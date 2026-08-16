defmodule AdventureTimeApi.Leaderboards.QuestResults do
  @moduledoc """
  Converts existing server-authoritative quest records into leaderboard results.

  Callers use `sync_safely/3` after their own successful write. It never accepts client
  points and never lets a leaderboard failure change quest behavior.
  """

  import Ecto.Query

  require Logger

  alias AdventureTimeApi.Accounts.User
  alias AdventureTimeApi.Health.StepSnapshot

  alias AdventureTimeApi.Leaderboards.{Calendar, Configuration, ResultRecorder, Slots}

  alias AdventureTimeApi.Quests.{
    DailyNumbersDailyAttempt,
    PerfectTimingAttempt,
    SpeedCalculusDailyRun,
    WordleDailyAttempt
  }

  alias AdventureTimeApi.Repo

  @final_perfect_timing_statuses ["kept", "auto_finalized", "failed"]

  @spec sync_safely(Ecto.UUID.t(), Date.t(), term()) :: :ok
  def sync_safely(user_id, date, source) do
    case sync(user_id, date, source) do
      {:ok, _result} ->
        :ok

      {:error, reason} when reason in [:scoring_unavailable, :leaderboard_ineligible] ->
        :ok

      {:error, reason} ->
        Logger.warning("leaderboard result sync skipped",
          user_id: user_id,
          competition_date: date,
          source: inspect(source),
          reason: inspect(reason)
        )

        :ok
    end
  rescue
    exception ->
      Logger.error("leaderboard result sync failed",
        user_id: user_id,
        competition_date: date,
        source: inspect(source),
        error: Exception.message(exception)
      )

      :ok
  end

  @spec sync(Ecto.UUID.t(), Date.t(), term()) :: {:ok, term()} | {:error, term()}
  def sync(user_id, %Date{} = date, source) do
    with true <-
           DateTime.compare(DateTime.utc_now(), Calendar.publication_cutoff(date)) == :lt or
             {:error, :result_window_closed},
         %User{leaderboard_eligible: true} = user <- Repo.get(User, user_id),
         {:ok, normalized} when is_map(normalized) <- load_source(user, date, source),
         {:ok, {version, configuration}} <- Configuration.for_date(date),
         {:ok, slot} <- Slots.get_or_create(user, date) do
      normalized
      |> Map.merge(%{
        user_id: user.id,
        competition_slot_id: slot.id,
        competition_date: date,
        scoring_version_id: version.id,
        scoring_configuration: configuration
      })
      |> ResultRecorder.record_validated()
    else
      %User{} -> {:error, :leaderboard_ineligible}
      nil -> {:error, :user_not_found}
      {:ok, :not_final} -> {:ok, :not_final}
      {:error, :result_window_closed} = error -> error
      error -> error
    end
  end

  def sync(_user_id, _date, _source), do: {:error, :invalid_result_source}

  defp load_source(user, date, :steps) do
    case Repo.get_by(StepSnapshot,
           user_id: user.id,
           recorded_for: date,
           source: user.preferred_step_source
         ) do
      %StepSnapshot{} = snapshot ->
        {:ok,
         source_attrs(
           "steps/default",
           "health_step_snapshot",
           snapshot.id,
           %{"kind" => "steps", "steps" => snapshot.step_count},
           snapshot.step_count,
           "accepted",
           snapshot.updated_at,
           %{source: Atom.to_string(snapshot.source), steps: snapshot.step_count}
         )}

      nil ->
        {:ok, :not_final}
    end
  end

  defp load_source(user, date, {:daily_numbers, mode}) when mode in ["1-5", "2-4", "3-3"] do
    case Repo.get_by(DailyNumbersDailyAttempt, user_id: user.id, date: date, mode: mode) do
      %DailyNumbersDailyAttempt{} = attempt ->
        outcome = if attempt.exact, do: "exact", else: "failed"

        {:ok,
         source_attrs(
           "daily-numbers/#{mode}",
           "daily_numbers_daily_attempt",
           attempt.id,
           %{
             "kind" => "exact_completion_time",
             "exact" => attempt.exact,
             "elapsedMs" => attempt.elapsed_ms
           },
           attempt.elapsed_ms,
           outcome,
           attempt.inserted_at,
           %{
             exact: attempt.exact,
             completed: attempt.completed,
             elapsedMs: attempt.elapsed_ms,
             distance: attempt.distance
           }
         )}

      nil ->
        {:ok, :not_final}
    end
  end

  defp load_source(user, date, {:wordle, locale}) when locale in ["fr", "en"] do
    latest =
      from(attempt in WordleDailyAttempt,
        where:
          attempt.user_id == ^user.id and attempt.date == ^date and attempt.locale == ^locale,
        order_by: [desc: attempt.attempt],
        limit: 1
      )
      |> Repo.one()

    case latest do
      %WordleDailyAttempt{solved: true} = attempt ->
        {:ok, wordle_attrs(attempt, "solved")}

      %WordleDailyAttempt{attempt: 6} = attempt ->
        {:ok, wordle_attrs(attempt, "failed")}

      _ ->
        {:ok, :not_final}
    end
  end

  defp load_source(user, date, {:speed_calculus, run_id}) do
    case Repo.get_by(SpeedCalculusDailyRun, id: run_id, user_id: user.id, date: date) do
      %SpeedCalculusDailyRun{status: status} = run when status in ["completed", "abandoned"] ->
        score = run.score || 0

        {:ok,
         source_attrs(
           "speed-calculus/ranked",
           "speed_calculus_daily_run",
           run.id,
           %{"kind" => "correct_answers", "correctAnswers" => score},
           score,
           status,
           run.finished_at || run.inserted_at,
           %{runNumber: run.run_number, status: status, correctAnswers: score}
         )
         |> Map.put(:ranked_session_id, nil)}

      _ ->
        {:ok, :not_final}
    end
  end

  defp load_source(user, date, :perfect_timing) do
    final =
      from(attempt in PerfectTimingAttempt,
        where:
          attempt.user_id == ^user.id and attempt.date == ^date and
            attempt.status in ^@final_perfect_timing_statuses,
        order_by: [desc: attempt.attempt_number],
        limit: 1
      )
      |> Repo.one()

    case final do
      %PerfectTimingAttempt{} = attempt ->
        outcome =
          if attempt.tier == "miss" or attempt.status == "failed", do: "miss", else: "success"

        error_ms = attempt.deviation_ms || abs((attempt.elapsed_ms || 0) - attempt.target_ms)

        {:ok,
         source_attrs(
           "perfect-timing/official",
           "perfect_timing_attempt",
           attempt.id,
           %{
             "kind" => "duration_error_ms",
             "outcome" => outcome,
             "absoluteErrorMs" => error_ms,
             "tier" => attempt.tier
           },
           error_ms,
           outcome,
           attempt.completed_at || attempt.inserted_at,
           %{
             attemptNumber: attempt.attempt_number,
             tier: attempt.tier,
             status: attempt.status,
             targetMs: attempt.target_ms,
             elapsedMs: attempt.elapsed_ms,
             absoluteErrorMs: error_ms
           }
         )}

      nil ->
        {:ok, :not_final}
    end
  end

  defp load_source(_user, _date, _source), do: {:error, :invalid_result_source}

  defp wordle_attrs(attempt, outcome) do
    source_attrs(
      "wordle/#{attempt.locale}",
      "wordle_daily_attempt",
      attempt.id,
      %{"kind" => "wordle_outcome", "outcome" => outcome, "guesses" => attempt.attempt},
      attempt.attempt,
      outcome,
      attempt.inserted_at,
      %{locale: attempt.locale, outcome: outcome, guesses: attempt.attempt}
    )
  end

  defp source_attrs(
         board_key,
         source_kind,
         source_id,
         raw_result,
         raw_numeric_value,
         outcome,
         submitted_at,
         metrics
       ) do
    %{
      board_key: board_key,
      source_kind: source_kind,
      source_id: source_id,
      raw_result: raw_result,
      raw_numeric_value: raw_numeric_value,
      outcome: outcome,
      submitted_at: submitted_at,
      telemetry: %{
        normalized_metrics: Map.new(metrics, fn {key, value} -> {to_string(key), value} end),
        validity_reason_codes: ["server_validated"],
        integrity_reason_codes: []
      }
    }
  end
end
