# Heimdall Evaluation

This repository is the evaluation artifact for [Heimdall](https://github.com/SolidLabResearch/heimdall). It contains evaluation clients, experiment orchestration, deployment configuration, analysis scripts, metric definitions, and reproducibility documentation.

The repository preserves several experiment snapshots on separate branches. The root `main` branch is the navigation page; the experiment code and its matching configuration are on the branch identified in the tables below.

Related service implementation: [Solid Notifications Aggregator](https://github.com/SolidLabResearch/solid-notifications-aggregator).

## Evaluation Overview

The repository evaluates streaming-query processing over Solid data using three approaches where supported by the experiment branch:

1. **Without Aggregator**: the client-side processing path, in which the client performs the local stream/query work.
2. **Solid Notifications Aggregator**: a service-mediated notification path with upstream stream subscriptions and a local RSP result lifecycle per client.
3. **Heimdall**: a service-mediated path in which queries are registered with Heimdall; the multi-client framework can measure shared-query creation, query reuse, and the service-side RSP lifecycle.

The branch documentation identifies the following evaluation questions and measurement families:

- component and stage latency, including stream discovery, subscription, parsing, RSP insertion, window-query processing, and result delivery where observable;
- initialization latency, including a standalone comparison of Heimdall and the Solid Notifications Aggregator;
- increasing-client experiments and query-reuse behavior in the configurable 4 Hz framework;
- Heimdall saturation/discovery and the bounded E4 condition with independent, non-reusable query identities;
- heterogeneous query/data workload composition at `N=1`;
- client/service CPU and memory measurements and role-specific network RX/TX measurements; and
- historical analysis of the without-aggregator/client-side path and comparisons with service-mediated approaches.

These are repository capabilities and experiment definitions, not a claim that every branch contains a completed formal campaign or publishable result. Read the branch-specific methodology, deployment, and audit documents before interpreting a result directory.

## Why the experiments are on branches

The experiments change together with their clients, orchestration scripts, configuration schemas, companion-repository revisions, and analysis code. They are therefore kept as branch-scoped snapshots rather than combined into one mutable default configuration. In particular, the `evaluation/*` branches are the named evaluation snapshots, `benchmark-*` branches contain standalone or supporting benchmarks, `codex/*` branches preserve development precursors, and the remaining branches provide analysis, deployment, smoke-test, or reproduction-support history.

Always switch to one complete experiment branch before installing dependencies or running an experiment. Do not copy an experiment script, configuration file, or result directory from a different branch unless the branch documentation explicitly requires it.

## Repository Branches

The links use the repository URL [github.com/SolidLabResearch/heimdall-evaluation](https://github.com/SolidLabResearch/heimdall-evaluation). At the time of this audit, the first eight rows were advertised by `origin`; the rows marked **local-only** were additional branch refs present in the checkout but not advertised by that remote.

| Branch | Purpose | Status | Important documentation |
| --- | --- | --- | --- |
| [`main`](https://github.com/SolidLabResearch/heimdall-evaluation/tree/main) | Landing page for the repository. It also retains the earlier analysis/result organization. | Baseline / entry point | [`src/README.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/main/src/README.md), [`analysis-results/README.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/main/analysis-results/README.md) |
| [`evaluation/heterogeneous-workloads-n1`](https://github.com/SolidLabResearch/heimdall-evaluation/tree/evaluation/heterogeneous-workloads-n1) | Defines the single-client heterogeneous workload-composition evaluation: same query/data, different queries/same data, and different queries/different data. | Formal evaluation branch | [`HETEROGENEOUS-WORKLOADS.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/evaluation/heterogeneous-workloads-n1/src/experiments/HETEROGENEOUS-WORKLOADS.md), [`COMPONENT-METRICS.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/evaluation/heterogeneous-workloads-n1/src/experiments/COMPONENT-METRICS.md), [`REPRODUCTION-AUDIT.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/evaluation/heterogeneous-workloads-n1/src/experiments/REPRODUCTION-AUDIT.md) |
| [`evaluation/heimdall-saturation-e4`](https://github.com/SolidLabResearch/heimdall-evaluation/tree/evaluation/heimdall-saturation-e4) | Adds the bounded E4 no-reuse scaling campaign and its watchdog, classification, cleanup, and completeness checks. | Evaluation branch; bounded exploratory E4, not a universal capacity claim | [`E4-HEIMDALL-SATURATION.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/evaluation/heimdall-saturation-e4/src/experiments/E4-HEIMDALL-SATURATION.md), [`HEIMDALL-SATURATION.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/evaluation/heimdall-saturation-e4/src/experiments/HEIMDALL-SATURATION.md), [`DEPLOYMENT.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/evaluation/heimdall-saturation-e4/src/experiments/DEPLOYMENT.md) |
| [`benchmark-initialization-latency`](https://github.com/SolidLabResearch/heimdall-evaluation/tree/benchmark-initialization-latency) | Contains the standalone initialization-latency benchmark and the integrated configurable 4 Hz experiment framework, including the current saturation and heterogeneous-workload documentation. | Benchmark / current integrated reproduction snapshot | [`src/README-initialization-latency.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/benchmark-initialization-latency/src/README-initialization-latency.md), [`src/experiments/README.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/benchmark-initialization-latency/src/experiments/README.md), [`DEPLOYMENT.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/benchmark-initialization-latency/src/experiments/DEPLOYMENT.md), [`REPRODUCTION-AUDIT.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/benchmark-initialization-latency/src/experiments/REPRODUCTION-AUDIT.md) |
| [`analysis-work`](https://github.com/SolidLabResearch/heimdall-evaluation/tree/analysis-work) | Refactors and extends the analysis layer, with analysis scripts, generated outputs, performance comparisons, system-metric reports, and out-of-order-event reports. | Analysis / historical work | [`analysis-refactored/README.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/analysis-work/analysis-refactored/README.md), [`analysis-results/README.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/analysis-work/analysis-results/README.md), [`analysis-refactored/reports/performance-comparison-table-1client.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/analysis-work/analysis-refactored/reports/performance-comparison-table-1client.md) |
| [`codex/heimdall-saturation`](https://github.com/SolidLabResearch/heimdall-evaluation/tree/codex/heimdall-saturation) | Implements the earlier Heimdall saturation/discovery benchmark, including the same-query maximum-reuse and controlled distinct-query conditions. | Development precursor; superseded by [`evaluation/heimdall-saturation-e4`](https://github.com/SolidLabResearch/heimdall-evaluation/tree/evaluation/heimdall-saturation-e4) for the bounded E4 campaign | [`HEIMDALL-SATURATION.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/codex/heimdall-saturation/src/experiments/HEIMDALL-SATURATION.md), [`COMPONENT-METRICS.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/codex/heimdall-saturation/src/experiments/COMPONENT-METRICS.md), [`REPRODUCTION-AUDIT.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/codex/heimdall-saturation/src/experiments/REPRODUCTION-AUDIT.md) |
| [`codex/initialization-latency-benchmark`](https://github.com/SolidLabResearch/heimdall-evaluation/tree/codex/initialization-latency-benchmark) | Earlier implementation of the initialization benchmark and supporting 4 Hz framework. Its history is an ancestor of `benchmark-initialization-latency`. | Development precursor / benchmark prototype | [`src/experiments/README.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/codex/initialization-latency-benchmark/src/experiments/README.md), [`DEPLOYMENT.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/codex/initialization-latency-benchmark/src/experiments/DEPLOYMENT.md), [`NETWORK-TRAFFIC.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/codex/initialization-latency-benchmark/src/experiments/NETWORK-TRAFFIC.md) |
| [`fix/deployment-smoke-readiness`](https://github.com/SolidLabResearch/heimdall-evaluation/tree/fix/deployment-smoke-readiness) | Hardens deployment configuration, readiness gates, first-result instrumentation, and remote-path handling used by the 4 Hz framework. | Infrastructure / support branch | [`DEPLOYMENT.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/fix/deployment-smoke-readiness/src/experiments/DEPLOYMENT.md), [`REPRODUCTION-AUDIT.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/fix/deployment-smoke-readiness/src/experiments/REPRODUCTION-AUDIT.md), [`COMPONENT-METRICS.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/fix/deployment-smoke-readiness/src/experiments/COMPONENT-METRICS.md) |
| [`evaluation/component-latency-instrumentation`](https://github.com/SolidLabResearch/heimdall-evaluation/tree/evaluation/component-latency-instrumentation) **(local-only)** | Unifies component-latency instrumentation and records the mapping from manuscript rows to raw metrics, boundaries, join keys, and clock types. | Evaluation instrumentation ref; not advertised by `origin` in this checkout | [`COMPONENT-METRICS.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/evaluation/component-latency-instrumentation/src/experiments/COMPONENT-METRICS.md), [`DEPLOYMENT.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/evaluation/component-latency-instrumentation/src/experiments/DEPLOYMENT.md), [`REPRODUCTION-AUDIT.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/evaluation/component-latency-instrumentation/src/experiments/REPRODUCTION-AUDIT.md) |
| [`evaluation/heterogeneous-workloads-n079`](https://github.com/SolidLabResearch/heimdall-evaluation/tree/evaluation/heterogeneous-workloads-n079) **(local-only)** | Ports the heterogeneous workload evaluation to the later n079 deployment path; its distinguishing commits are the n079 E3 replayer deployment changes. | Evaluation variant / local-only deployment port; use `evaluation/heterogeneous-workloads-n1` for the published n1 snapshot | [`HETEROGENEOUS-WORKLOADS.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/evaluation/heterogeneous-workloads-n079/src/experiments/HETEROGENEOUS-WORKLOADS.md), [`DEPLOYMENT.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/evaluation/heterogeneous-workloads-n079/src/experiments/DEPLOYMENT.md), [`REPRODUCTION-AUDIT.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/evaluation/heterogeneous-workloads-n079/src/experiments/REPRODUCTION-AUDIT.md) |
| [`infra/portable-four-machine-evaluation`](https://github.com/SolidLabResearch/heimdall-evaluation/tree/infra/portable-four-machine-evaluation) **(local-only)** | Makes the four-machine deployment configurable and portable across the replayer, Solid Pod, client, and Heimdall service roles. | Infrastructure / development precursor | [`DEPLOYMENT.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/infra/portable-four-machine-evaluation/src/experiments/DEPLOYMENT.md), [`REPRODUCTION-AUDIT.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/infra/portable-four-machine-evaluation/src/experiments/REPRODUCTION-AUDIT.md) |
| [`refactor/4hz-configurable-evaluation`](https://github.com/SolidLabResearch/heimdall-evaluation/tree/refactor/4hz-configurable-evaluation) **(local-only)** | Introduces the configurable 4 Hz evaluation framework that later branches extend with deployment and experiment-specific behavior. | Development precursor / framework refactor | [`QUERY-DISCREPANCIES.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/refactor/4hz-configurable-evaluation/src/experiments/QUERY-DISCREPANCIES.md) |
| [`smoke/4hz-heimdall`](https://github.com/SolidLabResearch/heimdall-evaluation/tree/smoke/4hz-heimdall) **(local-only)** | Records the 4 Hz Heimdall smoke-test validation state and its reproduction constraints. | Smoke-test / validation support | [`REPRODUCTION-AUDIT.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/smoke/4hz-heimdall/src/experiments/REPRODUCTION-AUDIT.md), [`QUERY-DISCREPANCIES.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/smoke/4hz-heimdall/src/experiments/QUERY-DISCREPANCIES.md) |
| [`validate/4hz-reproduction`](https://github.com/SolidLabResearch/heimdall-evaluation/tree/validate/4hz-reproduction) **(local-only)** | Audits the historical 4 Hz topology, query semantics, dependency provenance, and limits of what can be reproduced from the available files. | Reproduction audit / historical support | [`REPRODUCTION-AUDIT.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/validate/4hz-reproduction/src/experiments/REPRODUCTION-AUDIT.md), [`QUERY-DISCREPANCIES.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/validate/4hz-reproduction/src/experiments/QUERY-DISCREPANCIES.md) |

### Branch selection in one sentence

Use `benchmark-initialization-latency` for the initialization-latency benchmark and the integrated configurable 4 Hz framework; use `evaluation/heterogeneous-workloads-n1` for the formal `N=1` heterogeneous workload composition; use `evaluation/heimdall-saturation-e4` for the bounded no-reuse E4 campaign; use `analysis-work` for analysis-only work; and treat `codex/*`, local-only evaluation refs, and support refs as historical or development context unless their documentation explicitly matches the experiment you intend to reproduce.

## Experiment Map

| Evaluation question | Branch | Main entry point |
| --- | --- | --- |
| Initialization latency: Heimdall versus Solid Notifications Aggregator | [`benchmark-initialization-latency`](https://github.com/SolidLabResearch/heimdall-evaluation/tree/benchmark-initialization-latency) | [`src/README-initialization-latency.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/benchmark-initialization-latency/src/README-initialization-latency.md); `npm run benchmark:init:preflight`, then `npm run benchmark:init:campaign` |
| 4 Hz increasing-client evaluation across the three approaches | [`benchmark-initialization-latency`](https://github.com/SolidLabResearch/heimdall-evaluation/tree/benchmark-initialization-latency) | [`src/experiments/README.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/benchmark-initialization-latency/src/experiments/README.md); `src/experiments/orchestration/run-experiment.sh` |
| Heimdall maximum-reuse/discovery benchmark | [`codex/heimdall-saturation`](https://github.com/SolidLabResearch/heimdall-evaluation/tree/codex/heimdall-saturation) | [`HEIMDALL-SATURATION.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/codex/heimdall-saturation/src/experiments/HEIMDALL-SATURATION.md); this is the precursor lineage |
| Heimdall independent-query scaling / E4 | [`evaluation/heimdall-saturation-e4`](https://github.com/SolidLabResearch/heimdall-evaluation/tree/evaluation/heimdall-saturation-e4) | [`E4-HEIMDALL-SATURATION.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/evaluation/heimdall-saturation-e4/src/experiments/E4-HEIMDALL-SATURATION.md); `src/experiments/orchestration/run-saturation-campaign.sh` |
| Heterogeneous queries and data at one client | [`evaluation/heterogeneous-workloads-n1`](https://github.com/SolidLabResearch/heimdall-evaluation/tree/evaluation/heterogeneous-workloads-n1) | [`HETEROGENEOUS-WORKLOADS.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/evaluation/heterogeneous-workloads-n1/src/experiments/HETEROGENEOUS-WORKLOADS.md); `src/experiments/orchestration/run-heterogeneous-campaign.sh` |
| Component latency and raw metric boundary mapping | [`evaluation/component-latency-instrumentation`](https://github.com/SolidLabResearch/heimdall-evaluation/tree/evaluation/component-latency-instrumentation) **(local-only ref)** | [`COMPONENT-METRICS.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/evaluation/component-latency-instrumentation/src/experiments/COMPONENT-METRICS.md); `analysis/component-latency/` |
| CPU, memory, network, and result-completeness analysis | Experiment-specific evaluation branches, especially [`benchmark-initialization-latency`](https://github.com/SolidLabResearch/heimdall-evaluation/tree/benchmark-initialization-latency) and [`evaluation/heimdall-saturation-e4`](https://github.com/SolidLabResearch/heimdall-evaluation/tree/evaluation/heimdall-saturation-e4) | [`NETWORK-TRAFFIC.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/benchmark-initialization-latency/src/experiments/NETWORK-TRAFFIC.md), [`COMPONENT-METRICS.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/benchmark-initialization-latency/src/experiments/COMPONENT-METRICS.md), and the branch-local `analysis/` scripts |
| Historical/client-side versus service-mediated analysis | [`analysis-work`](https://github.com/SolidLabResearch/heimdall-evaluation/tree/analysis-work) and [`main`](https://github.com/SolidLabResearch/heimdall-evaluation/tree/main) | [`analysis-refactored/README.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/analysis-work/analysis-refactored/README.md) and [`analysis-results/README.md`](https://github.com/SolidLabResearch/heimdall-evaluation/blob/main/analysis-results/README.md) |

The saturation and heterogeneous branches are deliberately separate. The saturation documents hold the controlled reuse/non-reuse identity experiment; the heterogeneous documents hold genuinely different query/data workload structures. Do not substitute one for the other.

## Related Repositories and Runtime Inputs

The branch documentation and configuration files identify these companion components:

- [Heimdall](https://github.com/SolidLabResearch/heimdall), the service evaluated by the Heimdall paths. The deployment scripts expect a matching Heimdall checkout and its service command.
- [Solid Notifications Aggregator](https://github.com/SolidLabResearch/solid-notifications-aggregator), used by the notification-aggregator paths and by the initialization-latency benchmark.
- **RSP-JS**, required as a sibling checkout by the evaluation package (`rsp-js` is declared as `file:../RSP-JS`) and pinned by the deployment preflight in the newer experiment branches.
- **Replayer**, the four-machine source-event process. The formal branches pin or validate a replayer revision and use branch-specific replayer configuration templates.
- **Solid Pod / Community Solid Server deployment**, which hosts the configured LDES streams. The deployment documentation treats it as a separate machine/role rather than as a local test fixture.

The exact companion revisions, host names, paths, service-start commands, and private credentials are deployment inputs. They must come from the selected branch’s configuration and preflight; they are not interchangeable across branch snapshots.

## Reproducing an Experiment

Start from a clean checkout of one experiment branch:

```bash
git clone https://github.com/SolidLabResearch/heimdall-evaluation.git
cd heimdall-evaluation

git fetch --all
git branch -a

git switch <experiment-branch>
npm install
```

Then follow the documentation linked in the branch table. The general sequence is:

1. Read the branch’s experiment README and its `DEPLOYMENT.md`, `REPRODUCTION-AUDIT.md`, and metric documentation where present.
2. Record the exact evaluation revision with `git rev-parse HEAD`.
3. Prepare the required sibling checkouts (Heimdall, RSP-JS, the replayer, and—when applicable—the Solid Notifications Aggregator) at the revisions required by that branch.
4. Use a private deployment configuration or environment overlay. Do not put SSH keys, passwords, host-specific start commands, or real credentials in the repository.
5. Run the branch’s `--preflight` and `--dry-run` modes before any mutating run. The newer four-machine framework explicitly uses these modes to inspect local inputs, remote reachability, paths, dependency revisions, and the rendered SSH/SCP sequence.
6. Run the documented experiment command and keep its generated output under the branch’s documented results hierarchy. Do not reuse result directories from another branch or configuration.
7. Run the matching analysis script only after checking that the raw output has the completeness and provenance files required by that branch’s validator.

For the current integrated 4 Hz branch, the three architecture entry points are:

```bash
./src/experiments/orchestration/run-experiment.sh heimdall
./src/experiments/orchestration/run-experiment.sh notification-aggregator
./src/experiments/orchestration/run-experiment.sh without-aggregator
```

For initialization latency, the branch documentation requires the benchmark-specific environment variables and then:

```bash
npm run benchmark:init:preflight
npm run benchmark:init:campaign
```

For E4, inspect the private configuration first and use the bounded campaign wrapper’s documented phases:

```bash
src/experiments/orchestration/run-saturation-campaign.sh --dry-run
src/experiments/orchestration/run-saturation-campaign.sh --preflight
src/experiments/orchestration/run-saturation-campaign.sh --run
```

These commands are not substitutes for the branch documentation: the 4 Hz and E4 workflows require deployment-specific commands and companion checkouts, while the initialization benchmark requires a Pod URL, metric URI, and sibling repositories. A successful local type-check, test, preflight, or dry-run does not by itself establish that a remote campaign ran or that results are available.

## License

This code is copyrighted by [Ghent University - imec](https://www.ugent.be/ea/idlab/en) and released under the [MIT Licence](./LICENCE)

## Contact

For any questions, please contact [Kush](mailto:kushagrasingh.bisen@ugent.be).
