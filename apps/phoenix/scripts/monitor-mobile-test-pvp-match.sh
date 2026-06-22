#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
APP_DIR=$(cd -- "$SCRIPT_DIR/.." && pwd)

match_id="${1:-${PVP_MONITOR_MATCH_ID:-${TEST_MATCH_ID:-${MOBILE_TEST_MATCH_ID:-}}}}"

if [[ -z "$match_id" ]]; then
  echo "A match id is required." >&2
  echo "Usage: $0 <match-id>" >&2
  exit 1
fi

interval_ms="${PVP_MONITOR_INTERVAL_MS:-1000}"
max_seconds="${PVP_MONITOR_MAX_SECONDS:-180}"

tmp_script="$(mktemp)"
cleanup() {
  rm -f "$tmp_script"
}
trap cleanup EXIT

cat >"$tmp_script" <<'ELIXIR'
import Ecto.Query

require Logger

alias AdventureTimeApi.Pvp
alias AdventureTimeApi.Pvp.{Match, MatchEvent, MatchSnapshot}
alias AdventureTimeApi.Repo

Logger.configure(level: :warning)

match_id = System.fetch_env!("PVP_MONITOR_MATCH_ID")
interval_ms =
  System.get_env("PVP_MONITOR_INTERVAL_MS", "1000")
  |> String.to_integer()

max_seconds =
  System.get_env("PVP_MONITOR_MAX_SECONDS", "180")
  |> String.to_integer()

started_at = System.monotonic_time(:millisecond)

timestamp = fn ->
  DateTime.utc_now()
  |> DateTime.truncate(:millisecond)
  |> DateTime.to_iso8601()
end

latest_snapshot = fn ->
  Repo.one(
    from snapshot in MatchSnapshot,
      where: snapshot.match_id == ^match_id,
      order_by: [desc: snapshot.seq_at],
      limit: 1
  )
end

player_summary = fn state ->
  state
  |> Map.get("players", [])
  |> Enum.map(fn player ->
    active =
      player
      |> Map.get("units", [])
      |> Enum.map(fn unit ->
        "#{unit["name"]}:#{unit["hp"]}/#{unit["maxHp"]}"
      end)
      |> Enum.join(",")

    max_energy = player["maxEnergy"] || player["energy"]

    "#{player["name"] || player["userId"]} energy=#{player["energy"]}/#{max_energy} active=[#{active}]"
  end)
  |> Enum.join(" | ")
end

view_state = fn match, snapshot ->
  case Pvp.get_match(match.inviter_id, match.id) do
    {:ok, %{battleState: state}} -> state || %{}
    _ -> if snapshot, do: snapshot.state || %{}, else: %{}
  end
end

print_snapshot = fn match, snapshot ->
  state = view_state.(match, snapshot)

  IO.puts(
    "[#{timestamp.()}] match=#{match.id} status=#{match.status} turn=#{match.current_turn || "-"} winner=#{match.winner_id || "-"} current=#{state["currentPlayerId"] || "-"} snapshotSeq=#{if(snapshot, do: snapshot.seq_at, else: "-")} #{player_summary.(state)}"
  )
end

print_event = fn event ->
  IO.puts(
    "[#{timestamp.()}] event seq=#{event.seq} turn=#{event.turn || "-"} type=#{event.type} payload=#{inspect(event.payload, limit: 8, printable_limit: 220)}"
  )
end

loop = fn loop, seen_seq ->
  elapsed_ms = System.monotonic_time(:millisecond) - started_at

  if elapsed_ms > max_seconds * 1000 do
    IO.puts("[#{timestamp.()}] monitor timed out after #{max_seconds}s")
    System.halt(124)
  end

  match = Repo.get(Match, match_id)

  if is_nil(match) do
    IO.puts("[#{timestamp.()}] match=#{match_id} not found")
    System.halt(2)
  end

  events =
    Repo.all(
      from event in MatchEvent,
        where: event.match_id == ^match_id and event.seq > ^seen_seq,
        order_by: [asc: event.seq]
    )

  Enum.each(events, print_event)
  print_snapshot.(match, latest_snapshot.())

  next_seen_seq =
    events
    |> Enum.map(& &1.seq)
    |> Enum.max(fn -> seen_seq end)

  if match.status in ["completed", "declined", "expired"] do
    IO.puts("[#{timestamp.()}] monitor finished with status=#{match.status}")
    System.halt(0)
  end

  Process.sleep(interval_ms)
  loop.(loop, next_seen_seq)
end

IO.puts("[#{timestamp.()}] monitoring PvP match #{match_id}")
loop.(loop, -1)
ELIXIR

(
  cd "$APP_DIR"
  PVP_MONITOR_MATCH_ID="$match_id" \
  PVP_MONITOR_INTERVAL_MS="$interval_ms" \
  PVP_MONITOR_MAX_SECONDS="$max_seconds" \
    mix run "$tmp_script"
)
