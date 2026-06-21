#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
APP_DIR=$(cd -- "$SCRIPT_DIR/.." && pwd)

match_id="${1:-${PVP_DRIVER_MATCH_ID:-${TEST_MATCH_ID:-${MOBILE_TEST_MATCH_ID:-}}}}"
step="${2:-complete}"

if [[ -z "$match_id" ]]; then
  echo "A match id is required." >&2
  echo "Usage: $0 <match-id> [end-turn|concede|complete]" >&2
  exit 1
fi

case "$step" in
  end-turn|concede|complete)
    ;;
  *)
    echo "Unknown PvP driver step: $step" >&2
    echo "Usage: $0 <match-id> [end-turn|concede|complete]" >&2
    exit 1
    ;;
esac

(
  cd "$APP_DIR"
  PVP_DRIVER_MATCH_ID="$match_id" \
  PVP_DRIVER_STEP="$step" \
    mix run -e '
alias AdventureTimeApi.Accounts.User
alias AdventureTimeApi.Pvp
alias AdventureTimeApi.Repo

match_id = System.fetch_env!("PVP_DRIVER_MATCH_ID")
step = System.get_env("PVP_DRIVER_STEP", "complete")

primary_email =
  System.get_env("MOBILE_TEST_EMAIL", "mobile-test@leaetzak.love")
  |> String.trim()
  |> String.downcase()

opponent_email =
  System.get_env("MOBILE_TEST_OPPONENT_EMAIL", "mobile-opponent@leaetzak.love")
  |> String.trim()
  |> String.downcase()

primary_user = Repo.get_by!(User, email: primary_email)
opponent_user = Repo.get_by!(User, email: opponent_email)

run_step = fn
  "end-turn" ->
    case Pvp.end_turn(primary_user.id, match_id, nil) do
      {:ok, _result} ->
        IO.puts("pvp-driver end-turn match=#{match_id} user=#{primary_email}")

      {:error, reason} ->
        raise "pvp-driver end-turn failed: #{inspect(reason)}"
    end

  "concede" ->
    case Pvp.concede_match(opponent_user.id, match_id) do
      {:ok, _result} ->
        IO.puts("pvp-driver concede match=#{match_id} user=#{opponent_email}")

      {:error, reason} ->
        raise "pvp-driver concede failed: #{inspect(reason)}"
    end
end

case step do
  "complete" ->
    run_step.("end-turn")
    run_step.("concede")

  single_step ->
    run_step.(single_step)
end
'
)
