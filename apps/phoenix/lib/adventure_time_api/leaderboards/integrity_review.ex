defmodule AdventureTimeApi.Leaderboards.IntegrityReview do
  @moduledoc """
  Read-only list of recent leaderboard results carrying an integrity reason code, so
  a super administrator can review them and exclude or correct one through the
  existing audited flows.
  """

  import Ecto.Query

  alias AdventureTimeApi.Accounts.User

  alias AdventureTimeApi.Leaderboards.{
    Board,
    DailyResult,
    Period,
    ResultTelemetry,
    Snapshot
  }

  alias AdventureTimeApi.Repo

  @reasons [
    "suspicious_elapsed_ratio",
    "client_elapsed_exceeds_server_window",
    "ranked_session_deadline_exceeded",
    "no_ranked_session"
  ]
  @default_reason "suspicious_elapsed_ratio"
  @lookback_days 14
  @limit 200

  def reasons, do: @reasons

  @spec list_flagged(String.t() | nil, Date.t()) :: {:ok, map()} | {:error, :invalid_reason}
  def list_flagged(reason \\ nil, today \\ Date.utc_today())

  def list_flagged(nil, today), do: list_flagged(@default_reason, today)

  def list_flagged(reason, %Date{} = today) when reason in @reasons do
    since = Date.add(today, -@lookback_days)

    results =
      from(result in DailyResult,
        join: telemetry in ResultTelemetry,
        on: telemetry.result_id == result.id,
        join: board in Board,
        on: board.id == result.board_id,
        left_join: user in User,
        on: user.id == result.user_id,
        left_join: period in Period,
        on: period.period_type == :day and period.competition_date == result.competition_date,
        left_join: snapshot in Snapshot,
        on:
          snapshot.period_id == period.id and snapshot.board_id == result.board_id and
            snapshot.current,
        where:
          result.active and result.competition_date >= ^since and
            ^reason in telemetry.integrity_reason_codes,
        order_by: [desc: result.competition_date, desc: result.submitted_at],
        limit: @limit,
        select: {result, telemetry, board.key, user, snapshot.id}
      )
      |> Repo.all()
      |> Enum.map(&project/1)

    {:ok, %{reason: reason, reasons: @reasons, results: results}}
  end

  def list_flagged(_reason, _today), do: {:error, :invalid_reason}

  defp project({result, telemetry, board_key, user, snapshot_id}) do
    metrics = telemetry.session_metrics || %{}

    %{
      id: result.id,
      boardKey: board_key,
      competitionDate: Date.to_iso8601(result.competition_date),
      userId: result.user_id,
      displayName: user && (user.display_name || user.email),
      resultStatus: result.result_status,
      integrityStatus: result.integrity_status,
      integrityReasonCodes: telemetry.integrity_reason_codes,
      serverElapsedMs: Map.get(metrics, "serverElapsedMs"),
      clientElapsedMs: Map.get(metrics, "clientElapsedMs"),
      pointsMilli: result.points_milli,
      rawResult: result.raw_result,
      submittedAt: result.submitted_at && DateTime.to_iso8601(result.submitted_at),
      snapshotId: if(result.result_status == :snapshotted, do: snapshot_id)
    }
  end
end
