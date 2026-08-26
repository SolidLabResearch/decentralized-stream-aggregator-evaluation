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

Q0, Q1, and Q2 use identical streams, window parameters, numeric projection, and BGP cardinality, but constrain observations using different RDF descriptors: measured property (Q0), producing sensor (Q1), or measurement type (Q2). All three descriptors are present on every benchmark observation. This changes graph-pattern structure while controlling input rate, windowing, arithmetic workload, and expected result cardinality. Q0 remains byte-identical to the canonical legacy query. No query projects or binds a workload-variant label.

| Query | Descriptor in each window | Meaning |
|---|---|---|
| Q0 | `saref:relatesToProperty dahccsensors:wearable.acceleration.x` | measured property |
| Q1 | `saref:measurementMadeBy dahccsensors:E4.A03846.Accelerometer` | producing sensor |
| Q2 | `dcterms:isVersionOf saref:Measurement` | measurement type |

## Dataset A/B/C generation

Data A/B/C are non-overlapping temporal portions of the same audited DAHCC participant-1 accelerometer recording, not different participants or physical axes. The audited input is `/users/kbisenug/dahcc-benchmark-dataset/accelerometer-3minute/32Hz.nt` on `n078-06`, SHA256 `3069b63a7058804bd0640700d1a7fbdd2946af0f19c7f2dbbecf9b42afcf4b15`. Its source observations are retained byte-for-byte in the output: values, observation URIs, RDF representation, and timestamps are never rewritten by the generator.

`src/experiments/datasets/generate-heterogeneous-segments.py` derives three 60-second intervals from the first input timestamp: segment-01 `[t0, t0+60s)`, segment-02 `[t0+60s, t0+120s)`, and segment-03 `[t0+120s, t0+180s)`. For each interval it makes the exact grid `segmentStart + k*250ms`, `k=0..239`, and selects the nearest unused source observation per target. Equal distances resolve to the earlier timestamp. The generator rejects duplicate selections, overlapping segments, reordered timestamps, malformed/non-six-triple observations, and an unexpected source SHA. It performs no interpolation, synthesis, averaging, or random sampling.

The output root contains `manifest.json` and `segment-01/`, `segment-02/`, and `segment-03/`, each with `4Hz.nt` (240 original source lines) and `provenance.json`. Provenance records the complete target grid, selected source index/timestamp, absolute error in microseconds and milliseconds, selection invariants, source metadata, and output SHA256. The manifest records all three output/provenance hashes and cross-segment disjointness. Segment A is segment-01, B is segment-02, and C is segment-03.

The three `acc-x`, `acc-y`, and `acc-z` URLs in each replayer configuration are logical locations required by the evaluation's three-stream topology. They are not claims that the one source recording contains three physical axes. A replayer invocation publishes the same selected segment to those three logical locations.

## Replayer and topology

The isolated topology is Pod `n078-03`, service `n078-22`, replayer `n078-06`, and evaluator `n078-19`. Identity and bastion handling remain configurable through the existing experiment settings.

Each attempt selects exactly one command:

| Data | Command variable |
|---|---|
| A | `HETEROGENEOUS_REPLAYER_START_COMMAND_A` |
| B | `HETEROGENEOUS_REPLAYER_START_COMMAND_B` |
| C | `HETEROGENEOUS_REPLAYER_START_COMMAND_C` |

A0, B0, B1, B2, and C0 select A; C1 selects B; C2 selects C. There is no replayer-command array and no multi-replayer concurrency.

The heterogeneous wrapper freezes replayer revision `a1a2100ea64870da086ec64be1914141eca0fb93`. It rejects an unset, empty, placeholder, or obvious n079 command/config (`n079-*`, `experiment-config.n079`, or `acc-x-1min`) before formal execution. It does not fall back to `REPLAYER_START_COMMAND` or the replayer checkout's committed historical configuration.

The evaluator-local replayer history available during preparation does not contain that exact SHA, so the exact formal revision's config-loading and replay-clock semantics remain a mandatory deployment preflight, not an assumption. The available older revision statically imports `src/config/config.json`, reads all RDF observations sequentially, uses `frequency_event` for queue processing and `frequency_buffer` for publication, sends each queued observation to all configured locations, and rewrites its timestamp on publication; source timestamps do not determine its wall-clock pacing. Before any smoke attempt, confirm the frozen `a1a210...` source has the same static config import and semantics. `prepare-run-owned-replayer.sh` fails if the static config import is absent.

Use `src/experiments/orchestration/prepare-run-owned-replayer.sh` later on `n078-06` to clone the frozen checkout into a unique run-owned directory, check out `a1a210...`, overlay exactly one segment configuration into `src/config/config.json`, record both SHA256s, build, and (only with `--start`) start one `npm run replay` process. It leaves the frozen checkout untouched. The three templates reference `/users/kbisenug/dahcc-benchmark-dataset/heterogeneous/segment-01/4Hz.nt`, `segment-02/4Hz.nt`, and `segment-03/4Hz.nt` respectively. Remove only the explicitly created run-owned directory after its run group has stopped.

## Notification Aggregator n078 configuration

The recovered Notification Aggregator revision `7623967531a4f8a9558c7a8fb91c4ab428199ef5` statically imports `src/config/notif_aggregator_setup.json`; it has no environment/config-path override. That tracked file contains n079 URLs. For n078, do not alter the tracked service checkout. Instead, use `src/experiments/orchestration/prepare-run-owned-notification-aggregator.sh` to clone the frozen service into a unique run-owned directory, overlay `src/experiments/config/notif_aggregator_setup.n078.json` into `src/config/notif_aggregator_setup.json`, record the frozen service and deployment-config SHA256s, and build it. Its optional `--start` starts `npm run start`; otherwise configure the existing orchestrator to start that prepared directory. The n078 values are `http://n078-22.wall1.ilabt.imec.be:8085/` and `ws://n078-22.wall1.ilabt.imec.be:8085/`. Cleanup removes only the explicit run-owned clone after its process group stops. This is the smallest reproducible solution until the service itself gains supported runtime configuration.

## Later n078-06 generation and verification (do not run from this repository now)

After the generator is copied or checked out on `n078-06`, generate the artifacts once with:

```bash
python3 /path/to/decentralized-stream-aggregator-evaluation/src/experiments/datasets/generate-heterogeneous-segments.py \
  --source /users/kbisenug/dahcc-benchmark-dataset/accelerometer-3minute/32Hz.nt \
  --output-root /users/kbisenug/dahcc-benchmark-dataset/heterogeneous \
  --expected-source-sha256 3069b63a7058804bd0640700d1a7fbdd2946af0f19c7f2dbbecf9b42afcf4b15 \
  --strict-source-sha256
```

Verify rather than regenerate with:

```bash
python3 /path/to/decentralized-stream-aggregator-evaluation/src/experiments/datasets/generate-heterogeneous-segments.py \
  --source /users/kbisenug/dahcc-benchmark-dataset/accelerometer-3minute/32Hz.nt \
  --output-root /users/kbisenug/dahcc-benchmark-dataset/heterogeneous \
  --expected-source-sha256 3069b63a7058804bd0640700d1a7fbdd2946af0f19c7f2dbbecf9b42afcf4b15 \
  --strict-source-sha256 --verify
```

The verification JSON prints the source SHA, each segment's count/output SHA/timestamp range/error summary, manifest SHA, and proof of mutually disjoint selected source indices.

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
