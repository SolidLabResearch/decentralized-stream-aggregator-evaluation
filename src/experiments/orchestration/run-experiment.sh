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
replayer_host="$(read_config 'c.hosts.replayer')"; pod_host="$(read_config 'c.hosts.solidPod')"; client_host="$(read_config 'c.hosts.client')"; solid_pod_url="$(read_config 'c.urls.solidPod')"
SSH_USER="${EXPERIMENT_SSH_USER:-$(read_config 'c.ssh.user')}"; SSH_BASTION="${EXPERIMENT_SSH_BASTION:-$(read_config 'c.ssh.bastion === null ? "" : c.ssh.bastion')}"
SSH_IDENTITY_FILE="${EXPERIMENT_SSH_IDENTITY_FILE:-$(read_config 'c.ssh.identityFile === null ? "" : c.ssh.identityFile')}"; SSH_CONNECT_TIMEOUT_SECONDS="${EXPERIMENT_SSH_CONNECT_TIMEOUT_SECONDS:-$(read_config 'c.ssh.connectTimeoutSeconds')}"
experiment_ssh_args
evaluation_path="$(experiment_remote_path "$(read_config 'c.remotePaths.evaluation')")"; heimdall_path="$(experiment_remote_path "$(read_config 'c.remotePaths.heimdall')")"; rsp_js_path="$(experiment_remote_path "$(read_config 'c.remotePaths.rspJs')")"; replayer_path="$(experiment_remote_path "$(read_config 'c.remotePaths.replayer')")"
evaluation_sha="${EVALUATION_REPOSITORY_SHA_EXPECTED:-$(git rev-parse HEAD)}"; heimdall_sha="${HEIMDALL_REPOSITORY_SHA_EXPECTED:-aa4a674ca03c7eb5a0e0e626ea5a8b3d190a9fef}"; rsp_js_sha="${RSP_JS_SHA_EXPECTED:-$(git -C "$root/../RSP-JS" rev-parse HEAD)}"; replayer_sha="${REPLAYER_REPOSITORY_SHA_EXPECTED:-$(git -C "$root/../kvasir-replayer" rev-parse HEAD)}"
launcher="src/experiments/clients/$approach/launcher.ts"; run_id="${EXPERIMENT_RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"; output_root="results/4hz/$approach/clients-$client_count/run-$run_id"
client_config_path="${EXPERIMENT_CLIENT_CONFIG_PATH:-}"
solid_initialize="cd \"$evaluation_path\" && EXPERIMENT_CONFIG_PATH=\"$client_config_path\" npx ts-node initialise-LDES.ts"; solid_cleanup="${SOLID_CLEANUP_COMMAND:-<SOLID_CLEANUP_COMMAND is required>}"; replayer_start="${REPLAYER_START_COMMAND:-<REPLAYER_START_COMMAND is required>}"
service_results_root="$heimdall_path/.evaluation-results/$run_id"
service_iteration_dir="$service_results_root/iteration-XX"
heimdall_pid_file="$service_results_root/heimdall.pid"
case "$approach" in
  notification-aggregator) service_host="$(read_config 'c.hosts.notificationAggregator')"; service_start="${NOTIFICATION_AGGREGATOR_START_COMMAND:-<NOTIFICATION_AGGREGATOR_START_COMMAND is required>}"; service_sha="${NOTIFICATION_AGGREGATOR_REPOSITORY_SHA_EXPECTED:-}" ;;
  heimdall)
    service_host="$(read_config 'c.hosts.heimdall')"
    service_start="${HEIMDALL_START_COMMAND:-<HEIMDALL_START_COMMAND is required>}"
    service_sha="$heimdall_sha"
    ;;
  without-aggregator) service_host="none"; service_start=":"; service_sha="" ;;
esac

