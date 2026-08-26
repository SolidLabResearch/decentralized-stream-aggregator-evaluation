# Configurable 4 Hz evaluation

This is a non-destructive replacement framework for the 4 Hz
increasing-client experiments. It calls the former Aggregator approach
**Heimdall**, the service's current name. Historical code and results remain in
`src/increasing-number-of-clients/` unchanged.

The three supported approaches are `heimdall`, `notification-aggregator`, and
`without-aggregator`. Only 4 Hz is supported. The loader rejects another
frequency, client counts outside 1--30, and non-positive iteration/duration
values.

`experiment.clientArrivalMode` defaults to `simultaneous`, preserving the
original benchmark. Set it to `staged-reuse` with Heimdall or Notification
Aggregator to launch client 0, wait for its genuine first result, and then launch
clients 1..N-1 together.

Set `experiment.clientCount` to `2` for the smoke test, or to a final matrix
count of `1`, `5`, `10`, `20`, or `30`. Each value launches that many
independently forked client processes on the same client host. The committed defaults are 4 Hz, one client, 35 iterations, and
720 seconds. Hosts, service URLs, streams, and the 500 ms resource-sampling
interval are also centralized there.

Each child writes `client-N-resource.csv` containing the original cumulative
CPU counters plus additive delta/utilization columns, RSS, heap total/used, and
external memory. The launcher writes `client-host-resource.csv` from
`/proc/stat` and `/proc/meminfo`. It also writes per-client results and timing
CSVs. Output lives under
`results/4hz/<approach>/clients-N/iteration-XX/`, along with `metadata.json`.

The empirical experiment is colocated concurrent-client scaling: one repetition
is the independent unit, and all clients share the configured client host. It is
separate from the theoretical distributed `R_s + nR_c` analysis. Final batches
use 35 repetitions and retain iterations 04--33 (N=30 repetitions).

`registration_to_first_result` is client-local. Heimdall requires an explicit
query-ready acknowledgement; Notifications Aggregator requires an explicit
per-stream subscription-ready acknowledgement for all three streams; the
without-aggregator client starts after all three successful Solid subscription
establishment responses. The first-result marker is written only when that same
client observes its first result. These boundaries are never computed from
cross-machine clocks and are distinct from canonical `r2r_first_result`.

In `staged-reuse`, client 0 reports `cold_registration_to_first_result`. Heimdall
late clients report `reuse_registration_to_first_result`; Notification
Aggregator late clients report `join_registration_to_first_result`. The client
records the architecture-specific registration boundary and first-result
monotonic timestamps, result payload hash, and result/window identifier when
present. The Notification Aggregator registration boundary is the first
outbound stream-subscription request; JSON/control messages are excluded from
staged first-result boundaries.

The architectures retain different meanings: Heimdall validates one shared RSP
query creation, N-1 query reuse registrations, and three upstream subscriptions;
Notification Aggregator validates three unique successful upstream subscriptions
from its existing service log and one local RSP result lifecycle per client. Its
joining clients do not reuse the local RSP query.

Run the four-machine orchestration from the repository root:

```bash
./src/experiments/orchestration/run-experiment.sh heimdall
./src/experiments/orchestration/run-experiment.sh notification-aggregator
./src/experiments/orchestration/run-experiment.sh without-aggregator
```

It reads the configured replayer, Solid Pod, client, and service hosts and
keeps the legacy sequence: clean state, initialize LDES resources on the
client against the remote Solid Pod, start the needed service and clients,
start the replayer, wait, collect, then stop. `HEIMDALL_START_COMMAND` is
required because the legacy scripts do not define a Heimdall deployment
command. Remote usernames, repository paths, SSH options,
and the Pod cleanup/startup commands can be overridden by environment variables
documented at the top of the script.
Set `EXPERIMENT_CLIENT_CONFIG_PATH` to the deployment configuration path visible
on the client machine; source initialization requires it explicitly.

For a new deployment, use the portable SSH and remote-path fields in
`config/deployment-config.example.json` as the basis for a private full
configuration passed by `EXPERIMENT_CONFIG_PATH`. `--dry-run` prints the exact
SSH/SCP sequence without contacting a host; `--preflight` checks local inputs
then read-only SSH reachability, remote paths, Node availability, and the
Heimdall/RSP-JS sibling layout. Runtime readiness is checked after the
configured Heimdall start command has been launched. See `DEPLOYMENT.md` for the required four-machine
roles and system-information collection.

For a local structural launcher check, use `npx ts-node` with an alternate
configuration through `EXPERIMENT_CONFIG_PATH`, or a JSON overlay through
`EXPERIMENT_CONFIG_OVERRIDES`; do not edit the committed defaults for a short
smoke run. Query provenance and the one historical
notification-client discrepancy are recorded in `QUERY-DISCREPANCIES.md`.
