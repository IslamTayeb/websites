I used to manually cluster my music into Red (hype), Yellow (happy), Purple (EDM), etc. depending on arbitrary moods and genres. Last semester, I wanted to automate it and see if there are better ways to cluster my music to sort my liked songs.

Spotify Wrapped dropped around then and, as usual, offered nothing beyond top-5 artists and genre percentages. So I looked into it.

I figured [Spotify's API](https://developer.spotify.com/documentation/web-api?id=0) would give me what I needed. I remember from an [older project](https://github.com/IslamTayeb/NLP-spotify) that their API had useful endpoints: `audio-features` (danceability, valence, energy) and `audio-analysis`. Turns out they deprecated both of them in late 2024.[^1] So I took this as an opportunity to brush up on some ML and data science skills.

P.S. This post's timing coincides with [Anna's Archive's Spotify scrape](https://annas-archive.li/blog/backing-up-spotify.html). It included the features and analyses of 99.9% of Spotify's library. This happened 3-4 days after I started this project. Had the leak dropped a week earlier, I wouldn't have built this, and I'd have missed the temporal analysis that made the project worthwhile.

* * *

## Index

* * *

## Embedding the Audio

My first instinct was to use existing music embedding models. If vision has *CLIP* and language has *BERT*, surely music has something similar.

I first tried [*MERT*](https://huggingface.co/m-a-p/MERT-v1-95M), a late-2024 music representation transformer that's (AFAIK) the state-of-the-art. It produced 768-dimension vectors, which I then PCA'd into 128-D vectors. I used KNN (N = 2-8), and clusters mixed mellow jazz with aggressive EDM. Once I switched to interpretable dimensions, the clusters became legible. I then tried [*Essentia's Discogs-EffNet*](https://essentia.upf.edu/models.html) embedding model (1,280-D) and [*CLAP-Music*](https://huggingface.co/laion/larger_clap_music) (512-D). Both scattered sonically similar tracks across 4+ clusters (i.e. was terrible).

So clearly, embedding then clustering immediately failed. I think that's because general-purpose embeddings are trained on everything from Beethoven to Beyoncé. My library, given my limited taste, occupies a tiny corner of that latent space. Differences between Earl Sweatshirt and Drake become lighter than noise.

I started thinking it'd be better to at least understand the dimensions one by one. So I'd pick the dimensions myself, then use classifiers to score every song on each one. Turns out this has a name, **supervised dimensionality reduction**, and I stumbled upon it out of necessity rather than "a blog told me to do so."

### Essentia Classifiers

*Essentia* doesn't just provide embeddings. It has dozens of pre-trained classifiers that output interpretable features: `mood_*`, `danceability`, `instrumentalness`, `genre_*`, and more.

**Danceability**

*Essentia*'s danceability measures rhythm regularity, not "would people dance to this." Drake averages 0.073, 59% *below* my library average of 0.178. The man who made *One Dance* scores lower than Marty Robbins. Basically it's measuring metronome-likeness, so the name is a lie.

### Genre Fusion

I also wanted to take into account how much fusion was in my music. *Essentia*'s genre classifier spits out probabilities across the 400 Discogs genres, so I took the entropy of that:

-   **Low entropy → pure genre.** Think Playboi Carti's ["New Tank"](https://open.spotify.com/track/4txKMpsSfZRV6durPuHVq0): obviously trap.
-   **High entropy → genre fusion.** Think ["Raksit Leila"](https://open.spotify.com/track/0paNldkxk0i10Vp8IzQb7J), which blends Arabic pop, electronic, and folk.

That gives me **19 audio dimensions** total.

## Embedding the Lyrics

Audio features alone aren't enough though. Two songs can sound similar but have completely different lyrical content that I'd like to take into account.

### Sentence Transformers Failed

I tried embedding lyrics with sentence transformers (*BGE-M3*, *E5-large*, *BERT*), but they just clustered by language, lumping all my Japanese songs together regardless of mood.

### GPT as an Annotator

I figured prompting GPT directly would be good enough. So instead of hunting for classifiers, I made a bunch of *GPT-5 mini* calls with structured prompts explaining the dimensions I wanted. Sue me.

### Instrumentalness Weighting

Here's where it got tricky: what do you do with instrumentals, or with EDM where the lyrics barely matter?

#### Problem 1: Zero isn't always neutral

My first attempt was to zero out lyric features for instrumentals, since an instrumental has no sad lyrics (`lyric_mood_sad = 0`). Funnily enough, that clustered my instrumentals with happy music, which also has low sadness. The culprit was bipolar features like valence, which run from negative [0] to positive [1], where zero means "negative" rather than "no lyrics." Their neutral point is 0.5, not 0.

| Feature Type | Neutral Value | Rationale |
| --- | --- | --- |
| Bipolar (valence, arousal) | 0.5 | Neutral, not negative |
| Presence (moods, explicit, narrative) | 0 | Absence is absence |

#### Problem 2: Instrumentalness is a spectrum

Tracks like [Fred Again's *leavemealone*](https://open.spotify.com/track/34vzTHRwW8Im0Rkim8IJGs?si=d9a7e4472cdb40cd) technically have lyrics, but (with all due respect to Keem) these are textural at best. The words don't carry the song the way a Kendrick verse would. When GPT classified these lyrics, it'd return real values (e.g. arousal 0.8, narrative 0.1), clustering it with lyrically similar pop instead of with other electronic music.

Basically, instrumentalness is a spectrum, not a switch. Another Fred Again track like [*adore u*](https://open.spotify.com/track/1rf4SX7dduNbrNnOmupLzi?si=530b812b0310431c) should have *some* lyric influence, just dampened proportionally.

So I weighted each lyric dimension by `(1 - instrumentalness)`, which pulls it toward its neutral value:

```python
# For bipolar features (neutral = 0.5):
weighted = 0.5 + (raw - 0.5) * (1 - instrumentalness)
# For presence features (neutral = 0):
weighted = raw * (1 - instrumentalness)
```

That fixed it. Fred Again's *leavemealone* stopped clustering with pop and landed with the rest of my electronic music.

That gives me **33 dimensions total**: 19 audio, 12 lyrics, 2 metadata. The next step: group them.

## Clustering

With 33 interpretable dimensions, I needed a clustering algorithm. I tried a few and empirically ran through the playlists generated by them, ending up with *HAC* (*k=5*), which dropped misplacement rate from ~20% to ~5%. Good enough: 90% of clusters matched my intuition on shuffle.

Do note that I (mostly) ignored things like silhouette scores (data wasn't well-separated enough) or elbow methods.

## Analysis

### The Clusters

<iframe src="https://islamtayeb.github.io/harmonia/export/visualizations/combined/index.html" width="100%" height="350px"></iframe>

*3D UMAP visualization with cluster colors*

After standardizing features, running HAC, and listening to a lot of my questionable music taste, I landed on 5 clusters.

- [<code class="hard-rap">Hard-Rap</code>](https://open.spotify.com/playlist/2r09O8jpBHFbsPFR9KtVBh) (59%): High-energy rap (trap, drill). Loud, profane, and confrontational. Main character energy.
- [<code class="narrative-rap">Narrative-Rap</code>](https://open.spotify.com/playlist/0YR44cIs9Frfp4V7g0eovT) (18%): Story-telling/introspective (lyrical rap, sad songs). Think Kendrick's Duckworth or Earl Sweatshirt.
- [<code class="jazz-fusion">Jazz-Fusion</code>](https://open.spotify.com/playlist/1Yd9WxdGakzTnwpooWP89m) (7%): Mostly instrumentals. Dominated by Japanese jazz fusion.
- [<code class="rhythm-game-edm">Rhythm-Game-EDM</code>](https://open.spotify.com/playlist/2UycjhM5qkU9EULPUpxMzi) (4%): EDM reminiscent of my osu! days (breakcore, dance).
- [<code class="mellow">Mellow</code>](https://open.spotify.com/playlist/67kgiiBpRUEqGHmzifMKVh) (12%): Sad, calm music. Similar in essence to introspective music but more on the sadness.

### Audio vs. Lyrics Covariance

I clustered my library using audio features, then separately with lyric features. The 2 clusterings barely agree. The Adjusted Rand Index between audio-only and lyric-only clusterings is 0.092, nearly indistinguishable from random chance. Was unexpected, since you'd guess that lyrically-sad songs would match with musically-sad songs.

<iframe src="https://islamtayeb.github.io/harmonia/export/visualizations/audio_vs_lyrics/contingency_matrix/index.html" width="100%" height="600px"></iframe>

*Audio cluster vs lyric cluster overlap*

### Temporal Analysis

Note: timestamps are only reliable post-July 2024.[^2]

<iframe width="100%" height="600px" src="https://islamtayeb.github.io/harmonia/export/visualizations/temporal/cluster_trends/index.html"></iframe>

*Cluster share of additions by quarter*

The overall mood profile stays fairly stable over time, but clear changes in my library corresponded to specific people and moments.

#### Summer 2024: Internship, California

At my internship, Connor kept putting me on Latin folk and jazz-adjacent stuff. Christian introduced me to Masayoshi Takanaka on our ride to Yosemite that summer, and I've been hooked on Japanese jazz fusion since. In my head though, all of it was just "work music."

In the cluster chart, you can see <code class="jazz-fusion">Jazz-Fusion</code> spawn, going from 0.8% of additions in Q2 to 14.7% in Q4.

#### Fall 2024: Blue Lock edits at 2am

Around fall 2024, my brother started sending me Blue Lock anime edits. I *really* liked "l'etoile d'afrique - #18" by VDYCD from one of them, and that sent me down a phonk and opium rabbit hole. Most of it landed in <code class="rhythm-game-edm">Rhythm-Game-EDM</code>, just with darker lyrics (when there were any).

#### Fall 2025: Fall break in the common room

Over fall break, a few friends and I ended up on a Spotify playlist of popular osu! beatmaps. That motivated me to revisit a lot of my old (<2021) music taste.

<code class="rhythm-game-edm">Rhythm-Game-EDM</code> went from 1.7% in Q2 to 9.1% in Q4. You can see `mood_party` and engagement spike around October because of it in the mood profile. I think it stuck because it already had a place in my head.

<iframe width="100%" height="600px" src="https://islamtayeb.github.io/harmonia/export/visualizations/temporal/mood_trends/index.html"></iframe>

*Cumulative mood profile over time*

## Afterword

*59%* of my library is <code class="hard-rap">Hard-Rap</code>.

But the more interesting findings were the phases I'd forgotten I was having. Remembering my summer days listening to Connor's Latin folk playlist in the office, the lock-in I had that fall break with friends, that March where I quit premed. My taste isn't some coherent aesthetic I curated. It's a messy mosaic of people and moments, and I was happy to reminisce while looking at the data.

From a data science perspective, this whole project was "vibey" in a way that made me uncomfortable at first. I didn't optimize silhouette scores or run formal ablations. If a cluster doesn't match my mental model, then it's fair to call it false.

We've come a long way from glazing 2010s Kanye. Alas, the data was never really the point. The people were.

[^1]: No official explanation besides [this](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api) blog post by Spotify, but the timing coincides with increased scrutiny over data access due to wrapper applications. Recently, Anna's Archive released a massive scrape of Spotify's internal data.

[^2]: Before July 4, 2024, I dumped songs into playlists, then mass-liked everything in one day. So pre-July timestamps are meaningless, but post-July they're real.