command_required() { [[ "$1" == "<"*" is required>" ]]; }
remote_path_expression() {
  local value="$1"
  if [[ "$value" == '$HOME/'* ]]; then
    # Keep the variable expansion outside the single-quoted path suffix.
    printf '"$HOME"%s' "$(shell_quote "${value#'$HOME'}")"
  else
    shell_quote "$value"
  fi
}
shell_quote() {
  local value="$1"
  printf "'%s'" "${value//\'/\'\\\'\'}"
}
client_pid_file="$evaluation_path/.4hz-$approach-launcher.pid"
client_launch_command() {
  local iteration_output_dir="$1" iteration_run_id="$2"
  if [[ "$approach" == "without-aggregator" ]]; then
    printf 'cd "%s" && (setsid env EXPERIMENT_CONFIG_PATH=%s EXPERIMENT_RUN_ID=%s EVALUATION_REPOSITORY_SHA=%s RSP_JS_REPOSITORY_SHA=%s SERVICE_REPOSITORY_SHA=%s npx ts-node %s --output-dir %s > "%s/client-launcher.log" 2>&1 & client_pid=\$!; printf '\''%%s\\n'\'' "\$client_pid" > "%s"; wait "\$client_pid")' \
      "$evaluation_path" "$(shell_quote "$client_config_path")" "$(shell_quote "$iteration_run_id")" \
      "$(shell_quote "$evaluation_sha")" "$(shell_quote "$rsp_js_sha")" "$(shell_quote "$service_sha")" "$(shell_quote "$launcher")" "$(shell_quote "$iteration_output_dir")" "$iteration_output_dir" "$client_pid_file"
  else
    printf 'cd "%s" && (setsid env EXPERIMENT_CONFIG_PATH=%s EXPERIMENT_RUN_ID=%s EVALUATION_REPOSITORY_SHA=%s RSP_JS_REPOSITORY_SHA=%s SERVICE_REPOSITORY_SHA=%s npx ts-node %s --output-dir %s > "%s/client-launcher.log" 2>&1 & client_pid=\$!; printf '\''%%s\\n'\'' "\$client_pid" > "%s"; wait "\$client_pid")' \
      "$evaluation_path" "$(shell_quote "$client_config_path")" "$(shell_quote "$iteration_run_id")" \
      "$(shell_quote "$evaluation_sha")" "$(shell_quote "$rsp_js_sha")" "$(shell_quote "$service_sha")" "$(shell_quote "$launcher")" "$(shell_quote "$iteration_output_dir")" "$iteration_output_dir" "$client_pid_file"
  fi
}

