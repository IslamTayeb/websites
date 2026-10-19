Date: 2026-05-05 Context: Benchmark idea from Islam. Is it better for an agent to interpret its decision before, during, or after the fact. Motivated by using opencode SDK to extract chemical reactions from PDFs and wanting to know why extractions fail.

## TL;DR

The exact three-way framing (pre-hoc vs ad-hoc vs post-hoc as a timing axis for agent self-interpretation) does not appear to have a dedicated benchmark yet. The individual pieces are well studied, but mostly as binary debates (is CoT faithful or post-hoc). A structured benchmark that forces the same agent to explain the same decision at three timing points and then measures faithfulness, downstream accuracy, and error-diagnosis utility is a real gap. It is worth pursuing, especially if grounded in a concrete domain like chemical reaction extraction.

## What already exists

1.  Project Ariadne (arXiv 2601.02314, Jan 2026). Structural causal framework for auditing faithfulness in LLM agents. Uses do-calculus interventions on intermediate reasoning nodes to measure Causal Sensitivity. Defines Causal Decoupling failure mode, violation density up to 0.77 in factual and scientific domains. Proposes Ariadne Score as benchmark. This is the closest thing to what you're proposing, but it only audits post-hoc faithfulness of CoT. It does not compare pre-hoc vs ad-hoc vs post-hoc.

2.  MATCHA (arXiv 2505.17406, v2 Feb 2026). Answer-Conditioned Probing. Tests the Decoupling Hypothesis: correct answers often mask fragile post-hoc rationalizations. Finds LLMs are "right for the wrong reasons" under perturbation. Transfer of adversarial examples to black-box models. Again, post-hoc only.

3.  Arcuschin et al. (arXiv 2503.08679, Mar 2025). "CoT Reasoning In The Wild Is Not Always Faithful". Shows Implicit Post-Hoc Rationalization even without biased prompts. Rates: GPT-4o-mini 13%, Haiku 3.5 7%, Sonnet 3.7 thinking 0.04%. Establishes that rationalization rates vary dramatically across models.

4.  Emmons et al. (arXiv 2507.05246, July 2025, DeepMind). "When CoT is Necessary, Language Models Struggle to Evade Monitors". Distinguishes CoT-as-rationalization (post-hoc) from CoT-as-computation (effectively pre-hoc or ad-hoc). Argues monitorability, not faithfulness, is the key property for safety. This is the most conceptually aligned paper to your idea, but frames it as a safety/monitoring argument, not a benchmark across timing conditions.

5.  ProtoX (arXiv 2211.03162). Post-hoc prototype-based RL policy explainer. Classical XAI, pre-LLM-agent era.

6.  CRISP (arXiv 2507.08037). Plan-then-act approach. Explicitly pre-hoc: high-level plan generation before execution. Shows pre-hoc plans beat CoT on downstream math and code tasks. Relevant as evidence that pre-hoc structure helps accuracy, but not an interpretability benchmark.

7.  QFANG (arXiv 2512.13668, Dec 2025). Chemistry reasoning LM with explicit CoT for synthesis procedure generation. Relevant to your chem domain, but it is a model release, not an interpretability study.

8.  zERExtractor (arXiv 2508.09995). Automated enzyme reaction extraction pipeline using LLMs. Directly adjacent to your opencode SDK reaction extraction work. No interpretability analysis though.

9.  Zheng et al. / ChatGPT Chemistry Assistant (arXiv 2306.11296, JACS 2023). MOF synthesis text mining with ChatGPT prompts. Precision/recall 90-99%. No explainability dimension.


## The gap

Nobody seems to have run a controlled experiment with a single agent that must:

-   Pre-hoc: state its intent and reasoning before acting, then act without access to the stated reasoning (or with).
-   Ad-hoc: interleave reasoning and action, each step reasoned about at the moment.
-   Post-hoc: act first, explain after.

Then compare across three axes:

