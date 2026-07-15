#!/usr/bin/env bash

set -euo pipefail

WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MOBILE_ROOT="$WORKSPACE_ROOT/apps/mobile"
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
API_BASE_URL="${EXPO_PUBLIC_API_BASE_URL:-http://127.0.0.1:4200}"

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
  # shellcheck disable=SC1090
  source "$NVM_DIR/nvm.sh"
  nvm use --silent >/dev/null
fi

require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "$command_name is required for iOS local development."
    exit 1
  fi
}

ensure_pods_in_sync() {
  local ios_root="$MOBILE_ROOT/ios"
  local podfile_lock="$ios_root/Podfile.lock"
  local manifest_lock="$ios_root/Pods/Manifest.lock"

  if [[ ! -f "$podfile_lock" ]]; then
    echo "Missing iOS Podfile.lock at $podfile_lock"
    exit 1
  fi

  if [[ ! -f "$manifest_lock" ]] || ! cmp -s "$podfile_lock" "$manifest_lock"; then
    echo "Syncing CocoaPods sandbox for this worktree"
    (
      cd "$ios_root"
      pod install --repo-update --ansi
    )
  fi
}

clear_metro_cache_if_needed() {
  if [[ "${EXPO_SKIP_METRO_CLEAR:-0}" == "1" ]]; then
    return 0
  fi

  local tmp_dir="${TMPDIR:-/tmp}"
  local metro_cache="$tmp_dir/metro-cache"

  if [[ -d "$metro_cache" ]]; then
    echo "Clearing Metro cache at $metro_cache"
    rm -rf "$metro_cache"
  fi
}

ensure_local_api_ready() {
  case "$API_BASE_URL" in
    http://127.0.0.1:* | http://localhost:*) ;;
    *) return 0 ;;
  esac

  local ready_url="${API_BASE_URL%/}/ready"

  if curl \
    --fail \
    --max-time 3 \
    --output /dev/null \
    --silent \
    --user-agent "AdventureTimeNative/iOS-local-development" \
    "$ready_url"; then
    return 0
  fi

  echo "Local Phoenix API is not healthy at $ready_url"
  echo "Start it, or restart a wedged process, in another terminal:"
  echo "  npm run dev:api"
  exit 1
}

list_available_simulators() {
  xcrun simctl list devices available | awk -F'[()]' '/iPhone/ {gsub(/^ +| +$/, "", $1); print $1}'
}

resolve_simulator_name() {
  if [[ $# -gt 0 && -n "${*// }" ]]; then
    printf '%s\n' "$*"
    return 0
  fi

  if [[ -n "${IOS_SIMULATOR_NAME:-}" ]]; then
    printf '%s\n' "$IOS_SIMULATOR_NAME"
    return 0
  fi

  list_available_simulators | head -n 1
}

boot_simulator() {
  local simulator_name="$1"

  open -a Simulator >/dev/null 2>&1 || true

  if xcrun simctl list devices booted | rg -q "Booted"; then
    return 0
  fi

  if ! list_available_simulators | rg -Fxq "$simulator_name"; then
    echo "Simulator '$simulator_name' is not available."
    echo "Available simulators:"
    list_available_simulators | sed 's/^/  - /'
    exit 1
  fi

  echo "Booting iOS simulator: $simulator_name"
  xcrun simctl boot "$simulator_name" >/dev/null 2>&1 || true

  for _ in $(seq 1 60); do
    if xcrun simctl list devices booted | rg -Fq "$simulator_name"; then
      return 0
    fi
    sleep 2
  done

  echo "iOS simulator did not boot in time."
  exit 1
}

for command_name in cmp curl npx pod xcrun open rg; do
  require_command "$command_name"
done

require_command node
ensure_local_api_ready
ensure_pods_in_sync
prepend_node_path "$MOBILE_ROOT/node_modules"
clear_metro_cache_if_needed

IOS_SIMULATOR_NAME="$(resolve_simulator_name "$@")"

if [[ -z "$IOS_SIMULATOR_NAME" ]]; then
  echo "No available iPhone simulators were found."
  exit 1
fi

boot_simulator "$IOS_SIMULATOR_NAME"

echo "Launching Adventure Time on iOS with EXPO_PUBLIC_API_BASE_URL=$API_BASE_URL"
cd "$MOBILE_ROOT"
expo_run_args=(run:ios --device "$IOS_SIMULATOR_NAME")

if [[ "${EXPO_NO_BUNDLER:-0}" == "1" ]]; then
  expo_run_args+=(--no-bundler)
fi

EXPO_PUBLIC_API_BASE_URL="$API_BASE_URL" npx expo "${expo_run_args[@]}"
