#!/usr/bin/env bash
set -euo pipefail

usage() { echo "Usage: $0 {heimdall|notification-aggregator|without-aggregator} {same-query-same-data|different-query-same-data|different-query-different-data} {0|1|2} [--dry-run|--preflight]" >&2; }
approach="${1:-}"; workload="${2:-}"; instance="${3:-}"; mode="${4:-}"
case "$approach" in heimdall|notification-aggregator|without-aggregator) ;; *) usage; exit 2;; esac
case "$workload" in same-query-same-data|different-query-same-data|different-query-different-data) ;; *) usage; exit 2;; esac
case "$instance" in 0|1|2) ;; *) usage; exit 2;; esac
case "$mode" in ""|--dry-run|--preflight) ;; *) usage; exit 2;; esac
if [[ "$workload" == "same-query-same-data" && "$instance" != "0" ]]; then
  echo "same-query-same-data has one formal workload configuration: instance 0 (Q0/Data A)." >&2
  exit 2
fi

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
config_path="${EXPERIMENT_CONFIG_PATH:-$root/src/experiments/config/experiment-config.n078.heterogeneous.json}"
[[ -f "$config_path" ]] || { echo "Heterogeneous config does not exist: $config_path" >&2; exit 2; }
configured_count="$(node -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); process.stdout.write(String(c.experiment && c.experiment.clientCount));' "$config_path")"
[[ "$configured_count" == "1" ]] || { echo "Heterogeneous config must specify clientCount=1; found $configured_count." >&2; exit 2; }
client_config_path="${EXPERIMENT_CLIENT_CONFIG_PATH:-}"
[[ -n "$client_config_path" ]] || { echo "EXPERIMENT_CLIENT_CONFIG_PATH must name this config on n078-19." >&2; exit 2; }

# N=1 makes simultaneous arrival neutral; retain the existing mode rather than introducing staged-reuse semantics.
data_variant="A"
if [[ "$workload" == "different-query-different-data" ]]; then
  case "$instance" in 0) data_variant="A";; 1) data_variant="B";; 2) data_variant="C";; esac
fi
overrides='{"experiment":{"clientCount":1,"clientArrivalMode":"simultaneous","workloadMode":"'"$workload"'","workloadInstance":'"$instance"',"replayerDataVariant":"'"$data_variant"'"}}'
run_id="${EXPERIMENT_RUN_ID:-hetero-${workload//-}-${approach}-i${instance}-n1-$(date -u +%Y%m%dT%H%M%SZ)}"
output_root="results/4hz/heterogeneous/$workload/$approach/clients-1/run-$run_id"
replayer_variable="HETEROGENEOUS_REPLAYER_START_COMMAND_${data_variant}"
replayer_command="${!replayer_variable:-}"
if [[ -z "$replayer_command" && "$mode" != "--dry-run" ]]; then
  echo "Set $replayer_variable to one 4 Hz replayer command for data variant $data_variant." >&2
  exit 2
fi
if [[ "$mode" != "--dry-run" ]]; then
  normalized_replayer_command="$(printf '%s' "$replayer_command" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
  if [[ "$normalized_replayer_command" == *"placeholder"* || "$normalized_replayer_command" == *"set_to"* || "$normalized_replayer_command" == *"<"* || "$normalized_replayer_command" == *">"* || "$normalized_replayer_command" == *"..."* || "$normalized_replayer_command" == *"n079-"* || "$normalized_replayer_command" == *"experiment-config.n079"* || "$normalized_replayer_command" == *"acc-x-1min"* ]]; then
    echo "$replayer_variable is a placeholder or historical n079 replayer command/config; configure a dedicated n078 ${data_variant} segment command." >&2
    exit 2
  fi
fi

EXPERIMENT_CONFIG_PATH="$config_path" EXPERIMENT_CONFIG_OVERRIDES="$overrides" EXPERIMENT_RUN_ID="$run_id" EXPERIMENT_OUTPUT_ROOT="$output_root" EXPERIMENT_CLIENT_CONFIG_PATH="$client_config_path" REPLAYER_REPOSITORY_SHA_EXPECTED="a1a2100ea64870da086ec64be1914141eca0fb93" REPLAYER_START_COMMAND="$replayer_command" "$root/src/experiments/orchestration/run-experiment.sh" "$approach" "$mode"
if [[ -z "$mode" ]]; then
  npx --prefix "$root" ts-node "$root/src/experiments/validation/heterogeneous-workload.ts" "$root/$output_root/iteration-01" "$approach"
fi
