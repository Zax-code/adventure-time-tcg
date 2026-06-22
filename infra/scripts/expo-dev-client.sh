#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MOBILE_ROOT="$REPO_ROOT/apps/mobile"
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
EXPO_DEV_HOST="${EXPO_DEV_HOST:-lan}"

prepend_node_path() {
  local workspace_node_modules="$1"

  case ":${NODE_PATH:-}:" in
    *":$workspace_node_modules:"*) ;;
    *)
      export NODE_PATH="$workspace_node_modules${NODE_PATH:+:$NODE_PATH}"
      ;;
  esac
}

if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # Expo CLI is not stable on Node 25 on this host; use the repo-pinned runtime.
  # shellcheck disable=SC1090
  source "$NVM_DIR/nvm.sh"
  nvm use --silent >/dev/null
fi

has_cache_arg=0
has_host_arg=0
next_arg_is_host=0

for arg in "$@"; do
  if (( next_arg_is_host )); then
    has_host_arg=1
    next_arg_is_host=0
    if [[ "$arg" == "tunnel" ]]; then
      echo "Tunnel mode has been removed. Use local or LAN Expo dev-client startup instead."
      exit 1
    fi
    continue
  fi

  case "$arg" in
    --clear|-c|--reset-cache)
      has_cache_arg=1
      ;;
    --localhost|--lan|--host=*|-m=*)
      has_host_arg=1
      if [[ "$arg" == "--host=tunnel" || "$arg" == "-m=tunnel" ]]; then
        echo "Tunnel mode has been removed. Use local or LAN Expo dev-client startup instead."
        exit 1
      fi
      ;;
    --host|-m)
      next_arg_is_host=1
      ;;
    --tunnel)
      echo "Tunnel mode has been removed. Use local or LAN Expo dev-client startup instead."
      exit 1
      ;;
  esac
done

if [[ "${EXPO_SKIP_METRO_CLEAR:-0}" != "1" && "$has_cache_arg" == "0" ]]; then
  set -- --clear "$@"
fi

if [[ "$has_host_arg" == "0" ]]; then
  set -- --host "$EXPO_DEV_HOST" "$@"
fi

cd "$MOBILE_ROOT"
prepend_node_path "$MOBILE_ROOT/node_modules"

exec npx expo start --dev-client "$@"
