# OpsMind — Decision Intelligence

## What is a Decision?

A Decision is the primary output artifact of the OpsMind reasoning pipeline. It is not a chat response. It is a structured, evidence-based, reflection-evaluated intelligence document that gets persisted to organizational memory.

Every Decision contains:

| Field | Description |
|---|---|
| `summary` | Executive summary paragraph |
| `reasoning` | Full reasoning narrative explaining how the agent reached this decision |
| `findings` | Structured findings with severity, evidence, and related metrics |
| `recommendations` | Actionable recommendations with priority, impact, timeframe, and risks |
| `reflection` | Mandatory quality evaluation: confidence assessment, risks, alternatives, limitations |
| `confidenceScore` | 0–1 score, calibrated by the reflection loop |
| `reasoningTrace` | Full step-by-step trace with durations and token counts |
| `toolsUsed` | Which MCP tools were invoked |
| `memoryReferences` | Which historical decisions informed this one |

---

## Decision Lifecycle

```
draft
  ↓ (after synthesis)
pending_reflection
  ↓ (after reflection loop)
reflected
  ↓ (after memory persistence)
finalized
```

A decision can also be marked `superseded` when a newer decision replaces it for the same problem.

---

## Confidence Scoring

Confidence is assigned by the `DecisionSynthesizer` and then **adjusted** by the `ReflectionLoop`.

**Synthesis scoring guide:**
- 0.9–1.0: Multiple corroborating data sources, clear causal chain, strong evidence
- 0.7–0.9: Strong evidence, minor gaps in data
- 0.5–0.7: Moderate evidence, some assumptions required
- 0.3–0.5: Limited data, significant uncertainty
- 0.0–0.3: Insufficient data, highly speculative

**Reflection adjustment:** The evaluator independently assesses whether the confidence score is justified. It can increase or decrease the score based on:
- Evidence quality (is the reasoning grounded in data?)
- Reasoning coherence (does the logic hold?)
- Alternative explanations (were other hypotheses considered?)
- Data completeness (are there obvious gaps?)

**Confidence levels:**
| Score | Level |
|---|---|
| 0.85–1.0 | `very_high` |
| 0.65–0.85 | `high` |
| 0.40–0.65 | `medium` |
| 0.0–0.40 | `low` |

---

## Reflection Quality Assessment

The reflection loop produces one of three assessments:

| Assessment | Meaning | Action |
|---|---|---|
| `approved` | Decision is sound, evidence is strong, recommendations are actionable | Finalize as-is |
| `approved_with_notes` | Decision is acceptable but has minor issues worth noting | Finalize with notes attached |
| `needs_revision` | Decision has significant logical flaws or unsupported conclusions | Finalize with revision requirements noted |

In v1, all assessments result in finalization — the revision requirements are preserved in the reflection for transparency. A future version could trigger a re-planning loop for `needs_revision` decisions.

---

## Finding Severity

| Severity | Meaning |
|---|---|
| `critical` | Immediate business impact, requires urgent action |
| `warning` | Significant issue, requires attention within days |
| `info` | Informational finding, no immediate action required |

---

## Recommendation Priority

| Priority | Meaning | Expected timeframe |
|---|---|---|
| `immediate` | Act within 24–48 hours | Hours to days |
| `high` | Act within the week | Days to a week |
| `medium` | Act within the month | Weeks |
| `low` | Consider for next planning cycle | Months |

---

## How Decisions Improve Over Time

Each decision becomes part of organizational memory. Future reasoning sessions retrieve relevant historical decisions via the `ContextAssembler`:

1. **Pattern recognition:** The agent sees that similar anomalies were investigated before
2. **Outcome learning:** The agent knows which recommendations led to successful outcomes
3. **Confidence calibration:** Historical confidence scores inform current confidence assessment
4. **Hypothesis generation:** Previous root causes become initial hypotheses for new investigations

This is the core value proposition of OpsMind: **the system gets smarter with every investigation**.
