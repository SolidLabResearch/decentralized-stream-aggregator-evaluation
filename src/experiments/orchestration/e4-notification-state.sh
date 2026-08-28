#!/usr/bin/env bash
# Read-only E4 CSS notification-state snapshot. It never reads notification
# payloads or changes state; only names, filesystem kinds, sizes and mtimes are
# reported so n=5 remains a human-gated decision after n=1.
set -euo pipefail
usage() { echo "Usage: $0 --phase {before|after} --output FILE" >&2; }
phase=""; output=""
while (( $# )); do case "$1" in --phase|--output) key="$1"; shift; (( $# )) || { usage; exit 2; }; [[ "$key" == --phase ]] && phase="$1" || output="$1"; shift;; *) usage; exit 2;; esac; done
[[ "$phase" == before || "$phase" == after ]] || { usage; exit 2; }
[[ -n "$output" ]] || { usage; exit 2; }
directory="${E4_CSS_NOTIFICATION_DIR:-/users/kbisenug/data-heterogeneous/.internal/notifications}"
mkdir -p "$(dirname "$output")"
node - "$phase" "$directory" "$output" <<'NODE'
const fs = require("fs");
const [phase, directory, output] = process.argv.slice(2);
let entries = [];
if (fs.existsSync(directory)) entries = fs.readdirSync(directory, { withFileTypes: true }).map(entry => {
  const item = fs.lstatSync(`${directory}/${entry.name}`);
  return { name: entry.name, type: entry.isFile() ? "file" : entry.isDirectory() ? "directory" : entry.isSymbolicLink() ? "symlink" : "other", sizeBytes: item.size, mtimeMs: item.mtimeMs };
}).sort((a, b) => a.name.localeCompare(b.name));
const value = { phase, notificationDirectory: directory, directoryExists: fs.existsSync(directory), count: entries.length, entries, observedAtUtc: new Date().toISOString() };
fs.writeFileSync(output, `${JSON.stringify(value, null, 2)}\n`);
NODE
