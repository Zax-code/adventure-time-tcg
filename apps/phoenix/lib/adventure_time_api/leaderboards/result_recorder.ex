defmodule AdventureTimeApi.Leaderboards.ResultRecorder do
  @moduledoc """
  Records normalized competitive results only after quest validation has succeeded.

  It accepts no client-supplied points and does not change quest state, coins, or quest
  rewards. Replacements preserve the previous normalized row for auditability.
  """

  import Ecto.Query

  alias AdventureTimeApi.Leaderboards.{Board, DailyResult, Locks, ResultTelemetry, Scoring}
  alias AdventureTimeApi.Repo

  @required_keys [
    :user_id,
    :board_key,
    :competition_slot_id,
    :competition_date,
    :source_kind,
    :source_id,
    :raw_result,
    :scoring_version_id,
    :scoring_configuration,
    :submitted_at
  ]

  @spec record_validated(map()) :: {:ok, DailyResult.t()} | {:error, term()}
  def record_validated(attrs) when is_map(attrs) do
    with :ok <- require_keys(attrs),
         {:ok, points_milli} <-
           Scoring.score(attrs.scoring_configuration, attrs.board_key, attrs.raw_result) do
      Repo.transaction(fn ->
        board =
          Repo.one(from(board in Board, where: board.key == ^attrs.board_key and board.enabled)) ||
            Repo.rollback(:unknown_or_disabled_board)

        Locks.daily_result!(board.id, attrs.competition_date)

        lock_key =
          Enum.join(
            [attrs.user_id, board.id, Date.to_iso8601(attrs.competition_date)],
            ":"
          )

        case Repo.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [lock_key]) do
          {:ok, _result} -> :ok
          {:error, reason} -> Repo.rollback(reason)
        end

        previous =
          Repo.one(
            from(result in DailyResult,
              where:
                result.user_id == ^attrs.user_id and result.board_id == ^board.id and
                  result.competition_date == ^attrs.competition_date and result.active,
              lock: "FOR UPDATE"
            )
          )

        same_source =
          previous && previous.source_kind == attrs.source_kind &&
            previous.source_id == attrs.source_id

        if same_source &&
             (previous.result_status == :excluded or previous.eligibility_status == :moderated) do
          Repo.rollback(:result_excluded)
        end

        accepted_at = DateTime.utc_now()

        result_attrs = %{
          user_id: attrs.user_id,
          board_id: board.id,
          competition_slot_id: attrs.competition_slot_id,
          competition_date: attrs.competition_date,
          ranked_session_id: Map.get(attrs, :ranked_session_id),
          source_kind: attrs.source_kind,
          source_id: attrs.source_id,
          raw_result_schema_version: Map.get(attrs, :raw_result_schema_version, 1),
          raw_result: attrs.raw_result,
          raw_numeric_value: Map.get(attrs, :raw_numeric_value),
          outcome: Map.get(attrs, :outcome),
          points_milli: points_milli,
          scoring_version_id: attrs.scoring_version_id,
          result_status: :accepted,
          integrity_status: :accepted,
          eligibility_status: :eligible,
          active: true,
          provisional: true,
          submitted_at: attrs.submitted_at,
          accepted_at: accepted_at,
          supersedes_result_id: previous && previous.id
        }

        result =
          if same_source do
            previous
            |> DailyResult.changeset(
              Map.put(result_attrs, :supersedes_result_id, previous.supersedes_result_id)
            )
            |> Repo.update!()
          else
            if previous do
              previous
              |> Ecto.Changeset.change(active: false)
              |> Repo.update!()
            end

            %DailyResult{}
            |> DailyResult.changeset(result_attrs)
            |> Repo.insert!()
          end

        telemetry = Map.get(attrs, :telemetry, %{})

        telemetry_attrs = %{
          result_id: result.id,
          board_id: board.id,
          competition_date: attrs.competition_date,
          scoring_version_id: attrs.scoring_version_id,
          normalized_metrics: Map.get(telemetry, :normalized_metrics, %{}),
          source: Map.get(telemetry, :source),
          platform: Map.get(telemetry, :platform),
          app_version: Map.get(telemetry, :app_version),
          validity_reason_codes: Map.get(telemetry, :validity_reason_codes, []),
          integrity_reason_codes: Map.get(telemetry, :integrity_reason_codes, []),
          session_metrics: Map.get(telemetry, :session_metrics, %{}),
          cohort: Map.get(telemetry, :cohort, %{})
        }

        case Repo.get_by(ResultTelemetry, result_id: result.id) do
          nil ->
            %ResultTelemetry{}
            |> ResultTelemetry.changeset(telemetry_attrs)
            |> Repo.insert!()

          existing ->
            existing
            |> ResultTelemetry.changeset(telemetry_attrs)
            |> Repo.update!()
        end

        result
      end)
    end
  end

  def record_validated(_attrs), do: {:error, :invalid_result}

  defp require_keys(attrs) do
    if Enum.all?(@required_keys, &Map.has_key?(attrs, &1)) do
      :ok
    else
      {:error, :invalid_result}
    end
  end
end
