#!/usr/bin/env bash
set -euo pipefail

mode="${1:-}"
if [[ -n "$mode" && "$mode" != "--dry-run" ]]; then echo "Usage: $0 [--dry-run]" >&2; exit 2; fi
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"; cd "$root"
config_path="${EXPERIMENT_CONFIG_PATH:-$root/src/experiments/config/experiment-config.json}"
config_json="$(npx --prefix "$root" ts-node -e "process.stdout.write(JSON.stringify(require('./src/experiments/config/config').loadExperimentConfig(process.argv[1])))" "$config_path")"
read_config() { node -e "const c=JSON.parse(process.argv[1]); console.log($1)" "$config_json"; }
source "$root/src/experiments/orchestration/ssh-helper.sh"
SSH_USER="${EXPERIMENT_SSH_USER:-$(read_config 'c.ssh.user')}"; SSH_BASTION="${EXPERIMENT_SSH_BASTION:-$(read_config 'c.ssh.bastion === null ? "" : c.ssh.bastion')}"
SSH_IDENTITY_FILE="${EXPERIMENT_SSH_IDENTITY_FILE:-$(read_config 'c.ssh.identityFile === null ? "" : c.ssh.identityFile')}"; SSH_CONNECT_TIMEOUT_SECONDS="${EXPERIMENT_SSH_CONNECT_TIMEOUT_SECONDS:-$(read_config 'c.ssh.connectTimeoutSeconds')}"
experiment_ssh_args
evaluation_path="$(experiment_remote_path "$(read_config 'c.remotePaths.evaluation')")"; heimdall_path="$(experiment_remote_path "$(read_config 'c.remotePaths.heimdall')")"; rsp_js_path="$(experiment_remote_path "$(read_config 'c.remotePaths.rspJs')")"; replayer_path="$(experiment_remote_path "$(read_config 'c.remotePaths.replayer')")"
replayer_host="$(read_config 'c.hosts.replayer')"; pod_host="$(read_config 'c.hosts.solidPod')"; client_host="$(read_config 'c.hosts.client')"; heimdall_host="$(read_config 'c.hosts.heimdall')"
output_dir="${EXPERIMENT_SYSTEM_INFO_OUTPUT_DIR:-$root/results/deployment-metadata/system-info-$(date -u +%Y%m%dT%H%M%SZ)}"

common_info='hostname; uname -s; uname -r; (sysctl -n machdep.cpu.brand_string 2>/dev/null || lscpu 2>/dev/null | sed -n "s/^Model name:[[:space:]]*//p" | head -1 || true); getconf _NPROCESSORS_ONLN 2>/dev/null || true; (sysctl -n hw.memsize 2>/dev/null || free -b 2>/dev/null | awk "/^Mem:/ {print \$2}" || true); node --version 2>/dev/null || true; npm --version 2>/dev/null || true'
collect() {
  local role="$1" host="$2" repositories="$3"
  echo "Collecting $role from $host"
  experiment_ssh "$host" "$common_info; $repositories" >"$output_dir/$role.txt"
}

if [[ "$mode" == "--dry-run" ]]; then
  echo "Would collect non-sensitive system info in $output_dir"
  for item in "replayer:$replayer_host" "solid-pod:$pod_host" "client:$client_host" "heimdall:$heimdall_host"; do echo "$item"; done
  exit 0
fi
mkdir -p "$output_dir"
collect replayer "$replayer_host" "git -C \"$replayer_path\" rev-parse HEAD 2>/dev/null || true"
collect solid-pod "$pod_host" "true"
collect client "$client_host" "git -C \"$evaluation_path\" rev-parse HEAD 2>/dev/null || true"
collect heimdall "$heimdall_host" "git -C \"$heimdall_path\" rev-parse HEAD 2>/dev/null || true; git -C \"$rsp_js_path\" rev-parse HEAD 2>/dev/null || true"
node -e 'const c=JSON.parse(process.argv[1]); if (c.ssh.identityFile) c.ssh.identityFile="<redacted>"; console.log(JSON.stringify(c, null, 2));' "$config_json" >"$output_dir/deployment-config.json"
echo "Wrote $output_dir"
