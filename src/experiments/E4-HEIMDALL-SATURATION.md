# E4: bounded Heimdall consumer-capacity discovery

E4 measures the safe onset of saturation while increasing simultaneous consumers. A crash is never a result or a criterion: a guardrail crossing stops the current attempt cleanly and prohibits larger automatic N values.

`maximum-reuse` registers N equivalent queries and must observe N registrations, one created query execution, N-1 reuses, and three upstream subscriptions. `no-reuse` changes only the paired name of the first `WINDOW` declaration and its reference (`:satw0000`, `:satw0001`, ...). Heimdall's equivalence implementation uses that name in its identity comparison. Streams, data, RANGE/STEP, BGP, projection, cardinality and complexity are unchanged, so this is a controlled non-reusable identity—not E3-style query/data heterogeneity. It must observe N registrations/created executions, zero reuses, and 3N upstream subscriptions. Counts are read from Heimdall initialization output; a mismatch is `INVALID`.

Classifications are `HEALTHY`, `SATURATING`, `SAFETY_STOP`, and `INVALID`. `SATURATING` is application failure (default 5%), registration/first-result failure, timeout, or configured latency threshold while hosts are below hard guards. `SAFETY_STOP` records the sampled host/metric rather than calling Heimdall failed. First client-host guard crossing maps to `LOAD_GENERATOR_LIMIT`; Heimdall maps to `HEIMDALL_SATURATION`; Solid/replayer/network have corresponding owners.

Defaults: one-second sampling; available memory at least 20% (immediate stop); 90% process CPU for five consecutive samples; FD use below 75% of a discovered limit; and a configurable current-attempt process-count margin of four. Missing metrics are emitted as `metric_unavailable`, never zero. Each role watchdog writes `watchdog.csv`, atomically creates a trigger, stops further launch, and cleanup uses only recorded `setsid` PID/PGIDs: TERM, five-second grace, then KILL surviving exact groups. No `pkill`/`killall` or command-name cleanup is permitted.

Every attempt has metadata/classification/watchdog/PID-PGID data plus the existing initialization, window, client, service, resource and network artifacts. Strict pre/post gates check stale E4 groups and marker files, ports, SHAs, dataset, reachability, writable directories and metric collection. Any pre/post, cleanup, semantic, backup or infrastructure failure stops the campaign. A configured `E4_BACKUP_COMMAND` receives `E4_ATTEMPT_DIR`; failure stops before a larger N. It must not use `rsync --delete`.

Discovery is serialized and defaults to `32,64,96,128,...`; a next value over 1.5× the last healthy value is refused. It stops on its first non-healthy result. Confirmation accepts only user-provided N values and repetitions; it never auto-bisects an unsafe boundary.

Commands (set real n079 values and lifecycle commands first):

```bash
src/experiments/orchestration/run-saturation-campaign.sh --dry-run
src/experiments/orchestration/run-saturation-campaign.sh --preflight
src/experiments/orchestration/run-saturation-campaign.sh --smoke
src/experiments/orchestration/run-saturation-campaign.sh --discover
src/experiments/orchestration/run-saturation-campaign.sh --confirm 48,64 3
```
