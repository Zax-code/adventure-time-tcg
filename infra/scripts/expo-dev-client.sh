#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # Expo CLI is not stable on Node 25 on this host; use the repo-pinned runtime.
  # shellcheck disable=SC1090
  source "$NVM_DIR/nvm.sh"
  nvm use --silent >/dev/null
fi

GLOBAL_NODE_MODULES="$(npm root -g)"
if [[ ! -d "$GLOBAL_NODE_MODULES/@expo/ngrok" ]]; then
  echo "Installing @expo/ngrok for the active Node runtime..."
  npm install --global @expo/ngrok@^4.1.0
fi

cd "$REPO_ROOT/apps/mobile"

mapfile -t stale_ngrok_pids < <(pgrep -u "$USER" -f '@expo/ngrok-bin-linux-x64/ngrok start --none' || true)
if (( ${#stale_ngrok_pids[@]} > 0 )); then
  echo "Stopping stale ngrok tunnel process(es): ${stale_ngrok_pids[*]}"
  kill "${stale_ngrok_pids[@]}" || true
  sleep 1
fi

exec npx expo start --dev-client "$@"
