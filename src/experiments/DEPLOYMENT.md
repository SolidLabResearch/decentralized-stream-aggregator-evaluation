# Portable four-machine deployment

The evaluation keeps the original isolation: use four separate machines for
the Replayer, Solid Pod, Client, and Heimdall service. A newly allocated
machine is not assumed equivalent to the former n078 infrastructure until its
hardware/software facts have been collected with `collect-system-info.sh`.

| Machine | Required repository/software | Required ports | Role |
| --- | --- | --- | --- |
| Replayer | Replayer repository, Node/npm | Deployment-defined | Emits the 4 Hz source events. |
| Solid Pod | Configured Solid Pod and initialized LDES resources | Deployment-defined Solid HTTP endpoint | Hosts the three configured streams. |
| Client | Evaluation repository, its Node dependencies | Ephemeral callback ports for direct-notification mode | Runs one child process per simulated client. |
| Heimdall | Heimdall checkout, matching RSP-JS checkout, Node/npm | TCP 8080 for HTTP/WebSocket | Registers and evaluates Heimdall queries. |

Copy the deployment fields from
`config/deployment-config.example.json` into a full private deployment config,
then pass it through `EXPERIMENT_CONFIG_PATH`. Set `ssh.bastion` only when a
ProxyJump host is necessary. Leave `ssh.identityFile` null to use the normal
SSH agent/config; prefer `EXPERIMENT_SSH_IDENTITY_FILE` for a local key path.
No key, password, or host-specific command belongs in version control.

Before an experiment, supply the deployment-specific commands as environment
variables: `SOLID_CLEANUP_COMMAND`,
`HEIMDALL_START_COMMAND`, and `REPLAYER_START_COMMAND` (plus the notification
aggregator command when relevant). Review `--preflight` and `--dry-run` before
any mutating run.

Collect immutable infrastructure facts before the first campaign:

```bash
./src/experiments/orchestration/collect-system-info.sh
```

It records hostname, OS/kernel, CPU model, logical CPU count, total RAM, Node,
npm, and available repository SHAs under `results/deployment-metadata/`.
