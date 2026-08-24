defmodule AdventureTimeApi.Workers.MediaCleanupWorker do
  @moduledoc false

  use Oban.Worker,
    queue: :maintenance,
    max_attempts: 10,
    unique: [
      period: 86_400,
      fields: [:worker, :args],
      keys: [:asset_id],
      states: :incomplete
    ]

  require Logger

  alias AdventureTimeApi.Media

  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"asset_id" => asset_id}}) do
    case Media.cleanup_image_asset(asset_id) do
      :ok ->
        :ok

      {:protected, reference_kinds} ->
        Logger.info(
          "media cleanup skipped for referenced asset=#{asset_id} references=#{Enum.join(reference_kinds, ",")}"
        )

        :ok

      {:error, reason} ->
        Logger.warning(
          "media cleanup will retry asset=#{asset_id} reason=#{cleanup_reason(reason)}"
        )

        {:error, "media cleanup failed"}
    end
  end

  defp cleanup_reason({:object_delete_failed, {operation, status}})
       when is_atom(operation) and is_integer(status),
       do: "#{operation}:#{status}"

  defp cleanup_reason({operation, status}) when is_atom(operation) and is_integer(status),
    do: "#{operation}:#{status}"

  defp cleanup_reason(reason) when is_atom(reason), do: Atom.to_string(reason)
  defp cleanup_reason(_reason), do: "internal_error"
end
