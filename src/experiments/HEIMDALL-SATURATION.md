# Heimdall saturation/discovery benchmark

This is a separate Heimdall-only experiment for the Sensors-paper scalability concern. It reports saturation characteristics of the evaluated deployment, not a universal Heimdall capacity.

`same-query` sends byte-identical Qsat0 to every concurrent client. `distinct-query` retains the same three streams, 60 s range, 20 s step, BGP, SELECT expression, and result shape, but gives client *i* a deterministic first window name `:satwNNNN`. Both the `FROM NAMED WINDOW` declaration and its matching `WINDOW` reference change together, so the graph binding is unchanged.

The local registry source proves why this is required. `hash_string_md5` removes whitespace; `QueryRegistry.checkUniqueQuery` then calls `is_equivalent`. The installed equivalence implementation ignores FILTER patterns, so numeric FILTER literals would accidentally reuse. It explicitly compares the first window name before BGP isomorphism: `:satw0000` through `:satw0127` are therefore 128 distinct service reuse identities without changing data predicates, range/step, or result projection. This is an identity-controlled, not a data-filter, family.

The dataset audit reads the local 4 Hz DAHCC source and requires each observation to have numeric `hasValue` plus the three canonical descriptor predicates. Since saturation queries do not add predicates or filters, their eligible observation population and cardinality are unchanged; the audit records the observed numeric range only as provenance.

Discovery defaults to 1, 2, 4, 8, 16, 32, 64, 128 clients, both modes, three repetitions, 120 seconds, 4 Hz and 500 ms sampling: exactly 48 serialized attempts. Mode order rotates by repetition. Failed/invalid attempts are appended to `results/4hz/heimdall-saturation/campaign-logs/attempts.csv` and never replaced. After discovery, bracket the last healthy, first materially degraded, and first reproducibly failed counts, then select only informative points for formal repetitions.

Before replay, the runner requires all client `query_ready` markers and exact service raw counts: registrations, shared-query creations/reuses, and subscriptions. It uses `SATURATION_CLIENT_READY_TIMEOUT_SECONDS` (default 300) without changing normal experiment timeouts. Process groups remain the existing run-owned `setsid` groups and are terminated with group liveness checks.

Metrics remain raw: per-client registration-to-first-result, R2R, client/service CPU/RSS, role-specific network RX/TX, registrations, subscriptions, reuse identities, completeness, errors/timeouts, and readiness time. First-event-to-first-result must be calculated only from service-local monotonic `rsp_insertion.end_monotonic_ns` to service-local `r2r_first_result.end_monotonic_ns`; it includes the window/step progression and is not pure execution time. The analyzer emits CSV, JSON and Markdown summaries but deliberately makes no saturation conclusion.

Commands (after an approved deployment preflight) are:

```bash
./src/experiments/orchestration/run-heimdall-saturation-experiment.sh same-query 2
./src/experiments/orchestration/run-heimdall-saturation-experiment.sh distinct-query 2
./src/experiments/orchestration/run-heimdall-saturation-discovery.sh
```

Use `--dry-run` for command rendering and `--preflight` for local query/config checks only; neither launches infrastructure.
