# Initialization-latency benchmark

Run on the service host, with sibling checkouts (do not run the campaign on a development laptop):

```sh
export HEIMDALL_REPO=$HOME/Code/heimdall
export NOTIFICATIONS_AGGREGATOR_REPO=$HOME/Code/solid-notifications-aggregator
export BENCHMARK_POD_URL=http://192.168.0.1/<pod>/
export BENCHMARK_METRIC_URI=<metric-uri>
export BENCHMARK_EXPECTED_STREAM=<optional-single-tree-view-url>
export BENCHMARK_REPETITIONS=30 BENCHMARK_WARMUPS=3
export BENCHMARK_OUTPUT_DIR=$PWD/results/initialization-latency
npm run benchmark:init:preflight
npm run benchmark:init:campaign
```

The adapters invoke the production discovery and notification helper functions in each sibling checkout. Each adapter is a fresh Node process, so application maps cannot reuse a subscription. CSS receives one real POST per invocation; its successful response is required. Warmups run before measured repetitions and are omitted from both CSVs. Measured order alternates Heimdall/Aggregator and Aggregator/Heimdall by repetition.
