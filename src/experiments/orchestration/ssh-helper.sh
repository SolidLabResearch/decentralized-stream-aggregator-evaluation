#!/usr/bin/env bash

# Set SSH_USER, SSH_BASTION, SSH_IDENTITY_FILE and SSH_CONNECT_TIMEOUT_SECONDS,
# then call experiment_ssh, experiment_scp_from, or experiment_ssh_reachable.
experiment_ssh_args() {
  EXPERIMENT_SSH_ARGS=(-o BatchMode=yes -o "ConnectTimeout=${SSH_CONNECT_TIMEOUT_SECONDS}")
  if [[ -n "${SSH_BASTION:-}" ]]; then EXPERIMENT_SSH_ARGS+=(-J "${SSH_USER}@${SSH_BASTION}"); fi
  if [[ -n "${SSH_IDENTITY_FILE:-}" ]]; then EXPERIMENT_SSH_ARGS+=(-i "${SSH_IDENTITY_FILE}"); fi
}

experiment_ssh() { ssh "${EXPERIMENT_SSH_ARGS[@]}" "${SSH_USER}@$1" "$2"; }
experiment_scp_from() { scp "${EXPERIMENT_SSH_ARGS[@]}" -r "${SSH_USER}@$1:$2" "$3"; }
experiment_ssh_reachable() { experiment_ssh "$1" "true"; }
experiment_ssh_preview() {
  local host="$1" command="$2" rendered="ssh"
  if [[ -n "${SSH_BASTION:-}" ]]; then rendered+=" -J ${SSH_USER}@${SSH_BASTION}"; fi
  if [[ -n "${SSH_IDENTITY_FILE:-}" ]]; then rendered+=" -i <configured-identity-file>"; fi
  printf '%s -o ConnectTimeout=%ss %s@%s %q' "$rendered" "$SSH_CONNECT_TIMEOUT_SECONDS" "$SSH_USER" "$host" "$command"
}
experiment_scp_preview() {
  local host="$1" source="$2" destination="$3" rendered="scp -r"
  if [[ -n "${SSH_BASTION:-}" ]]; then rendered+=" -J ${SSH_USER}@${SSH_BASTION}"; fi
  if [[ -n "${SSH_IDENTITY_FILE:-}" ]]; then rendered+=" -i <configured-identity-file>"; fi
  printf '%s -o ConnectTimeout=%ss %s@%s:%s %s' "$rendered" "$SSH_CONNECT_TIMEOUT_SECONDS" "$SSH_USER" "$host" "$source" "$destination"
}

# Returns a remote-shell expression. It intentionally expands only a leading
# ~/ using the remote account's HOME, not the local machine's home directory.
experiment_remote_path() {
  local configured_path="$1"
  if [[ "$configured_path" == "~/"* ]]; then printf '$HOME/%s' "${configured_path:2}"; else printf '%s' "$configured_path"; fi
}
