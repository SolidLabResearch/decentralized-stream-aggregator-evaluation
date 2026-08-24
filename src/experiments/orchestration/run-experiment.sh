#!/usr/bin/env bash
set -euo pipefail

usage() { echo "Usage: $0 {heimdall|notification-aggregator|without-aggregator} [--dry-run|--preflight]" >&2; }
approach="${1:-}"; mode="${2:-}"
case "$approach" in heimdall|notification-aggregator|without-aggregator) ;; *) usage; exit 2;; esac
case "$mode" in ""|--dry-run|--preflight) ;; *) usage; exit 2;; esac
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"; cd "$root"
config_path="${EXPERIMENT_CONFIG_PATH:-$root/src/experiments/config/experiment-config.json}"
config_json="$(npx --prefix "$root" ts-node -e "process.stdout.write(JSON.stringify(require('./src/experiments/config/config').loadExperimentConfig(process.argv[1])))" "$config_path")"
read_config() { node -e "const c=JSON.parse(process.argv[1]); console.log($1)" "$config_json"; }
frequency="$(read_config 'c.experiment.frequencyHz')"; iterations="$(read_config 'c.experiment.iterations')"; duration="$(read_config 'c.experiment.durationSeconds')"; client_count="$(read_config 'c.experiment.clientCount')"
replayer_host="$(read_config 'c.hosts.replayer')"; pod_host="$(read_config 'c.hosts.solidPod')"; client_host="$(read_config 'c.hosts.client')"
remote_user="${REMOTE_USER:-kbisenug}"; client_repo="${CLIENT_REPO_PATH:-/users/kbisenug/decentralized-stream-aggregator-evaluation}"
replayer_repo="${REPLAYER_REPO_PATH:-/users/kbisenug/replayer}"; service_repo="${SERVICE_REPO_PATH:-/users/kbisenug/decentralized-stream-notifications-aggregator}"
ssh_options="${SSH_OPTIONS:-}"; launcher="src/experiments/clients/$approach/launcher.ts"; output_root="results/4hz/$approach/clients-$client_count"
pod_clean="${POD_CLEAN_COMMAND:-}"
if [[ -z "$pod_clean" ]]; then pod_clean="rm -rf /users/kbisenug/data2/.internal/notifications /users/kbisenug/data2/pod1/acc-x/ /users/kbisenug/data2/pod1/acc-y/ /users/kbisenug/data2/pod1/acc-z/"; fi
initialize="cd '$client_repo' && npx ts-node initialise-LDES.ts"
case "$approach" in
  notification-aggregator) service_host="$(read_config 'c.hosts.notificationAggregator')"; service_start="${NOTIFICATION_AGGREGATOR_START_COMMAND:-cd '$service_repo' && npx ts-node start_notification_aggregator_process.ts}" ;;
  heimdall) service_host="$(read_config 'c.hosts.heimdall')"; service_start="${HEIMDALL_START_COMMAND:-<HEIMDALL_START_COMMAND is required>}" ;;
  without-aggregator) service_host="none"; service_start=":" ;;
esac

print_plan() {
  echo "approach=$approach frequencyHz=$frequency clientCount=$client_count iterations=$iterations durationSeconds=$duration"
  echo "machines: replayer=$replayer_host solidPod=$pod_host client=$client_host service=$service_host"
  echo "output-root=$root/$output_root"
  echo "solid-pod: ssh $remote_user@$pod_host '$pod_clean'"
  echo "initialize: ssh $remote_user@$client_host '$initialize'"
  if [[ "$service_host" == "none" ]]; then echo "service: none"; else echo "service: ssh $remote_user@$service_host '$service_start'"; fi
  echo "clients: ssh $remote_user@$client_host \"cd '$client_repo' && npx ts-node '$launcher' --output-dir '$output_root/iteration-XX'\""
  echo "replayer: ssh $remote_user@$replayer_host \"cd '$replayer_repo' && npm run start\""
  echo "collect: scp -r $remote_user@$client_host:$client_repo/$output_root/iteration-XX/. $root/$output_root/iteration-XX/"
}

if [[ "$mode" == "--dry-run" ]]; then print_plan; exit 0; fi
if [[ "$mode" == "--preflight" ]]; then
  failures=0
  for required in "$config_path" "$root/initialise-LDES.ts" "$root/$launcher" "$root/node_modules/.bin/ts-node"; do
    if [[ -e "$required" ]]; then echo "OK: $required"; else echo "MISSING: $required" >&2; failures=1; fi
  done
  if [[ -w "$root" ]]; then echo "OK: output root is writable ($root)"; else echo "NOT WRITABLE: $root" >&2; failures=1; fi
  if [[ "$approach" == "heimdall" && "$service_start" == "<HEIMDALL_START_COMMAND is required>" ]]; then echo "MISSING: HEIMDALL_START_COMMAND for execution" >&2; failures=1; fi
  print_plan
  exit "$failures"
fi
if [[ "$approach" == "heimdall" && "$service_start" == "<HEIMDALL_START_COMMAND is required>" ]]; then echo "Set HEIMDALL_START_COMMAND before running Heimdall." >&2; exit 2; fi
ssh_run() { ssh $ssh_options "$remote_user@$1" "$2"; }
client_pid_file="$client_repo/.4hz-$approach-launcher.pid"
cleanup() { ssh_run "$client_host" "if test -f '$client_pid_file'; then kill -TERM \$(cat '$client_pid_file') 2>/dev/null || true; rm -f '$client_pid_file'; fi" || true; }
trap cleanup EXIT INT TERM
for iteration in $(seq 1 "$iterations"); do
  iteration_dir="$output_root/iteration-$(printf '%02d' "$iteration")"
  echo "[$approach] iteration $iteration/$iterations"
  mkdir -p "$root/$iteration_dir"
  ssh_run "$pod_host" "$pod_clean"
  ssh_run "$client_host" "rm -rf '$client_repo/$iteration_dir'; $initialize" & init_pid=$!
  service_pid=""
  if [[ "$service_host" != "none" ]]; then ssh_run "$service_host" "$service_start" >"$root/$iteration_dir/$approach.log" 2>&1 & service_pid=$!; fi
  wait "$init_pid"; sleep "${SERVICE_STARTUP_SECONDS:-15}"
  ssh_run "$client_host" "cd '$client_repo' && (npx ts-node '$launcher' --output-dir '$iteration_dir' & echo \$! > '$client_pid_file'; wait \$!)" >"$root/$iteration_dir/client-launcher.log" 2>&1 & client_pid=$!
  ssh_run "$replayer_host" "cd '$replayer_repo' && npm run start" >"$root/$iteration_dir/replayer.log" 2>&1 & replayer_pid=$!
  sleep "$duration"
  cleanup
  pids=("$client_pid" "$replayer_pid")
  if [[ -n "$service_pid" ]]; then pids+=("$service_pid"); fi
  kill "${pids[@]}" 2>/dev/null || true
  wait "${pids[@]}" 2>/dev/null || true
  scp -r $ssh_options "$remote_user@$client_host:$client_repo/$iteration_dir/." "$root/$iteration_dir/"
done