replayer_runtime_root="$replayer_path/.evaluation-runtime/$run_id"
replayer_pid_file="$replayer_runtime_root/replayer.pid"
replayer_log_file="$replayer_runtime_root/replayer.log"
replayer_start_quoted="$(shell_quote "$replayer_start")"
replayer_launch_command="mkdir -p \"$replayer_runtime_root\" || exit 1; setsid bash -c $replayer_start_quoted > \"$replayer_log_file\" 2>&1 & replayer_pid=\$!; printf '%s\\n' \"\$replayer_pid\" > \"$replayer_pid_file\"; wait \"\$replayer_pid\""
heimdall_start_quoted="$(shell_quote "$service_start")"
service_start_exec_quoted="$(shell_quote "exec $service_start")"
heimdall_launch_command="mkdir -p \"$service_results_root\" \"$service_iteration_dir\" || exit 1; setsid bash -c $heimdall_start_quoted > \"$service_iteration_dir/heimdall.log\" 2>&1 & heimdall_pid=\$!; printf '%s\\n' \"\$heimdall_pid\" > \"$heimdall_pid_file\"; wait \"\$heimdall_pid\""
csv_operation_count_command() {
  local csv_path="$1" operation="$2"
  printf 'test -f %s && awk -F, '\''NR == 1 { for (i = 1; i <= NF; i++) if ($i == "operation") operation_column = i; next } operation_column && $operation_column == "%s" { count++ } END { exit !(count >= 1) }'\'' %s' \
    "$(remote_path_expression "$csv_path")" "$operation" "$(remote_path_expression "$csv_path")"
}
service_resource_header='timestamp,cpu_user_jiffies,cpu_system_jiffies,rss_bytes,wall_delta_ms,cpu_utilization_percent'
service_launch_command() {
  local iteration_dir="$1"
  printf 'mkdir -p %s; printf "%s\\n" > %s; setsid bash -c %s > %s/service.log 2>&1 & service_pid=\$!; printf "%%s\\n" "\$service_pid" > %s/service.pid; wait "\$service_pid"' \
    "$(remote_path_expression "$service_results_root/$iteration_dir")" "$service_resource_header" "$(remote_path_expression "$service_results_root/$iteration_dir/service-resource.csv")" "$service_start_exec_quoted" "$(remote_path_expression "$service_results_root/$iteration_dir")" "$(remote_path_expression "$service_results_root/$iteration_dir")"
}
service_monitor_command() {
  local iteration_dir="$1"
  printf 'file=%s; pid_file=%s; previous_cpu=; previous_wall=; while test -f "$pid_file"; do pid=$(cat "$pid_file" 2>/dev/null || true); test -r "/proc/$pid/stat" || break; stat=$(cat "/proc/$pid/stat"); user=$(awk '\''{print $14}'\'' <<< "$stat"); system=$(awk '\''{print $15}'\'' <<< "$stat"); rss=$(awk '\''/^VmRSS:/ {print $2 * 1024}'\'' "/proc/$pid/status"); now=$(date +%%s%%3N); if test -n "$previous_wall"; then wall_delta=$((now - previous_wall)); cpu_util=$(awk -v c=$((user + system - previous_cpu)) -v w="$wall_delta" '\''BEGIN { if (w > 0) print 100 * c / (w * 100); else print ""}'\''); else wall_delta=""; cpu_util=""; fi; printf "%%s,%%s,%%s,%%s,%%s,%%s\\n" "$now" "$user" "$system" "$rss" "$wall_delta" "$cpu_util" >> "$file"; previous_wall=$now; previous_cpu=$((user + system)); sleep %s; done' \
    "$(remote_path_expression "$service_results_root/$iteration_dir/service-resource.csv")" "$(remote_path_expression "$service_results_root/$iteration_dir/service.pid")" "$(read_config 'c.experiment.resourceSamplingIntervalMs')/1000"
}
heimdall_query_ready_command() {
  local initialization_csv="$1"
  printf 'test -f %s && awk -F, '\''NR == 1 { for (i = 1; i <= NF; i++) if ($i == "operation") operation_column = i; next } operation_column && $operation_column == "query_registration" { query_registration++ } operation_column && $operation_column == "stream_subscription" { stream_subscription++ } END { exit !(query_registration >= 1 && stream_subscription >= 3) }'\'' %s' \
    "$(remote_path_expression "$initialization_csv")" "$(remote_path_expression "$initialization_csv")"
}
heimdall_first_result_ready_command() {
  csv_operation_count_command "$1" "r2r_first_result"
}
without_aggregator_first_result_ready_command() {
  local iteration_dir="$1"
  printf 'iteration_dir=%s; for csv in "\$iteration_dir"/client-*-operations.csv; do test -f "\$csv" && awk -F, '\''NR == 1 { for (i = 1; i <= NF; i++) if ($i == "operation") operation_column = i; next } operation_column && $operation_column == "r2r_first_result" { found=1 } END { exit !found }'\'' "\$csv" && exit 0; done; exit 1' "$(remote_path_expression "$evaluation_path/$iteration_dir")"
}
all_client_first_result_markers_ready_command() {
  local iteration_dir="$1"
  printf 'iteration_dir=%s; for client_id in $(seq 0 %s); do test -f "\$iteration_dir/client-\$client_id-first-result.ready" || exit 1; done' "$(remote_path_expression "$evaluation_path/$iteration_dir")" "$((client_count - 1))"
}
all_client_ready_markers_command() {
  local iteration_dir="$1"
  printf 'iteration_dir=%s; count=0; for client_id in $(seq 0 %s); do marker="\$iteration_dir/client-\$client_id-ready.json"; test -s "\$marker" || exit 1; count=$((count + 1)); done; test "\$count" -eq %s' "$(remote_path_expression "$evaluation_path/$iteration_dir")" "$((client_count - 1))" "$client_count"
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
    echo "heimdall-query-ready-command: $(heimdall_query_ready_command "$service_iteration_dir/initialization.csv")"
    echo "heimdall-first-result-ready-command: $(heimdall_first_result_ready_command "$service_iteration_dir/window-processing.csv")"
    echo "heimdall-query-readiness: query_registration >= 1 and stream_subscription >= 3 (timeout=${HEIMDALL_QUERY_READY_TIMEOUT_SECONDS:-30}s)"
    echo "heimdall-stop-mode: ${EXPERIMENT_STOP_AFTER_FIRST_WINDOW:-false} (first-window signal=r2r_first_result, poll=${EXPERIMENT_FIRST_WINDOW_POLL_INTERVAL_SECONDS:-1}s)"
  else echo "service: $(experiment_ssh_preview "$service_host" "$(service_launch_command iteration-XX)")"; fi
  echo "clients: $(experiment_ssh_preview "$client_host" "$(client_launch_command "$output_root/iteration-XX" "$run_id")")"
  echo "client-readiness-markers: $(all_client_ready_markers_command "iteration-XX")"
  echo "client-first-result-markers: $(all_client_first_result_markers_ready_command "iteration-XX")"
  echo "replayer: $(experiment_ssh_preview "$replayer_host" "$replayer_launch_command")"
  echo "collect: $(experiment_scp_preview "$client_host" "$evaluation_path/$output_root/iteration-XX" "$root/$output_root/")"
  if [[ "$service_host" != "none" ]]; then echo "collect-service: $(experiment_scp_preview "$service_host" "$service_results_root/iteration-XX" "$root/$output_root/iteration-XX/service")"; fi
}

