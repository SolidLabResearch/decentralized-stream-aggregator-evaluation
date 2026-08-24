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
evaluation_sha="$(git rev-parse HEAD)"; heimdall_sha="a6dbbba45f7d764355e010e4b5e3b82fd2795778"; rsp_js_sha="97a8865a3225a0699705d4f8cf7359ba6dd04611"; replayer_sha="a98ec1cba14f4437bb0bbefd915fb07e79a454fe"
launcher="src/experiments/clients/$approach/launcher.ts"; run_id="${EXPERIMENT_RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"; output_root="results/4hz/$approach/clients-$client_count/run-$run_id"
client_config_path="${EXPERIMENT_CLIENT_CONFIG_PATH:-}"
solid_initialize="cd \"$evaluation_path\" && EXPERIMENT_CONFIG_PATH=\"$client_config_path\" npx ts-node initialise-LDES.ts"; solid_cleanup="${SOLID_CLEANUP_COMMAND:-<SOLID_CLEANUP_COMMAND is required>}"; replayer_start="${REPLAYER_START_COMMAND:-<REPLAYER_START_COMMAND is required>}"
service_results_root="$heimdall_path/.evaluation-results/$run_id"
service_iteration_dir="$service_results_root/iteration-XX"
heimdall_pid_file="$service_results_root/heimdall.pid"
case "$approach" in
  notification-aggregator) service_host="$(read_config 'c.hosts.notificationAggregator')"; service_start="${NOTIFICATION_AGGREGATOR_START_COMMAND:-<NOTIFICATION_AGGREGATOR_START_COMMAND is required>}" ;;
  heimdall)
    service_host="$(read_config 'c.hosts.heimdall')"
    service_start="${HEIMDALL_START_COMMAND:-<HEIMDALL_START_COMMAND is required>}"
    ;;
  without-aggregator) service_host="none"; service_start=":" ;;
esac

command_required() { [[ "$1" == "<"*" is required>" ]]; }
shell_quote() {
  local value="$1"
  printf "'%s'" "${value//\'/\'\\\'\'}"
}
client_pid_file="$evaluation_path/.4hz-$approach-launcher.pid"
client_launch_command() {
  local iteration_output_dir="$1" iteration_run_id="$2"
  printf 'cd "%s" && (EXPERIMENT_CONFIG_PATH=%s EXPERIMENT_RUN_ID=%s EVALUATION_REPOSITORY_SHA=%s npx ts-node %s --output-dir %s & echo $! > "%s"; wait $!)' \
    "$evaluation_path" "$(shell_quote "$client_config_path")" "$(shell_quote "$iteration_run_id")" \
    "$(shell_quote "$evaluation_sha")" "$(shell_quote "$launcher")" "$(shell_quote "$iteration_output_dir")" "$client_pid_file"
}

