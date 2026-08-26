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

frequency="$(read_config 'c.experiment.frequencyHz')"; iterations="$(read_config 'c.experiment.iterations')"; duration="$(read_config 'c.experiment.durationSeconds')"; client_count="$(read_config 'c.experiment.clientCount')"; client_arrival_mode="$(read_config 'c.experiment.clientArrivalMode')"
late_client_ids=""; if (( client_count > 1 )); then for late_id in $(seq 1 "$((client_count - 1))"); do [[ -n "$late_client_ids" ]] && late_client_ids+=","; late_client_ids+="$late_id"; done; fi
replayer_host="$(read_config 'c.hosts.replayer')"; pod_host="$(read_config 'c.hosts.solidPod')"; client_host="$(read_config 'c.hosts.client')"; solid_pod_url="$(read_config 'c.urls.solidPod')"
SSH_USER="${EXPERIMENT_SSH_USER:-$(read_config 'c.ssh.user')}"; SSH_BASTION="${EXPERIMENT_SSH_BASTION:-$(read_config 'c.ssh.bastion === null ? "" : c.ssh.bastion')}"
SSH_IDENTITY_FILE="${EXPERIMENT_SSH_IDENTITY_FILE:-$(read_config 'c.ssh.identityFile === null ? "" : c.ssh.identityFile')}"; SSH_CONNECT_TIMEOUT_SECONDS="${EXPERIMENT_SSH_CONNECT_TIMEOUT_SECONDS:-$(read_config 'c.ssh.connectTimeoutSeconds')}"
experiment_ssh_args
evaluation_path="$(experiment_remote_path "$(read_config 'c.remotePaths.evaluation')")"; heimdall_path="$(experiment_remote_path "$(read_config 'c.remotePaths.heimdall')")"; notification_aggregator_path="$(experiment_remote_path "$(read_config 'c.remotePaths.notificationAggregator')")"; rsp_js_path="$(experiment_remote_path "$(read_config 'c.remotePaths.rspJs')")"; replayer_path="$(experiment_remote_path "$(read_config 'c.remotePaths.replayer')")"
evaluation_sha="${EVALUATION_REPOSITORY_SHA_EXPECTED:-$(git rev-parse HEAD)}"; heimdall_sha="${HEIMDALL_REPOSITORY_SHA_EXPECTED:-32c9e3adc254cfd6f79eea71ab121b7bc344ae86}"; notification_aggregator_sha="${NOTIFICATION_AGGREGATOR_REPOSITORY_SHA_EXPECTED:-7623967531a4f8a9558c7a8fb91c4ab428199ef5}"; rsp_js_sha="${RSP_JS_SHA_EXPECTED:-56e773d8416f978d82a8288802532cabdf8ffef6}"; replayer_sha="${REPLAYER_REPOSITORY_SHA_EXPECTED:-a98ec1cba14f4437bb0bbefd915fb07e79a454fe}"
launcher="src/experiments/clients/$approach/launcher.ts"; run_id="${EXPERIMENT_RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"; output_root="results/4hz/$approach/clients-$client_count/run-$run_id"
client_config_path="${EXPERIMENT_CLIENT_CONFIG_PATH:-}"
solid_initialize="cd \"$evaluation_path\" && EXPERIMENT_CONFIG_PATH=\"$client_config_path\" npx ts-node initialise-LDES.ts"; solid_cleanup="${SOLID_CLEANUP_COMMAND:-<SOLID_CLEANUP_COMMAND is required>}"; replayer_start="${REPLAYER_START_COMMAND:-<REPLAYER_START_COMMAND is required>}"
service_results_root="$heimdall_path/.evaluation-results/$run_id"
service_iteration_dir="$service_results_root/iteration-XX"
heimdall_pid_file="$service_results_root/heimdall.pid"
case "$approach" in
  notification-aggregator) service_host="$(read_config 'c.hosts.notificationAggregator')"; service_start="${NOTIFICATION_AGGREGATOR_START_COMMAND:-<NOTIFICATION_AGGREGATOR_START_COMMAND is required>}"; service_sha="$notification_aggregator_sha"; service_repository_path="$notification_aggregator_path" ;;
  heimdall)
    service_host="$(read_config 'c.hosts.heimdall')"
    service_start="${HEIMDALL_START_COMMAND:-<HEIMDALL_START_COMMAND is required>}"
    service_sha="$heimdall_sha"; service_repository_path="$heimdall_path"
    ;;
  without-aggregator) service_host="none"; service_start=":"; service_sha=""; service_repository_path="" ;;
esac
if [[ "$client_arrival_mode" == "staged-reuse" && "$approach" != "heimdall" && "$approach" != "notification-aggregator" ]]; then
  echo "clientArrivalMode=staged-reuse is supported only with heimdall or notification-aggregator." >&2
  exit 2
fi
if [[ "$service_host" != "none" ]]; then
  service_results_root="$service_repository_path/.evaluation-results/$run_id"
  service_iteration_dir="$service_results_root/iteration-XX"
  heimdall_pid_file="$service_results_root/heimdall.pid"
