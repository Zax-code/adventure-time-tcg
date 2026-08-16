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

  alias AdventureTimeApi.Leaderboards.{
    Calendar,
    Configuration,
    RankedSession,
    ResultRecorder,
    Slots
  }

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
         {:ok, slot} <- Slots.get_or_create(user, date),
         :ok <- validate_attribution_window(normalized, slot, source) do
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

  @spec reconcile_open_week(DateTime.t()) :: :ok
  def reconcile_open_week(now \\ DateTime.utc_now()) do
    today = DateTime.to_date(now)

    since =
      today
      |> Date.beginning_of_week(:monday)
      |> Date.add(-1)
      |> max_date(Configuration.launch_date())

    AdventureTimeApi.Quests.settle_expired_speed_calculus_runs_since(since, now)

    from(snapshot in StepSnapshot,
      join: user in User,
      on:
        user.id == snapshot.user_id and user.preferred_step_source == snapshot.source and
          user.leaderboard_eligible,
      where: snapshot.recorded_for >= ^since,
      select: {snapshot.user_id, snapshot.recorded_for, :steps}
    )
    |> Repo.all()
    |> Enum.each(fn {user_id, date, source} -> sync_safely(user_id, date, source) end)

    from(attempt in DailyNumbersDailyAttempt,
      left_join: session in RankedSession,
      on:
        session.source_kind == "daily_numbers_daily_attempt" and session.source_id == attempt.id and
          session.status == :settled and session.integrity_status == :accepted,
      where: attempt.date >= ^since and (not attempt.exact or not is_nil(session.id)),
      select: {attempt.user_id, attempt.date, attempt.mode}
    )
    |> Repo.all()
    |> Enum.each(fn {user_id, date, mode} ->
      sync_safely(user_id, date, {:daily_numbers, mode})
    end)

    from(attempt in WordleDailyAttempt,
      where: attempt.date >= ^since and (attempt.solved or attempt.attempt == 6),
      select: {attempt.user_id, attempt.date, attempt.locale}
    )
    |> Repo.all()
    |> Enum.each(fn {user_id, date, locale} -> sync_safely(user_id, date, {:wordle, locale}) end)

    from(run in SpeedCalculusDailyRun,
      where: run.date >= ^since and run.status in ["completed", "abandoned"],
      select: {run.user_id, run.date, run.id}
    )
    |> Repo.all()
    |> Enum.each(fn {user_id, date, run_id} ->
      sync_safely(user_id, date, {:speed_calculus, run_id})
    end)

    from(attempt in PerfectTimingAttempt,
      where: attempt.date >= ^since and attempt.status in ^@final_perfect_timing_statuses,
      select: {attempt.user_id, attempt.date}
    )
    |> Repo.all()
    |> Enum.uniq()
    |> Enum.each(fn {user_id, date} -> sync_safely(user_id, date, :perfect_timing) end)

    :ok
  end

  defp max_date(first, second) do
    if Date.compare(first, second) == :lt, do: second, else: first
  end

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

        ranked_session =
          Repo.get_by(RankedSession,
            source_kind: "daily_numbers_daily_attempt",
            source_id: attempt.id,
            status: :settled,
            integrity_status: :accepted
          )

        leaderboard_elapsed_ms =
          case ranked_session do
            %RankedSession{} = session ->
              max(
                DateTime.diff(session.server_ended_at, session.server_started_at, :millisecond),
                0
              )

            nil when not attempt.exact ->
              attempt.elapsed_ms

            nil ->
              nil
          end

        if is_nil(leaderboard_elapsed_ms) do
          {:error, :untrusted_ranked_timing}
        else
          {:ok,
           source_attrs(
             "daily-numbers/#{mode}",
             "daily_numbers_daily_attempt",
             attempt.id,
             %{
               "kind" => "exact_completion_time",
               "exact" => attempt.exact,
               "elapsedMs" => leaderboard_elapsed_ms
             },
             leaderboard_elapsed_ms,
             outcome,
             attempt.inserted_at,
             %{
               exact: attempt.exact,
               completed: attempt.completed,
               clientElapsedMs: attempt.elapsed_ms,
               serverElapsedMs: leaderboard_elapsed_ms,
               distance: attempt.distance
             }
           )
           |> Map.put(:ranked_session_id, ranked_session && ranked_session.id)}
        end

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

  defp validate_attribution_window(normalized, slot, source) do
    deadline =
      if source == :steps do
        DateTime.add(slot.ends_at, 8, :hour)
      else
        slot.ends_at
      end

    if DateTime.compare(normalized.submitted_at, deadline) == :gt do
      {:error, :slot_attribution_closed}
    else
      :ok
    end
  end

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
