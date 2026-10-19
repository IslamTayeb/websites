Context: early local/Azure frontier-model canaries for deciding whether a direction like "Hydra, but for making test-passing code by construction" is still interesting. My concern was that if a strong LLM receives the problem spec plus unit tests, it might already infer everything needed and one-shot the solution, leaving little room for a test-passing-by-construction system to be useful tbh.

## Experiment

Question: does spec/tests already saturate one-shot frontier models, or is there room for test-feedback / test-passing-by-construction search?

Tasks: 20 hard LCB/AtCoder-derived problems from `hard_post_20240602_prompt_safe_20_seed0.json`.

<table><thead><tr><th>Cell</th><th>Spec?</th><th>Tests?</th></tr></thead><tbody><tr><td><code>spec_only</code></td><td>yes</td><td>none</td></tr><tr><td><code>spec_some_tests</code></td><td>yes</td><td>half</td></tr><tr><td><code>spec_all_tests</code></td><td>yes</td><td>all</td></tr><tr><td><code>tests_some</code></td><td>no</td><td>half</td></tr><tr><td><code>tests_all</code></td><td>no</td><td>all</td></tr></tbody></table>

Models: GPT-4o, GPT-4.1, GPT-4.1-mini, GPT-5.5 none/low/xhigh (incomplete).

## Metrics

<table><thead><tr><th>Metric</th><th>Definition</th></tr></thead><tbody><tr><td>Compile-valid</td><td>Extracted C++ passes local strict syntax/typecheck</td></tr><tr><td>Visible tests</td><td>Input/output test cases included in the prompt before generation</td></tr><tr><td>Visible pass</td><td>Generated code passes only the prompt-shown tests</td></tr><tr><td>Correct</td><td>Generated code passes the full eval test suite, including tests not shown in the prompt</td></tr><tr><td>Prefill/infra invalid</td><td>No normal code block / empty output / <code>invalid_prefill</code></td></tr></tbody></table>

Compile-valid command shape:

```bash
clang++ -fsyntax-only -x c++ -std=c++17 -Wall -Wextra -Werror \
  [local include/toolchain/resource flags] candidate.cpp
```

<table><thead><tr><th>Flag</th><th>Meaning</th></tr></thead><tbody><tr><td><code>-fsyntax-only</code></td><td>Parse/typecheck the program but do not produce an executable</td></tr><tr><td><code>-x c++</code></td><td>Treat the input as C++ source</td></tr><tr><td><code>-std=c++17</code></td><td>Compile as C++17</td></tr><tr><td><code>-Wall -Wextra</code></td><td>Enable common/extra compiler warnings</td></tr><tr><td><code>-Werror</code></td><td>Promote warnings to errors, which makes this stricter than normal contest compilation</td></tr><tr><td>local include/toolchain/resource flags</td><td>Environment-specific paths for finding C++ headers/toolchain resources</td></tr></tbody></table>

LCB-style correctness counts compile errors, runtime errors, timeouts, wrong answers, and invalid/empty outputs as failures. Compile-valid is not correctness; it only says the code is locally valid C++ under strict flags. Because of `-Werror`, some non-compile-valid rows may be warning-only artifacts that a normal contest judge would compile.

For `spec_some_tests` / `tests_some`, visible pass and correctness can differ: visible pass checks the shown half of tests, while correctness checks all tests. For `spec_all_tests` / `tests_all`, the prompt-visible tests are the full local test bundle, so visible pass and correctness should align except for infra/evaluator details.

## Correctness

Strict `correct / 20`, except xhigh tests-only cells are partial and should not be compared directly.

