Over last semester, I wanted to see whether I could formalize my music preferences numerically, whether I could model the distinctions I *felt* but couldn't articulate, and use them to automatically sort my liked songs into playlists. Could I build something that surfaces patterns in my library I sense but can't describe?

Spotify Wrapped dropped around then and, as usual, offered nothing beyond top-5 artists and genre percentages. So I looked into it.

I figured [Spotify's API](https://developer.spotify.com/documentation/web-api?id=0) would give me what I needed. I remember from an [older project](https://github.com/IslamTayeb/NLP-spotify) that their API had useful endpoints: `audio-features` (danceability, valence, energy) and `audio-analysis`. Turns out they deprecated both of them in late 2024.[^1] So I took this as an opportunity to brush up on some ML and data science skills.

P.S. This post's timing coincides with [Anna's Archive's Spotify scrape](https://annas-archive.li/blog/backing-up-spotify.html). It included the features and analyses of 99.9% of Spotify's library. This happened 3-4 days after I started this project. Had the leak dropped a week earlier, I wouldn't have built this, and I'd have missed the temporal analysis that made the project worthwhile.

* * *

## Index

* * *

## Embedding the Audio

My first instinct was to use existing music embedding models. If vision has *CLIP* and language has *BERT*, surely music has something similar.

I first tried [*MERT*](https://huggingface.co/m-a-p/MERT-v1-95M), a late-2024 music representation transformer that's (AFAIK) the state-of-the-art. It produced 768-dimension vectors, which I then PCA'd into 128-D vectors. I used KNN (N = 2-8), and clusters mixed mellow jazz with aggressive EDM. Once I switched to interpretable dimensions, the clusters became legible. I then tried [*Essentia's Discogs-EffNet*](https://essentia.upf.edu/models.html) embedding model (1,280-D) and [*CLAP-Music*](https://huggingface.co/laion/larger_clap_music) (512-D). Both scattered sonically similar tracks across 4+ clusters (i.e. was terrible).

The failure of embedding → clustering made sense: embeddings optimize for their training objective. *MERT* for masked prediction, *EffNet* for Discogs (genre) tags. The geometry of the space encodes *their* goals, not mine. And general-purpose embeddings are trained on everything from Beethoven to Beyoncé. My library, given my limited taste, occupies a tiny corner of that space, where the distinctions I care about (sad rap vs. narrative rap, warm jazz vs. cold EDM) are smaller than the noise floor.

I started thinking it'd be better to at least understand the dimensions one by one. Instead of letting the embedding define the space, I'd define the space myself and project songs onto it. This approach is called **supervised dimensionality reduction**: you choose the dimensions that matter to you, then train or use classifiers to score data along those dimensions. I stumbled upon this out of necessity rather than "a blog told me to do so."

### Essentia Classifiers

*Essentia* doesn't just provide embeddings. It has dozens of pre-trained classifiers that output interpretable features: `mood_*`, `danceability`, `instrumentalness`, `genre_*`, and more.

**Danceability**

*Essentia*'s danceability measures rhythm regularity, not "would people dance to this." Drake averages 0.073, 59% *below* my library average of 0.178. The man who made *One Dance* scores lower than Marty Robbins. The name is misleading: it's really measuring metronome-likeness.

### Genre Fusion

I differentiate my music as genre soup (jazz fusion, experimental hip hop) vs. one-trick ponies (pure trap, straightforward pop). I wanted to capture that.

*Essentia*'s genre classifier outputs probabilities across 400 Discogs genres. I computed the entropy of this distribution:

-   **Low entropy → pure genre.** The model is confident the song belongs to one category. Think Playboi Carti's "New Tank": obviously trap.
-   **High entropy → genre fusion.** Probability is spread across many categories. Think a track like "Raksit Leila" that blends Arabic pop, electronic, and folk.

That gives me **19 audio dimensions** total.

## Embedding the Lyrics

Audio features alone weren't enough. Two songs can sound similar but have completely different lyrical content. Given that 60%+ of my library is rap, lyric features needed significant weight.

### Sentence Transformers Failed

I tried embedding lyrics with sentence transformers (*BGE-M3*, *E5-large*, *BERT*). They clustered by language, not emotion. Japanese songs grouped together regardless of mood. The embedding space captures linguistic meaning, not affective meaning.

### GPT as an Annotator

I figured prompting GPT directly would be good enough: LLMs have been trained on so much text about emotions, sentiment, and meaning that they've essentially internalized how humans label these things. So instead of hunting for classifiers, I made a bunch of *GPT-5 mini* calls with structured prompts explaining the dimensions I wanted. Sue me.

### Instrumentalness Weighting

Here's where it got tricky. What do you do with instrumental tracks? How about tracks where lyrics have very little value (e.g. in EDM)?

#### Problem 1: Zero isn't always neutral

My first attempt: zero out lyric features for instrumentals. An instrumental has no sad lyrics, so `lyric_mood_sad = 0`. But this caused instrumentals to cluster with *happy* music, because happy songs also have low sadness.

The issue is that some features are bipolar (valence: negative ↔ positive) while others are presence-based (sadness: absent ↔ present). For bipolar features, zero means "negative," not "absent." An instrumental isn't lyrically negative; it's lyrically *absent*. The neutral point is 0.5, not 0.

| Feature Type | Neutral Value | Rationale |
| --- | --- | --- |
| Bipolar (valence, arousal) | 0.5 | Neutral, not negative |
| Presence (moods, explicit, narrative) | 0 | Absence is absence |

#### Problem 2: Instrumentalness is a spectrum

Tracks like [Fred Again's *leavemealone*](https://open.spotify.com/track/34vzTHRwW8Im0Rkim8IJGs?si=d9a7e4472cdb40cd) technically have lyrics, but (with all due respect to Keem) these are textural at best, not semantic. The words don't carry emotional weight the way Kendrick's verses do. When GPT classified these lyrics, it'd return real values (arousal 0.8, narrative 0.1), and suddenly my EDM was clustering with lyrically similar pop instead of with other electronic music.

Basically, instrumentalness is a spectrum, not a switch. Another Fred Again track like [*adore u*](https://open.spotify.com/track/1rf4SX7dduNbrNnOmupLzi?si=530b812b0310431c) should have *some* lyric influence, just dampened proportionally.

The fix: weight each lyric dimension by `(1 - instrumentalness)`, pulling toward the appropriate neutral value:

```python
# For bipolar features (neutral = 0.5):
weighted = 0.5 + (raw - 0.5) * (1 - instrumentalness)
# For presence features (neutral = 0):
weighted = raw * (1 - instrumentalness)
```

This fixed the scattering problem. After this change, Fred Again's *leavemealone* stopped clustering with lyrically similar pop tracks and landed with other electronic music where it belonged.

That gives me **33 dimensions total**: 19 audio, 12 lyrics, 2 metadata. The next step: group them.

## Clustering

With 33 interpretable dimensions, I needed a clustering algorithm. I tried 3. Do note that I (mostly) ignored things like silhouette scores (data wasn't well-separated enough) or elbow methods.

#### HDBSCAN

*HDBSCAN* was my first choice. It had worked well for me on biological data before: density-based, no need to specify k, finds arbitrary shapes. On music, HDBSCAN labeled 90% of tracks as noise.

It assumes clusters are "regions of the data that are denser than the surrounding space"; the mental model is "trying to separate the islands from the sea." But music taste barely has any density gaps. Chill pop gradates into bedroom pop gradates into lo-fi. There are no valleys to cut.

#### KNN

*KNN*\-based clustering (building a neighbor graph, then running community detection) was better. It captures local structure. A song might neighbor five chill tracks and one jazz track, and that single edge pulls it wrong. I found ~20% of tracks felt misplaced from randomly shuffling.

#### Hierarchical Agglomerative Clustering (HAC)

*HAC* worked great. It builds a tree: every song starts as its own cluster, and the algorithm repeatedly merges the two most similar. You cut wherever you want k clusters. HAC dropped misplacement rate from ~20% to ~5%.

**Final approach:** *HAC* for main clustering (*k=5*). Good enough: 90% of clusters matched my intuition on shuffle.

## Analysis

### The Clusters

<iframe src="https://islamtayeb.github.io/harmonia/export/visualizations/combined/index.html" width="100%" height="350px"></iframe>

*3D UMAP visualization with cluster colors*

After standardizing features, running HAC, and listening to a lot of my questionable music taste, I landed on 5 clusters.

#### <code class="hard-rap">Hard-Rap</code> (Cluster 0, [Playlist](https://open.spotify.com/playlist/2r09O8jpBHFbsPFR9KtVBh)) — 733 songs, 58.5%

High-energy rap dominated by trap and cloud rap. Loud, profane, and confrontational. Main character energy.

#### <code class="narrative-rap">Narrative-Rap</code> (Cluster 1, [Playlist](https://open.spotify.com/playlist/0YR44cIs9Frfp4V7g0eovT)) — 226 songs, 18.0%

Songs that tell stories. Lyrically dense, emotionally heavy. Kendrick's Duckworth type stories, BROCKHAMPTON's confessionals, Earl's introspection. Music you have to whip out the Genius article for.

#### <code class="jazz-fusion">Jazz-Fusion</code> (Cluster 2, [Playlist](https://open.spotify.com/playlist/1Yd9WxdGakzTnwpooWP89m)) — 91 songs, 7.3%

Instrumental, relaxed, head-nodding music. Soundtracks, ambient, downtempo, Japanese jazz fusion.

#### <code class="rhythm-game-edm">Rhythm-Game-EDM</code> (Cluster 3, [Playlist](https://open.spotify.com/playlist/2UycjhM5qkU9EULPUpxMzi)) — 47 songs, 3.8%

EDM, osu! music. Breakcore, hardcore, chiptune. 180+ BPM, complex time signatures, very electronic.

#### <code class="mellow">Mellow</code> (Cluster 4, [Playlist](https://open.spotify.com/playlist/67kgiiBpRUEqGHmzifMKVh)) — 156 songs, 12.5%

Soft, reflective, acoustic-leaning. Late night drives. Rain on windows. The playlist you put on when you're in your feelings but not trying to wallow.

### Audio vs. Lyrics Covariance

When I cluster my library using only audio features, then separately cluster using only lyric features, the two clusterings barely agree. The Adjusted Rand Index between audio-only and lyric-only clusterings is 0.092, nearly indistinguishable from random chance (0.0).

<iframe src="https://islamtayeb.github.io/harmonia/export/visualizations/audio_vs_lyrics/contingency_matrix/index.html" width="100%" height="600px"></iframe>

*Audio cluster vs lyric cluster overlap*

This might sound like a problem at first, but it's actually the point. If audio and lyrics produced the same clusters, one of them would be redundant. The low agreement means they capture different information.

### Temporal Analysis

Note: timestamps are only reliable post-July 2024.[^2]

<iframe width="100%" height="600px" src="https://islamtayeb.github.io/harmonia/export/visualizations/temporal/cluster_trends/index.html"></iframe>

*Cluster share of additions by quarter*

The overall mood profile stays fairly stable over time, but clear changes in my library corresponded to specific people and moments.

#### Summer 2024: Internship, California

At my internship, Connor kept putting me on Latin folk and jazz-adjacent stuff. Christian introduced me to Masayoshi Takanaka on our ride to Yosemite that summer, and I've been hooked on Japanese jazz fusion since. In my head, all of it was just "work music."

In the cluster chart, you can see <code class="jazz-fusion">Jazz-Fusion</code> spawn. It went from 0.83% of additions in Q2 to 8.63% in Q3, then 14.70% in Q4.

#### Fall 2024: Blue Lock edits at 2am

Around fall 2024, my brother started sending me Blue Lock anime edits. I *really* liked "l'etoile d'afrique - #18" by VDYCD from one of them, and that sent me down a phonk and opium rabbit hole. The aggressive, high-energy production fit right into the <code class="rhythm-game-edm">Rhythm-Game-EDM</code> cluster, but the lyrical content (when there was any) was darker, more confrontational.

#### Fall 2025: Fall break in the common room

Over fall break, a few friends and I ended up on a Spotify playlist of popular osu! beatmaps. I thought it'd be a one-night nostalgia trip.

<code class="rhythm-game-edm">Rhythm-Game-EDM</code> went from 1.65% in Q2 to 9.100% in Q4. You can see `mood_party` and engagement spike around October because of it in the mood profile. But the real reason it stuck is that it already had a place in my head. That weekend just reminded me it was there.

<iframe width="100%" height="600px" src="https://islamtayeb.github.io/harmonia/export/visualizations/temporal/mood_trends/index.html"></iframe>

*Cumulative mood profile over time*

Connor gave me Latin folk. Christian gave me Takanaka on the aux. My brother's Blue Lock edits at 2am sent me down the phonk hole. Claire and that night in the Cube reopened a dormant folder. Each person carved out a slot, and the slots stuck.

## Afterword

*59%* of my library is <code class="hard-rap">Hard-Rap</code>.

But the more interesting findings were the phases I'd forgotten I was having. Remembering my summer days listening to Connor's Latin folk playlist in the office, the lock-in I had that fall break with friends, that March where I quit premed. My taste isn't some coherent aesthetic I curated. It's a messy mosaic of people and moments, and I was happy to reminisce while looking at the data.

From a data science perspective, this whole project was "vibey" in a way that made me uncomfortable at first. I didn't optimize silhouette scores or run formal ablations. If a cluster doesn't match my mental model, then it's fair to call it false.

We've come a long way from glazing 2010s Kanye. Alas, the data was never really the point. The people were.

[^1]: No official explanation besides [this](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api) blog post by Spotify, but the timing coincides with increased scrutiny over data access due to wrapper applications. Recently, Anna's Archive released a massive scrape of Spotify's internal data, which makes this project potentially useful beyond self-analysis: you could use these 33 interpretable dimensions to study recommendation biases or build more transparent suggestion systems.

[^2]: Before July 4, 2024, I dumped songs into playlists, then mass-liked everything in one day. So pre-July timestamps are meaningless. Post-July, they're real.
