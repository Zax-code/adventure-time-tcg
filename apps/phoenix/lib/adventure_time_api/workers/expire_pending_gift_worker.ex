defmodule AdventureTimeApi.Workers.ExpirePendingGiftWorker do
  @moduledoc false

  use Oban.Worker,
    queue: :maintenance,
    max_attempts: 5,
    unique: [period: 300, fields: [:worker, :args], keys: [:gift_id]]

  alias AdventureTimeApi.Social

  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"gift_id" => gift_id}}) do
    case Social.expire_gift(gift_id) do
      {:ok, :expired} -> :ok
      {:ok, :noop} -> :ok
      {:error, :not_found} -> :discard
      {:error, reason} -> {:error, reason}
    end
  end
end