replayer_runtime_root="$replayer_path/.evaluation-runtime/$run_id"
replayer_pid_file="$replayer_runtime_root/replayer.pid"
replayer_log_file="$replayer_runtime_root/replayer.log"
replayer_start_quoted="$(shell_quote "$replayer_start")"
replayer_launch_command="mkdir -p \"$replayer_runtime_root\" || exit 1; setsid bash -c $replayer_start_quoted > \"$replayer_log_file\" 2>&1 & replayer_pid=\$!; printf '%s\\n' \"\$replayer_pid\" > \"$replayer_pid_file\"; wait \"\$replayer_pid\""
heimdall_start_quoted="$(shell_quote "$service_start")"
heimdall_launch_command="mkdir -p \"$service_results_root\" \"$service_iteration_dir\" || exit 1; setsid bash -c $heimdall_start_quoted > \"$service_iteration_dir/heimdall.log\" 2>&1 & heimdall_pid=\$!; printf '%s\\n' \"\$heimdall_pid\" > \"$heimdall_pid_file\"; wait \"\$heimdall_pid\""
csv_operation_count_command() {
  local csv_path="$1" operation="$2"
  printf 'test -f %s && awk -F, '\''NR == 1 { for (i = 1; i <= NF; i++) if ($i == "operation") operation_column = i; next } operation_column && $operation_column == "%s" { count++ } END { exit !(count >= 1) }'\'' %s' \
    "$(shell_quote "$csv_path")" "$operation" "$(shell_quote "$csv_path")"
}
heimdall_query_ready_command() {
  local initialization_csv="$1"
  printf 'test -f %s && awk -F, '\''NR == 1 { for (i = 1; i <= NF; i++) if ($i == "operation") operation_column = i; next } operation_column && $operation_column == "query_registration" { query_registration++ } operation_column && $operation_column == "stream_subscription" { stream_subscription++ } END { exit !(query_registration >= 1 && stream_subscription >= 3) }'\'' %s' \
    "$(shell_quote "$initialization_csv")" "$(shell_quote "$initialization_csv")"
}
heimdall_window_ready_command() {
  csv_operation_count_command "$1" "window_query_processing"
}
print_plan() {
  echo "approach=$approach frequencyHz=$frequency clientCount=$client_count iterations=$iterations durationSeconds=$duration"
  echo "ssh=user:$SSH_USER bastion:${SSH_BASTION:-none} identity:${SSH_IDENTITY_FILE:+configured} timeout:${SSH_CONNECT_TIMEOUT_SECONDS}s"
  echo "machines: replayer=$replayer_host solidPod=$pod_host client=$client_host service=$service_host"
  echo "remote-paths: evaluation=$evaluation_path heimdall=$heimdall_path rspJs=$rsp_js_path replayer=$replayer_path"
  echo "expected-shas: evaluation=$evaluation_sha heimdall=$heimdall_sha rspJs=$rsp_js_sha replayer=$replayer_sha"
  echo "output-root=$root/$output_root"
  echo "replayer-runtime: $replayer_runtime_root"
  echo "replayer-pid: $replayer_pid_file"
  echo "cleanup-pids: heimdall=$heimdall_pid_file replayer=$replayer_pid_file"
  echo "solid-cleanup: $(experiment_ssh_preview "$pod_host" "$solid_cleanup")"
  echo "solid-initialize: $(experiment_ssh_preview "$client_host" "$solid_initialize")"
  if [[ "$service_host" == "none" ]]; then echo "service: none"
  elif [[ "$approach" == "heimdall" ]]; then
    echo "heimdall: $(experiment_ssh_preview "$service_host" "$heimdall_launch_command")"
    echo "heimdall-results: $service_iteration_dir"
    echo "heimdall-pid: $heimdall_pid_file"
    echo "heimdall-query-readiness: query_registration >= 1 and stream_subscription >= 3 (timeout=${HEIMDALL_QUERY_READY_TIMEOUT_SECONDS:-30}s)"
    echo "heimdall-stop-mode: ${EXPERIMENT_STOP_AFTER_FIRST_WINDOW:-false} (poll=${EXPERIMENT_FIRST_WINDOW_POLL_INTERVAL_SECONDS:-1}s)"
  else echo "service: $(experiment_ssh_preview "$service_host" "$service_start")"; fi
  echo "clients: $(experiment_ssh_preview "$client_host" "$(client_launch_command "$output_root/iteration-XX" "$run_id")")"
  echo "replayer: $(experiment_ssh_preview "$replayer_host" "$replayer_launch_command")"
  echo "collect: $(experiment_scp_preview "$client_host" "$evaluation_path/$output_root/iteration-XX" "$root/$output_root/")"
  if [[ "$approach" == "heimdall" ]]; then echo "collect-service: $(experiment_scp_preview "$service_host" "$service_results_root/iteration-XX" "$root/$output_root/iteration-XX/service")"; fi
}

remote_check() {
  local label="$1" host="$2" command="$3"
  if experiment_ssh "$host" "$command"; then echo "$label: OK"; else echo "$label: FAILED" >&2; return 1; fi
}
port_listening_command='if command -v ss >/dev/null; then ss -ltn "sport = :8080"; elif command -v netstat >/dev/null; then netstat -ltn 2>/dev/null | grep ":8080" || true; else echo "no-port-tool"; fi'
wait_for_command() {
  local label="$1" command="$2" timeout="$3" interval="${4:-1}" start=$SECONDS
  while (( SECONDS - start < timeout )); do
    if experiment_ssh "$service_host" "$command"; then return 0; fi
    sleep "$interval"
  done
  echo "$label did not become ready within ${timeout}s." >&2; return 1
}

