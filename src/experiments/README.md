# Configurable 4 Hz evaluation

This is a non-destructive replacement framework for the 4 Hz
increasing-client experiments. It calls the former Aggregator approach
**Heimdall**, the service's current name. Historical code and results remain in
`src/increasing-number-of-clients/` unchanged.

The three supported approaches are `heimdall`, `notification-aggregator`, and
`without-aggregator`. Only 4 Hz is supported. The loader rejects another
frequency, client counts outside 1--10, and non-positive iteration/duration
values.

Edit `config/experiment-config.json` to set `experiment.clientCount`: `1`,
`5`, and `10` launch one, five, and ten independently forked client processes,
respectively. The committed defaults are 4 Hz, one client, 35 iterations, and
720 seconds. Hosts, service URLs, streams, and the 500 ms resource-sampling
interval are also centralized there.

Each child writes `client-N-resource.csv` containing timestamp, CPU user/system
time, RSS, heap total/used, and external memory. It also writes per-client
results and timing CSVs. Output lives under
`results/4hz/<approach>/clients-N/iteration-XX/`, along with `metadata.json`.

Run the four-machine orchestration from the repository root:

```bash
./src/experiments/orchestration/run-experiment.sh heimdall
./src/experiments/orchestration/run-experiment.sh notification-aggregator
./src/experiments/orchestration/run-experiment.sh without-aggregator
```

It reads the configured replayer, Solid Pod, client, and service hosts and
keeps the legacy sequence: clean state, initialize LDES resources, start the
needed service and clients, start the replayer, wait, collect, then stop.
`HEIMDALL_SOLID_START_COMMAND`, `HEIMDALL_SOLID_READY_COMMAND`, and
`HEIMDALL_START_COMMAND` are required because the legacy scripts do not define a
Heimdall deployment command. Remote usernames, repository paths, SSH options,
and the Pod cleanup/startup commands can be overridden by environment variables
documented at the top of the script.

For a new deployment, use the portable SSH and remote-path fields in
`config/deployment-config.example.json` as the basis for a private full
configuration passed by `EXPERIMENT_CONFIG_PATH`. `--dry-run` prints the exact
SSH/SCP sequence without contacting a host; `--preflight` checks local inputs
then read-only SSH reachability, remote paths, Node availability, and the
Heimdall/RSP-JS sibling layout. Runtime readiness is checked only after the
explicit local Solid and Heimdall start commands have been launched. See `DEPLOYMENT.md` for the required four-machine
roles and system-information collection.

For a local structural launcher check, use `npx ts-node` with an alternate
configuration through `EXPERIMENT_CONFIG_PATH`, or a JSON overlay through
`EXPERIMENT_CONFIG_OVERRIDES`; do not edit the committed defaults for a short
smoke run. Query provenance and the one historical
notification-client discrepancy are recorded in `QUERY-DISCREPANCIES.md`.
