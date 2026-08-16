defmodule AdventureTimeApi.Workers.LeaderboardLifecycleWorker do
  @moduledoc "Runs the retry-safe leaderboard lifecycle coordinator."

  use Oban.Worker,
    queue: :maintenance,
    max_attempts: 10,
    unique: [period: 240, fields: [:worker]]

  alias AdventureTimeApi.Leaderboards.Lifecycle

  @impl Oban.Worker
  def perform(%Oban.Job{}) do
    case Lifecycle.tick() do
      :ok -> :ok
      {:error, reason} -> {:error, reason}
    end
  end
end
