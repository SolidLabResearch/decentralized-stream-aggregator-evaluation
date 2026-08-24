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
source "$root/src/experiments/orchestration/ssh-helper.sh"

frequency="$(read_config 'c.experiment.frequencyHz')"; iterations="$(read_config 'c.experiment.iterations')"; duration="$(read_config 'c.experiment.durationSeconds')"; client_count="$(read_config 'c.experiment.clientCount')"
replayer_host="$(read_config 'c.hosts.replayer')"; pod_host="$(read_config 'c.hosts.solidPod')"; client_host="$(read_config 'c.hosts.client')"
SSH_USER="${EXPERIMENT_SSH_USER:-$(read_config 'c.ssh.user')}"; SSH_BASTION="${EXPERIMENT_SSH_BASTION:-$(read_config 'c.ssh.bastion === null ? "" : c.ssh.bastion')}"
SSH_IDENTITY_FILE="${EXPERIMENT_SSH_IDENTITY_FILE:-$(read_config 'c.ssh.identityFile === null ? "" : c.ssh.identityFile')}"; SSH_CONNECT_TIMEOUT_SECONDS="${EXPERIMENT_SSH_CONNECT_TIMEOUT_SECONDS:-$(read_config 'c.ssh.connectTimeoutSeconds')}"
experiment_ssh_args
evaluation_path="$(experiment_remote_path "$(read_config 'c.remotePaths.evaluation')")"; heimdall_path="$(experiment_remote_path "$(read_config 'c.remotePaths.heimdall')")"; rsp_js_path="$(experiment_remote_path "$(read_config 'c.remotePaths.rspJs')")"; replayer_path="$(experiment_remote_path "$(read_config 'c.remotePaths.replayer')")"
launcher="src/experiments/clients/$approach/launcher.ts"; run_id="${EXPERIMENT_RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"; output_root="results/4hz/$approach/clients-$client_count/run-$run_id"
solid_initialize="${SOLID_INITIALIZE_COMMAND:-<SOLID_INITIALIZE_COMMAND is required>}"; solid_cleanup="${SOLID_CLEANUP_COMMAND:-<SOLID_CLEANUP_COMMAND is required>}"; replayer_start="${REPLAYER_START_COMMAND:-<REPLAYER_START_COMMAND is required>}"
case "$approach" in
  notification-aggregator) service_host="$(read_config 'c.hosts.notificationAggregator')"; service_start="${NOTIFICATION_AGGREGATOR_START_COMMAND:-<NOTIFICATION_AGGREGATOR_START_COMMAND is required>}" ;;
  heimdall) service_host="$(read_config 'c.hosts.heimdall')"; service_start="${HEIMDALL_START_COMMAND:-<HEIMDALL_START_COMMAND is required>}" ;;
  without-aggregator) service_host="none"; service_start=":" ;;
esac

command_required() { [[ "$1" == "<"*" is required>" ]]; }
print_plan() {
  echo "approach=$approach frequencyHz=$frequency clientCount=$client_count iterations=$iterations durationSeconds=$duration"
  echo "ssh=user:$SSH_USER bastion:${SSH_BASTION:-none} identity:${SSH_IDENTITY_FILE:+configured} timeout:${SSH_CONNECT_TIMEOUT_SECONDS}s"
  echo "machines: replayer=$replayer_host solidPod=$pod_host client=$client_host service=$service_host"
  echo "remote-paths: evaluation=$evaluation_path heimdall=$heimdall_path rspJs=$rsp_js_path replayer=$replayer_path"
  echo "output-root=$root/$output_root"
  echo "solid-cleanup: $(experiment_ssh_preview "$pod_host" "$solid_cleanup")"
  echo "solid-initialize: $(experiment_ssh_preview "$client_host" "$solid_initialize")"
  if [[ "$service_host" == "none" ]]; then echo "service: none"; else echo "service: $(experiment_ssh_preview "$service_host" "$service_start")"; fi
  echo "clients: $(experiment_ssh_preview "$client_host" "cd \"$evaluation_path\" && npx ts-node '$launcher' --output-dir '$output_root/iteration-XX'")"
  echo "replayer: $(experiment_ssh_preview "$replayer_host" "$replayer_start")"
  echo "collect: $(experiment_scp_preview "$client_host" "$evaluation_path/$output_root/iteration-XX/." "$root/$output_root/iteration-XX/")"
}

remote_check() {
  local label="$1" host="$2" command="$3"
  if experiment_ssh "$host" "$command"; then echo "$label: OK"; else echo "$label: FAILED" >&2; return 1; fi
}
port_listening_command='if command -v ss >/dev/null; then ss -ltn "sport = :8080"; elif command -v netstat >/dev/null; then netstat -ltn 2>/dev/null | grep ":8080" || true; else echo "no-port-tool"; fi'
wait_for_heimdall_health() {
  local timeout="${HEIMDALL_READY_TIMEOUT_SECONDS:-30}" elapsed=0
  while (( elapsed < timeout )); do
    if experiment_ssh "$service_host" "curl --fail --silent --show-error http://127.0.0.1:8080/health >/dev/null"; then return 0; fi
    sleep 1; ((elapsed+=1))
  done
  echo "Heimdall /health did not become reachable within ${timeout}s." >&2; return 1
}

