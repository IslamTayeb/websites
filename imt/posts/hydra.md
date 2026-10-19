Context: Hydra (Du, Ou, Zhuo, Lentz @ Duke). Async checking + checkpoint-and-rollback for LLM code gen, retrofitted onto Clang. Meeting with Matthew Lentz.

-   If I imagine the POV of frontier labs making coding agents: Hydra sounds pretty good for the purpose of small, fast, cheap implementation models.
-   However, most of the frontier LMs have a much bigger problem with things like spec misunderstanding and edge cases. Table I got from reading a few papers below (take it with a grain of salt)
-   I do believe that spec misunderstanding comes largely as a fault of the english language in prompting. Test-driven development and formal interpretation of the system is likely the way to go there.
-   So we want to go from tests → correct code (by-construction). Hydra gives a good base for statically-correct-by-construction, now what can we built in it's spirit to catch dynamic runtime correctness?

<table><thead><tr><th>Failure Mode</th><th>Approx. % of Frontier Failures</th><th>Plain Definition</th><th>Source</th></tr></thead><tbody><tr><td>Spec misunderstanding / wrong logical direction</td><td>~30-40%</td><td>Code compiles and runs but solves a slightly different problem than asked.</td><td>Wang et al. [1]</td></tr><tr><td>Missing edge cases / corner cases</td><td>~15-25%</td><td>Main case works, fails on empty, boundary, overflow, or unicode inputs.</td><td>Tambon et al. [2]; Wang et al. [1]</td></tr><tr><td>Logic errors on complex control flow (incorrect condition, missing condition)</td><td>~15-20%</td><td>Right approach overall, one branch or state transition is wrong.</td><td>Wang et al. [1]</td></tr><tr><td>Misinterpretation + prompt-biased code</td><td>~10-15%</td><td>Model over-anchors on surface words in the prompt and produces code that mirrors the phrasing rather than the intent.</td><td>Tambon et al. [2]</td></tr><tr><td>API / object hallucination (incl. wrong attribute)</td><td>~8-12%</td><td>Function or attribute exists but wrong signature, wrong version semantics, or non-existent.</td><td>Tambon et al. [2]</td></tr><tr><td>Performance + numerical correctness (GPU/systems)</td><td>Separate domain: frontier models match PyTorch baseline in &lt;20% of CUDA tasks; 0/30 on quantization</td><td>Kernel compiles and returns right shape, but is slow or numerically wrong.</td><td>Ouyang et al. [3]</td></tr><tr><td>Static/semantic compile errors (Hydra's target)</td><td>6.4% of all generations on gpt-oss 120B, rising to 11.1% on hard subset</td><td>Type errors, out-of-scope identifiers, bad argument types.</td><td>Du et al. [4] (Table 1)</td></tr><tr><td>Syntactic errors</td><td>0.4% of all generations on gpt-oss 120B</td><td>Malformed expressions, unbalanced delimiters. Near-zero at frontier.</td><td>Du et al. [4] (Table 1)</td></tr></tbody></table>

-   Quick AlphaXiv scan tells me that most of the kernel programming and performant-code agents are focused on multi-agents with "building" and "provisioning" agents

-   Hydra's contributions:

    -   Async checking
    -   Targeted rollback API w/ policy case-study
-   Paper itself suggests 2 directions:

    -   "Spectrum of Correctness": formal verification, unit testing, potentially different directions (concurrency? memory-secure? CUDA programming?)
        -   Definitely more interested in this
        -   I know that LLMs are pretty bad until now w/ GPU/kernel programming, a lot of static errors. Feels like I'd be re-purposing hydra which isn't as sexy, though I have an inkling that there's more to it.
            -   I've been deep in the trenches of GPU programming lately, so I'd be interested in exploring it through this lens
            -   GPU kernel generation is a domain where dynamic checking is pretty cheap though, could target if can't generalize to all runtime errors
                -   *Could build on hydra to handle multiple "check" types, e.g. clang-cuda + nvcc + unit tests?*
                -   still might be too small of a contribution
        -   Obviously, instinct says to take the next step: **runtime/dynamic errors**
            -   *Isn't post-hoc way better? I don't instinctively find a systematic, async way to do this*
                -   Partially because I think human development (in my mind) goes: user has compiler checking async as they code for static errors, will run unit/integration tests much less frequently, bigger argument for post-hoc
            -   I liked Hydra's "don't recheck validated prefixes" clang retrofit. Could there be a world where we say "C touches A and B. A and B are confirmed dynamic, just check the rest of C"?
                -   I assume not, global states, pointers, etc. can go wrong, that's why integration tests exist
                -   assumes a kind of compositional confidence that dynamic correctness doesn't actually provide
                -   "touches" is undecidable in general since it needs alias anal, can approximate but would have to over-include
                -   Could be good when writing large chunks of code
                -   If user comes with no tests, there's also the chicken-and-egg problem of having the LLM write tests to run
    -   "Policies": deep dive into better policy heuristics
        -   I'm personally less interested in this, think it's best as part of a paper to explore the system built, not a separate paper itself
    -   I don't think improving the infrastructure is particularly important right now (faster compiler, )
-   Meta problem: I think my head is getting too constrained over "Hydra" and "Hydra-shaped solutions for similar problems"

    -   I've been thinking about "shared KV cache between agents" and KV caches in general, could be useful for hydra and other future work for rollouts
        -   common thread: concurrent LLM workloads share state via prefixes more than people exploit

* * *

\[1\] Wang, Zhou, Song, Huang, Chen, Ma, Zhang. "Towards Understanding the Characteristics of Code Generation Errors Made by Large Language Models." ICSE 2025. arXiv:2406.08731.

\[2\] Tambon, Moradi Dakhel, Nikanjam, Khomh, Desmarais, Antoniol. "Bugs in Large Language Models Generated Code: An Empirical Study." arXiv:2403.08937 (2024).

\[3\] Ouyang, Guo, Arora, Zhang, Hu, Ré, Mirhoseini. "KernelBench: Can LLMs Write Efficient GPU Kernels?" ICLR 2025. arXiv:2502.10517.

\[4\] Du, Ou, Zhuo, Lentz. "Hydra: Efficient, Correct Code Generation via Checkpoint-and-Rollback Support." (The paper you're reading.)
