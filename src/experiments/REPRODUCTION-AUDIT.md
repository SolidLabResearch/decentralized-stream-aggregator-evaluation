# 4 Hz reproduction audit

## Scope and conclusion

This audit compares the historical files that were available on the
`validate/4hz-reproduction` branch and the local sibling repositories. It does
not change historical code or resolve scientific differences by preference.

**QUERY SEMANTICS UNRESOLVED.** Every numbered `4Hz` entrypoint delegates to a
20-second query, but the latest historical notification-aggregator orchestration
does not call that entrypoint: it calls `master-process-main*.ts`, whose child
query was deliberately changed from 20 to 30 seconds in `df2c3b0` (2025-09-09).
There is no repository evidence identifying which pathway produced the results
to be reproduced. The new shared query remains at STEP 20000; it must not be
changed until the campaign to reproduce is identified.

## Historical query comparison

All locations below use `http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-x/`,
`acc-y/`, and `acc-z/` respectively, unless stated otherwise. `X/X/X` means
each window tests `dahccsensors:wearable.acceleration.x`.

| Approach and historical execution path | RANGE | STEP | X/Y/Z streams | X/Y/Z predicates | `:` namespace | Evidence |
| --- | ---: | ---: | --- | --- | --- | --- |
| Heimdall numbered `4Hz/*client.ts` -> `with-aggregator/util/generate-clients.ts` | 60000 | 20000 | acc-x / acc-y / acc-z | X / X / X | `https://rsp.js` | Entry points created in `885d959` (2024-06-18); utility unchanged since then. |
| Heimdall child `master-process-main.ts` -> `child-process-client.ts` | 60000 | 20000 | **n079-11** acc-x / acc-y / acc-z | X / X / X | `https://rsp.js/` | Child/master edits in Sep 2024; not referenced by an n078 script in this repository. |
| Notification numbered `4Hz/*client.ts` -> `with-notification-aggregator/util/generate-clients.ts` | 60000 | 20000 | acc-x / acc-y / acc-z | X / X / X | `https://rsp.js` | Entry points `885d959`; generator remains 20 seconds after `df2c3b0`. |
| Notification orchestration -> `master-process-main*.ts` -> `child-process-client.ts` | 60000 | 30000 | acc-x / acc-y / acc-z | X / X / X | `https://rsp.js` | `df2c3b0` explicitly changed each STEP from 20000 to 30000. |
| Without-aggregator numbered `4Hz/*client.ts` -> `without-aggregator/util/generate-clients.ts` | 60000 | 20000 | acc-x / acc-y / acc-z | X / X / X | `https://rsp.js/` | Generator updated through `c8c834e` (2024-10-15). |
| Without-aggregator `src/scripts/test.sh` -> `util/main.ts` -> `util/client.ts` | 60000 | 20000 | acc-x / acc-y / acc-z | X / X / X | `https://rsp.js/` | `test.sh` added in `fd87f36` (2025-09-09); `main.ts` itself is hard-coded to launch 10 children. |

### X/Y/Z finding

This is **B and C** for the numbered 4 Hz entrypoint paths: all three use
separate `acc-x`, `acc-y`, and `acc-z` stream URLs, but all three query copies
test the acceleration **x** predicate in every window. The same predicate
pattern remains in the historical child implementations. It is not treated as
a correction opportunity.

### Result timing evidence

The repository contains analysis summaries and a one-line resource log, but no
raw client-result timestamp series usable to measure RStream emission cadence.
The sibling `solid-stream-aggregator-evaluation-results` checkout contains
orchestration scripts but no collected campaign CSV/log data. **Historical
result timing cannot be established from files currently available in the
repository.**

## Workflow reconstruction

### Heimdall / historical stream-aggregator campaign

The best direct historical evidence is the local sibling
`solid-stream-aggregator-evaluation-results/scripts/with-stream-aggregator-approach-orchestrator.sh`,
which is a different n079 campaign:

1. Replayer `n079-07`, Pod `n079-11`, client `n079-02`, service `n079-09`.
2. Delete Pod notification/data directories; kill CSS processes, flush Redis,
   and wait five seconds.
3. Kill port 8080, run `initialise-LDES.ts` on the client, then run
   `cd /users/kbisenug/decentralized-stream-aggregator && npx ts-node
   start_aggregator_process.ts` on the service host; wait 15 seconds.
4. Run a selected `master-process-main*.ts` in the historical with-aggregator
   utility directory; start the replayer; wait 720 seconds.
5. Copy client, service, RSP-JS, and replayer logs; delete copied remote logs.

This proves a historical wrapper command and port, but not that it is the n078
4 Hz campaign represented by the new config.

### Notification Aggregator / n078 campaign

`src/scripts/with-notifications-aggregator-approach-orchestrator.sh` (all lines
blamed to `fd87f36`, 2025-09-09) specifies:

1. Replayer `n078-06`, Pod `n078-03`, client `n078-19`, service `n078-22`.
2. Delete Pod notification/data directories and per-client prior logs.
3. Kill port 8085; start client-side `initialise-LDES.ts`; start
   `cd /users/kbisenug/decentralized-stream-notifications-aggregator && npx
   ts-node start_notification_aggregator_process.ts`; wait 15 seconds.
4. Run one of `master-process-main.ts` through `master-process-main-10.ts` on
   the client, then start `cd /users/kbisenug/replayer && npm run start`.
