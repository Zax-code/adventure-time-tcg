#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

: "${MOBILE_TEST_REPLAY_OPPONENT_EMAIL:=mobile-replay-opponent@leaetzak.love}"
: "${MOBILE_TEST_REPLAY_OPPONENT_DISPLAY_NAME:=Mobile Replay Opponent}"

if [[ -z "${MOBILE_TEST_PASSWORD:-}" ]]; then
  echo "MOBILE_TEST_PASSWORD is required" >&2
  echo "Example:" >&2
  echo "  MOBILE_TEST_PASSWORD='your-password' $0" >&2
  exit 1
fi

match_id="$(
  MOBILE_TEST_OPPONENT_EMAIL="$MOBILE_TEST_REPLAY_OPPONENT_EMAIL" \
  MOBILE_TEST_OPPONENT_DISPLAY_NAME="$MOBILE_TEST_REPLAY_OPPONENT_DISPLAY_NAME" \
    "$SCRIPT_DIR/ensure-mobile-test-pvp-fixture.sh"
)"
match_id="$(printf '%s\n' "$match_id" | tail -n 1)"

cd "$SCRIPT_DIR/.."

MOBILE_TEST_MATCH_ID="$match_id" mix run -e '
require Logger

alias AdventureTimeApi.Accounts.User
alias AdventureTimeApi.Pvp
alias AdventureTimeApi.Pvp.Match
alias AdventureTimeApi.Repo

Logger.configure(level: :warning)

match_id = System.fetch_env!("MOBILE_TEST_MATCH_ID")
primary_email =
  System.get_env("MOBILE_TEST_EMAIL", "mobile-test@leaetzak.love")
  |> String.trim()
  |> String.downcase()

primary_user = Repo.get_by!(User, email: primary_email)

{:ok, %{match: match, battleState: battle_state}} = Pvp.get_match(primary_user.id, match_id)

if match.status != "IN_PROGRESS" do
  raise "Expected replay fixture match to be in progress, got #{inspect(match.status)}"
end

conceding_user_id = battle_state["currentPlayerId"] || primary_user.id
{:ok, %{success: true}} = Pvp.concede_match(conceding_user_id, match_id)

completed_match = Repo.get!(Match, match_id)

if completed_match.status != "completed" do
  raise "Expected replay fixture match to be completed, got #{inspect(completed_match.status)}"
end

IO.puts(match_id)
'