1.  Task accuracy (does the explanation mode change the answer quality).
2.  Faithfulness (does the explanation causally drive the action, measured via intervention like Ariadne's do-calculus).
3.  Diagnostic utility (when the agent is wrong, which mode of explanation is most useful for a human to localize and fix the error).

Axis 3 is the one almost no one is measuring, and it is the one that matters most for your reaction extraction work. You don't just want to know if the CoT was faithful. You want to know which timing of explanation best helps you debug a wrong extraction.

## Why it is worth pursuing

1.  Concrete gap. Timing is orthogonal to the existing faithfulness axis. Current work mostly assumes "explain while or after" and tests faithfulness. Pre-commitment explanations with a mechanism that forces the agent to stick to them is not well studied as a design axis.

2.  Ideal testbed. Reaction extraction from PDFs is a great benchmark substrate:

    -   Ground truth is structured and checkable (SMILES, reaction components).
    -   Errors have clear typology: entity resolution, role assignment (reagent vs catalyst vs solvent), stoichiometry, multi-step decomposition.
    -   Errors are frequent enough to study but not random. Enables causal analysis of which explanation timing surfaces which error class.
3.  Actionable result. If pre-hoc explanations reduce a specific error class (say role confusion) by forcing the agent to commit to a schema, that is a deployable technique. If post-hoc is better for stoichiometry checks because the agent can verify, that's also deployable.

4.  Alignment with current safety interest. Emmons et al. and Ariadne show the field cares about this. A benchmark that operationalizes timing as a design choice fits cleanly into the monitorability conversation.


## Risks and why it might not work

1.  Confound: pre-hoc vs post-hoc may collapse into the same thing in modern thinking models, since their internal reasoning is already pre-action. You'd need to carefully distinguish verbalized reasoning from hidden reasoning.

2.  Faithfulness measurement is hard. You would need to adopt or adapt Ariadne's interventional method, or something like it, to claim any of the three modes is actually more faithful rather than just more verbose.

3.  Scope. Just picking chemistry is a lot. You might want a second domain (code, math) to show generality.

4.  Benchmark saturation risk. If the three modes give statistically indistinguishable accuracy, the story has to lean hard on diagnostic utility (a human-subjects angle) which adds experimental complexity.


## Suggested shape of the contribution

-   Formalize the taxonomy. Pre-hoc (commit-then-act), ad-hoc (interleaved, current CoT/ReAct), post-hoc (act-then-explain). Cross with "reasoning visible to next step" yes/no.
-   Instantiate on two tasks: reaction extraction from a patent/paper corpus, plus one textbook reasoning task for generality.
-   Metrics: task accuracy, faithfulness via intervention (reuse or port Ariadne-style), and a human (or LLM-judge) debugging utility score where an evaluator uses the explanation to localize the error.
-   Ablate: does forcing the agent to stick to its pre-hoc plan help or hurt. Does allowing post-hoc revision leak into retroactive correction that masks the bug.

## Key repos and directions to check

-   Project Ariadne (if code released, look at Khanzadeh's GitHub).
-   MATCHA framework code.
-   Faithfulness-in-the-wild code from Arcuschin et al. (Neel Nanda / Apollo Research ecosystem).
-   Chemistry extraction baselines: ChemDataExtractor 2, OpenReactionDB, ORD schema. These give you ground truth structure.
-   opencode SDK traces. Your own tool-call logs are a first-class data source that most CoT-faithfulness work lacks (they mostly study non-agentic LLMs).

## Recommendation

Worth pursuing. The specific framing of timing as a controllable design axis, evaluated not just on faithfulness but on debuggability, is novel enough. The chemistry grounding gives it teeth. Main research move: write a short position doc first (2 to 3 pages) defining the taxonomy crisply, then pilot on a small reaction extraction subset to see if the three modes actually differentiate before investing in a full benchmark.

* * *

# Compliance Framing (updated)

Reframing the benchmark around automating compliance changes both the stakes and the novelty story. This is the stronger angle.

## Why compliance changes the picture

In a pure interpretability setting, "which timing is more faithful" is a safety/alignment question. In compliance, the question becomes legally and operationally loaded:

-   GDPR Article 22 plus Recital 71: data subjects have rights related to automated decision-making, including meaningful information about the logic involved. Courts and regulators are still fighting over whether this is ex-ante (before the decision), ex-post (after), or both.
-   EU AI Act Articles 13 and 14 (transparency, human oversight) and Article 86 (right to explanation for high-risk systems): both ex-ante (system-level documentation) and ex-post (decision-level explanation) obligations.
-   SOX, HIPAA, SR 11-7 (model risk), NIST AI RMF: all assume you can reconstruct why a decision was made, after the fact, from logs.
-   ISO 42001 (AI management systems, 2023): requires documented decision-justification processes.

So the timing taxonomy maps directly onto legal requirements people are already arguing about. That is the novelty hook.

## Key adjacent work (compliance lens)

1.  Wachter, Mittelstadt, Russell (2017, arXiv 1711.00399, Harvard JLT). Foundational. Argues for unconditional counterfactual explanations as the GDPR-appropriate form. Explicitly post-hoc but decision-specific. Establishes three aims for explanations: inform, contest, change. Your benchmark can directly operationalize "which timing best supports each of these three aims".

2.  Aler Tubella et al. (2020, arXiv 2006.05133). "Contestable Black Boxes". Makes the case that contestability (post-hoc) is a distinct requirement from explainability. Argues for socio-technical combinations. Does not benchmark timing.

3.  Sovrano et al. (2021, arXiv 2109.04165). GDPR-compliant Explanatory Narratives. User-centred, exploration-based explanations. Pre-LLM-agent era.

4.  L4L (arXiv 2511.21033, Mar 2026). Solver-centric LLM legal reasoning with SMT verification. Pre-hoc formalization of statute then solver-checked adjudication. Verifiable justifications. This is effectively pre-hoc plus formal verification. Closest to a compliance-grade pre-hoc architecture.

5.  Mirror (arXiv 2602.13292, Feb 2026). Multi-agent ethics review. EthicsLLM fine-tuned for normative reasoning, Mirror-ER for expedited automated compliance checks, Mirror-CR for committee deliberation. Relevant as a production-style compliance agent but does not isolate explanation timing as a variable.

6.  HADA (arXiv 2506.04253, June 2025). Human-AI Agent Decision Alignment architecture. Wraps any algorithm in role-specific stakeholder agents (audit, ethics, business) with full decision lineage. Credit-scoring POC. Directly in the compliance automation space. Explicitly separates audit and ethics agents, which is an ad-hoc/post-hoc architectural split.

7.  HCLA (arXiv 2510.20102, Mar 2026). Human-centered LLM-agent system for crypto anomaly detection. Explicitly separates evidence scoring from expert-style justification. "Accountability beyond explainability". Reconstructs a traceable expert reasoning process for regulatory/audit use. Very close to the compliance spirit but again does not study timing.

8.  Transparent Data Agents (arXiv 2509.24127, Sept 2025). Insurance claims agent with multi-layered reasoning and auditable justifications. Enterprise compliance flavored.


## The refined gap

In compliance automation, current agent systems generate justifications in one of three ways, usually without naming it:

-   Pre-hoc: rule/statute formalization, plan-then-execute, SMT-verified (L4L style). High rigor, poor flexibility.
-   Ad-hoc: CoT/ReAct-style interleaved reasoning (Mirror-ER, HADA). Decent but faithfulness is suspect (see Ariadne, MATCHA).
-   Post-hoc: reconstructed justifications from logs and evidence (HCLA, Wachter counterfactuals). Great for contestability, weak on preventing the error in the first place.

Nobody compares these three modes on the same compliance task measuring:

1.  Decision accuracy.
2.  Faithfulness (is the justification what actually drove the decision).
3.  Regulatory adequacy (does it satisfy the relevant legal requirement for meaningful information, contestability, counterfactual change).
4.  Auditor/reviewer utility (time to detect wrong decisions, time to localize cause).
5.  Cost (tokens, latency, human review burden).

That matrix does not exist. That is your benchmark.

## Why compliance is the right framing (not pure interp)

1.  Stakeholders are named. Regulators, auditors, contesting subjects, operators. Each cares about different properties, which maps cleanly onto timing modes.
2.  Ground truth is legally defined. The correct decision is not just "accurate" but "meets statutory criteria". This lets you define error typologies that matter (e.g., KYC missed flag vs. PII leak vs. wrongful denial).
3.  Failure cost is asymmetric. A post-hoc rationalization that hides a bug is catastrophic in compliance. This raises the bar for faithfulness and makes the pre-hoc story more compelling than in general agentic work.
4.  Your chemistry reaction extraction still fits. Frame it as patent compliance / regulatory submission accuracy (FDA, EPA, ICH), or as pharmacovigilance literature triage. Reaction extraction becomes compliance-adjacent when the data feeds regulatory filings.

## Concrete benchmark design (compliance version)

Tasks (pick 2 to 3):

-   Regulatory literature extraction (your chem work, framed as pharmacovigilance or patent submission compliance). Errors carry real cost.
-   Financial AML/KYC transaction review. Public synthetic datasets exist (HCLA-style).
-   Privacy policy conformance checking (does this data flow match the declared policy). ToS/privacy corpora exist.
-   Loan adjudication (HADA-style credit scoring with fairness constraints).

Conditions per task:

-   Pre-hoc: agent emits a structured decision rubric plus applicable rules before seeing the full case, then applies it. Variant: formal (L4L-style SMT) vs natural language.
-   Ad-hoc: interleaved ReAct reasoning, standard agent loop.
-   Post-hoc: decide first, then generate a justification given the decision and the evidence.
-   Hybrid: pre-hoc plan + post-hoc justification. Likely the real-world answer, include as a reference.

Metrics:

1.  Decision accuracy vs ground truth.
2.  Faithfulness: Ariadne-style causal interventions on reasoning nodes, measure decision flip rate.
3.  Regulatory adequacy: rubric derived from GDPR Art 22 / EU AI Act Art 13-14 / SR 11-7. LLM-judge plus a small expert panel.
4.  Contestability: can a counterfactual be produced that would flip the decision (Wachter-style).
5.  Debuggability: auditor or LLM-judge timing to localize cause on wrong decisions.
6.  Token and latency cost.
7.  Drift: when rules change (inject a rule update), how much does each mode require to stay correct. Pre-hoc should dominate, test this.

Expected story arcs:

-   Pre-hoc wins on regulatory adequacy and drift resilience but loses on nuance.
-   Ad-hoc wins on accuracy but has the worst faithfulness gap.
-   Post-hoc wins on contestability and debuggability but is dangerous because it can launder a wrong decision into a plausible-looking rationale.
-   Hybrid dominates on total utility but increases cost significantly.

If those trends hold, the contribution is a principled way to pick the timing mode based on which compliance obligation is primary, not just "which is more interpretable".

## Revised recommendation

This is a clearly more fundable, citable, and practically useful framing than pure interpretability. The compliance angle:

-   Gives you named stakeholders and legally grounded metrics.
-   Connects to live policy debates (EU AI Act implementation, NIST AI RMF maturity).
-   Has industry pull: every financial, health, and regulated-industry team deploying agents is hitting this exact question.
-   Your reaction extraction work still plugs in as a sub-task (regulatory/patent compliance).

Main moves to commit:

1.  Rewrite the position doc with compliance as the primary framing, interpretability as mechanism.
2.  Pick one high-stakes compliance domain plus reaction extraction as the pair of tasks.
3.  Adopt Ariadne's causal intervention method for the faithfulness metric. Adopt Wachter-style counterfactuals for contestability.
4.  Build a small rubric for regulatory adequacy from GDPR, EU AI Act, and sector-specific (e.g., SR 11-7 for banking). This rubric alone is a citable artifact.
5.  Consider co-authoring with someone in law/policy. This reads better with a cross-disciplinary author list.

## Open questions to resolve before pilot

-   Which single compliance domain is your strongest entry point? Your chem work points to pharma/pharmacovigilance. That is a real market.
-   Is the benchmark a leaderboard (static) or an evaluation framework (applied per-deployment)? Framework is more durable and harder to saturate.
-   Do you want to release an opencode SDK plugin that emits all three timing modes as a deliverable? That would give the paper engineering teeth and distribution.
