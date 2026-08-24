# Real-world workload traces

This document records real usage telemetry supplied during development of GPT Decision Lab. These observations are intended to calibrate the **Context Economics** and future **Continue vs Restart / Compact** models. They are not benchmark results.

## Terminology

### Ideal prefix reuse

Avoid describing the baseline case as “100% cache hit rate.” A real request always contains some new material, so its token-level cache-hit ratio can legitimately be 97–99% rather than 100%.

For this project, **ideal prefix reuse** means:

- every history prefix that is unchanged from the previous request remains reusable/cached;
- only newly added material is uncached;
- there is no catastrophic event where the entire reusable prefix suddenly misses and must be rebuilt from zero.

This distinction is the one that matters economically. Token-level hit percentage and catastrophic prefix-cache failure are different concepts.

---

## Primary trace — pure autonomous development after compaction

This is one continuous real workflow and is currently the project’s cleanest calibration trace for pure development.

### Conversation boundary

The old conversation reached approximately **130K prompt input tokens**. A `compact` operation was then performed as the final user-side action before autonomous development continued.

For modeling purposes, the state after compaction is treated as the beginning of a **new logical conversation / development segment**. It is not a separate unrelated workload: it is the second logical conversation created from the old one by compaction.

The compacted state retained a summary plus the mechanism’s normal retained context, producing a new baseline of approximately **45K prompt input tokens**.

### Pure-development segment

- **Call 58:** first call of the post-compaction segment, approximately **45K prompt input tokens**.
- From call 58 onward, the agent was told to execute the existing plan.
- **No user intervention occurred during calls 58–129.**
- The agent worked autonomously on implementation, repository inspection, tool use, testing, correction, and completion.
- **Call 129:** end of this feature-development cycle.
- At call 129, prompt input was approximately **45.9% of a 300K reference window**, i.e. about **137.7K tokens**.
- Prefix-cache behavior during this segment was effectively **ideal prefix reuse**. Ordinary token-level hit ratios may still have been around 97–98%; the important point is that there was no known catastrophic full-prefix cache-loss event.

### Directly supplied values

| Field | Value |
|---|---:|
| Old conversation before compact | ~130K prompt tokens |
| First post-compact call | 58 |
| Post-compact baseline | ~45K prompt tokens |
| Final call of the pure-development segment | 129 |
| Approx. final prompt input | ~137.7K tokens |
| Reference window used for the percentage | 300K tokens |
| Approx. final window utilization | 45.9% |
| User interventions during calls 58–129 | 0 |
| Workload type | Pure autonomous development |
| Cache regime | Ideal prefix reuse; no catastrophic miss observed |

### Derived values

These values are derived from the supplied endpoints and are calibration estimates rather than exact per-call telemetry.

- Calls in the post-compaction segment, inclusive: **72** (`129 - 58 + 1`).
- Model-call intervals between the two observed endpoints: **71**.
- Compaction retained about **34.6%** of the old prompt (`45K / 130K`).
- Compaction removed about **65.4%** of carried context, or roughly **85K tokens**.
- Prompt input grew by about **92.7K tokens** during the autonomous feature-development segment (`137.7K - 45K`).
- If the endpoint-to-endpoint growth is approximated linearly, net prompt growth is about **1.31K tokens per model-call interval** (`92.7K / 71`).

The actual path will not be perfectly linear. File reads, shell output, tests, generated code, retries, and tool calls occur in bursts. The 1.31K figure is therefore an empirical average suitable for a preset, not a law of the workload.

### Why this trace matters

This trace provides a real calibration point for a variable that should be first-class in the site model: **number of billable model calls**.

Context length determines the cost of one request. The number of subsequent model calls determines how many times that carried context is read again. A large context with only a few calls remaining may be worth keeping; the same context with dozens of calls remaining may justify compaction or restart.

The trace also demonstrates that one substantial feature-development cycle can naturally consume on the order of **70+ model calls** even with no user discussion in the middle. Therefore the Continue-vs-Restart model should not treat “turn count” as a cosmetic statistic.

---

## Supporting telemetry fragment

An earlier branch-level aggregate was also supplied:

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

These figures are useful as supporting telemetry about cache behavior and a mature ~131K request. They should **not** be treated as a second workload preset, and the 128-turn aggregate alone should not be used to reconstruct a context-growth curve.

---

## Implications for the site model

The future Continue-vs-Restart / Compact tool should distinguish at least:

- current prompt input tokens;
- estimated remaining model calls;
- prompt growth per model call;
- fixed system/tool-definition prefix tokens;
- checkpoint/compact retained baseline;
- restart restore tokens for files, plan, repository state, and summary;
- restart friction, preferably represented as **equivalent extra model calls** rather than an invented dollar value for human effort;
- catastrophic cache-rebuild events as a separate stochastic process from ordinary token-level cache-hit percentage.

### Empirical preset now supported

**Pure autonomous development — observed**

- post-compact baseline: ~45K tokens;
- one feature cycle: ~72 calls;
- endpoint: ~137.7K tokens;
- average net context growth: ~1.31K tokens / model-call interval;
- user intervention: none;
- cache regime: ideal prefix reuse.

This should be the first real workload preset exposed by the site. Other workload presets should not be invented until there is either real telemetry or an explicitly labeled scenario assumption.

---

## Data quality note

The exact call-129 token count was supplied verbally together with the clearer statement that it represented approximately **45.9% of a 300K reference window**. This document therefore records the endpoint as approximately **137.7K tokens**. If raw telemetry for call 129 is later available, replace this approximation and recompute the derived growth rate.
