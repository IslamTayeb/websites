> tl;dr Context should not be one flat transcript. It should be a structured object of messages, where each message can be `full` / `summary` / `hidden`. The agent can tune that detail-level per message per prompt, spending tokens only where needed.

Since Sonnet 3.7 came out last summer, I've barely hand-written code. Coding agents are getting insanely good, and I (like many others) keep trusting these models to do more and more.

With that said, since we’re not writing code line-by-line, our intent becomes more abstract, and we stop critically thinking about the code itself. The chats with Claude show your intent more than the code diffs. However, they can be millions of tokens large, and most intent rarely needs the entire chat loaded into context. So, I started toying with the idea of embedding compression and context infrastructure.

Most of the interesting work in the space happens through [alternative training methods](https://doi.org/10.48550/arXiv.2502.15957) that make embeddings reversibly compressible, but I wanted to see how far a pure harness-engineering approach could go.

---
## Index

---

## Background

Agents are constrained in how much they can keep in-memory by their context windows, usually within 400K-1M tokens. Once the context window gets past 50%, model behavior degrades because old, irrelevant, stale, or noisy information remains in the prompt. This is called [context rot](https://www.trychroma.com/research/context-rot). There's 2 main ways for context to rot in coding agents: (1) irrelevant chats and information are included in the prompt, or (2) unnecessarily long, sparse messages.

![On Agent Memory Fidelity (Decant) 1](https://raw.githubusercontent.com/islamtayeb/obsidian-files/main/On Agent Memory Fidelity (Decant)-1.png)
*The three framings side by side. Cleanup fires only at the compaction threshold in (1) but every turn in (2) and (3). Only (3) is reversible.*

### Context as a constant

Agentic coding tools periodically "compact" chat history when you're about to fill up your context window. However, if a prompt requires only 1 message out of a chat with 5 messages, you’ll still pay for those 5 messages until you hit that compaction point. On top of that, during compaction, details can be lost without any reversible way of getting those full messages back.

### Context as a string variable

The agent can now treat context as a variable to edit whenever it deems fit. Old work can be cut if unnecessary. So, we can make an agent that can read, grep, and bash over its own context to edit it, similar to a simplified [recursive language model](https://alexzhang13.github.io/blog/2025/rlm/#:~:text=We%20propose%20Recursive%20Language%20Models%2C%20or,the%20user%E2%80%99s%20prompt%20in%20a%20variable) (RLM). We'll call this an RGB-agent[^1]. However, it still has to re-ingest a large portion of the context to know what to edit

### Context as message objects

Rather than treating context as a long string, we can view it as a structured object of `Message` objects. Each `Message` contains data (`timeSent`, `content`, etc.). Adding a `compression` field to `Message` could theoretically let an agent consider a summary (or drop) of obviously-irrelevant context without having to re-ingest the full session.

Obviously, there is no `compression` parameter on GPT or Claude, so we'll settle for discrete `fidelity`[^5] settings, namely `full` / `summary` / `hidden`.

This is how conversations work for humans. I do not remember every detail of a conversation (even mid-conversation). Some key parts stay vivid, some collapse into a gist, and tangents might disappear.

Agent sessions should have the same *adaptive forgetting*. Where it differs from humans: when detail matters again, the agent should be able to fetch the message in full.

---

## Decant

Decant allows agents to treat context as a collection of message objects grouped into topics, with knobs to adjust compression. The agent decides how much of each topic or message should stay in the next prompt.

There are two control layers:

1. `Topic`: multiple messages that describe the same thread of work. A topic can be rendered as `full` / `summary` / `hidden`.
2. `Message`: the building block of a topic. A single message can `inherit` the topic setting, or force itself back to `full` / `summary` / `hidden`.

The agent does not have to reread the whole transcript. It starts from the topic map, lowers the `fidelity` of stale topics, looks at message summaries, then fetches exact messages later if the summary is not enough.

To be concrete, Decant's context map looks roughly like this:

```python
class Topic:
    topic_id: str
    summary: str                # stand-in when the topic renders cheaply
    messages: list[Message]     # lets exact messages be reopened later
    token_estimate: int         # flags big topics before they eat the prompt
    fidelity: "full" | "summary" | "hidden"

class Message:
    parts: list[Part]           # raw message data (text, reasoning, tools)
    topic_id: Optional[str] = None
    summary: str
    token_estimate: int
    fidelity: "inherit" | "full" | "summary" | "hidden"
```

The important additions are `fidelity`, `topicID`, and `summary`: what gets rendered, where the message belongs, and what replaces the full text when Decant needs a cheaper view.

The raw message data still exists, making it reversibly compressible. The prompt just gets a cheaper view by default and could at any moment use a tool call `message_detail` to "zoom in" to a message when needed.

### Fidelity Engine

Decant annotates the conversation as it happens. On each assistant turn, it asks the model to return the normal answer plus a hidden `<annotation>` tag for the user's latest prompt and the message output, something like:

```json
// ...Actual message...
// <annotation>
{
    "topic": "stable snake_case topic label for this assistant response",
    "is_new_topic": "boolean: whether this response starts a new topic",
    "message_summary": "summary of this assistant message only",
    "placeholder": "short 5-10 word stub for the topic as description",
    "key_facts": [
	    "facts or decisions worth preserving through compression"
    ]
}
// </annotation>
```

Decant strips that annotation from the visible chat and stores it next to the session.

That gives the next prompt a menu of renderings. Recent work can stay `full`. Finished work can become message summaries. Distant work can become topic summaries. Old dead ends can become placeholders or disappear.

The annotation is usually on the order of 300-500 output tokens. You're accepting to pay a consistent, small "tax" to allow the agent the ability to bookkeep and visualize the chat. The agent can call `view_context` and `set_fidelity` to change the map before the next turn.

During OpenCode compaction, Decant also rewrites the compaction prompt so the summarizer respects those annotations instead of flattening every old turn equally. It can use `set_fidelity` to hide or shrink unimportant context.

### Updated Git Blame

As agents write more code, they take care of edge cases and implement specifications without the user noticing. However, knowing *why* a piece of code was written in a large codebase with 100s of engineers is important. The user's intention is just as important as the code output, especially when the code isn’t optimized for human readability.

Here is one possible workflow with a `blame_lookup()` tool call that I’d like to explore:

1. Agent runs tool call over a line reference
2. Run git blame on the line, get commit hash
3. Check Agent Session <> Commit mapping, get session ID
4. Spawn sub-agent on session with original question about intent + topics in the session
5. View message summaries of selected topics, zoom into specific messages as necessary

![On Agent Memory Fidelity (Decant) 2](https://raw.githubusercontent.com/islamtayeb/obsidian-files/main/On Agent Memory Fidelity (Decant)-2.png)
*git blame to the commit, the commit to the session that produced it, then a sub-agent recovers why the line exists and cites the message it came from.*

Now you've allowed agents to make use of other agents' transcripts, and created an efficient way for them to search for what they need with the fidelity engine. Pretty cool.

Specifically for the "Agent Session <> Commit mapping", Decant checks if you have git-ai installed to see if there's an existing mapping. It also keeps a hidden project-local backup.

### User Control

Decant exposes the context map to the dev for transparency and manual control. You can see what the model is likely to read, how large each topic is, and what has been collapsed or hidden.

The sidebar and <kbd>/context</kbd> show the conversation grouped by topic. Each topic has a token estimate and a `fidelity` setting. From <kbd>/context</kbd>, you can set a topic to `full` / `summary` / `hidden`. You can also override individual messages' `fidelity`.

<kbd>/blame</kbd> is a manual trigger over the aforementioned `blame_lookup()` tool call. You could enter a line reference, or ask a natural-language question about past chats. Decant runs `blame_lookup()` as we discussed in the last section, finds the relevant prior session, and answers why a line is present given past conversations about it.

## Evaluation

So far, we've been talking about making agents able to reversibly remove old context. I wanted to see if that shape shows up in numbers at all, so I made three evals around the routes I care about:

* Old facts leaving the prompt, then coming back when asked for
* Unrelated future work piling up after the old facts are no longer current
* Code pointing back to the chat/session that explains why it exists

The tables compare three ways of handling old context:

| Method             | What it does                                                                            |
| :----------------- | :-------------------------------------------------------------------------------------- |
| Default compaction | Carries a compacted summary of the old transcript. Default behavior of OpenCode.        |
| RGB-agent          | Keeps old chat outside the prompt, then uses read, grep, and bash before answering.[^2] |
| Decant             | Keeps old detail outside the prompt, then opens exact messages only when needed.        |

### Selective Memory Under Future Work

Can the old facts leave the prompt and still be recovered later?

I started with 8 old topics, then asked 4 exact recall questions and 48 unrelated current-work questions. I ran the RGB-agent version three times with openai/gpt-5.5; default and Decant are the saved blog runs for the same shape.

Default compaction recovered 3 of 12 old facts. RGB-agent and Decant recovered all 12. RGB-agent also stopped carrying old memory into current-work prompts. Decant was still cheaper because its lookup opens narrower evidence than raw transcript search.

| Condition          | Runs Passed | Old-Fact Recall | Current Work | Avg Query Tokens | Avg Total Cost[^3] |
| :----------------- | ----------: | --------------: | -----------: | ---------------: | -----------------: |
| Default compaction |         0/3 |            3/12 |      144/144 |             320K |          $0.79 (–) |
| RGB-agent          |         3/3 |           12/12 |      144/144 |             305K |       $0.80 (+1%) |
| Decant             |         3/3 |           12/12 |      144/144 |             277K |       $0.62 (-22%) |

### Fanout

We keep the old-memory demand fixed at 4 recall questions, then grow unrelated future work from 24 to 96 turns.

RGB-agent keeps old memory out of current-work prompts, but recall turns still search the raw transcript, which seems to help as we increase turns slightly. Decant uses fewer query tokens because lookup returns a smaller old-memory slice though, gives a better "birds-eye view" of the context.

| Condition | 24 Turns | 48 Turns | 96 Turns |
| :--- | ---: | ---: | ---: |
| RGB-agent | $2.83 | $3.10 | $3.39 |
| Decant | $1.52 (-46%) | $1.74 (-44%) | $2.36 (-30%) |

### Updated Git Blame Lookup

This one checks the code-to-chat route from the blame section above. The question starts from a line reference, and the agent has to route back to the session/message that explains why the line exists.

```text
line reference -> git blame commit -> agent session -> topic/message -> rationale
```

A post-hoc GPT-5.5 judge scored the five standard blame answers from 0 to 1.[^4] For default, this table assumes the full old fixture context is charged on each question, as it would normally. Obviously, compaction would take place in "chunks" of 1M tokens if the chat was >1M tokens long.

| Condition          | Judge Score | Avg Query Tokens | Avg Total Cost[^3] |
| :----------------- | ----------: | ---------------: | -----------------: |
| Default compaction |        0.93 |             190K |          $0.29 (–) |
| RGB-agent          |        0.91 |              53K |       $0.10 (-65%) |
| Decant             |        0.93 |              44K |       $0.05 (-83%) |

## Limitations

None of these evals show Decant makes agents better programmers. I'm frankly too ~~lazy~~ busy to make that benchmark right now.

What I test is specifically can old context get cheaper without becoming unrecoverable? Can lookup stay targeted as unrelated future work piles up? Can a code line route back to the chat evidence behind it?

The blame eval is especially controlled. The past chats are Codex-generated fixtures, the repos are tiny, and the commits are seeded. This is not evidence that Decant handles a messy real codebase with 100s of engineers yet.

Also, the models are not trained for either side of this comparison. They are not trained to be recursive-language-model-style RGB-agents that edit their own working context. They are also not trained to use Decant's fidelity controls as a native memory system. I would not be shocked if a better-trained RGB-agent turns out to be the objective answer.

## Afterword

The evals are enough to make me think the infra gains are real, and the memory routes work when the evidence exists. Testing how this holds up in actual production environments with big teams would be pretty cool.

Also, the discrete `full` / `summary` / `hidden` knobs are placeholders for a continuous and learned `compression` field. [R3Mem](https://doi.org/10.48550/arXiv.2502.15957) trains embeddings to be reversibly compressible.

Alas, I've enjoyed thinking about agents for the last couple of months. I've been thinking a lot about "compilers" for different fields and how transformers fundamentally work to enable funny improvements like [copy-pasting the prompt](https://arxiv.org/abs/2512.14982) and [asking for reasoning before score](https://arxiv.org/abs/2408.02442). Big things coming!

P.S. Been revisiting the Bleach soundtrack, some real [gems](https://open.spotify.com/track/3EpPf1hMLF0jMoeuOsBV9f) in there. Also discovered there's a Raising Cane's 15~ minutes from Duke, which I've been frequenting.

---

[^1]: Credit to [Alexis](https://blog.alexisfox.dev/arcagi3) for coining the term

[^2]: In these evals, RGB-agent means the old chat stays outside the prompt, each question gets an editable working context, and the answer turn can use read, grep, and bash against that context before replying.

[^3]: Estimated cost uses a fixed GPT-5.5 standard price model as of 2026-05-17: `input_tokens * $5/M + cache_read_tokens * $0.50/M + (output_tokens + reasoning_tokens) * $30/M`. Tool/runtime costs are not included. For non-GPT runs, treat this as a normalized estimate, not the provider bill.

[^4]: Judge scores are post-hoc semantic scores over saved artifacts, not the original benchmark pass/fail bit. I used openai/gpt-5.5 as the judge. For blame lookup, the judge saw the question, expected rationale facts, forbidden distractor terms, final answer, and expected session/message citation.

[^5]: How much of a message actually reaches the prompt. Similar to image fidelity: high fidelity, high resolution (and vice versa).