<table><thead><tr><th>Model Artifact</th><th align="right"><code>spec_only</code></th><th align="right"><code>spec_some_tests</code></th><th align="right"><code>spec_all_tests</code></th><th align="right"><code>tests_some</code></th><th align="right"><code>tests_all</code></th></tr></thead><tbody><tr><td>GPT-4o</td><td align="right">3/20</td><td align="right">3/20</td><td align="right">2/20</td><td align="right">0/20</td><td align="right">0/20</td></tr><tr><td>GPT-4.1</td><td align="right">4/20</td><td align="right">3/20</td><td align="right">4/20</td><td align="right">0/20</td><td align="right">0/20</td></tr><tr><td>GPT-4.1-mini</td><td align="right">5/20</td><td align="right">4/20</td><td align="right">4/20</td><td align="right">0/20</td><td align="right">0/20</td></tr><tr><td>GPT-5.5 none</td><td align="right">5/20</td><td align="right">7/20</td><td align="right">6/20</td><td align="right">1/20</td><td align="right">2/20</td></tr><tr><td>GPT-5.5 low</td><td align="right">14/20</td><td align="right">14/20</td><td align="right">13/20</td><td align="right">5/20</td><td align="right">8/20</td></tr><tr><td>GPT-5.5 xhigh</td><td align="right">17/20</td><td align="right">19/20</td><td align="right">18/20</td><td align="right">–</td><td align="right">–</td></tr></tbody></table>

## Compile Validity

Compile-valid counts under the local strict C++ checker.

<table><thead><tr><th>Model Artifact</th><th align="right"><code>spec_only</code></th><th align="right"><code>spec_some_tests</code></th><th align="right"><code>spec_all_tests</code></th><th align="right"><code>tests_some</code></th><th align="right"><code>tests_all</code></th></tr></thead><tbody><tr><td>GPT-4o</td><td align="right">16/20</td><td align="right">15/20</td><td align="right">16/20</td><td align="right">20/20</td><td align="right">16/20</td></tr><tr><td>GPT-4.1</td><td align="right">13/20</td><td align="right">14/20</td><td align="right">10/20</td><td align="right">16/20</td><td align="right">14/20</td></tr><tr><td>GPT-4.1-mini</td><td align="right">16/20</td><td align="right">14/20</td><td align="right">16/20</td><td align="right">17/20</td><td align="right">19/20</td></tr><tr><td>GPT-5.5 none</td><td align="right">18/20</td><td align="right">16/20</td><td align="right">19/20</td><td align="right">19/20</td><td align="right">19/20</td></tr><tr><td>GPT-5.5 low</td><td align="right">18/20</td><td align="right">19/20</td><td align="right">18/20</td><td align="right">19/20</td><td align="right">18/20</td></tr><tr><td>GPT-5.5 xhigh</td><td align="right">18/20</td><td align="right">19/20</td><td align="right">18/20</td><td align="right">–</td><td align="right">–</td></tr></tbody></table>

## Visible Tests

This is the direct saturation check for the "can the LLM already pass the tests it sees?" concern.

<table><thead><tr><th>Model Artifact</th><th align="right"><code>spec_some_tests</code> visible pass</th><th align="right"><code>spec_all_tests</code> full pass</th><th align="right"><code>tests_some</code> visible pass</th><th align="right"><code>tests_all</code> full pass</th></tr></thead><tbody><tr><td>GPT-4o</td><td align="right">3/20</td><td align="right">2/20</td><td align="right">0/20</td><td align="right">0/20</td></tr><tr><td>GPT-4.1</td><td align="right">4/20</td><td align="right">4/20</td><td align="right">0/20</td><td align="right">0/20</td></tr><tr><td>GPT-4.1-mini</td><td align="right">4/20</td><td align="right">4/20</td><td align="right">0/20</td><td align="right">0/20</td></tr><tr><td>GPT-5.5 none</td><td align="right">7/20</td><td align="right">6/20</td><td align="right">3/20</td><td align="right">2/20</td></tr><tr><td>GPT-5.5 low</td><td align="right">14/20</td><td align="right">13/20</td><td align="right">9/20</td><td align="right">8/20</td></tr><tr><td>GPT-5.5 xhigh</td><td align="right">19/20</td><td align="right">18/20</td><td align="right">–</td><td align="right">–</td></tr></tbody></table>

GPT-5.5 low and xhigh (reasoning models) are the main caution. On LCB spec-containing cells, their one-shot rates are high enough that a search system may have little headroom to show improvement.