remote_check() {
  local label="$1" host="$2" command="$3"
  if experiment_ssh "$host" "$command"; then echo "$label: OK"; else echo "$label: FAILED" >&2; return 1; fi
}
port_listening_command='if command -v ss >/dev/null; then ss -ltn "sport = :8080"; elif command -v netstat >/dev/null; then netstat -ltn 2>/dev/null | grep ":8080" || true; else echo "no-port-tool"; fi'
wait_for_command() {
  wait_for_command_on_host "$1" "$service_host" "$2" "$3" "${4:-1}"
}
wait_for_command_on_host() {
  local label="$1" host="$2" command="$3" timeout="$4" interval="${5:-1}" start=$SECONDS
  while (( SECONDS - start < timeout )); do
    if experiment_ssh "$host" "$command"; then return 0; fi
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
  if [[ "$service_host" != "none" && -z "$service_sha" ]]; then echo "CONFIG MISSING: NOTIFICATION_AGGREGATOR_REPOSITORY_SHA_EXPECTED (explicit pinned service commit)" >&2; failures=1; fi
  for command in "$solid_cleanup" "$replayer_start"; do if command_required "$command"; then echo "CONFIG MISSING: ${command#<}" >&2; failures=1; fi; done
  if [[ "$service_host" != "none" ]] && command_required "$service_start"; then echo "CONFIG MISSING: ${service_start#<}" >&2; failures=1; fi
  remote_check "REPLAYER reachable/path/SHA/node" "$replayer_host" "test -d \"$replayer_path\" && test \"\$(git -C \"$replayer_path\" rev-parse HEAD)\" = \"$replayer_sha\" && command -v node && node --version" || failures=1
  remote_check "SOLID POD SSH reachable" "$pod_host" "hostname" || failures=1
  remote_check "SOLID POD HTTP reachable" "$client_host" "command -v curl >/dev/null && curl --fail --silent --show-error --max-time 10 --output /dev/null \"$solid_pod_url\"" || failures=1
  remote_check "CLIENT reachable/evaluation-path/SHA/clean/node" "$client_host" "test -d \"$evaluation_path\" && test \"\$(git -C \"$evaluation_path\" rev-parse HEAD)\" = \"$evaluation_sha\" && test -z \"\$(git -C \"$evaluation_path\" status --porcelain -- src/experiments package.json package-lock.json tsconfig.experiments.json)\" && command -v node && node --version" || failures=1
  if [[ "$service_host" != "none" ]]; then
    remote_check "SERVICE reachable/repos/SHAs/clean/node/RSP-JS sibling" "$service_host" "test -d \"$heimdall_path\" && test \"\$(git -C \"$heimdall_path\" rev-parse HEAD)\" = \"$service_sha\" && test -z \"\$(git -C \"$heimdall_path\" status --porcelain -- src package.json package-lock.json tsconfig.json)\" && test -d \"$rsp_js_path\" && test \"\$(git -C \"$rsp_js_path\" rev-parse HEAD)\" = \"$rsp_js_sha\" && test -z \"\$(git -C \"$rsp_js_path\" status --porcelain)\" && test \"\$(cd \"$heimdall_path/../RSP-JS\" && pwd)\" = \"\$(cd \"$rsp_js_path\" && pwd)\" && command -v node && node --version" || failures=1
  fi
  print_plan
  exit "$failures"
fi
for command in "$solid_initialize" "$solid_cleanup" "$replayer_start" "$service_start"; do if command_required "$command"; then echo "Set ${command#<} before running." >&2; exit 2; fi; done
cleanup() {
  if [[ "$approach" == "without-aggregator" ]]; then
    experiment_ssh "$client_host" "if test -f \"$client_pid_file\"; then pid=\$(cat \"$client_pid_file\" 2>/dev/null || true); if test -n \"\$pid\" && kill -0 -- \"-\$pid\" 2>/dev/null; then kill -TERM -- \"-\$pid\" 2>/dev/null || kill -TERM \"\$pid\" 2>/dev/null || true; for attempt in 1 2 3 4 5; do status=\$(kill -0 -- \"-\$pid\" 2>/dev/null && echo alive || true); if test -z \"\$status\"; then break; fi; sleep 1; done; status=\$(kill -0 -- \"-\$pid\" 2>/dev/null && echo alive || true); if test -n \"\$status\"; then kill -KILL -- \"-\$pid\" 2>/dev/null || kill -KILL \"\$pid\" 2>/dev/null || true; fi; fi; rm -f \"$client_pid_file\"; fi" || true
  else
    experiment_ssh "$client_host" "if test -f \"$client_pid_file\"; then kill -TERM \$(cat \"$client_pid_file\") 2>/dev/null || true; rm -f \"$client_pid_file\"; fi" || true
  fi
  if [[ "$service_host" != "none" && "$approach" != "heimdall" ]]; then
    experiment_ssh "$service_host" "if test -f \"$service_iteration_dir/service.pid\"; then pid=\$(cat \"$service_iteration_dir/service.pid\" 2>/dev/null || true); test -n \"\$pid\" && kill -TERM \"\$pid\" 2>/dev/null || true; rm -f \"$service_iteration_dir/service.pid\"; fi" || true
  fi
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
  service_monitor_pid=""
  if [[ "$service_host" != "none" ]]; then
    if [[ "$approach" == "heimdall" ]]; then
      experiment_ssh "$service_host" "export HEIMDALL_RESULTS_DIR=\"$service_iteration_dir\" HEIMDALL_RUN_ID='$run_id-$(printf '%02d' "$iteration")' HEIMDALL_APPROACH=heimdall HEIMDALL_RSP_JS_PATH=\"$rsp_js_path\" HEIMDALL_RESOURCE_INTERVAL_MS='$(read_config 'c.experiment.resourceSamplingIntervalMs')'; $heimdall_launch_command" >"$root/$iteration_dir/$approach.log" 2>&1 & service_pid=$!
    else
      experiment_ssh "$service_host" "$(service_launch_command "iteration-$(printf '%02d' "$iteration")")" >"$root/$iteration_dir/$approach.log" 2>&1 & service_pid=$!
      sleep 1
      experiment_ssh "$service_host" "$(service_monitor_command "iteration-$(printf '%02d' "$iteration")")" >"$root/$iteration_dir/service-monitor.log" 2>&1 & service_monitor_pid=$!
    fi
  fi
  if [[ "$approach" == "heimdall" ]]; then wait_for_command "Heimdall /health" "curl --fail --silent --show-error http://127.0.0.1:8080/health >/dev/null" "${HEIMDALL_READY_TIMEOUT_SECONDS:-30}"; elif [[ "$service_host" != "none" ]]; then sleep "${SERVICE_STARTUP_SECONDS:-15}"; fi
  experiment_ssh "$client_host" "$(client_launch_command "$iteration_dir" "$run_id-$(printf '%02d' "$iteration")")" >"$root/$iteration_dir/client-launcher.log" 2>&1 & client_pid=$!
  wait_for_command_on_host "all client confirmed-ready markers" "$client_host" "$(all_client_ready_markers_command "$iteration_dir")" "${CLIENT_READY_TIMEOUT_SECONDS:-60}" "${EXPERIMENT_FIRST_WINDOW_POLL_INTERVAL_SECONDS:-1}" || { echo "Not all $client_count clients became ready; replayer will not be started." >&2; exit 1; }
  experiment_ssh "$replayer_host" "$replayer_launch_command" >"$root/$iteration_dir/replayer.log" 2>&1 & replayer_pid=$!
  if [[ "$approach" == "heimdall" && "${EXPERIMENT_STOP_AFTER_FIRST_WINDOW:-false}" == "true" ]]; then
    wait_for_command "first Heimdall R2R result" "$(heimdall_first_result_ready_command "$service_iteration_dir/window-processing.csv")" "$duration" "${EXPERIMENT_FIRST_WINDOW_POLL_INTERVAL_SECONDS:-1}" || { echo "No r2r_first_result appeared within ${duration}s after replay started." >&2; exit 1; }
  fi
  wait_for_command_on_host "all client first-result markers" "$client_host" "$(all_client_first_result_markers_ready_command "$iteration_dir")" "$duration" "${EXPERIMENT_FIRST_WINDOW_POLL_INTERVAL_SECONDS:-1}" || { echo "Not all $client_count clients produced a first result within ${duration}s after replay started." >&2; exit 1; }
  cleanup
  pids=("$client_pid" "$replayer_pid"); if [[ -n "$service_pid" ]]; then pids+=("$service_pid"); fi; if [[ -n "$service_monitor_pid" ]]; then pids+=("$service_monitor_pid"); fi
  kill "${pids[@]}" 2>/dev/null || true; wait "${pids[@]}" 2>/dev/null || true
  experiment_scp_from "$client_host" "$evaluation_path/$iteration_dir" "$root/$output_root/"
  if [[ "$service_host" != "none" ]]; then experiment_scp_from "$service_host" "$service_iteration_dir" "$root/$iteration_dir/service"; if [[ -f "$root/$iteration_dir/service/resource.csv" ]]; then cp "$root/$iteration_dir/service/resource.csv" "$root/$iteration_dir/service-resource.csv"; elif [[ -f "$root/$iteration_dir/service/service-resource.csv" ]]; then cp "$root/$iteration_dir/service/service-resource.csv" "$root/$iteration_dir/service-resource.csv"; fi; fi
done
