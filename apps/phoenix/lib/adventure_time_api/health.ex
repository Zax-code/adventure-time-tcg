defmodule AdventureTimeApi.Health do
  @moduledoc """
  Health boundary for step data sync and retrieval.
  """

  import Ecto.Query

  alias AdventureTimeApi.Health.StepSnapshot
  alias AdventureTimeApi.Repo
  alias Ecto.Adapters.SQL

  def ready? do
    case SQL.query(Repo, "SELECT 1", []) do
      {:ok, _result} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  def get_latest_step_snapshot(user_id, source \\ nil) do
    StepSnapshot
    |> where([s], s.user_id == ^user_id)
    |> maybe_filter_source(source)
    |> order_by([s], desc: s.recorded_for, desc: s.updated_at, desc: s.inserted_at)
    |> limit(1)
    |> Repo.one()
  end

  def get_step_snapshot_for_date(user_id, date, source \\ nil) do
    StepSnapshot
    |> where([s], s.user_id == ^user_id and s.recorded_for == ^date)
    |> maybe_filter_source(source)
    |> order_by([s], desc: s.step_count)
    |> limit(1)
    |> Repo.one()
  end

  def upsert_step_snapshot(user_id, source, step_count, recorded_for) do
    source_atom = parse_source(source)

    case Date.from_iso8601(to_string(recorded_for)) do
      {:ok, date} ->
        %StepSnapshot{}
        |> StepSnapshot.changeset(%{
          user_id: user_id,
          source: source_atom,
          step_count: step_count,
          recorded_for: date
        })
        |> Repo.insert(
          on_conflict: [
            set: [
              step_count: step_count,
              updated_at: DateTime.utc_now() |> DateTime.truncate(:second)
            ]
          ],
          conflict_target: [:user_id, :source, :recorded_for]
        )

      {:error, _} ->
        {:error, :invalid_date}
    end
  end

  defp parse_source(source) when is_atom(source), do: source
  defp parse_source("device_health"), do: :device_health
  defp parse_source("fitbit"), do: :fitbit
  defp parse_source(_), do: :device_health

  defp maybe_filter_source(query, nil), do: query

  defp maybe_filter_source(query, source) do
    where(query, [s], s.source == ^parse_source(source))
  end
end
