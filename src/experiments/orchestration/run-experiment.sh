#!/usr/bin/env bash
set -euo pipefail

# Runs the established four-machine sequence. Authentication and service startup remain
# environment-specific, so commands/paths below are intentionally overridable.
approach="${1:-}"
case "$approach" in heimdall|notification-aggregator|without-aggregator) ;; *) echo "Usage: $0 {heimdall|notification-aggregator|without-aggregator}" >&2; exit 2;; esac
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$root"
config="${EXPERIMENT_CONFIG_PATH:-$root/src/experiments/config/experiment-config.json}"
npx --prefix "$root" ts-node -e "require('./src/experiments/config/config').loadExperimentConfig('$config')" >/dev/null

read_config() { node -e "const c=require('$config'); console.log($1)"; }
replayer_host="$(read_config 'c.hosts.replayer')"; pod_host="$(read_config 'c.hosts.solidPod')"; client_host="$(read_config 'c.hosts.client')"; heimdall_host="$(read_config 'c.hosts.heimdall')"
iterations="$(read_config 'c.experiment.iterations')"; duration="$(read_config 'c.experiment.durationSeconds')"; client_count="$(read_config 'c.experiment.clientCount')"
remote_user="${REMOTE_USER:-kbisenug}"; client_repo="${CLIENT_REPO_PATH:-/users/kbisenug/decentralized-stream-aggregator-evaluation}"
replayer_repo="${REPLAYER_REPO_PATH:-/users/kbisenug/replayer}"; service_repo="${SERVICE_REPO_PATH:-/users/kbisenug/decentralized-stream-notifications-aggregator}"
ssh_options="${SSH_OPTIONS:-}"; ssh_run() { ssh $ssh_options "$remote_user@$1" "$2"; }
pod_clean="${POD_CLEAN_COMMAND:-rm -rf /users/kbisenug/data2/.internal/notifications /users/kbisenug/data2/pod1/acc-{x,y,z}/}"
initialize="cd '$client_repo' && npx ts-node initialise-LDES.ts"
launcher="src/experiments/clients/$approach/launcher.ts"
case "$approach" in
  notification-aggregator) service_start="${NOTIFICATION_AGGREGATOR_START_COMMAND:-cd '$service_repo' && npx ts-node start_notification_aggregator_process.ts}" ;;
  heimdall) service_start="${HEIMDALL_START_COMMAND:?Set HEIMDALL_START_COMMAND to the deployed Heimdall start command.}" ;;
  without-aggregator) service_start=":" ;;
esac

cleanup() { ssh_run "$client_host" "pkill -f '$launcher' || true" || true; }
trap cleanup EXIT INT TERM
for iteration in $(seq 1 "$iterations"); do
  iteration_dir="results/4hz/$approach/clients-$client_count/iteration-$(printf '%02d' "$iteration")"
  echo "[$approach] iteration $iteration/$iterations"
  mkdir -p "$root/$iteration_dir"
  ssh_run "$pod_host" "$pod_clean"
  ssh_run "$client_host" "rm -rf '$client_repo/$iteration_dir'; $initialize" & init_pid=$!
  ssh_run "$heimdall_host" "$service_start" >"$root/$iteration_dir/$approach.log" 2>&1 & service_pid=$!
  wait "$init_pid"; sleep "${SERVICE_STARTUP_SECONDS:-15}"
  ssh_run "$client_host" "cd '$client_repo' && npx ts-node '$launcher' --output-dir '$iteration_dir'" >"$root/$iteration_dir/client-launcher.log" 2>&1 & client_pid=$!
  ssh_run "$replayer_host" "cd '$replayer_repo' && npm run start" >"$root/$iteration_dir/replayer.log" 2>&1 & replayer_pid=$!
  sleep "$duration"
  kill "$client_pid" "$replayer_pid" "$service_pid" 2>/dev/null || true
  wait "$client_pid" "$replayer_pid" "$service_pid" 2>/dev/null || true
  mkdir -p "$root/$iteration_dir"
  scp -r $ssh_options "$remote_user@$client_host:$client_repo/$iteration_dir/." "$root/$iteration_dir/"
done
