## The Problem

You want to spawn 100+ coding agents concurrently (e.g. "research 100 papers, give me 1-page reports each"). Today you'd do this by spawning 100 Claude Code instances manually or writing a script that fires off API calls. There's no SDK designed for this. The inefficiencies compound: redundant system prompts, no shared KV cache, no request scheduling, no centralized orchestration.

## What Exists Today

### Orchestration Layer (spawning and managing agents)

**Agent Orchestrator (Composio, 6.4K stars)** — Closest to what you're imagining but focused on coding tasks on a single codebase, not batch research. Spawns parallel Claude Code/Codex/Aider agents in isolated git worktrees, each gets its own branch and PR. Agent-agnostic, runtime-agnostic (tmux/Docker). Dashboard for supervision. Handles CI failures and review comments automatically.

**Sculptor (Imbue, 146 stars)** — UI for running parallel Claude Code instances in Docker containers. Each agent gets an isolated container. Focused on parallel coding, not batch research/analysis.

**amux (93 stars)** — TUI for parallel coding agents. Lightweight tmux-based, workspace-first model with git worktrees. No scheduling or batching intelligence.

**OpenAI Codex Cloud** — "Work on many tasks in parallel" is literally their pitch. But it's a product, not an SDK. You can't self-host or customize the orchestration.

**OpenAI Batch API** — Async batch endpoint with 50% discount, results within 24 hours. Good for bulk completions but stateless: no tool use, no agent loops, no multi-turn. Just fire-and-forget prompt-to-completion.

### Inference Layer (making batched requests efficient)

**vLLM (77K stars)** — High-throughput serving with continuous batching, PagedAttention, automatic prefix caching. The standard for self-hosted LLM inference. Prefix caching reuses KV blocks when requests share a prefix (e.g. same system prompt across 100 agents).

**SGLang (26K stars)** — RadixAttention: token-level radix tree for prefix caching, more fine-grained than vLLM's block-level hashing. Better for multi-turn/branching conversations where prefixes diverge mid-sequence.

**LMCache** — KV cache extraction layer that sits between inference engines and storage. Enables cross-node KV sharing, hierarchical storage (GPU → CPU → disk → remote). Works with both vLLM and SGLang.

### Research Papers (the systems angle)

**TokenDance (Apr 2026, Peking/UT Austin)** — The most directly relevant paper. Observes that multi-agent systems have an "All-Gather" communication pattern: a scheduler collects all agent outputs and redistributes the combined context. This creates massive KV cache redundancy because every agent's prompt contains the same shared output blocks. Their solution: a KV Collector that deduplicates shared blocks in one collective step (cost paid once regardless of agent count), plus Diff-Aware Storage that encodes sibling caches as block-sparse diffs against a master copy (11-17x compression). Result: 2.7x more concurrent agents than vLLM with prefix caching, 17.5x less KV storage per agent.

**KVFlow (Jul 2025, UCSB/Amazon)** — Workflow-aware KV cache management. Instead of LRU eviction, it models the agent execution schedule as a graph and assigns "steps-to-execution" priority to each cached entry. Prefetches KV tensors from CPU to GPU for agents about to activate. 1.83x speedup for single workflows, 2.19x for concurrent workflows vs SGLang.

**Agent Memory Below the Prompt (Feb 2026)** — Persistent Q4-quantized KV cache for multi-agent inference on edge devices. Cross-session KV reuse without recomputation. Orthogonal to the batch problem but relevant for persistent agent state.

**LMCache (Oct 2025)** — The "glue" layer between inference engines and KV storage. Enables hierarchical caching across GPU/CPU/disk/network. Claimed 3x higher throughput for long-context workloads.

## The Gap (Your Opportunity)

Nobody has built an SDK that:

1.  Takes a batch of N tasks (e.g. "read these 100 papers")
2.  Spawns N agents with a shared system prompt + per-agent unique context
3.  Routes requests through a serving layer that exploits prefix sharing (the system prompt is identical across all N agents, so the KV cache for it is computed once)
4.  Schedules multi-turn agent loops (tool calls, file reads, web searches) with batching-aware request scheduling (group requests from agents that are at the same point in their workflow)
5.  Returns structured results

The orchestration layer (Agent Orchestrator, amux) doesn't think about inference efficiency. The inference layer (vLLM, SGLang) doesn't think about agent orchestration. TokenDance and KVFlow show the research opportunity at the intersection, but they're papers, not products.

**Concrete optimizations for 100+ concurrent agents:**

-   Shared system prompt prefix: compute KV cache once, share across all agents (prefix caching)
-   Grouped tool calls: if 80 agents all need to read a file, batch those reads
-   Staggered scheduling: don't fire all 100 first requests simultaneously, stagger to maximize continuous batching efficiency
-   Diff-aware context: after round 1, agent contexts diverge but share structure. Store diffs, not full copies (TokenDance approach)
-   Priority queuing: agents closer to completion get priority over agents in early exploration
-   Result streaming: return completed agent results as they finish, don't wait for all 100

**The self-hosted angle is key.** If you're running vLLM/SGLang locally, you control the scheduler. You can co-design the orchestration layer and the inference layer. The commercial API approach (OpenAI Batch API) can't do this because you don't control the serving infrastructure.

## Related Reading

-   TokenDance: arxiv.org/abs/2604.03143
-   KVFlow: arxiv.org/abs/2507.07400
-   LMCache: arxiv.org/abs/2510.09665
-   vLLM prefix caching docs: docs.vllm.ai/en/stable/design/prefix\_caching
-   Agent Orchestrator: github.com/ComposioHQ/agent-orchestrator