5. Wait 720 seconds, download named client/service/replayer logs, and delete
   remote copied logs.

### Without Aggregator / n078 campaign

`src/scripts/test.sh` (also `fd87f36`) has the n078 topology and:

1. Delete the same Pod directories and prior client logs.
2. Start `initialise-LDES.ts` on the client and the **notification aggregator**
   on `n078-22` (no 15-second startup wait in this script).
3. Run `util/main.ts` on the client, then start the replayer.
4. Wait 720 seconds, collect client/replayer logs, and delete copied remote
   files.

The historical `main.ts` launches 10 child processes regardless of the log
path list. This is an inconsistency, not evidence for a new interpretation.

## Heimdall startup and dependencies

### Historically confirmed

The separate n079 stream-aggregator orchestrator above runs
`npx ts-node start_aggregator_process.ts` from
`/users/kbisenug/decentralized-stream-aggregator`, kills port 8080 first, and
waits 15 seconds. That wrapper is not present in this evaluation checkout, and
the n078 scripts do not start Heimdall. Therefore no exact historical n078
Heimdall command is established.

### Current runnable equivalent (not historical proof)

The local sibling `../solid-stream-aggregator` (on
`refactor/rename-to-heimdall`) exposes `npm run start-aggregation`, which
compiles and runs `dist/index.js aggregation`. `src/index.ts` defaults to port
8080; `config/heimdall_setup.json` supplies the n078 service HTTP/WS URLs.
The package has no `engines` field, so no expected Node version is documented.
Its README additionally starts a local aggregation Solid server on port 3000;
the n078 evaluation topology instead has a separate Pod machine, so starting
that local server would be a topology change.

The evaluation package resolves `rsp-js` as `file:../RSP-JS` (introduced by
`063cde9`, 2024-10-09), which exists beside this checkout. The local Heimdall
checkout instead declares `file:../RSP/RSP-JS`, which does **not** exist from
its present location. This mismatch is a blocker to treating the current
Heimdall checkout as smoke-ready without an explicit dependency decision.

## New framework audit

The three new clients call only `buildActivityIndexQuery` from
`config/query.ts`; no new client embeds a query. `launchConfiguredClients`
reads and validates one config, forks exactly `clientCount` child processes,
and supplies a shared output directory. Every child starts the same reusable
500 ms monitor before its network work; CSVs contain timestamp, user/system
CPU, RSS, heap total/used, and external memory. Child startup failures now
close handles and stop the monitor instead of leaving an interval alive.

Remaining reproduction limitations are deliberate or unresolved:

- New Heimdall uses real child processes, whereas the old numbered 4 Hz
  Heimdall entrypoints used multiple WebSockets in one process. The old
  child-process implementation belongs to the older n079 topology.
- The orchestration runner is structurally safe to inspect but cannot prove
  remote commands, access, deployment paths, or service readiness locally.
- The runner records a launcher PID and sends SIGTERM on cleanup; remote
  service/replayer cleanup still relies on their SSH process termination and
  needs a real one-client smoke verification.

## Heimdall 4 Hz Smoke Test

**Date/time:** 2026-08-24T11:02:07Z.

**Evaluation revision:** `975f489` on `smoke/4hz-heimdall`.
**Requested parameters:** 4 Hz, one client, one iteration, 30 seconds, 500 ms
client resource sampling.

The smoke test was **not executed**. Before making any remote change, a
non-interactive read-only SSH reachability check was made with the documented
historical account (`kbisenug`) and the local SSH agent only. Each target
returned `No route to host` on port 22:

| Machine | Host | Result |
| --- | --- | --- |
| Replayer | `n078-06.wall1.ilabt.imec.be` | Unreachable |
| Solid Pod | `n078-03.wall1.ilabt.imec.be` | Unreachable |
| Client | `n078-19.wall1.ilabt.imec.be` | Unreachable |
| Heimdall service | `n078-22.wall1.ilabt.imec.be` | Unreachable |

The historical PEM paths referenced by the old scripts are not present in this
environment. No bastion, credential, or remote filesystem workaround was
attempted. Consequently the remote Heimdall checkout, RSP-JS checkout, port
8080 owner, running processes, and remote Node/npm versions could not be
observed; their commit SHAs and dependency resolution are unknown.

Local structural validation remains successful: `npm install`,
`npm run check:experiments`, and Heimdall `--preflight`/`--dry-run` with a
one-client/one-iteration/30-second runtime overlay. Preflight will pass only
after the operator supplies a verified remote `HEIMDALL_START_COMMAND`.

Once network access and the remote checkout are confirmed, run this first as a
non-mutating review of the exact command sequence:

```bash
EXPERIMENT_CONFIG_OVERRIDES='{"experiment":{"clientCount":1,"iterations":1,"durationSeconds":30}}' \
HEIMDALL_START_COMMAND='<command verified on n078-22>' \
./src/experiments/orchestration/run-experiment.sh heimdall --preflight

EXPERIMENT_CONFIG_OVERRIDES='{"experiment":{"clientCount":1,"iterations":1,"durationSeconds":30}}' \
HEIMDALL_START_COMMAND='<command verified on n078-22>' \
./src/experiments/orchestration/run-experiment.sh heimdall --dry-run
```

Only after remote inspection verifies the deployed dependency path and confirms
that port 8080 is either free or owned by the intended service should the same
command be run without `--dry-run`. No client connection, event processing,
query result, resource CSV, log collection, or cleanup outcome can be claimed
until then.
