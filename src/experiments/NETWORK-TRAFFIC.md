# Network traffic methodology

Each repetition records Linux kernel interface byte counters at the workload boundary: after every client is ready and immediately before replay starts, then after the replay process completes and before teardown.  The two snapshots are local commands on the Solid server, service (when present), client host, and replayer; the runner does not poll counters during a workload.

The runner resolves the interface with `ip route get` towards another experiment node, rejects `lo`, and records the chosen interface in `network.csv`.  Set `EXPERIMENT_NETWORK_INTERFACE_SOLID`, `EXPERIMENT_NETWORK_INTERFACE_SERVICE`, `EXPERIMENT_NETWORK_INTERFACE_CLIENT`, or `EXPERIMENT_NETWORK_INTERFACE_REPLAYER` to override route selection. `EXPERIMENT_NETWORK_SNAPSHOT_ROOT` changes the remote snapshot directory.

RX and TX are measured independently from `/sys/class/net/<interface>/statistics/{rx_bytes,tx_bytes}`.  Deltas use the actual `/proc/uptime` monotonic elapsed duration; average Mbps is `bytes * 8 / seconds / 1,000,000`. Each row is a host boundary. Do not sum values across hosts: both ends can observe the same packet. The client row is aggregate host traffic for all concurrent clients. Without Aggregator has no service row, meaning service traffic is N/A rather than zero.

Use `npm run analyze:network-traffic -- results/4hz` for retained repetitions 04--33. It prints per-approach, client-count, and role RX/TX mean, sample SD, median, Q1, Q3, and average throughput. It does not create a cross-host total.