if [[ "$mode" == "--dry-run" ]]; then print_plan; exit 0; fi
if [[ "$mode" == "--preflight" ]]; then
  failures=0
  for required in "$config_path" "$root/initialise-LDES.ts" "$root/$launcher" "$root/node_modules/.bin/ts-node"; do
    if [[ -e "$required" ]]; then echo "LOCAL OK: $required"; else echo "LOCAL MISSING: $required" >&2; failures=1; fi
  done
  if [[ -w "$root" ]]; then echo "LOCAL OK: output root is writable ($root)"; else echo "LOCAL NOT WRITABLE: $root" >&2; failures=1; fi
  if [[ -n "$client_config_path" ]]; then echo "CLIENT CONFIG: $client_config_path"; else echo "CONFIG MISSING: EXPERIMENT_CLIENT_CONFIG_PATH (path on the client machine)" >&2; failures=1; fi
  for command in "$solid_cleanup" "$replayer_start"; do if command_required "$command"; then echo "CONFIG MISSING: ${command#<}" >&2; failures=1; fi; done
  if [[ "$service_host" != "none" ]] && command_required "$service_start"; then echo "CONFIG MISSING: ${service_start#<}" >&2; failures=1; fi
  remote_check "REPLAYER reachable/path/SHA/node" "$replayer_host" "test -d \"$replayer_path\" && test \"\$(git -C \"$replayer_path\" rev-parse HEAD)\" = \"$replayer_sha\" && command -v node && node --version" || failures=1
  remote_check "SOLID POD reachable" "$pod_host" "hostname" || failures=1
  remote_check "CLIENT reachable/evaluation-path/SHA/node" "$client_host" "test -d \"$evaluation_path\" && test \"\$(git -C \"$evaluation_path\" rev-parse HEAD)\" = \"$evaluation_sha\" && command -v node && node --version" || failures=1
  if [[ "$service_host" != "none" ]]; then
    remote_check "HEIMDALL reachable/repos/SHAs/node/RSP-JS sibling" "$service_host" "test -d \"$heimdall_path\" && test \"\$(git -C \"$heimdall_path\" rev-parse HEAD)\" = \"$heimdall_sha\" && test -d \"$rsp_js_path\" && test \"\$(git -C \"$rsp_js_path\" rev-parse HEAD)\" = \"$rsp_js_sha\" && test \"\$(cd \"$heimdall_path/../RSP-JS\" && pwd)\" = \"\$(cd \"$rsp_js_path\" && pwd)\" && command -v node && node --version" || failures=1
  fi
  print_plan
  exit "$failures"
