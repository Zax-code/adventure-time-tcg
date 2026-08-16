defmodule AdventureTimeApi.Leaderboards.Locks do
  @moduledoc false

  alias AdventureTimeApi.Repo

  def period_board!(period_id, board_id) do
    advisory_lock!("leaderboard-period:#{period_id}:#{board_id}")
  end

  def daily_result!(board_id, %Date{} = date) do
    advisory_lock!("leaderboard-result:#{board_id}:#{Date.to_iso8601(date)}")
  end

  defp advisory_lock!(key) do
    Repo.query!("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [key])
    :ok
  end
end
