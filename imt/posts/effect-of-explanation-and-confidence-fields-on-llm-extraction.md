Question: If you ask an LLM to extract structured data and include an "explanation" field or a "confidence score" per item, how does that affect accuracy, calibration, and the ad-hoc interpretability story?

Short answer: field order matters enormously, confidence fields are usually badly calibrated, and the request to structure output at all imposes a measurable accuracy tax. The fix is to put the reasoning/explanation before the value, not after.

* * *

## 1\. The order-of-output problem (this is the big one)

Autoregressive LLMs generate left to right. If your schema is:

```json
{"value": "...", "explanation": "..."}
```

the model commits to the value before producing the reasoning. The explanation becomes post-hoc rationalization by construction.

If your schema is:

```json
{"explanation": "...", "value": "..."}
```

the model reasons first, then commits. This is ad-hoc or pre-hoc depending on framing.

Key evidence:

-   Yu et al., "Thinking Out of Order" (arXiv 2601.22035, Jan 2026). On GSM8K, Math500, and their ReasonOrderQA benchmark: when prompts request answers before reasoning, autoregressive models show up to 67% relative accuracy drop vs. standard CoT ordering. Masked diffusion models stay within 14%. They call this "order robustness" and show AR models literally commit to wrong answers before generating reasoning. Direct evidence that schema field order is a correctness-level design choice, not a cosmetic one.

-   "The Format Tax" (arXiv 2604.03616, April 2026). JSON/XML/LaTeX/Markdown formatting instructions alone cause most of the accuracy degradation, even before any constrained decoding. The fix they recommend: decouple reasoning from formatting. Either generate freeform first then reformat in a second pass, or use extended thinking inside the single call. Across 6 open-weight models, 4 API models, 4 formats. Closed frontier models show little format tax; open models still lose a lot.

-   SCOPE (arXiv 2604.25120, April 2026). Clinical trial table reasoning. Making the source field, reasoning rules, and output constraints explicit before answer generation beats direct prompting and CoT. Pre-hoc structure helps on extraction-style tasks.


Practical implication for extraction: always put `explanation` or `rationale` before `value` in the schema. If you must output `value` first (downstream parser requires it), run a two-pass pipeline: free-form reasoning first, then format extraction second.

* * *

## 2\. The confidence-field problem

Asking an LLM to emit a `confidence` field is tempting but the scores are typically useless without work.

Key evidence:

-   Voss, "Calibrated Confidence Estimation for Tabular QA" (arXiv 2604.12491). Five methods, five frontier LLMs, two tabular QA benchmarks. All models are severely overconfident on structured data. Smooth ECE 0.35-0.64 vs 0.10-0.15 on textual QA. Verbalized confidence and P(True) self-evaluation achieve AUROC 0.42-0.76 (near random to mediocre). Perturbation methods (semantic entropy, self-consistency, multi-format agreement) hit 0.78-0.86. Self-evaluation loses systematically to perturbation. Structured output makes calibration worse than freeform QA.

-   Saenko et al., Telco LLMs (arXiv 2604.13271, April 2026). Gemma-3 family on telecom tasks. Single-pass verbalized confidence is biased and systematically overconfident. Their Twin-Pass CoT-Ensembling reduces Expected Calibration Error by up to 88%. Single-pass self-reported confidence is not trustworthy.