fi
for command in "$solid_initialize" "$solid_cleanup" "$replayer_start" "$service_start"; do if command_required "$command"; then echo "Set ${command#<} before running." >&2; exit 2; fi; done
cleanup() {
  experiment_ssh "$client_host" "if test -f \"$client_pid_file\"; then kill -TERM \$(cat \"$client_pid_file\") 2>/dev/null || true; rm -f \"$client_pid_file\"; fi" || true
  if [[ "$approach" == "heimdall" ]]; then
    experiment_ssh "$service_host" "if test -f \"$heimdall_pid_file\"; then pid=\$(cat \"$heimdall_pid_file\" 2>/dev/null || true); if test -n \"\$pid\" && kill -0 \"\$pid\" 2>/dev/null; then kill -TERM -- \"-\$pid\" 2>/dev/null || kill -TERM \"\$pid\" 2>/dev/null || true; for attempt in 1 2 3 4 5; do status=\$(ps -o stat= -p \"\$pid\" 2>/dev/null | tr -d ' ' || true); if test -z \"\$status\" || [[ \"\$status\" == Z* ]]; then break; fi; sleep 1; done; status=\$(ps -o stat= -p \"\$pid\" 2>/dev/null | tr -d ' ' || true); if test -n \"\$status\" && [[ \"\$status\" != Z* ]]; then kill -KILL -- \"-\$pid\" 2>/dev/null || kill -KILL \"\$pid\" 2>/dev/null || true; fi; fi; rm -f \"$heimdall_pid_file\"; status=\$(ps -o stat= -p \"\$pid\" 2>/dev/null | tr -d ' ' || true); if test -n \"\$status\" && [[ \"\$status\" != Z* ]]; then echo \"Heimdall run PID \$pid is still running after cleanup.\" >&2; exit 1; fi; fi"
  fi
  experiment_ssh "$replayer_host" "if test -f \"$replayer_pid_file\"; then pid=\$(cat \"$replayer_pid_file\" 2>/dev/null || true); if test -n \"\$pid\" && kill -0 \"\$pid\" 2>/dev/null; then kill -TERM -- \"-\$pid\" 2>/dev/null || kill -TERM \"\$pid\" 2>/dev/null || true; for attempt in 1 2 3 4 5; do status=\$(ps -o stat= -p \"\$pid\" 2>/dev/null | tr -d ' ' || true); if test -z \"\$status\" || [[ \"\$status\" == Z* ]]; then break; fi; sleep 1; done; status=\$(ps -o stat= -p \"\$pid\" 2>/dev/null | tr -d ' ' || true); if test -n \"\$status\" && [[ \"\$status\" != Z* ]]; then kill -KILL -- \"-\$pid\" 2>/dev/null || kill -KILL \"\$pid\" 2>/dev/null || true; fi; fi; rm -f \"$replayer_pid_file\"; status=\$(ps -o stat= -p \"\$pid\" 2>/dev/null | tr -d ' ' || true); if test -n \"\$status\" && [[ \"\$status\" != Z* ]]; then echo \"Replayer run PID \$pid is still running after cleanup.\" >&2; exit 1; fi; fi"
}
trap cleanup EXIT INT TERM
for iteration in $(seq 1 "$iterations"); do
  iteration_dir="$output_root/iteration-$(printf '%02d' "$iteration")"
  service_iteration_dir="$service_results_root/iteration-$(printf '%02d' "$iteration")"
  heimdall_launch_command="mkdir -p \"$service_results_root\" \"$service_iteration_dir\" || exit 1; setsid bash -c $heimdall_start_quoted > \"$service_iteration_dir/heimdall.log\" 2>&1 & heimdall_pid=\$!; printf '%s\\n' \"\$heimdall_pid\" > \"$heimdall_pid_file\"; wait \"\$heimdall_pid\""
  mkdir -p "$root/$iteration_dir"
  experiment_ssh "$pod_host" "$solid_cleanup"
  experiment_ssh "$client_host" "$solid_initialize"
  service_pid=""
  if [[ "$service_host" != "none" ]]; then
    if [[ "$approach" == "heimdall" ]]; then
      experiment_ssh "$service_host" "export HEIMDALL_RESULTS_DIR=\"$service_iteration_dir\" HEIMDALL_RUN_ID='$run_id-$(printf '%02d' "$iteration")' HEIMDALL_APPROACH=heimdall HEIMDALL_RSP_JS_PATH=\"$rsp_js_path\" HEIMDALL_RESOURCE_INTERVAL_MS='$(read_config 'c.experiment.resourceSamplingIntervalMs')'; $heimdall_launch_command" >"$root/$iteration_dir/$approach.log" 2>&1 & service_pid=$!
    else experiment_ssh "$service_host" "$service_start" >"$root/$iteration_dir/$approach.log" 2>&1 & service_pid=$!; fi
  fi
  if [[ "$approach" == "heimdall" ]]; then wait_for_command "Heimdall /health" "curl --fail --silent --show-error http://127.0.0.1:8080/health >/dev/null" "${HEIMDALL_READY_TIMEOUT_SECONDS:-30}"; elif [[ "$service_host" != "none" ]]; then sleep "${SERVICE_STARTUP_SECONDS:-15}"; fi
  experiment_ssh "$client_host" "$(client_launch_command "$iteration_dir" "$run_id-$(printf '%02d' "$iteration")")" >"$root/$iteration_dir/client-launcher.log" 2>&1 & client_pid=$!
  if [[ "$approach" == "heimdall" ]]; then
    wait_for_command "Heimdall query/subscription readiness" "$(heimdall_query_ready_command "$service_iteration_dir/initialization.csv")" "${HEIMDALL_QUERY_READY_TIMEOUT_SECONDS:-30}" || { echo "Heimdall query readiness failed; replayer will not be started." >&2; exit 1; }
  fi
  experiment_ssh "$replayer_host" "$replayer_launch_command" >"$root/$iteration_dir/replayer.log" 2>&1 & replayer_pid=$!
  if [[ "$approach" == "heimdall" && "${EXPERIMENT_STOP_AFTER_FIRST_WINDOW:-false}" == "true" ]]; then
    wait_for_command "first completed Heimdall window evaluation" "$(heimdall_window_ready_command "$service_iteration_dir/window-processing.csv")" "$duration" "${EXPERIMENT_FIRST_WINDOW_POLL_INTERVAL_SECONDS:-1}" || { echo "No completed Heimdall window evaluation appeared within ${duration}s after replay started." >&2; exit 1; }
  else
    sleep "$duration"
  fi
  cleanup
  pids=("$client_pid" "$replayer_pid"); if [[ -n "$service_pid" ]]; then pids+=("$service_pid"); fi
  kill "${pids[@]}" 2>/dev/null || true; wait "${pids[@]}" 2>/dev/null || true
  experiment_scp_from "$client_host" "$evaluation_path/$iteration_dir" "$root/$output_root/"
  if [[ "$approach" == "heimdall" ]]; then experiment_scp_from "$service_host" "$service_iteration_dir" "$root/$iteration_dir/service"; fi
done
