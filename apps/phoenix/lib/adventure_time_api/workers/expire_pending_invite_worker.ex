defmodule AdventureTimeApi.Workers.ExpirePendingInviteWorker do
  @moduledoc false

  use Oban.Worker,
    queue: :maintenance,
    max_attempts: 5,
    unique: [period: 300, fields: [:worker, :args], keys: [:match_id]]

  alias AdventureTimeApi.Pvp

  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"match_id" => match_id}}) do
    case Pvp.expire_match_invite(match_id) do
      {:ok, :expired} -> :ok
      {:ok, :noop} -> :ok
      {:error, :not_found} -> :discard
      {:error, reason} -> {:error, reason}
    end
  end
end