-   Dang et al., "Instinct vs. Reflection" (arXiv 2604.17274, April 2026). Multimodal LLMs. Token-level support (model's implicit probabilities) frequently diverges from verbal self-assessment. They propose fusing the two signals. Again, verbalized confidence alone is not enough.

-   Cacioli, Gemma 3 4B self-consistency distillation (arXiv 2604.24070, April 2026). Small instruct-tuned LLMs produce degenerate verbal confidence under minimal elicitation: >95% ceiling, near-chance Type-2 AUROC. Fine-tuning is needed to get even a binary correct/incorrect discriminator.


Practical implication for extraction: a `confidence` field generated in-line is almost certainly miscalibrated, especially on structured tabular data. If you need real confidence, use sampling-based methods (self-consistency, perturbation ensembles, multi-format agreement) or fuse token logits with the verbal score. The naive approach will produce systematic overconfidence and look worst precisely on the items the model gets wrong with high confidence.

* * *

## 3\. Does adding an explanation field improve the extraction itself?

Two opposing effects:

Positive (ad-hoc effect):

-   Forcing a rationale before the value works like inline CoT. On reasoning-heavy extractions (role assignment, inference from context, disambiguation), this generally helps. SCOPE and classic CoT literature support this.

Negative (format tax):

-   Adding any structured field adds format constraint. "The Format Tax" shows even requesting JSON has a measurable cost. If the explanation field is verbose and mandatory, open-weight models degrade further.

Net:

-   For capable models (frontier closed-weight), explanation-before-value tends to improve or at least not hurt extraction quality while giving you a legible reason.
-   For small open-weight models, it is a coin flip. The format tax can eat the CoT gain.
-   Explanation-after-value almost always hurts, because it is post-hoc and the model sometimes confabulates a reason that contradicts the value.

* * *

## 4\. Does an explanation field improve interpretability?

Partially. With strong caveats:

-   Faithfulness is suspect. Post-hoc rationalization literature (Ariadne 2026, MATCHA 2026, Arcuschin 2025) shows stated reasons often don't causally drive the output, especially after-the-fact explanations. An explanation field after the value is essentially a post-hoc rationalization.
-   Legibility improves even if faithfulness doesn't. Humans reviewing extractions find explanation fields useful for triage, even when the explanation is partially confabulated. This is the debuggability gain.
-   The explanation field does not pass a regulatory-grade faithfulness bar on its own. It is commentary, not evidence of mechanism.

* * *

## 5\. Ties back to the pre-hoc / ad-hoc / post-hoc framing

Field order in structured output is the cleanest, cheapest knob for the timing taxonomy:

-   Pre-hoc: emit a rubric or rule-list field at the top, separate from per-item extraction, committing before seeing the details.
-   Ad-hoc: interleave `explanation` then `value` per item. The explanation must come first or it is not ad-hoc, it is post-hoc.
-   Post-hoc: emit all values first, then a batch `explanations` block at the end. Worst for faithfulness, sometimes fine for user-facing display.

If your friend's infra wants to support the timing taxonomy as a primitive, the very first, easiest feature is a schema-order enforcer that rewrites user schemas to put reasoning fields before value fields. One simple rule, measurable accuracy gain, explicit timing semantics.

* * *

## 6\. Concrete recommendations

1.  Put explanation fields before value fields in extraction schemas. Always. The accuracy and faithfulness gap vs. after-value is large.
2.  Do not trust a single-shot `confidence` field. Use multi-sample agreement, perturbation, or logit fusion. If you must keep the field, treat it as a hint only, and calibrate against a held-out set.
3.  If using an open-weight model, consider a two-pass pipeline: freeform reasoning first, then a small formatter model produces the JSON. Recovers most of the format tax.
4.  For regulated use cases, log both the explanation field and a sample-based confidence metric. Label the explanation as "stated reasoning, not audited for faithfulness." Separate the epistemic claims.
5.  For the benchmark/product angle: schema-order and confidence-method are two orthogonal axes that compose with the timing taxonomy. They give you cheap, measurable knobs.

* * *

## Key citations

-   Yu et al. 2026, "Thinking Out of Order" (2601.22035). Order robustness, 67% AR drop.
-   Lee, D'Antoni, Berg-Kirkpatrick 2026, "The Format Tax" (2604.03616). Prompt-level format cost, decoupling fix.
-   Voss 2026, "Calibrated Confidence Estimation for Tabular QA" (2604.12491). Self-eval vs perturbation dichotomy.
-   Saenko et al. 2026, Telco LLMs Twin-Pass CoT (2604.13271). 88% ECE reduction.
-   Dang et al. 2026, "Instinct vs. Reflection" (2604.17274). Token vs verbal confidence fusion.
-   Cacioli 2026, CSFT Gemma 3 4B (2604.24070). Pre-registered negative then rescue on verbal confidence.
-   SCOPE 2026 (2604.25120). Pre-hoc planning beats direct and CoT on clinical table reasoning.
-   Arcuschin et al. 2025, CoT faithfulness in the wild (2503.08679). Post-hoc rationalization rates.
-   MATCHA 2026 (2505.17406). Decoupling hypothesis.
-   Project Ariadne 2026 (2601.02314). Causal faithfulness audit.