if [[ "$mode" == "--dry-run" ]]; then print_plan; exit 0; fi
if [[ "$mode" == "--preflight" ]]; then
  failures=0
  for required in "$config_path" "$root/initialise-LDES.ts" "$root/$launcher" "$root/node_modules/.bin/ts-node"; do
    if [[ -e "$required" ]]; then echo "LOCAL OK: $required"; else echo "LOCAL MISSING: $required" >&2; failures=1; fi
  done
  if [[ -w "$root" ]]; then echo "LOCAL OK: output root is writable ($root)"; else echo "LOCAL NOT WRITABLE: $root" >&2; failures=1; fi
  for command in "$solid_initialize" "$solid_cleanup" "$replayer_start"; do if command_required "$command"; then echo "CONFIG MISSING: ${command#<}" >&2; failures=1; fi; done
  if [[ "$service_host" != "none" ]] && command_required "$service_start"; then echo "CONFIG MISSING: ${service_start#<}" >&2; failures=1; fi
  remote_check "REPLAYER reachable/path/node" "$replayer_host" "test -d \"$replayer_path\" && command -v node && node --version" || failures=1
  remote_check "SOLID POD reachable" "$pod_host" "hostname" || failures=1
  remote_check "CLIENT reachable/evaluation-path/node" "$client_host" "test -d \"$evaluation_path\" && command -v node && node --version" || failures=1
  if [[ "$service_host" != "none" ]]; then
    remote_check "HEIMDALL reachable/repos/node/port" "$service_host" "test -d \"$heimdall_path\" && test -d \"$rsp_js_path\" && command -v node && node --version && $port_listening_command" || failures=1
  fi
  print_plan
  exit "$failures"
fi
for command in "$solid_initialize" "$solid_cleanup" "$replayer_start" "$service_start"; do if command_required "$command"; then echo "Set ${command#<} before running." >&2; exit 2; fi; done
client_pid_file="$evaluation_path/.4hz-$approach-launcher.pid"
cleanup() { experiment_ssh "$client_host" "if test -f \"$client_pid_file\"; then kill -TERM \$(cat \"$client_pid_file\") 2>/dev/null || true; rm -f \"$client_pid_file\"; fi" || true; }
trap cleanup EXIT INT TERM
for iteration in $(seq 1 "$iterations"); do
  iteration_dir="$output_root/iteration-$(printf '%02d' "$iteration")"
  mkdir -p "$root/$iteration_dir"
  experiment_ssh "$pod_host" "$solid_cleanup"
  experiment_ssh "$client_host" "$solid_initialize" & init_pid=$!
  service_pid=""
  if [[ "$service_host" != "none" ]]; then
    if [[ "$approach" == "heimdall" ]]; then
      experiment_ssh "$service_host" "mkdir -p \"$evaluation_path/$iteration_dir/service\" && HEIMDALL_RESULTS_DIR=\"$evaluation_path/$iteration_dir/service\" HEIMDALL_RUN_ID='$run_id-$(printf '%02d' "$iteration")' HEIMDALL_APPROACH=heimdall HEIMDALL_RSP_JS_PATH=\"$rsp_js_path\" HEIMDALL_RESOURCE_INTERVAL_MS='$(read_config 'c.experiment.resourceSamplingIntervalMs')' $service_start" >"$root/$iteration_dir/$approach.log" 2>&1 & service_pid=$!
    else experiment_ssh "$service_host" "$service_start" >"$root/$iteration_dir/$approach.log" 2>&1 & service_pid=$!; fi
  fi
  wait "$init_pid"
  if [[ "$approach" == "heimdall" ]]; then wait_for_heimdall_health; elif [[ "$service_host" != "none" ]]; then sleep "${SERVICE_STARTUP_SECONDS:-15}"; fi
  experiment_ssh "$client_host" "cd \"$evaluation_path\" && (EXPERIMENT_RUN_ID='$run_id-$(printf '%02d' "$iteration")' EVALUATION_REPOSITORY_SHA='$(git rev-parse HEAD)' npx ts-node '$launcher' --output-dir '$iteration_dir' & echo \$! > \"$client_pid_file\"; wait \$!)" >"$root/$iteration_dir/client-launcher.log" 2>&1 & client_pid=$!
  experiment_ssh "$replayer_host" "$replayer_start" >"$root/$iteration_dir/replayer.log" 2>&1 & replayer_pid=$!
  sleep "$duration"; cleanup
  pids=("$client_pid" "$replayer_pid"); if [[ -n "$service_pid" ]]; then pids+=("$service_pid"); fi
  kill "${pids[@]}" 2>/dev/null || true; wait "${pids[@]}" 2>/dev/null || true
  experiment_scp_from "$client_host" "$evaluation_path/$iteration_dir/." "$root/$iteration_dir/"
  if [[ "$approach" == "heimdall" ]]; then experiment_scp_from "$service_host" "$evaluation_path/$iteration_dir/service/." "$root/$iteration_dir/service/"; fi
done
