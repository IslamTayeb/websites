# Multi-Agent Inter-Communication for Task Decomposition: Research Overview

Linked to: world-breaking-ideas.md

## The Problem

You have a complex task (e.g. extract all reactions from a research paper). Instead of one monolithic agent session, decompose it into specialized sub-agents that communicate: one parses figures, one reads methods sections, one resolves chemical names, one assembles the final structured output. Each agent has a focused context and can work in parallel, then share findings.

## Current Landscape

### Frameworks (general-purpose multi-agent)

<table><thead><tr><th>Project</th><th>Stars</th><th>Approach</th><th>Inter-agent communication</th></tr></thead><tbody><tr><td>MetaGPT</td><td>67K</td><td>Role-based (PM, architect, engineer). Agents publish to a shared message pool, subscribe by role. SOPs define handoff order.</td><td>Shared message pool + subscription</td></tr><tr><td>AutoGen/MAF</td><td>57K</td><td>Conversational agents in group chats or nested chats. Now maintenance mode, succeeded by Microsoft Agent Framework.</td><td>Group chat, nested chat, handoffs</td></tr><tr><td>CrewAI</td><td>50K</td><td>Role-based crews with defined tasks. Sequential or hierarchical process. Agents share a knowledge base.</td><td>Task delegation + shared memory</td></tr><tr><td>LangGraph</td><td>30K</td><td>Graph-based: agents are nodes, edges define communication paths. Supports cycles, branching, human-in-loop.</td><td>Explicit graph edges + shared state</td></tr><tr><td>ChatDev</td><td>33K</td><td>Software company simulation. Roles (CEO, CTO, programmer, tester) in chat chains. Waterfall-ish.</td><td>Sequential chat chains</td></tr><tr><td>CAMEL</td><td>17K</td><td>Inception prompting: two agents role-play (instructor/assistant) to solve tasks through conversation.</td><td>Direct pair dialogue</td></tr></tbody></table>

### Coding-Agent Specific

<table><thead><tr><th>Project</th><th>What it does</th><th>Communication model</th></tr></thead><tbody><tr><td>Claude Code Task tool</td><td>Built-in sub-agent spawner. Main agent creates sub-tasks, each runs in isolated context, returns result. No inter-sub-agent communication.</td><td>Parent-child only, no sibling talk</td></tr><tr><td>Agent Orchestrator (Composio)</td><td>Spawns parallel Claude Code/Codex in git worktrees. Each agent works independently on separate branches.</td><td>None. Isolated. Merge via git.</td></tr><tr><td>agent-com</td><td>Push-based messaging between Claude Code sessions via webhooks + DB. Star topology through orchestrator. HMAC auth, loop detection.</td><td>Hub-and-spoke via central DB</td></tr><tr><td>OpenClaw sub-agents</td><td>Spawn sub-sessions that auto-announce completion. No direct inter-agent messaging.</td><td>Parent-child completion events</td></tr></tbody></table>

### Research Papers

**Multi-Agent Collaboration Mechanisms Survey (Jan 2025)** — Taxonomizes collaboration into: cooperative (shared goal), competitive (adversarial), and mixed. Communication patterns: direct messaging, blackboard/shared memory, voting/debate. Key finding: structured communication protocols (who talks to whom, when) matter more than agent count.

**LLM Multi-Agent Systems: Challenges (Feb 2024, updated May 2025)** — Identifies core challenges: global planning (decomposing work), agent allocation (who does what), communication overhead (more agents = more tokens spent talking), and fault tolerance (one bad agent poisons the group).

**Multi-Agent Collaboration via Evolving Orchestration (Oct 2025)** — "Puppeteer" paradigm: centralized orchestrator dynamically directs specialist agents based on evolving task state. Outperforms static role assignment because the orchestrator can re-allocate work as the task unfolds.

**KARMA: Multi-Agent KG Enrichment (NeurIPS 2025)** — Multiple agents parse articles into knowledge graph entries. Relevant because it's close to your reaction extraction use case: specialized agents for different extraction subtasks, results merged into structured output.

## Key Architectural Patterns

**1\. Hub-and-spoke (orchestrator model)** One coordinator agent decomposes the task, assigns sub-tasks, collects results. Sub-agents don't talk to each other. Simple, debuggable, but coordinator is a bottleneck and single point of failure. (Claude Code Task tool, Agent Orchestrator, agent-com)

**2\. Shared blackboard** All agents read/write to a shared state object. No direct messaging. Agents poll for relevant updates. Good for loosely coupled tasks. (MetaGPT's message pool, CrewAI's shared knowledge)

**3\. Graph-based routing** Communication paths explicitly defined as a DAG or cyclic graph. Agent A outputs to Agent B and C, Agent C outputs to Agent D, etc. Most flexible but hardest to design. (LangGraph)

**4\. Debate/consensus** Multiple agents independently solve the same problem, then debate or vote on the best answer. Good for verification, bad for efficiency. (CAMEL, AutoGen group chat)

## The Gap (For Your Use Case)

For "extract reactions from a paper," the ideal system would be:

1.  Orchestrator decomposes paper into regions (figures, methods, SI)
2.  Specialist agents process in parallel: figure agent (MolScribe), methods agent (text extraction), SI agent (supplementary tables)
3.  Inter-agent queries: methods agent asks figure agent "what's the structure in Figure 2a?" instead of re-processing the figure
4.  Assembler agent merges all findings into structured reaction entries

Nobody has built this for coding agents specifically with the inter-agent query pattern. The closest is agent-com (push messaging between Claude Code sessions) but it's unreleased. Claude Code's Task tool is parent-child only, no sibling communication. MetaGPT/CrewAI could do it but they're general-purpose frameworks, not optimized for coding agent harnesses.

The systems opportunity: inter-agent communication is currently all at the application layer (JSON messages, shared files). If you co-designed it with the inference layer (shared KV cache prefixes from the batch-agent-sdk idea), sibling agents could share context without re-encoding it. An agent asking another agent "what did you find?" could literally reference the other agent's KV cache instead of sending a text summary.

## Connects To

-   — Inference optimization for spawning many agents
-   mem-mould — Context management within a single agent session