fi

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
client_phase_a_pid_file="$evaluation_path/.4hz-$approach-phase-a-launcher.pid"
client_phase_b_pid_file="$evaluation_path/.4hz-$approach-phase-b-launcher.pid"
client_launch_command() {
  local iteration_output_dir="$1" iteration_run_id="$2" client_ids="${3:-}" pid_file="${4:-$client_pid_file}" launch_marker="${5:-}" skip_host_monitor="${6:-false}" launcher_log="${7:-client-launcher.log}"
  local client_args="--output-dir $(shell_quote "$iteration_output_dir")"
  [[ -n "$client_ids" ]] && client_args+=" --client-ids $(shell_quote "$client_ids")"
  [[ -n "$launch_marker" ]] && client_args+=" --launch-marker $(shell_quote "$launch_marker")"
  [[ "$skip_host_monitor" == "true" ]] && client_args+=" --skip-host-monitor"
  printf 'cd "%s" && (setsid env RSP_JS_DISABLE_LOGGING=1 EXPERIMENT_CONFIG_PATH=%s EXPERIMENT_RUN_ID=%s EVALUATION_REPOSITORY_SHA=%s RSP_JS_REPOSITORY_SHA=%s SERVICE_REPOSITORY_SHA=%s npx ts-node %s %s > "%s/%s" 2>&1 & client_pid=$!; printf '\''%%s\\n'\'' "$client_pid" > "%s"; wait "$client_pid")' \
    "$evaluation_path" "$(shell_quote "$client_config_path")" "$(shell_quote "$iteration_run_id")" \
    "$(shell_quote "$evaluation_sha")" "$(shell_quote "$rsp_js_sha")" "$(shell_quote "$service_sha")" "$(shell_quote "$launcher")" "$client_args" "$iteration_output_dir" "$launcher_log" "$pid_file"
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
rsp_js_diagnostic_patterns=(
  'Adding \[" \+ .* \] at time : .* and watermark'
  'Watermark is not increasing'
  'Logger initialized with log level'
  'Error writing to file:'
  'Invalid log destination:'
)
validate_rsp_js_diagnostics() {
  local log_path="$1" pattern
  [[ -f "$log_path" ]] || return 0
  for pattern in "${rsp_js_diagnostic_patterns[@]}"; do
    if grep -Eq "$pattern" "$log_path"; then
      echo "RSP-JS diagnostic output detected in $log_path: $pattern" >&2
      return 1
    fi
  done
}
service_resource_header='timestamp,cpu_user_jiffies,cpu_system_jiffies,rss_bytes,wall_delta_ms,cpu_utilization_percent'
heimdall_rsp_js_preflight_command() {
  printf 'expected_path=$(cd %s && pwd -P) || { echo "Heimdall RSP-JS preflight: expected checkout is unavailable" >&2; exit 1; }; test "$(git -C "$expected_path" rev-parse HEAD)" = %s || { echo "Heimdall RSP-JS preflight: expected checkout SHA mismatch" >&2; exit 1; }; resolved=$(cd %s && node -e '\''const fs = require("fs"); process.stdout.write(fs.realpathSync(require.resolve("rsp-js")));'\'') || { echo "Heimdall RSP-JS preflight: unable to resolve rsp-js" >&2; exit 1; }; case "$resolved" in "$expected_path"/*) ;; *) echo "Heimdall RSP-JS preflight: resolved rsp-js is outside the frozen checkout: $resolved" >&2; exit 1;; esac; logger="$expected_path/dist/util/Logger.js"; test -f "$logger" && grep -Fq "RSP_JS_DISABLE_LOGGING" "$logger" || { echo "Heimdall RSP-JS preflight: resolved Logger lacks benchmark logging-disable support" >&2; exit 1; }' \
    "$(remote_path_expression "$rsp_js_path")" "$(shell_quote "$rsp_js_sha")" "$(remote_path_expression "$heimdall_path")"
}
service_launch_command() {
  local iteration_dir="$1"
  printf 'mkdir -p %s; printf "%s\\n" > %s; setsid bash -c %s > %s/service.log 2>&1 & service_pgid=$!; printf "%%s\\n" "$service_pgid" > %s/service.pgid; service_pid=""; for attempt in $(seq 1 %s); do descendants="$service_pgid"; while test -n "$descendants"; do next=""; for candidate in $descendants; do if test "$(ps -o comm= -p "$candidate" 2>/dev/null | tr -d " ")" = node; then service_pid="$candidate"; break 3; fi; next="$next $(pgrep -P "$candidate" 2>/dev/null || true)"; done; descendants="$next"; done; sleep 1; done; if test -z "$service_pid"; then echo "service launch: Node PID was not discovered within %s seconds" >&2; kill -TERM -- "-$service_pgid" 2>/dev/null || true; exit 1; fi; printf "%%s\\n" "$service_pid" > %s/service.pid; wait "$service_pgid"' \
    "$(remote_path_expression "$service_results_root/$iteration_dir")" "$service_resource_header" "$(remote_path_expression "$service_results_root/$iteration_dir/service-resource.csv")" "$service_start_exec_quoted" "$(remote_path_expression "$service_results_root/$iteration_dir")" "$(remote_path_expression "$service_results_root/$iteration_dir")" "${SERVICE_NODE_DISCOVERY_ATTEMPTS:-30}" "${SERVICE_NODE_DISCOVERY_ATTEMPTS:-30}" "$(remote_path_expression "$service_results_root/$iteration_dir")"
}
service_monitor_command() {
  local iteration_dir="$1"
  printf 'file=%s; pid_file=%s; pid_timeout=%s; interval_ms=%s; interval=$(awk -v ms="$interval_ms" '\''BEGIN { print ms / 1000 }'\''); proc_root=${SERVICE_PROC_ROOT:-/proc}; start=$(date +%%s); while :; do pid=$(cat "$pid_file" 2>/dev/null || true); case "$pid" in ""|*[!0-9]*) ;; *) test -r "$proc_root/$pid/stat" && break;; esac; if (( $(date +%%s) - start >= pid_timeout )); then echo "service monitor: service.pid did not become a readable numeric PID within ${pid_timeout}s" >&2; exit 1; fi; sleep 1; done; clock_ticks=$(getconf CLK_TCK 2>/dev/null || true); case "$clock_ticks" in ""|*[!0-9]*) echo "service monitor: getconf CLK_TCK returned an invalid value" >&2; exit 1;; esac; previous_cpu=; previous_wall=; while test -f "$pid_file"; do pid=$(cat "$pid_file" 2>/dev/null || true); case "$pid" in ""|*[!0-9]*) echo "service monitor: service.pid became invalid" >&2; exit 1;; esac; test -r "$proc_root/$pid/stat" || break; stat=$(cat "$proc_root/$pid/stat"); user=$(awk '\''{print $14}'\'' <<< "$stat"); system=$(awk '\''{print $15}'\'' <<< "$stat"); rss=$(awk '\''/^VmRSS:/ {print $2 * 1024}'\'' "$proc_root/$pid/status"); now=$(date +%%s%%3N); if test -n "$previous_wall"; then wall_delta=$((now - previous_wall)); delta_jiffies=$((user + system - previous_cpu)); cpu_util=$(awk -v j="$delta_jiffies" -v t="$clock_ticks" -v w="$wall_delta" '\''BEGIN { if (w > 0 && t > 0) print 100000 * j / (t * w); else print ""}'\''); else wall_delta=""; cpu_util=""; fi; printf "%%s,%%s,%%s,%%s,%%s,%%s\\n" "$now" "$user" "$system" "$rss" "$wall_delta" "$cpu_util" >> "$file"; previous_wall=$now; previous_cpu=$((user + system)); sleep "$interval"; done' \
    "$(remote_path_expression "$service_results_root/$iteration_dir/service-resource.csv")" "$(remote_path_expression "$service_results_root/$iteration_dir/service.pid")" "${SERVICE_PID_TIMEOUT_SECONDS:-${SERVICE_STARTUP_SECONDS:-15}}" "$(read_config 'c.experiment.resourceSamplingIntervalMs')"
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
  printf 'iteration_dir=%s; for csv in "$iteration_dir"/client-*-operations.csv; do test -f "$csv" && awk -F, '\''NR == 1 { for (i = 1; i <= NF; i++) if ($i == "operation") operation_column = i; next } operation_column && $operation_column == "r2r_first_result" { found=1 } END { exit !found }'\'' "$csv" && exit 0; done; exit 1' "$(remote_path_expression "$evaluation_path/$iteration_dir")"
}
all_client_first_result_markers_ready_command() {
  local iteration_dir="$1"
  printf 'iteration_dir=%s; for client_id in $(seq 0 %s); do test -f "$iteration_dir/client-$client_id-first-result.ready" || exit 1; done' "$(remote_path_expression "$evaluation_path/$iteration_dir")" "$((client_count - 1))"
}
all_client_ready_markers_command() {
  local iteration_dir="$1"
  printf 'iteration_dir=%s; count=0; for client_id in $(seq 0 %s); do marker="$iteration_dir/client-$client_id-ready.json"; test -s "$marker" || exit 1; count=$((count + 1)); done; test "$count" -eq %s' "$(remote_path_expression "$evaluation_path/$iteration_dir")" "$((client_count - 1))" "$client_count"
}
late_client_ready_markers_command() {
  local iteration_dir="$1"
  if (( client_count <= 1 )); then printf 'true'; return; fi
  printf 'iteration_dir=%s; for client_id in $(seq 1 %s); do test -s "$iteration_dir/client-$client_id-ready.json" || exit 1; done' "$(remote_path_expression "$evaluation_path/$iteration_dir")" "$((client_count - 1))"
}
late_client_first_result_markers_ready_command() {
  local iteration_dir="$1"
  if (( client_count <= 1 )); then printf 'true'; return; fi
  printf 'iteration_dir=%s; for client_id in $(seq 1 %s); do test -s "$iteration_dir/client-$client_id-first-result.ready" || exit 1; done' "$(remote_path_expression "$evaluation_path/$iteration_dir")" "$((client_count - 1))"
}
staged_phase_marker_command() {
  local iteration_dir="$1" marker="$2" phase="$3"
  printf 'mkdir -p %s; printf '\''{"phase":"%s","epoch_ms":%%s}\\n'\'' "$(date +%%s%%3N)" > %s' "$(remote_path_expression "$evaluation_path/$iteration_dir")" "$phase" "$(remote_path_expression "$evaluation_path/$iteration_dir/$marker")"
}
network_snapshot_base="${EXPERIMENT_NETWORK_SNAPSHOT_ROOT:-.evaluation-network}"
network_interface_command() {
  printf 'if test -n "$override"; then interface="$override"; else command -v ip >/dev/null || { echo "network snapshot: ip is unavailable" >&2; exit 1; }; route_target="$target"; if ! ip route get "$route_target" >/dev/null 2>&1; then command -v getent >/dev/null || { echo "network snapshot: getent is unavailable for hostname resolution" >&2; exit 1; }; route_target=$(getent ahostsv4 "$target" | awk '\''NR == 1 { print $1; exit }'\''); test -n "$route_target" || { echo "network snapshot: unable to resolve $target" >&2; exit 1; }; fi; interface=$(ip route get "$route_target" | awk '\''NR == 1 { for (i = 1; i <= NF; i++) if ($i == "dev") { print $(i + 1); exit } }'\''); fi'
}
network_snapshot_command() {
  local role="$1" route_target="$2" phase="$3" iteration_label="$4"
  local override_name
  override_name="EXPERIMENT_NETWORK_INTERFACE_$(printf '%s' "$role" | tr '[:lower:]' '[:upper:]')"
  local override="${!override_name:-}"
  local snapshot_file="$network_snapshot_base/$run_id/$iteration_label/$role.$phase.csv"
  printf 'set -euo pipefail; file=%s; target=%s; override=%s; mkdir -p "$(dirname "$file")"; %s; test -n "$interface" || { echo "network snapshot: no route interface for $target" >&2; exit 1; }; test "$interface" != lo || { echo "network snapshot: loopback is not permitted" >&2; exit 1; }; test -r "/sys/class/net/$interface/statistics/rx_bytes" && test -r "/sys/class/net/$interface/statistics/tx_bytes" || { echo "network snapshot: selected interface $interface is unavailable" >&2; exit 1; }; epoch=$(date +%%s%%3N); uptime=$(cut -d " " -f 1 /proc/uptime); seconds=${uptime%%.*}; fraction=${uptime#*.}; fraction=${fraction:0:9}; printf -v fraction "%%-9s" "$fraction"; fraction=${fraction// /0}; monotonic="${seconds}${fraction}"; rx=$(cat "/sys/class/net/$interface/statistics/rx_bytes"); tx=$(cat "/sys/class/net/$interface/statistics/tx_bytes"); case "$rx,$tx,$epoch,$monotonic" in *[!0-9,]*) echo "network snapshot: malformed kernel counter" >&2; exit 1;; esac; tmp="$file.tmp.$$"; printf "%%s,%%s,%%s,%%s,%%s,%%s,%%s\\n" %s "$(hostname -s)" "$interface" "$epoch" "$monotonic" "$rx" "$tx" > "$tmp"; mv "$tmp" "$file"' \
    "$(shell_quote "$snapshot_file")" "$(shell_quote "$route_target")" "$(shell_quote "$override")" "$(network_interface_command)" "$(shell_quote "$role")"
}
capture_network_snapshots() {
  local phase="$1" iteration_label="$2"
  local -a snapshot_pids=() snapshot_labels=()
  local solid_route_target="$client_host"
  [[ "$service_host" != "none" ]] && solid_route_target="$service_host"
  local -a roles=(solid client replayer) hosts=("$pod_host" "$client_host" "$replayer_host") targets=("$solid_route_target" "$pod_host" "$pod_host")
  if [[ "$service_host" != "none" ]]; then roles+=(service); hosts+=("$service_host"); targets+=("$pod_host"); fi
  local index
  for index in "${!roles[@]}"; do
    experiment_ssh "${hosts[$index]}" "$(network_snapshot_command "${roles[$index]}" "${targets[$index]}" "$phase" "$iteration_label")" >"$root/$iteration_dir/network-${roles[$index]}-$phase.log" 2>&1 &
    snapshot_pids+=("$!"); snapshot_labels+=("${roles[$index]}")
  done
  for index in "${!snapshot_pids[@]}"; do
    wait "${snapshot_pids[$index]}" || { echo "Network $phase snapshot failed for ${snapshot_labels[$index]}." >&2; return 1; }
  done
}
heimdall_staged_reuse_ready_command() {
  local initialization_csv="$1" expected_clients="$2"
  printf 'test -f %s && awk -F, '\''BEGIN { expected_reuse = %s - 1 } NR == 1 { for (i = 1; i <= NF; i++) operation_column = ($i == "operation" ? i : operation_column) } NR > 1 && operation_column { counts[$operation_column]++ } END { exit !(counts["shared_query_instance_created"] == 1 && counts["shared_query_instance_reused"] == expected_reuse && counts["query_registration"] == %s && counts["stream_subscription"] == 3) }'\'' %s' \
    "$(remote_path_expression "$initialization_csv")" "$expected_clients" "$expected_clients" "$(remote_path_expression "$initialization_csv")"
}
notification_aggregator_staged_reuse_ready_command() {
  local service_log="$1"
  printf 'test -f %s && awk '\''BEGIN { marker = "Subscribed to the inbox container location:" } index($0, marker) { value = substr($0, index($0, marker) + length(marker)); if (!(value in seen)) { seen[value] = 1; unique++ } total++ } END { exit !(total == 3 && unique == 3) }'\'' %s' \
    "$(remote_path_expression "$service_log")" "$(remote_path_expression "$service_log")"
}
staged_no_client_results_command() {
  local iteration_dir="$1"
  printf 'iteration_dir=%s; for marker in "$iteration_dir"/client-*-first-result.ready; do test ! -e "$marker" || exit 1; done' "$(remote_path_expression "$evaluation_path/$iteration_dir")"
}
staged_no_service_result_command() {
  local processing_csv="$1"
  printf 'if test -f %s; then awk -F, '\''NR == 1 { for (i = 1; i <= NF; i++) if ($i == "operation") operation_column = i; next } operation_column && $operation_column == "r2r_first_result" { found = 1 } END { exit found }'\'' %s; fi' \
    "$(remote_path_expression "$processing_csv")" "$(remote_path_expression "$processing_csv")"
}
print_plan() {
  echo "approach=$approach frequencyHz=$frequency clientCount=$client_count clientArrivalMode=$client_arrival_mode iterations=$iterations durationSeconds=$duration"
  echo "ssh=user:$SSH_USER bastion:${SSH_BASTION:-none} identity:${SSH_IDENTITY_FILE:+configured} timeout:${SSH_CONNECT_TIMEOUT_SECONDS}s"
  echo "machines: replayer=$replayer_host solidPod=$pod_host client=$client_host service=$service_host"
  echo "remote-paths: evaluation=$evaluation_path heimdall=$heimdall_path notificationAggregator=$notification_aggregator_path rspJs=$rsp_js_path replayer=$replayer_path"
  echo "expected-shas: evaluation=$evaluation_sha heimdall=$heimdall_sha notificationAggregator=$notification_aggregator_sha rspJs=$rsp_js_sha replayer=$replayer_sha"
  echo "output-root=$root/$output_root"
  echo "replayer-runtime: $replayer_runtime_root"
  echo "replayer-pid: $replayer_pid_file"
  echo "network-snapshots: two local kernel-counter snapshots per measured host under $network_snapshot_base/$run_id/iteration-XX"
  echo "cleanup-pids: heimdall=$heimdall_pid_file replayer=$replayer_pid_file"
  echo "client-launcher-pids: simultaneous=$client_pid_file phase-a=$client_phase_a_pid_file phase-b=$client_phase_b_pid_file"
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
  if [[ "$client_arrival_mode" == "staged-reuse" ]]; then
    echo "staged-client-0: $(experiment_ssh_preview "$client_host" "$(client_launch_command "$output_root/iteration-XX" "$run_id" 0 "$client_phase_a_pid_file" "iteration-XX/staged-client-0-launch.json" false client-phase-a-launcher.log)")"
    echo "staged-reuse-clients: $(experiment_ssh_preview "$client_host" "$(client_launch_command "$output_root/iteration-XX" "$run_id" "$late_client_ids" "$client_phase_b_pid_file" "iteration-XX/staged-reuse-clients-launch.json" true client-phase-b-launcher.log)")"
    echo "staged-phase-markers: client-0-launch, client-0-ready, reuse-clients-launch, reuse-clients-ready, reuse-validation-complete, all-clients-ready, replay-start, first-genuine-result(s)"
  fi
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
wait_for_replay_measurement_window() {
  local deadline="$1" iteration_dir="$2" interval="${EXPERIMENT_FIRST_WINDOW_POLL_INTERVAL_SECONDS:-1}"
  local first_results_ready=false replayer_exited_early=false service_result_ready=true client_results_ready=false remaining
  while (( SECONDS < deadline )); do
    if [[ "$first_results_ready" != true ]]; then
      service_result_ready=true
      if [[ "$approach" == "heimdall" && "${EXPERIMENT_STOP_AFTER_FIRST_WINDOW:-false}" == "true" ]]; then
        experiment_ssh "$service_host" "$(heimdall_first_result_ready_command "$service_iteration_dir/window-processing.csv")" && service_result_ready=true || service_result_ready=false
      fi
      experiment_ssh "$client_host" "$(all_client_first_result_markers_ready_command "$iteration_dir")" && client_results_ready=true || client_results_ready=false
      [[ "$service_result_ready" == true && "$client_results_ready" == true ]] && first_results_ready=true
    fi
    kill -0 "$replayer_pid" 2>/dev/null || replayer_exited_early=true
    remaining=$((deadline - SECONDS)); (( remaining > 0 )) || break
    sleep "$(( remaining < interval ? remaining : interval ))"
  done
  [[ "$first_results_ready" == true ]] || { echo "Not all clients produced a first result within ${duration}s after replay started." >&2; return 1; }
  [[ "$replayer_exited_early" != true ]] || { echo "Replayer exited before the ${duration}s measurement deadline." >&2; return 1; }
}
stop_replayer_process_group() {
  experiment_ssh "$replayer_host" "if test -f \"$replayer_pid_file\"; then pid=\$(cat \"$replayer_pid_file\" 2>/dev/null || true); if test -n \"\$pid\" && kill -0 -- \"-\$pid\" 2>/dev/null; then kill -TERM -- \"-\$pid\" 2>/dev/null || kill -TERM \"\$pid\" 2>/dev/null || true; for attempt in 1 2 3 4 5; do kill -0 -- \"-\$pid\" 2>/dev/null || break; sleep 1; done; if kill -0 -- \"-\$pid\" 2>/dev/null; then kill -KILL -- \"-\$pid\" 2>/dev/null || kill -KILL \"\$pid\" 2>/dev/null || true; fi; fi; rm -f \"$replayer_pid_file\"; fi" || true
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
  remote_check "SOLID POD SSH reachable" "$pod_host" "hostname" || failures=1
  remote_check "SOLID POD HTTP reachable" "$client_host" "command -v curl >/dev/null && curl --fail --silent --show-error --max-time 10 --output /dev/null \"$solid_pod_url\"" || failures=1
  remote_check "CLIENT reachable/evaluation-path/SHA/clean/node" "$client_host" "test -d \"$evaluation_path\" && test \"\$(git -C \"$evaluation_path\" rev-parse HEAD)\" = \"$evaluation_sha\" && test -z \"\$(git -C \"$evaluation_path\" status --porcelain -- src/experiments package.json package-lock.json tsconfig.experiments.json)\" && command -v node && node --version" || failures=1
  if [[ "$service_host" != "none" ]]; then
    remote_check "SERVICE reachable/repository/SHA/clean/node" "$service_host" "test -d \"$service_repository_path\" && test \"\$(git -C \"$service_repository_path\" rev-parse HEAD)\" = \"$service_sha\" && test -z \"\$(git -C \"$service_repository_path\" status --porcelain -- src package.json package-lock.json tsconfig.json)\" && command -v node && node --version" || failures=1
    if [[ "$approach" == "heimdall" ]]; then remote_check "HEIMDALL resolved frozen RSP-JS" "$service_host" "$(heimdall_rsp_js_preflight_command)" || failures=1; fi
  fi
  print_plan
  exit "$failures"
fi
for command in "$solid_initialize" "$solid_cleanup" "$replayer_start" "$service_start"; do if command_required "$command"; then echo "Set ${command#<} before running." >&2; exit 2; fi; done
cleanup() {
  if [[ "$client_arrival_mode" == "staged-reuse" ]]; then
    experiment_ssh "$client_host" "for pid_file in \"$client_phase_a_pid_file\" \"$client_phase_b_pid_file\"; do if test -f \"\$pid_file\"; then pid=\$(cat \"\$pid_file\" 2>/dev/null || true); if test -n \"\$pid\" && kill -0 -- \"-\$pid\" 2>/dev/null; then kill -TERM -- \"-\$pid\" 2>/dev/null || kill -TERM \"\$pid\" 2>/dev/null || true; for attempt in 1 2 3 4 5; do kill -0 -- \"-\$pid\" 2>/dev/null || break; sleep 1; done; kill -KILL -- \"-\$pid\" 2>/dev/null || true; fi; rm -f \"\$pid_file\"; fi; done" || true
  elif [[ "$approach" == "without-aggregator" ]]; then
    experiment_ssh "$client_host" "if test -f \"$client_pid_file\"; then pid=\$(cat \"$client_pid_file\" 2>/dev/null || true); if test -n \"\$pid\" && kill -0 -- \"-\$pid\" 2>/dev/null; then kill -TERM -- \"-\$pid\" 2>/dev/null || kill -TERM \"\$pid\" 2>/dev/null || true; for attempt in 1 2 3 4 5; do status=\$(kill -0 -- \"-\$pid\" 2>/dev/null && echo alive || true); if test -z \"\$status\"; then break; fi; sleep 1; done; status=\$(kill -0 -- \"-\$pid\" 2>/dev/null && echo alive || true); if test -n \"\$status\"; then kill -KILL -- \"-\$pid\" 2>/dev/null || kill -KILL \"\$pid\" 2>/dev/null || true; fi; fi; rm -f \"$client_pid_file\"; fi" || true
  else
    experiment_ssh "$client_host" "if test -f \"$client_pid_file\"; then kill -TERM \$(cat \"$client_pid_file\") 2>/dev/null || true; rm -f \"$client_pid_file\"; fi" || true
  fi
  if [[ "$service_host" != "none" && "$approach" != "heimdall" ]]; then
    experiment_ssh "$service_host" "if test -f \"$service_iteration_dir/service.pgid\"; then pgid=\$(cat \"$service_iteration_dir/service.pgid\" 2>/dev/null || true); test -n \"\$pgid\" && kill -TERM -- \"-\$pgid\" 2>/dev/null || true; for attempt in 1 2 3 4 5; do kill -0 -- \"-\$pgid\" 2>/dev/null || break; sleep 1; done; if kill -0 -- \"-\$pgid\" 2>/dev/null; then kill -KILL -- \"-\$pgid\" 2>/dev/null || true; echo \"Notification Aggregator group \$pgid survived cleanup.\" >&2; exit 1; fi; fi; rm -f \"$service_iteration_dir/service.pid\" \"$service_iteration_dir/service.pgid\"" || true
  fi
  if [[ "$approach" == "heimdall" ]]; then
    experiment_ssh "$service_host" "if test -f \"$heimdall_pid_file\"; then pid=\$(cat \"$heimdall_pid_file\" 2>/dev/null || true); if test -n \"\$pid\" && kill -0 \"\$pid\" 2>/dev/null; then kill -TERM -- \"-\$pid\" 2>/dev/null || kill -TERM \"\$pid\" 2>/dev/null || true; for attempt in 1 2 3 4 5; do status=\$(ps -o stat= -p \"\$pid\" 2>/dev/null | tr -d ' ' || true); if test -z \"\$status\" || [[ \"\$status\" == Z* ]]; then break; fi; sleep 1; done; status=\$(ps -o stat= -p \"\$pid\" 2>/dev/null | tr -d ' ' || true); if test -n \"\$status\" && [[ \"\$status\" != Z* ]]; then kill -KILL -- \"-\$pid\" 2>/dev/null || kill -KILL \"\$pid\" 2>/dev/null || true; fi; fi; rm -f \"$heimdall_pid_file\"; status=\$(ps -o stat= -p \"\$pid\" 2>/dev/null | tr -d ' ' || true); if test -n \"\$status\" && [[ \"\$status\" != Z* ]]; then echo \"Heimdall run PID \$pid is still running after cleanup.\" >&2; exit 1; fi; fi"
  fi
  stop_replayer_process_group
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
      experiment_ssh "$service_host" "export RSP_JS_DISABLE_LOGGING=1 HEIMDALL_RESULTS_DIR=\"$service_iteration_dir\" HEIMDALL_RUN_ID='$run_id-$(printf '%02d' "$iteration")' HEIMDALL_APPROACH=heimdall HEIMDALL_RSP_JS_PATH=\"$rsp_js_path\" HEIMDALL_RESOURCE_INTERVAL_MS='$(read_config 'c.experiment.resourceSamplingIntervalMs')'; $heimdall_launch_command" >"$root/$iteration_dir/$approach.log" 2>&1 & service_pid=$!
    else
      experiment_ssh "$service_host" "$(service_launch_command "iteration-$(printf '%02d' "$iteration")")" >"$root/$iteration_dir/$approach.log" 2>&1 & service_pid=$!
      experiment_ssh "$service_host" "$(service_monitor_command "iteration-$(printf '%02d' "$iteration")")" >"$root/$iteration_dir/service-monitor.log" 2>&1 & service_monitor_pid=$!
    fi
  fi
  if [[ "$approach" == "heimdall" ]]; then wait_for_command "Heimdall /health" "curl --fail --silent --show-error http://127.0.0.1:8080/health >/dev/null" "${HEIMDALL_READY_TIMEOUT_SECONDS:-30}"; elif [[ "$service_host" != "none" ]]; then sleep "${SERVICE_STARTUP_SECONDS:-15}"; fi
  # In simultaneous mode, all client confirmed-ready markers are required before the replayer starts.
  client_phase_b_ssh_pid=""
  if [[ "$client_arrival_mode" == "staged-reuse" ]]; then
    experiment_ssh "$client_host" "$(client_launch_command "$iteration_dir" "$run_id-$(printf '%02d' "$iteration")" 0 "$client_phase_a_pid_file" "$iteration_dir/staged-client-0-launch.json" false client-phase-a-launcher.log)" >"$root/$iteration_dir/client-phase-a-launcher.log" 2>&1 & client_pid=$!
    wait_for_command_on_host "client 0 confirmed-ready marker" "$client_host" "test -s $(remote_path_expression "$evaluation_path/$iteration_dir/client-0-ready.json")" "${CLIENT_READY_TIMEOUT_SECONDS:-60}" "${EXPERIMENT_FIRST_WINDOW_POLL_INTERVAL_SECONDS:-1}" || { echo "Client 0 did not become ready; replayer will not be started." >&2; exit 1; }
    experiment_ssh "$client_host" "$(staged_phase_marker_command "$iteration_dir" staged-client-0-ready.json client-0-ready)"
    if (( client_count > 1 )); then
      experiment_ssh "$client_host" "$(client_launch_command "$iteration_dir" "$run_id-$(printf '%02d' "$iteration")" "$late_client_ids" "$client_phase_b_pid_file" "$iteration_dir/staged-reuse-clients-launch.json" true client-phase-b-launcher.log)" >"$root/$iteration_dir/client-phase-b-launcher.log" 2>&1 & client_phase_b_ssh_pid=$!
      wait_for_command_on_host "reuse clients launched" "$client_host" "test -s $(remote_path_expression "$evaluation_path/$iteration_dir/staged-reuse-clients-launch.json")" "${CLIENT_READY_TIMEOUT_SECONDS:-60}" "${EXPERIMENT_FIRST_WINDOW_POLL_INTERVAL_SECONDS:-1}" || { echo "Reuse clients were not launched after client 0 became ready." >&2; exit 1; }
    else
      experiment_ssh "$client_host" "$(staged_phase_marker_command "$iteration_dir" staged-reuse-clients-launch.json reuse-clients-launch)"
    fi
    wait_for_command_on_host "all clients confirmed-ready markers" "$client_host" "$(all_client_ready_markers_command "$iteration_dir")" "${CLIENT_READY_TIMEOUT_SECONDS:-60}" "${EXPERIMENT_FIRST_WINDOW_POLL_INTERVAL_SECONDS:-1}" || { echo "Not all staged clients became ready; replayer will not be started." >&2; exit 1; }
    experiment_ssh "$client_host" "$(staged_phase_marker_command "$iteration_dir" staged-reuse-clients-ready.json reuse-clients-ready)"
    if [[ "$approach" == "heimdall" ]]; then
      wait_for_command "Heimdall staged reuse invariant" "$(heimdall_staged_reuse_ready_command "$service_iteration_dir/initialization.csv" "$client_count")" "${HEIMDALL_QUERY_READY_TIMEOUT_SECONDS:-30}" "${EXPERIMENT_FIRST_WINDOW_POLL_INTERVAL_SECONDS:-1}" || { echo "Heimdall staged reuse invariant was not established before replay." >&2; exit 1; }
      experiment_ssh "$client_host" "$(staged_no_client_results_command "$iteration_dir")"
      experiment_ssh "$service_host" "$(staged_no_service_result_command "$service_iteration_dir/window-processing.csv")"
    elif [[ "$approach" == "notification-aggregator" ]]; then
      wait_for_command "Notification Aggregator staged upstream invariant" "$(notification_aggregator_staged_reuse_ready_command "$service_iteration_dir/service.log")" "${CLIENT_READY_TIMEOUT_SECONDS:-60}" "${EXPERIMENT_FIRST_WINDOW_POLL_INTERVAL_SECONDS:-1}" || { echo "Notification Aggregator staged upstream invariant was not established before replay." >&2; exit 1; }
      experiment_ssh "$client_host" "$(staged_no_client_results_command "$iteration_dir")"
    fi
    experiment_ssh "$client_host" "$(staged_phase_marker_command "$iteration_dir" staged-reuse-validation-complete.json reuse-validation-complete)"
    experiment_ssh "$client_host" "$(staged_phase_marker_command "$iteration_dir" staged-all-clients-ready.json all-clients-ready)"
    capture_network_snapshots start "iteration-$(printf '%02d' "$iteration")"
    replay_deadline=$((SECONDS + duration))
    experiment_ssh "$client_host" "$(staged_phase_marker_command "$iteration_dir" staged-replay-start.json replay-start)"
    experiment_ssh "$replayer_host" "$replayer_launch_command" >"$root/$iteration_dir/replayer.log" 2>&1 & replayer_pid=$!
  else
    experiment_ssh "$client_host" "$(client_launch_command "$iteration_dir" "$run_id-$(printf '%02d' "$iteration")")" >"$root/$iteration_dir/client-launcher.log" 2>&1 & client_pid=$!
    wait_for_command_on_host "all client confirmed-ready markers" "$client_host" "$(all_client_ready_markers_command "$iteration_dir")" "${CLIENT_READY_TIMEOUT_SECONDS:-60}" "${EXPERIMENT_FIRST_WINDOW_POLL_INTERVAL_SECONDS:-1}" || { echo "Not all $client_count clients became ready; replayer will not be started." >&2; exit 1; }
    capture_network_snapshots start "iteration-$(printf '%02d' "$iteration")"
    replay_deadline=$((SECONDS + duration))
    experiment_ssh "$replayer_host" "$replayer_launch_command" >"$root/$iteration_dir/replayer.log" 2>&1 & replayer_pid=$!
  fi
  workload_failed=false
  infrastructure_failed=false
  wait_for_replay_measurement_window "$replay_deadline" "$iteration_dir" || workload_failed=true
  capture_network_snapshots end "iteration-$(printf '%02d' "$iteration")"
  stop_replayer_process_group
  kill "$replayer_pid" 2>/dev/null || true; wait "$replayer_pid" 2>/dev/null || true
  cleanup
  if [[ -n "$service_monitor_pid" ]] && ! wait "$service_monitor_pid"; then echo "Service resource monitor failed." >&2; infrastructure_failed=true; fi
  pids=("$client_pid" "$client_phase_b_ssh_pid"); if [[ -n "$service_pid" ]]; then pids+=("$service_pid"); fi
  kill "${pids[@]}" 2>/dev/null || true; wait "${pids[@]}" 2>/dev/null || true
  experiment_scp_from "$client_host" "$evaluation_path/$iteration_dir" "$root/$output_root/"
  mkdir -p "$root/$iteration_dir/network"
  for network_role in solid client replayer; do
    network_host="$pod_host"; [[ "$network_role" == client ]] && network_host="$client_host"; [[ "$network_role" == replayer ]] && network_host="$replayer_host"
    experiment_scp_from "$network_host" "$network_snapshot_base/$run_id/iteration-$(printf '%02d' "$iteration")/$network_role.start.csv" "$root/$iteration_dir/network/"
    experiment_scp_from "$network_host" "$network_snapshot_base/$run_id/iteration-$(printf '%02d' "$iteration")/$network_role.end.csv" "$root/$iteration_dir/network/"
  done
  if [[ "$service_host" != "none" ]]; then
    experiment_scp_from "$service_host" "$network_snapshot_base/$run_id/iteration-$(printf '%02d' "$iteration")/service.start.csv" "$root/$iteration_dir/network/"
    experiment_scp_from "$service_host" "$network_snapshot_base/$run_id/iteration-$(printf '%02d' "$iteration")/service.end.csv" "$root/$iteration_dir/network/"
  fi
  npx --prefix "$root" ts-node src/experiments/network/collect-network.ts --output "$root/$iteration_dir/network.csv" --approach "$approach" --run-id "$run_id" --client-count "$client_count" --iteration "$iteration" --input-dir "$root/$iteration_dir/network"
  if [[ "$service_host" != "none" ]]; then experiment_scp_from "$service_host" "$service_iteration_dir" "$root/$iteration_dir/service"; if [[ -f "$root/$iteration_dir/service/resource.csv" ]]; then cp "$root/$iteration_dir/service/resource.csv" "$root/$iteration_dir/service-resource.csv"; elif [[ -f "$root/$iteration_dir/service/service-resource.csv" ]]; then cp "$root/$iteration_dir/service/service-resource.csv" "$root/$iteration_dir/service-resource.csv"; fi; fi
  while IFS= read -r log_path; do validate_rsp_js_diagnostics "$log_path" || infrastructure_failed=true; done < <(find "$root/$iteration_dir" -type f -name '*.log' -print)
  [[ "$workload_failed" != true && "$infrastructure_failed" != true ]] || exit 1
done
