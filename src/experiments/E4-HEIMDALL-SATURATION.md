# E4: bounded exploratory no-reuse scaling

E1 evaluates increasing client counts for an equivalent query whose Heimdall execution can be shared and reused. E4 is a separate exploratory condition: it increases the number of concurrently executing independent, non-reusable Heimdall query instances.

The default E4 sequence is exactly `1,5,12,15,20` clients, one repetition per count, and no-reuse mode only. Each client registers exactly one query. The campaign stops escalation after the first failed, invalid, timed-out, orchestration-failed, or safety-stopped count; it never retries that count and never runs a larger count afterward.

E4's workload baseline is the observed successful n078 distinct-query n=2/n=8 deployment: Heimdall `e996c2b041c4fbbd206bd3ec8035d7f349cc31eb`, RSP-JS `56e773d8416f978d82a8288802532cabdf8ffef6`, and replayer `a1a2100ea64870da086ec64be1914141eca0fb93`. Historical evaluation checkout `b9052d6a7e1198978826c5fcd2f83d03d4e69799` is provenance only; E4 instead uses the immutable commit containing this modern orchestration. `EVALUATION_REPOSITORY_SHA_EXPECTED` must name that new E4 commit.

The controlled no-reuse query changes only the paired name of the first `WINDOW` declaration and its reference (`:satw0000`, `:satw0001`, ...). Heimdall's current equivalence implementation uses that identity comparison to prevent reuse. Streams, data, RANGE/STEP, BGP, projection, arithmetic, expected cardinality, and computational structure remain matched. Therefore E4 isolates execution multiplicity and is not claimed to represent arbitrary heterogeneous-query complexity.

Before an attempt is healthy, its raw Heimdall initialization must show N registrations, N independent query creations, zero reuse events, and 3N stream subscriptions. All N readiness markers and all N first-result markers/results are also required. Missing clients are reported explicitly.

The existing `saturation-watchdog.sh` runs on the Heimdall, client, Solid/CSS, and replayer hosts. It records raw samples and creates an attempt-local trigger after configurable consecutive violations. The owning orchestrator terminates the current attempt, invokes the existing bounded process-group cleanup, records `SAFETY_STOP`, and prevents escalation.

Every repetition preserves the established registration-before-replay sequence and exact-PGID cleanup. The generated campaign CSV has one row per no-reuse count/repetition with initialization counts, clients receiving results, mean client latency, service CPU/RSS, service RX/TX, result count, and failures.

Commands (set the private deployment config and lifecycle commands first):

```bash
src/experiments/orchestration/run-saturation-campaign.sh --dry-run
src/experiments/orchestration/run-saturation-campaign.sh --preflight
src/experiments/orchestration/run-saturation-campaign.sh --run
```

`E4_CLIENT_COUNTS` and `E4_REPETITIONS` remain supported overrides, but counts are bounded to 20 by the exploratory campaign wrapper. `E4_PROCESS_CPU_PERCENT` (default `95`) is an observation marker only: high Heimdall, client, Solid, or replayer CPU never triggers a safety stop. Machine-safety overrides include `E4_WATCHDOG_INTERVAL_SECONDS` (default `1`), `E4_WATCHDOG_CONSECUTIVE_SAMPLES` (default `3`), `E4_MAX_LOAD_PER_CPU` (default `2`), `E4_MIN_AVAILABLE_MEMORY_PERCENT` (default `20`), `E4_MAX_SWAP_USED_PERCENT` (default `10`), `E4_WATCHDOG_STARTUP_GRACE_SECONDS` (default `30`), `E4_SSH_CONSECUTIVE_FAILURES` (default `3`), and `E4_HEALTH_TIMEOUT_SECONDS` (default `5`). Load safety is based on `load1 / logical_cpu_count`, not an absolute load value; transient violations must persist for the consecutive-sample threshold.

`E4_CONFIG_PATH` is the local private configuration read by the campaign launcher. `EXPERIMENT_CLIENT_CONFIG_PATH` is a distinct path on `n078-19`, consumed by both `initialise-LDES.ts` and the client launcher through `EXPERIMENT_CONFIG_PATH`; it must point to the separately deployed `distinct-query` JSON. These paths must never be set to the same literal path unless the launcher itself runs on the client host.

E4 cleanup is CSS-level and idempotent: `orchestration/e4-solid-stream-cleanup.sh` recursively removes only `pod1/heterogeneous/segment-01/acc-x/`, `acc-y/`, and `acc-z/`; HTTP 404 means already clean. It deliberately leaves `.internal/notifications`, Redis, CSS profiles/authentication, other pods, and other segments untouched. `orchestration/e4-notification-state.sh` records read-only before/after notification directory snapshots. A changed notification count is observable evidence, not an automatic failure; after n=1 it must be inspected by a human before n=5.

Attempt classifications are `HEALTHY`, `INVALID`, `TIMEOUT`, `SAFETY_STOP`, `PROCESS_FAILURE`, and `ORCHESTRATION_FAILURE`. The machine-readable `classification.json` records status, owner when known (`heimdall`, `client`, `solid`, `replayer`, `network/ssh`, or null), trigger metric/value/threshold, client count, and reason. Campaign summaries read the actual `iteration-01` hierarchy and report configured clients, ready clients, registrations, independent executions, reuse events, successful and missing first results, status, owner, and reason.
