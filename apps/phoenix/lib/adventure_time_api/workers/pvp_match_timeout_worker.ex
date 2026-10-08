defmodule AdventureTimeApi.Workers.PvpMatchTimeoutWorker do
  @moduledoc """
  Expires PvP turns and invites that are past due, so spectator reads do not have
  to sweep every match. Opening a match still expires it immediately when due.
  """

  use Oban.Worker,
    queue: :maintenance,
    max_attempts: 3,
    unique: [
      period: 50,
      fields: [:worker],
      states: [:available, :scheduled, :executing, :retryable]
    ]

  alias AdventureTimeApi.Pvp

  @impl Oban.Worker
  def perform(%Oban.Job{}) do
    Pvp.expire_due_matches()
  end
end
