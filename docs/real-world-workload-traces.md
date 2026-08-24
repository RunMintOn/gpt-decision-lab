# Real-world workload traces

This document records real usage traces supplied during development of GPT Decision Lab. These traces are intended to calibrate the **Context Economics** and future **Continue vs Restart** models. They are observations from actual workflows, not benchmark results.

## Terminology

### Ideal prefix reuse

Avoid describing the baseline case as “100% cache hit rate.” A real request always contains some new input, so the token-level hit rate can legitimately be 97–99% rather than 100%.

For this project, **ideal prefix reuse** means:

- every history prefix that is unchanged from the previous request remains reusable/cached;
- only newly added material is uncached;
- there is no catastrophic event where the whole reusable prefix suddenly misses and must be rebuilt from zero.

This is the economically important distinction. Token-level cache-hit percentage and catastrophic prefix-cache failure are different concepts.

---

## Trace A — mixed development + discussion branch

Earlier observed branch-level aggregate:

```text
128 turns
prompt      10,669,050
received        74,173
cache hit    9,914,880
cache write          0
hit rate          92.9%
```

A nearby single-request observation was:

```text
call 130
model       openai-codex/gpt-5.6-sol
prompt      131,048
received        100
cache hit   129,536
cache write       0
hit rate       98.8%
```

Interpretation:

- the branch contains both development work and user/model discussion;
- the aggregate 92.9% value is a **token-level** cache-hit ratio, not evidence that 7.1% of calls were catastrophic misses;
- call 130 is useful as a point observation of a mature conversation around 131K prompt input tokens with near-ideal prefix reuse.

Do not infer a complete context-growth curve from the branch aggregate alone.

---

## Trace B — pure autonomous development after compaction

This is currently the cleanest real-world calibration trace.

### Workflow

1. An existing conversation reached approximately **130K prompt input tokens**.
2. A `compact` operation was performed at the end of the user interaction.
3. The compacted state included a summary and the mechanism’s normal retained material.
4. The next development segment began with a baseline of approximately **45K prompt input tokens** at **model call 58**.
5. From call 58 onward, the agent was told to execute the existing plan and then worked autonomously.
6. There was **no user intervention during this segment**; it is therefore a useful “pure development” workload rather than a development+discussion workload.
7. The segment continued through **call 129** and completed one substantial code change / feature-development cycle.
8. At call 129, prompt input was approximately **45.9% of a 300K reference window**, i.e. about **137.7K tokens**.
9. Prefix-cache behavior was effectively ideal: ordinary observed hit ratios may have been around 97–98%, but there was no known catastrophic full-prefix cache-loss event.

### Directly observed / supplied values

| Field | Value |
|---|---:|
| Pre-compaction prompt input | ~130K tokens |
| First post-compaction call | 58 |
| Post-compaction baseline | ~45K tokens |
| Final call in segment | 129 |
| Approx. final prompt input | ~137.7K tokens |
| Reference window used for the percentage | 300K tokens |
| Approx. final window utilization | 45.9% |
| User interventions during calls 58–129 | 0 |
| Cache regime | Ideal prefix reuse; no catastrophic miss observed |

### Derived values

These are derived from the supplied values and should be treated as calibration estimates rather than exact telemetry.

- Calls in the post-compaction development segment, inclusive: **72** (`129 - 58 + 1`).
- Compaction retained about **34.6%** of the pre-compaction prompt (`45K / 130K`).
- Compaction reduced the carried prompt by about **65.4%** (~85K tokens).
- Prompt input grew by about **92.7K tokens** over the autonomous development segment.
- If growth is approximated linearly between the two observed endpoints, net prompt growth is about **1.31K tokens per model-call interval** (`92.7K / 71`).

The last figure is useful as a first empirical preset, but the actual per-call growth path may be uneven because file reads, tests, tool output, generated code, and internal agent activity occur in bursts.

### Why this trace matters

This trace gives the project a real calibration point for the variable that was previously under-modeled: **number of billable model calls**.

For long-running agent work, context length determines the cost of a single request, while the number of subsequent model calls determines how many times that carried context is read again. A large context with only a few calls remaining may be cheaper to keep; the same context with dozens of calls remaining may justify compaction or restart.

This trace also demonstrates that a single feature-development cycle can naturally consume on the order of **70+ model calls** even without additional user discussion. Therefore, “remaining model calls” should be a first-class variable in the Continue-vs-Restart model rather than a secondary display metric.

---

## Implications for the site model

The future Continue-vs-Restart tool should distinguish at least these quantities:

- current prompt input tokens;
- current model-call index or estimated remaining model calls;
- prompt growth per model call;
- system/tool-definition fixed prefix tokens;
- checkpoint/compact retained baseline;
- restart restore tokens (files, plan, repository state, summary);
- restart friction, preferably represented as **equivalent extra model calls** rather than an invented dollar value for human effort;
- catastrophic cache-rebuild events as a separate stochastic process from ordinary token-level cache-hit ratio.

Useful presets can eventually be calibrated from observed workflows, for example:

- mixed development + discussion;
- pure autonomous development;
- short bug fix;
- large repository feature development.

Trace B is currently the strongest candidate for the **pure autonomous development** preset.

---

## Data quality note

The exact call-129 token count was supplied verbally together with the clearer statement that it represented approximately **45.9% of a 300K reference window**. This document therefore records the endpoint as approximately **137.7K tokens**. If raw telemetry for call 129 is later available, replace this approximation with the exact value and recompute the derived growth rate.
