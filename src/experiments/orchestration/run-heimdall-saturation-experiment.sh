#!/usr/bin/env bash
set -euo pipefail
usage() { echo "Usage: $0 {same-query|distinct-query} CLIENT_COUNT [--dry-run|--preflight]" >&2; }
mode="${1:-}"; count="${2:-}"; action="${3:-}"
case "$mode" in same-query|distinct-query) ;; *) usage; exit 2;; esac
case "$count" in ''|*[!0-9]*) usage; exit 2;; esac
(( count >= 1 && count <= ${SATURATION_MAX_CLIENT_COUNT:-1024} )) || { echo "Saturation client count must be 1..${SATURATION_MAX_CLIENT_COUNT:-1024}." >&2; exit 2; }
case "$action" in ''|--dry-run|--preflight) ;; *) usage; exit 2;; esac
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"; cd "$root"
config_path="${SATURATION_CONFIG_PATH:-$root/src/experiments/config/experiment-config.n078.saturation.json}"
[[ -f "$config_path" ]] || { echo "Missing saturation config: $config_path" >&2; exit 2; }
duration="${SATURATION_DURATION_SECONDS:-120}"; sampling="${SATURATION_RESOURCE_SAMPLING_INTERVAL_MS:-500}"
overrides="{\"experiment\":{\"clientCount\":$count,\"iterations\":1,\"durationSeconds\":$duration,\"resourceSamplingIntervalMs\":$sampling,\"clientArrivalMode\":\"simultaneous\",\"saturationMode\":\"$mode\",\"saturationMaxClientCount\":${SATURATION_MAX_CLIENT_COUNT:-1024}}}"
run_id="${EXPERIMENT_RUN_ID:-heimdall-saturation-${mode}-n${count}-$(date -u +%Y%m%dT%H%M%SZ)}"
output_root="results/4hz/heimdall-saturation/${mode}/clients-${count}/run-${run_id}"
if [[ "$action" == "--preflight" ]]; then
  npx --prefix "$root" ts-node -e "const c=require('./src/experiments/config/config'); c.loadExperimentConfig(process.argv[1]); const s=require('./src/experiments/config/saturation'); const x=JSON.parse(require('fs').readFileSync(process.argv[1])).streams; const q=s.buildSaturationQueries(x, process.argv[2], Number(process.argv[3])); if(new Set(q.map((v:any)=>v.heimdallReuseIdentity)).size !== (process.argv[2] === 'same-query' ? 1 : Number(process.argv[3]))) throw new Error('reuse identity preflight failed'); console.log(JSON.stringify({localPreflight:true,queries:q.length,uniqueReuseIdentities:new Set(q.map((v:any)=>v.heimdallReuseIdentity)).size}))" "$config_path" "$mode" "$count"
  exit 0
fi
set +e
EXPERIMENT_CONFIG_PATH="$config_path" EXPERIMENT_CONFIG_OVERRIDES="$overrides" EXPERIMENT_RUN_ID="$run_id" EXPERIMENT_OUTPUT_ROOT="$output_root" CLIENT_READY_TIMEOUT_SECONDS="${SATURATION_CLIENT_READY_TIMEOUT_SECONDS:-300}" "$root/src/experiments/orchestration/run-experiment.sh" heimdall "$action"
status=$?
set -e
if [[ "$action" == "--dry-run" ]]; then exit "$status"; fi
mkdir -p "$root/results/4hz/heimdall-saturation/campaign-logs"
attempts="$root/results/4hz/heimdall-saturation/campaign-logs/attempts.csv"
if [[ ! -f "$attempts" ]]; then echo "run_id,saturation_mode,client_count,repetition,frequency_hz,duration_seconds,status,output_root" > "$attempts"; fi
attempt_status="invalid"; (( status == 0 )) && attempt_status="valid"
printf '%s,%s,%s,%s,%s,%s,%s,%s\n' "$run_id" "$mode" "$count" "${SATURATION_REPETITION:-1}" 4 "$duration" "$attempt_status" "$output_root" >> "$attempts"
exit "$status"
