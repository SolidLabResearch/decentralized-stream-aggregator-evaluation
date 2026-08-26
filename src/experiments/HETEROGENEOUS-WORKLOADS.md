# Heterogeneous workload composition (N=1)

This is a fixed single-client workload-composition evaluation. Every attempt has `clientCount=1`; workloads run sequentially, and exactly one replayer is selected for an attempt. It neither measures concurrent query reuse nor establishes a Heimdall saturation point. Those questions belong to the separate future Heimdall scalability experiment.

## Formal workloads

Each distinct query/data workload is evaluated independently over 35 attempts. r01–r03 are warm-up, r04–r33 are the 30 retained observations, and r34–r35 are cool-down. There is no instance rotation within a repetition set.

| Scenario | Formal workload | Query / data | Retained n per approach |
|---|---|---|---:|
| Same query / same data | A0 | Q0 / A | 30 |
| Different queries / same data | B0 | Q0 / A | 30 |
|  | B1 | Q1 / A | 30 |
|  | B2 | Q2 / A | 30 |
| Different queries / different data | C0 | Q0 / A | 30 |
|  | C1 | Q1 / B | 30 |
|  | C2 | Q2 / C | 30 |

Thus one approach has 245 attempts and 210 retained observations. The three approaches together have 735 attempts and 630 retained observations. B and C each contain three workload variants × n=30, not 90 repetitions of one identical treatment. The variants are not concurrent clients.

Q1 and Q2 use deterministic projected `BIND("variant-i" AS ?queryVariant)` terms while preserving the canonical three windows, RANGE 60000, STEP 20000, and activity-index calculation. Q0 remains byte-identical to the canonical query. Data A/B/C target `segment-01/02/03` logical stream triplets. Segment artifacts remain explicit replayer configuration placeholders until they are generated; no fallback to the historical trace is permitted.

## Replayer and topology

The isolated topology is Pod `n078-03`, service `n078-22`, replayer `n078-06`, and evaluator `n078-19`. Identity and bastion handling remain configurable through the existing experiment settings.

Each attempt selects exactly one command:

| Data | Command variable |
|---|---|
| A | `HETEROGENEOUS_REPLAYER_START_COMMAND_A` |
| B | `HETEROGENEOUS_REPLAYER_START_COMMAND_B` |
| C | `HETEROGENEOUS_REPLAYER_START_COMMAND_C` |

A0, B0, B1, B2, and C0 select A; C1 selects B; C2 selects C. There is no replayer-command array and no multi-replayer concurrency.

## Running and validation

The wrapper accepts only formal workload combinations. `same-query-same-data` accepts instance `0` only; the other scenarios accept `0`, `1`, or `2`.

```bash
./src/experiments/orchestration/run-heterogeneous-experiment.sh \
  notification-aggregator different-query-different-data 2 --dry-run
```

Every run records scenario, workload instance, query/data/replayer variants, query hash, stream triplet, approach, client count, repetition-containing run ID, and timestamp. Per-attempt validation requires one ready client, genuine results, latency/RSP instrumentation, required resources, role-local network data, and the exact formal query/data/replayer mapping.

Campaign validation reads `campaign-logs/attempts.csv`. For every approach × A0/B0/B1/B2/C0/C1/C2 it requires exactly one attempt for every r01–r35, no duplicate repetition ID, and 30 valid retained observations in r04–r33. Invalid attempts are explicitly recorded and are never replaced.

The campaign rotates only execution order to reduce time-order bias; it never rotates instances inside their 35-attempt blocks.

## Analysis

The primary output has 21 rows: seven workload configurations by three approaches. Each row reports retained valid n and per-workload mean, SD, median, Q1, and Q3 before any scenario aggregation.

The secondary reviewer-facing output has the three scenarios by approach. A is one variant × n=30. B and C are three variants × n=30. Scenario metrics are equal-weighted means of the per-variant statistics; if a variant has no valid retained observation, the scenario aggregate is unavailable. This prevents a variant with more valid rows from receiving greater weight. Per-workload and scenario outputs are emitted as CSV, JSON, and Markdown for paper figures and supplements.

Network roles remain separate because packets may be observed at multiple host boundaries.
