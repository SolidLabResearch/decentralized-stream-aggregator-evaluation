#!/usr/bin/env bash
# E4 attempt-local watchdog. It never discovers or kills by executable name:
# only PGIDs recorded by the attempt owner may be terminated.
set -euo pipefail
usage() { echo "Usage: $0 --output CSV --trigger FILE --host-role ROLE --pid-file FILE [--interval SECONDS] [--once]" >&2; }
output=""; trigger=""; role=""; pid_file=""; interval="${E4_WATCHDOG_INTERVAL_SECONDS:-1}"; once=false
while (( $# )); do case "$1" in --output|--trigger|--host-role|--pid-file|--interval) key="${1#--}"; shift; (( $# )) || { usage; exit 2; }; case "$key" in output) output="$1";; trigger) trigger="$1";; host-role) role="$1";; pid-file) pid_file="$1";; interval) interval="$1";; esac; shift;; --once) once=true; shift;; *) usage; exit 2;; esac; done
[[ -n "$output" && -n "$trigger" && -n "$role" && -n "$pid_file" ]] || { usage; exit 2; }
[[ "$interval" =~ ^[1-9][0-9]*$ ]] || { echo "watchdog interval must be a positive integer" >&2; exit 2; }
mkdir -p "$(dirname "$output")" "$(dirname "$trigger")"; [[ -f "$output" ]] || echo 'timestamp_utc,elapsed_seconds,host_role,metric,value,threshold,state' > "$output"
started="$(date +%s)"; cpu_run=0
emit() { printf '%s,%s,%s,%s,%s,%s,%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(( $(date +%s) - started ))" "$role" "$1" "${2:---}" "${3:---}" "$4" >> "$output"; }
stop() { [[ -e "$trigger" ]] || { tmp="$trigger.$$"; printf 'host_role=%s\nmetric=%s\nvalue=%s\nthreshold=%s\ntimestamp_utc=%s\n' "$role" "$1" "$2" "$3" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$tmp"; mv "$tmp" "$trigger"; }; }
sample() {
  local available total mem_pct pid pgid cpu rss fd limit cpu_threshold="${E4_CPU_PERCENT:-90}" mem_threshold="${E4_MIN_AVAILABLE_MEMORY_PERCENT:-20}" fd_pct="${E4_FD_PERCENT:-75}"
  available="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo 2>/dev/null || true)"; total="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo 2>/dev/null || true)"
  if [[ "$available" =~ ^[0-9]+$ && "$total" =~ ^[1-9][0-9]*$ ]]; then mem_pct=$((available * 100 / total)); emit mem_available_percent "$mem_pct" "$mem_threshold" "$([[ $mem_pct -lt $mem_threshold ]] && echo violating || echo ok)"; [[ $mem_pct -lt $mem_threshold ]] && stop mem_available_percent "$mem_pct" "$mem_threshold"; else emit mem_available_percent -- "$mem_threshold" metric_unavailable; fi
  pid="$(tr -d '[:space:]' < "$pid_file" 2>/dev/null || true)"; if [[ ! "$pid" =~ ^[1-9][0-9]*$ ]] || ! kill -0 "$pid" 2>/dev/null; then emit process_alive 0 1 violating; stop process_alive 0 1; return; fi
  pgid="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d '[:space:]' || true)"; emit pgid "${pgid:---}" -- ok
  cpu="$(ps -p "$pid" -o %cpu= 2>/dev/null | awk '{printf "%d",$1}' || true)"; if [[ "$cpu" =~ ^[0-9]+$ ]]; then (( cpu >= cpu_threshold )) && cpu_run=$((cpu_run+1)) || cpu_run=0; emit process_cpu_percent "$cpu" "$cpu_threshold" "$([[ $cpu_run -ge ${E4_CPU_CONSECUTIVE_SAMPLES:-5} ]] && echo violating || echo ok)"; [[ $cpu_run -ge ${E4_CPU_CONSECUTIVE_SAMPLES:-5} ]] && stop process_cpu_percent "$cpu" "$cpu_threshold"; else emit process_cpu_percent -- "$cpu_threshold" metric_unavailable; fi
  rss="$(ps -p "$pid" -o rss= 2>/dev/null | tr -d '[:space:]' || true)"; [[ "$rss" =~ ^[0-9]+$ ]] && emit process_rss_kib "$rss" -- ok || emit process_rss_kib -- -- metric_unavailable
  fd="$(find "/proc/$pid/fd" -maxdepth 1 -type l 2>/dev/null | wc -l | tr -d ' ')"; limit="$(awk '/Max open files/ {print $5}' "/proc/$pid/limits" 2>/dev/null || true)"; if [[ "$fd" =~ ^[0-9]+$ && "$limit" =~ ^[1-9][0-9]*$ ]]; then threshold=$((limit * fd_pct / 100)); emit process_fd_count "$fd" "$threshold" "$([[ $fd -ge $threshold ]] && echo violating || echo ok)"; [[ $fd -ge $threshold ]] && stop process_fd_count "$fd" "$threshold"; else emit process_fd_count -- -- metric_unavailable; fi
}
while :; do sample; [[ "$once" == true || -e "$trigger" ]] && break; sleep "$interval"; done
