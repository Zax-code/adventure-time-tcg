defmodule AdventureTimeApi.Quests do
  @moduledoc """
  Quest boundary: daily claim, Daily Numbers, Wordle, and Speed Calculus.
  """

  import Ecto.Query

  require Logger

  alias AdventureTimeApi.Accounts.User
  alias AdventureTimeApi.Fitbit
  alias AdventureTimeApi.Health
  alias AdventureTimeApi.Leaderboards.QuestResults

  alias AdventureTimeApi.Quests.{
    DailyNumbersArchiveAttempt,
    DailyNumbersDailyAttempt,
    DailyNumbersEngine,
    DailyNumbersSolutionHunt,
    DailyQuest,
    PerfectTiming,
    PerfectTimingAttempt,
    PerfectTimingEngine,
    SpeedCalculusDailyRun,
    SpeedCalculusEngine,
    WordleDailyAttempt,
    WordleDictionaryWordDefinition,
    WordleDictionaryWord,
    WordleEngine
  }

  alias AdventureTimeApi.{PubSub, Repo}

  @daily_reward 50
  @reset_timezone "Europe/Paris"
  @wordle_max_attempts 6
  @default_wordle_locale "fr"
  @wordle_locales ["fr", "en"]
  @slow_wordle_ms 150
  @slow_speed_state_ms 150
  @slow_daily_numbers_ms 150
  @daily_numbers_archive_days 30
  @daily_numbers_launch_date ~D[2026-06-19]

  @quest_definitions [
    %{quest_type: "steps_10k", icon: "walking", target: 10_000, reward: 75},
    %{quest_type: "wordle_daily_fr", icon: "wordle", target: 1, reward: 35},
    %{quest_type: "wordle_daily_en", icon: "wordle", target: 1, reward: 35},
    %{quest_type: "speed_calculus_daily", icon: "sparkles", target: 3, reward: 0},
    %{quest_type: "perfect_timing_daily", icon: "sparkles", target: 1, reward: 0},
    %{quest_type: "daily_numbers_1_5", icon: "sparkles", target: 1, reward: 45},
    %{quest_type: "daily_numbers_2_4", icon: "sparkles", target: 1, reward: 60},
    %{quest_type: "daily_numbers_3_3", icon: "sparkles", target: 1, reward: 75}
  ]

  # ── Wordle Cache (persistent_term for fast in-memory lookups) ───────────────
  defp wordle_cache_key(locale), do: {:wordle_candidates, locale}
  defp wordle_words_set_key(locale), do: {:wordle_words_set, locale}

  defp wordle_candidates_from_db(locale) do
    WordleDictionaryWord
    |> where([w], w.locale == ^locale and w.is_solution_candidate == true)
    |> order_by([w], asc: w.word)
    |> select([w], w.word)
    |> Repo.all()
  end

  defp wordle_words_set_from_db(locale) do
    WordleDictionaryWord
    |> where([w], w.locale == ^locale and w.is_allowed_guess == true)
    |> select([w], w.word)
    |> Repo.all()
    |> MapSet.new()
  end

  defp get_wordle_candidates(locale) do
    case :persistent_term.get(wordle_cache_key(locale), :undefined) do
      :undefined ->
        candidates = wordle_candidates_from_db(locale)
        :persistent_term.put(wordle_cache_key(locale), candidates)
        candidates

      candidates ->
        candidates
    end
  end

  defp get_wordle_words_set(locale) do
    case :persistent_term.get(wordle_words_set_key(locale), :undefined) do
      :undefined ->
        words_set = wordle_words_set_from_db(locale)
        :persistent_term.put(wordle_words_set_key(locale), words_set)
        words_set

      words_set ->
        words_set
    end
  end

  def wordle_cache_warm do
    Enum.each(@wordle_locales, fn locale ->
      get_wordle_candidates(locale)
      get_wordle_words_set(locale)
    end)

    :ok
  end

  # ── Daily Claim ─────────────────────────────────────────────────────────────

  def daily_reward, do: @daily_reward
  def reset_timezone, do: @reset_timezone
  def current_reset_date, do: current_reset_date(@reset_timezone)

  def current_reset_date(timezone) when is_binary(timezone) do
    now_in_reset_timezone(timezone)
    |> DateTime.to_date()
  end

  def current_reset_date_for_user(user_id) do
    current_reset_date(reset_timezone_for_user(user_id))
  end

  def reset_timezone_for_user(user_id) do
    case Repo.get(User, user_id) do
      %User{} = user when is_binary(user.timezone) and user.timezone != "" -> user.timezone
      _ -> @reset_timezone
    end
  end

  def daily_claim_status(user_id) do
    case Repo.get(User, user_id) do
      nil -> {:error, :not_found}
      %User{} = user -> {:ok, status_payload(user)}
    end
  end

  def claim_daily_reward(user_id) do
    case Repo.get(User, user_id) do
      nil ->
        {:error, :not_found}

      %User{} = user ->
        if can_claim_daily?(user.last_daily_claim, user.timezone || @reset_timezone) do
          new_balance = user.coins + @daily_reward
          now = now_utc()

          last_claim_condition =
            case user.last_daily_claim do
              nil -> dynamic([u], u.id == ^user_id and is_nil(u.last_daily_claim))
              last_claim -> dynamic([u], u.id == ^user_id and u.last_daily_claim == ^last_claim)
            end

          query = from(u in User, where: ^last_claim_condition)

          case Repo.update_all(query,
                 set: [coins: new_balance, last_daily_claim: now, updated_at: now]
               ) do
            {1, _} ->
              {:ok, %{success: true, coinsAwarded: @daily_reward, newBalance: new_balance}}

            _ ->
              {:error, :already_claimed, conflict_payload(user.timezone || @reset_timezone)}
          end
        else
          {:error, :already_claimed, conflict_payload(user.timezone || @reset_timezone)}
        end
    end
  end

  def can_claim_daily?(last_claim, timezone \\ @reset_timezone)
  def can_claim_daily?(nil, _timezone), do: true

  def can_claim_daily?(%DateTime{} = last_claim, timezone) do
    current_reset_date(timezone) != reset_date_for(last_claim, timezone)
  end

  def time_until_next_claim_ms(timezone \\ @reset_timezone) do
    now = now_in_reset_timezone(timezone)
    tomorrow = Date.add(DateTime.to_date(now), 1)
    midnight = DateTime.new!(tomorrow, ~T[00:00:00], timezone)
    DateTime.diff(midnight, now, :millisecond)
  end

  # ── Quest Materialization ────────────────────────────────────────────────────

  @doc """
  Ensure each configured quest type has a daily_quest row for this user+date.
  Inserts on first call; on conflict, updates only target (preserves progress/reward/completion).
  """
  def materialize_daily_quests(user_id, date \\ nil) do
    date = date || current_reset_date_for_user(user_id)
    now = now_utc()

    entries =
      Enum.map(@quest_definitions, fn def ->
        %{
          id: Ecto.UUID.generate(),
          user_id: user_id,
          date: date,
          quest_type: def.quest_type,
          target: quest_target(def, date),
          reward: def.reward,
          progress: 0,
          completed: false,
          claimed: false,
          inserted_at: now,
          updated_at: now
        }
      end)

    Repo.insert_all(DailyQuest, entries,
      on_conflict: {:replace, [:target, :updated_at]},
      conflict_target: [:user_id, :date, :quest_type]
    )

    :ok
  end

  @doc """
  Sync the steps_10k quest progress from today's step snapshot (if any).
  """
  def sync_steps_quest(user_id, date \\ nil) do
    date = date || current_reset_date_for_user(user_id)
    now = now_utc()

    preferred_source =
      case Repo.get(User, user_id) do
        %User{preferred_step_source: source} -> source
        _ -> :device_health
      end

    quest =
      DailyQuest
      |> where([q], q.user_id == ^user_id and q.date == ^date and q.quest_type == "steps_10k")
      |> Repo.one()

    if quest do
      snapshot = Health.get_step_snapshot_for_date(user_id, date, preferred_source)
      progress = if snapshot, do: snapshot.step_count, else: 0
      completed = progress >= quest.target

      updates = [
        progress: progress,
        completed: quest.completed || completed,
        updated_at: now
      ]

      updates =
        if !quest.completed_at && completed do
          Keyword.put(updates, :completed_at, now)
        else
          updates
        end

      DailyQuest
      |> where([q], q.id == ^quest.id)
      |> Repo.update_all(set: updates)
    end

    QuestResults.sync_safely(user_id, date, :steps)

    :ok
  end

  @doc """
  Build the full quest list for the user, materializing quests for today if needed.
  """
  def list_quests_for_user(user_id) do
    date = current_reset_date_for_user(user_id)
    fitbit_connected = Fitbit.connected?(user_id)

    materialize_daily_quests(user_id, date)
    sync_steps_quest(user_id, date)

    quests =
      DailyQuest
      |> where([q], q.user_id == ^user_id and q.date == ^date)
      |> Repo.all()

    wordle_summary = build_wordle_summary(user_id, date)

    speed_state = build_speed_calculus_summary(user_id, date)
    perfect_timing_summary = PerfectTiming.summary(user_id, date)
    daily_numbers_attempts = load_daily_numbers_attempts(user_id, date)

    quest_list =
      @quest_definitions
      |> Enum.map(fn def ->
        quest = Enum.find(quests, &(&1.quest_type == def.quest_type))

        if quest do
          build_quest_entry(
            quest,
            def,
            wordle_summary,
            speed_state,
            perfect_timing_summary,
            daily_numbers_attempts
          )
        end
      end)
      |> Enum.reject(&is_nil/1)

    {:ok, %{quests: quest_list, fitbitConnected: fitbit_connected}}
  end

  def admin_reset_daily_quests(user_id, options \\ %{}) do
    date = Map.get(options, :date, current_reset_date_for_user(user_id))
    quest_type = Map.get(options, :quest_type)
    admin_id = Map.get(options, :admin_id)

    case Repo.transaction(fn ->
           delete_daily_quests_for_reset(user_id, date, quest_type)
           delete_wordle_attempts_for_reset(user_id, date, quest_type)
           delete_speed_runs_for_reset(user_id, date, quest_type)
           delete_perfect_timing_attempts_for_reset(user_id, date, quest_type)
           delete_daily_numbers_attempts_for_reset(user_id, date, quest_type)
           materialize_daily_quests(user_id, date)
           maybe_set_reset_actor(user_id, date, quest_type, admin_id)

           %{
             resetDate: Date.to_iso8601(date),
             resetMode: reset_mode(quest_type),
             questType: quest_type,
             resetByName: admin_reset_name(admin_id)
           }
         end) do
      {:ok, payload} = ok ->
        broadcast_quest_reset(user_id, payload)
        ok

      error ->
        error
    end
  end

  @doc """
  Claim a completed quest reward. Adds coins to user in a transaction.
  """
  def claim_quest(user_id, quest_id) do
    with %DailyQuest{} = quest <- Repo.get(DailyQuest, quest_id),
         :ok <- validate_quest_ownership(quest, user_id),
         :ok <- validate_quest_completed(quest),
         :ok <- validate_quest_not_claimed(quest),
         %User{} = user <- Repo.get(User, user_id) do
      now = now_utc()
      new_balance = user.coins + quest.reward

      Ecto.Multi.new()
      |> Ecto.Multi.run(:claim_quest, fn repo, _changes ->
        {1, _} =
          DailyQuest
          |> where([q], q.id == ^quest.id)
          |> repo.update_all(set: [claimed: true, claimed_at: now, updated_at: now])

        {:ok, :claimed}
      end)
      |> Ecto.Multi.run(:add_coins, fn repo, _changes ->
        {1, _} =
          User
          |> where([u], u.id == ^user_id)
          |> repo.update_all(set: [coins: new_balance, updated_at: now])

        {:ok, new_balance}
      end)
      |> Repo.transaction()
      |> case do
        {:ok, _} ->
          {:ok,
           %{
             success: true,
             reward: quest.reward,
             newBalance: new_balance,
             quest: %{id: quest.id, type: quest.quest_type, completed: true, claimed: true}
           }}

        {:error, _step, reason, _changes} ->
          {:error, reason}
      end
    else
      nil -> {:error, :not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  # ── Perfect Timing ─────────────────────────────────────────────────────────

  def perfect_timing_state(user_id) do
    date = current_reset_date_for_user(user_id)
    timezone = reset_timezone_for_user(user_id)
    recover_previous_perfect_timing_attempts(user_id, date, timezone)
    materialize_daily_quests(user_id, date)
    result = PerfectTiming.state(user_id, date, timezone)
    QuestResults.sync_safely(user_id, date, :perfect_timing)
    result
  end

  def start_perfect_timing(user_id, date_key, quest_version) do
    date = current_reset_date_for_user(user_id)
    timezone = reset_timezone_for_user(user_id)
    materialize_daily_quests(user_id, date)
    PerfectTiming.start(user_id, date, timezone, date_key, quest_version)
  end

  def stop_perfect_timing(
        user_id,
        attempt_id,
        elapsed_ms,
        stop_reason,
        date_key,
        quest_version
      ) do
    timezone = reset_timezone_for_user(user_id)

    with {:ok, attempt_id} <- Ecto.UUID.cast(attempt_id),
         %PerfectTimingAttempt{} = attempt <-
           Repo.get_by(PerfectTimingAttempt, id: attempt_id, user_id: user_id) do
      result =
        PerfectTiming.stop(
          user_id,
          attempt.date,
          timezone,
          attempt.id,
          elapsed_ms,
          stop_reason,
          date_key,
          quest_version
        )

      QuestResults.sync_safely(user_id, attempt.date, :perfect_timing)
      result
    else
      _ -> {:error, :attempt_not_found}
    end
  end

  def continue_perfect_timing(user_id, attempt_id, date_key, quest_version) do
    date = current_reset_date_for_user(user_id)
    timezone = reset_timezone_for_user(user_id)
    materialize_daily_quests(user_id, date)

    PerfectTiming.discard_result(
      user_id,
      date,
      timezone,
      attempt_id,
      date_key,
      quest_version
    )
  end

  def keep_perfect_timing(user_id, attempt_id, date_key, quest_version) do
    date = current_reset_date_for_user(user_id)
    timezone = reset_timezone_for_user(user_id)
    materialize_daily_quests(user_id, date)

    result =
      PerfectTiming.keep_result(
        user_id,
        date,
        timezone,
        attempt_id,
        date_key,
        quest_version
      )

    QuestResults.sync_safely(user_id, date, :perfect_timing)
    result
  end

  def perfect_timing_training_target(user_id) do
    date = current_reset_date_for_user(user_id)

    {:ok,
     %{
       targetMs: PerfectTiming.training_target(date),
       officialTargetMs: PerfectTimingEngine.daily_target_ms(date)
     }}
  end

  # ── Daily Numbers ───────────────────────────────────────────────────────────

  def daily_numbers_state(user_id, mode) do
    with {:ok, normalized_mode} <- normalize_daily_numbers_mode(mode) do
      date = current_reset_date_for_user(user_id)
      materialize_daily_quests(user_id, date)

      {:ok, build_daily_numbers_state(user_id, date, normalized_mode)}
    end
  end

  def start_daily_numbers_ranked(user_id, mode) do
    # Compatibility endpoint for app versions that still call ranked-start.
    daily_numbers_state(user_id, mode)
  end

  def submit_daily_numbers(
        user_id,
        mode,
        expected_date_key,
        steps,
        expected_quest_version \\ nil,
        elapsed_ms \\ 0
      ) do
    with {:ok, normalized_mode} <- normalize_daily_numbers_mode(mode),
         date = current_reset_date_for_user(user_id),
         :ok <- validate_daily_numbers_date(date, expected_date_key) do
      materialize_daily_quests(user_id, date)

      with :ok <-
             validate_daily_numbers_version(
               user_id,
               date,
               normalized_mode,
               expected_quest_version
             ) do
        quest_type = daily_numbers_quest_type(normalized_mode)
        quest = get_daily_quest(user_id, date, quest_type)

        if get_daily_numbers_attempt(user_id, date, normalized_mode) do
          {:error, :daily_numbers_already_submitted}
        else
          {:ok, puzzle} = DailyNumbersEngine.generate_puzzle(normalized_mode, date)

          with {:ok, validated_submission} <-
                 DailyNumbersEngine.validate_submission(puzzle, steps) do
            now = now_utc()

            earned_reward =
              quest.reward
              |> Kernel.*(validated_submission.score)
              |> Kernel./(100)
              |> round()

            submission_attrs = %{
              user_id: user_id,
              date: date,
              mode: normalized_mode,
              submitted_steps: validated_submission.steps,
              final_value: validated_submission.finalValue,
              distance: validated_submission.distance,
              score: validated_submission.score,
              exact: validated_submission.exact,
              completed: validated_submission.completed,
              elapsed_ms: normalize_daily_numbers_elapsed_ms(elapsed_ms)
            }

            quest_updates = [
              progress: 1,
              reward: earned_reward,
              completed: validated_submission.completed,
              updated_at: now
            ]

            quest_updates =
              if validated_submission.completed and is_nil(quest.completed_at) do
                Keyword.put(quest_updates, :completed_at, now)
              else
                quest_updates
              end

            Ecto.Multi.new()
            |> Ecto.Multi.insert(
              :daily_numbers_attempt,
              DailyNumbersDailyAttempt.changeset(%DailyNumbersDailyAttempt{}, submission_attrs)
            )
            |> Ecto.Multi.run(:update_quest, fn repo, _changes ->
              {1, _} =
                DailyQuest
                |> where([q], q.id == ^quest.id)
                |> repo.update_all(set: quest_updates)

              {:ok, :updated}
            end)
            |> Repo.transaction()
            |> case do
              {:ok, %{daily_numbers_attempt: _attempt}} ->
                QuestResults.sync_safely(
                  user_id,
                  date,
                  {:daily_numbers, normalized_mode}
                )

                {:ok, build_daily_numbers_state(user_id, date, normalized_mode)}

              {:error, _step, reason, _changes} ->
                {:error, reason}
            end
          end
        end
      end
    end
  end

  def submit_daily_numbers_solution_hunt(
        user_id,
        mode,
        expected_date_key,
        steps,
        expected_quest_version \\ nil
      ) do
    with {:ok, normalized_mode} <- normalize_daily_numbers_mode(mode),
         date = current_reset_date_for_user(user_id),
         :ok <- validate_daily_numbers_date(date, expected_date_key) do
      with :ok <-
             validate_daily_numbers_version(
               user_id,
               date,
               normalized_mode,
               expected_quest_version
             ),
           %DailyQuest{completed: true} <-
             get_daily_quest(user_id, date, daily_numbers_quest_type(normalized_mode)),
           %DailyNumbersDailyAttempt{completed: true} <-
             get_daily_numbers_attempt(user_id, date, normalized_mode),
           {:ok, puzzle} <- DailyNumbersEngine.generate_puzzle(normalized_mode, date),
           {:ok, submission} <- DailyNumbersEngine.validate_submission(puzzle, steps),
           true <- submission.exact || {:error, :daily_numbers_solution_hunt_not_exact},
           {:ok, solution_set} <-
             DailyNumbersSolutionHunt.ensure_solution_set(
               date,
               normalized_mode,
               puzzle
             ),
           {:ok, discovery_result} <-
             DailyNumbersSolutionHunt.record_solution(
               user_id,
               solution_set,
               submission.canonicalKey,
               submission.steps
             ) do
        progress = DailyNumbersSolutionHunt.progress(user_id, solution_set)

        {:ok,
         Map.merge(progress, %{
           valid: true,
           newSolution: discovery_result == :new,
           alreadyFound: discovery_result == :already_found
         })}
      else
        nil -> {:error, :daily_numbers_solution_hunt_locked}
        %DailyQuest{} -> {:error, :daily_numbers_solution_hunt_locked}
        %DailyNumbersDailyAttempt{} -> {:error, :daily_numbers_solution_hunt_locked}
        error -> error
      end
    end
  end

  def daily_numbers_archive_history(user_id) do
    today = current_reset_date_for_user(user_id)

    dates =
      1..@daily_numbers_archive_days
      |> Enum.map(&Date.add(today, -&1))
      |> Enum.reject(&(Date.compare(&1, @daily_numbers_launch_date) == :lt))

    archive_attempts =
      DailyNumbersArchiveAttempt
      |> where([a], a.user_id == ^user_id and a.date in ^dates)
      |> Repo.all()
      |> Map.new(&{{&1.date, &1.mode}, &1})

    daily_attempts =
      DailyNumbersDailyAttempt
      |> where([a], a.user_id == ^user_id and a.date in ^dates)
      |> Repo.all()
      |> Map.new(&{{&1.date, &1.mode}, &1})

    days =
      Enum.map(dates, fn date ->
        %{
          date: Date.to_iso8601(date),
          modes:
            daily_numbers_modes()
            |> Enum.map(fn mode ->
              attempt =
                Map.get(archive_attempts, {date, mode}) ||
                  Map.get(daily_attempts, {date, mode})

              build_daily_numbers_archive_mode_summary(attempt, mode)
            end)
        }
      end)

    {:ok, %{today: Date.to_iso8601(today), days: days}}
  end

  def daily_numbers_archive_state(user_id, date_key, mode) do
    with {:ok, date} <- parse_daily_numbers_archive_date(date_key),
         :ok <- validate_daily_numbers_archive_date(user_id, date),
         {:ok, normalized_mode} <- normalize_daily_numbers_mode(mode) do
      {:ok, build_daily_numbers_archive_state(user_id, date, normalized_mode)}
    end
  end

  def submit_daily_numbers_archive(user_id, date_key, mode, steps, elapsed_ms \\ 0) do
    with {:ok, date} <- parse_daily_numbers_archive_date(date_key),
         :ok <- validate_daily_numbers_archive_date(user_id, date),
         {:ok, normalized_mode} <- normalize_daily_numbers_mode(mode),
         {:ok, puzzle} <- DailyNumbersEngine.generate_puzzle(normalized_mode, date),
         {:ok, validated_submission} <- DailyNumbersEngine.validate_submission(puzzle, steps) do
      submission_attrs = %{
        user_id: user_id,
        date: date,
        mode: normalized_mode,
        submitted_steps: validated_submission.steps,
        final_value: validated_submission.finalValue,
        distance: validated_submission.distance,
        score: validated_submission.score,
        exact: validated_submission.exact,
        completed: validated_submission.completed,
        elapsed_ms: normalize_daily_numbers_elapsed_ms(elapsed_ms)
      }

      case upsert_daily_numbers_archive_attempt(user_id, date, normalized_mode, submission_attrs) do
        {:ok, _attempt} ->
          {:ok, build_daily_numbers_archive_state(user_id, date, normalized_mode)}

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  # ── Wordle ───────────────────────────────────────────────────────────────────

  @doc "Return the current Wordle game state for a user."
  def wordle_state(user_id, locale \\ nil) do
    with {:ok, locale} <- normalize_wordle_locale(locale) do
      {payload, duration_ms} =
        timed(fn ->
          timezone = reset_timezone_for_user(user_id)
          date = current_reset_date(timezone)
          attempts = load_wordle_attempts(user_id, date, locale)
          solved = Enum.any?(attempts, & &1.solved)
          game_over = solved || length(attempts) >= @wordle_max_attempts

          target_word =
            if game_over && !solved do
              get_daily_word(date, locale)
            end

          quest =
            DailyQuest
            |> where(
              [q],
              q.user_id == ^user_id and q.date == ^date and
                q.quest_type == ^wordle_quest_type(locale)
            )
            |> Repo.one()

          %{
            locale: locale,
            availableLocales: @wordle_locales,
            date: Date.to_iso8601(date),
            resetTimezone: timezone,
            guesses: Enum.map(attempts, fn a -> %{guess: a.guess, evaluation: a.evaluation} end),
            solved: solved,
            questVersion: if(quest, do: quest.id, else: nil),
            resetByName: reset_by_name(quest),
            targetWord: target_word
          }
        end)

      maybe_log_slow(
        duration_ms,
        @slow_wordle_ms,
        "wordle_state_slow",
        user_id: user_id,
        locale: locale,
        guesses: length(payload.guesses),
        solved: payload.solved
      )

      {:ok, payload}
    end
  end

  @doc "Return today's Wordle answer definition for the selected locale."
  def wordle_definition(user_id, locale \\ nil) do
    with {:ok, locale} <- normalize_wordle_locale(locale) do
      date = current_reset_date_for_user(user_id)
      word = get_daily_word(date, locale)

      with {:ok, definition} <- get_stored_wordle_definition(locale, word) do
        {:ok,
         %{
           locale: locale,
           word: word,
           displayWord: definition.display_word,
           definition: definition.definition,
           partOfSpeech: definition.part_of_speech,
           sourceName: definition.source_name,
           sourceUrl: definition.source_url,
           variants: definition.variants
         }}
      end
    end
  end

  @doc "Submit a Wordle guess. Returns evaluation or an error tuple with a code."
  def submit_wordle_guess(
        user_id,
        raw_guess,
        locale \\ nil,
        expected_date_str \\ nil,
        expected_quest_version \\ nil
      ) do
    with {:ok, locale} <- normalize_wordle_locale(locale) do
      {{result, breakdown}, duration_ms} =
        timed(fn ->
          date = current_reset_date_for_user(user_id)
          guess = WordleEngine.normalize(raw_guess)

          {validation_result, validation_ms} =
            timed(fn ->
              with :ok <- validate_expected_date(expected_date_str, date),
                   :ok <- validate_wordle_version(user_id, date, locale, expected_quest_version),
                   :ok <- validate_guess_format(guess),
                   :ok <- validate_wordle_word(guess, locale) do
                :ok
              end
            end)

          with :ok <- validation_result do
            {attempts_result, attempts_ms} =
              timed(fn ->
                attempts = load_wordle_attempts(user_id, date, locale)

                with :ok <- validate_not_already_solved(attempts),
                     :ok <- validate_attempts_remaining(attempts) do
                  {:ok, attempts}
                end
              end)

            with {:ok, attempts} <- attempts_result do
              {target, target_ms} = timed(fn -> get_daily_word(date, locale) end)

              {write_result, write_ms} =
                timed(fn ->
                  evaluation = WordleEngine.evaluate_guess(guess, target)
                  evaluation_strings = WordleEngine.evaluation_to_strings(evaluation)
                  solved = guess == target

                  %WordleDailyAttempt{}
                  |> WordleDailyAttempt.changeset(%{
                    user_id: user_id,
                    date: date,
                    locale: locale,
                    attempt: length(attempts) + 1,
                    guess: guess,
                    evaluation: evaluation_strings,
                    solved: solved
                  })
                  |> Repo.insert!()

                  QuestResults.sync_safely(user_id, date, {:wordle, locale})

                  quest_just_completed =
                    if solved do
                      complete_wordle_quest(user_id, date, locale)
                    else
                      false
                    end

                  target_word =
                    if !solved && length(attempts) + 1 >= @wordle_max_attempts do
                      target
                    end

                  {:ok,
                   %{
                     locale: locale,
                     evaluation: evaluation_strings,
                     solved: solved,
                     date: Date.to_iso8601(date),
                     questJustCompleted: quest_just_completed,
                     targetWord: target_word
                   }}
                end)

              {write_result,
               %{
                 locale: locale,
                 validation_ms: validation_ms,
                 attempts_ms: attempts_ms,
                 target_ms: target_ms,
                 write_ms: write_ms,
                 attempts_used: length(attempts) + 1,
                 solved: match?({:ok, %{solved: true}}, write_result)
               }}
            else
              error ->
                {error,
                 %{
                   locale: locale,
                   validation_ms: validation_ms,
                   attempts_ms: attempts_ms,
                   target_ms: 0,
                   write_ms: 0,
                   attempts_used: 0,
                   solved: false
                 }}
            end
          else
            error ->
              {error,
               %{
                 locale: locale,
                 validation_ms: validation_ms,
                 attempts_ms: 0,
                 target_ms: 0,
                 write_ms: 0,
                 attempts_used: 0,
                 solved: false
               }}
          end
        end)

      maybe_log_slow(
        duration_ms,
        @slow_wordle_ms,
        "wordle_submit_slow",
        user_id: user_id,
        locale: breakdown.locale,
        validation_ms: breakdown.validation_ms,
        attempts_ms: breakdown.attempts_ms,
        target_ms: breakdown.target_ms,
        write_ms: breakdown.write_ms,
        attempts_used: breakdown.attempts_used,
        solved: breakdown.solved
      )

      result
    end
  end

  defp get_stored_wordle_definition(locale, word) do
    case Repo.get_by(WordleDictionaryWord, locale: locale, word: word) do
      %WordleDictionaryWord{} = entry ->
        variants = load_wordle_definition_variants(entry, locale, word)

        case variants do
          [primary_variant | _rest] ->
            {:ok,
             %{
               display_word: primary_variant.displayWord,
               definition: primary_variant.definition,
               part_of_speech: primary_variant.partOfSpeech,
               source_name: primary_variant.sourceName,
               source_url: primary_variant.sourceUrl,
               variants: variants
             }}

          [] ->
            {:error, :definition_not_found}
        end

      nil ->
        {:error, :definition_not_found}
    end
  end

  defp load_wordle_definition_variants(entry, locale, word) do
    child_variants =
      WordleDictionaryWordDefinition
      |> where([d], d.wordle_dictionary_word_id == ^entry.id)
      |> order_by([d], asc: d.display_word)
      |> Repo.all()
      |> Enum.map(fn variant ->
        %{
          displayWord: variant.display_word,
          definition: variant.definition,
          partOfSpeech: variant.part_of_speech,
          sourceName: variant.source_name,
          sourceUrl: variant.source_url
        }
      end)

    case child_variants do
      [] ->
        if is_binary(entry.definition) and entry.definition != "" do
          [
            %{
              displayWord: entry.display_word || default_definition_display_word(locale, word),
              definition: entry.definition,
              partOfSpeech: entry.definition_part_of_speech,
              sourceName: entry.definition_source_name || default_definition_source_name(locale),
              sourceUrl:
                entry.definition_source_url ||
                  default_definition_source_url(locale, entry.display_word || word)
            }
          ]
        else
          []
        end

      variants ->
        variants
    end
  end

  defp default_definition_source_name("en"), do: "Open English WordNet"
  defp default_definition_source_name("fr"), do: "DBnary / Wiktionnaire"

  defp default_definition_display_word("fr", word), do: String.downcase(word)
  defp default_definition_display_word(_locale, word), do: word

  defp default_definition_source_url(locale, word) do
    case locale do
      "en" -> "https://en-word.net/"
      "fr" -> "https://fr.wiktionary.org/wiki/#{URI.encode(String.downcase(word))}#Fran%C3%A7ais"
    end
  end

  # ── Speed Calculus ───────────────────────────────────────────────────────────

  @doc "Get the full Speed Calculus state for a user."
  def speed_calculus_state(user_id) do
    date = current_reset_date_for_user(user_id)
    materialize_daily_quests(user_id, date)
    settle_expired_runs(user_id, date)
    {:ok, build_speed_calculus_state(user_id, date)}
  end

  @doc "Start a new Speed Calculus run (or return existing state if a run is active)."
  def start_speed_calculus_run(user_id) do
    date = current_reset_date_for_user(user_id)
    materialize_daily_quests(user_id, date)
    settle_expired_runs(user_id, date)
    state = build_speed_calculus_state(user_id, date)

    if state.activeRun do
      {:ok, state}
    else
      unless state.canStartRun do
        {:error, :cannot_start_run}
      else
        now = now_utc()
        pause_expires_at = DateTime.add(now, SpeedCalculusEngine.resume_pause_seconds(), :second)

        play_deadline_at =
          DateTime.add(
            now,
            SpeedCalculusEngine.resume_pause_seconds() +
              SpeedCalculusEngine.run_duration_seconds(),
            :second
          )

        run_number = state.runsUsed + 1

        %SpeedCalculusDailyRun{}
        |> SpeedCalculusDailyRun.changeset(%{
          user_id: user_id,
          date: date,
          run_number: run_number,
          seed: Ecto.UUID.generate(),
          answers: [],
          status: "in_progress",
          started_at: now,
          pause_expires_at: pause_expires_at,
          play_deadline_at: play_deadline_at
        })
        |> Repo.insert!()

        {:ok, build_speed_calculus_state(user_id, date)}
      end
    end
  end

  @doc "Start a stateless Speed Calculus training run with a fresh random seed."
  def start_speed_calculus_training(_user_id) do
    seed = Ecto.UUID.generate()

    questions =
      seed |> SpeedCalculusEngine.build_questions() |> SpeedCalculusEngine.to_public_questions()

    {:ok,
     %{
       runId: seed,
       seed: seed,
       questions: questions,
       runDurationSeconds: SpeedCalculusEngine.run_duration_seconds(),
       pauseDurationSeconds: SpeedCalculusEngine.resume_pause_seconds(),
       rewardPerAnswer: SpeedCalculusEngine.reward_per_answer()
     }}
  end

  @doc "Record a user answer for the active run."
  def answer_speed_calculus(user_id, run_id, answer, expected_quest_version \\ nil) do
    date = current_reset_date_for_user(user_id)

    with {:ok, run} <- get_visible_speed_run(user_id, run_id),
         :ok <- validate_speed_calculus_version(user_id, date, expected_quest_version) do
      Repo.transaction(fn ->
        case run do
          nil ->
            Repo.rollback(:run_not_found)

          %SpeedCalculusDailyRun{} ->
            locked_run =
              SpeedCalculusDailyRun
              |> where([r], r.id == ^run_id)
              |> lock("FOR UPDATE")
              |> Repo.one()

            if is_nil(locked_run) do
              Repo.rollback(:run_not_found)
            end

            cond do
              locked_run.status != "in_progress" ->
                Repo.rollback(:run_not_active)

              is_paused?(locked_run) ->
                Repo.rollback(:run_is_paused)

              true ->
                new_answers = locked_run.answers ++ [answer]

                {1, _} =
                  SpeedCalculusDailyRun
                  |> where([r], r.id == ^locked_run.id)
                  |> Repo.update_all(set: [answers: new_answers])

                build_speed_calculus_answer_response(user_id, locked_run, new_answers)
            end
        end
      end)
      |> case do
        {:ok, payload} -> {:ok, payload}
        {:error, reason} -> {:error, reason}
      end
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc "Pause the active run until the player explicitly resumes it."
  def pause_speed_calculus(user_id, synced_answers \\ nil, expected_quest_version \\ nil) do
    date = current_reset_date_for_user(user_id)
    settle_expired_runs(user_id, date)

    with :ok <- validate_speed_calculus_version(user_id, date, expected_quest_version) do
      Repo.transaction(fn ->
        active_run =
          SpeedCalculusDailyRun
          |> where([r], r.user_id == ^user_id and r.date == ^date and r.status == "in_progress")
          |> lock("FOR UPDATE")
          |> Repo.one()

        case active_run do
          nil ->
            Repo.rollback(:run_not_active)

          %SpeedCalculusDailyRun{} = run ->
            with {:ok, answers} <- merge_speed_calculus_answers(run, synced_answers) do
              cond do
                manually_paused?(run) ->
                  sync_speed_calculus_answers(run, answers)
                  build_speed_calculus_state(user_id, date)

                paused_countdown_active?(run) ->
                  Repo.rollback(:run_is_paused)

                true ->
                  now = now_utc()

                  SpeedCalculusDailyRun
                  |> where([r], r.id == ^run.id)
                  |> Repo.update_all(
                    set: [answers: answers, manual_paused_at: now, pause_expires_at: nil]
                  )

                  build_speed_calculus_state(user_id, date)
              end
            else
              {:error, reason} -> Repo.rollback(reason)
            end
        end
      end)
      |> case do
        {:ok, payload} -> {:ok, payload}
        {:error, reason} -> {:error, reason}
      end
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc "Resume a paused run (extends pause window 5 seconds)."
  def resume_speed_calculus(user_id) do
    date = current_reset_date_for_user(user_id)
    settle_expired_runs(user_id, date)

    active_run =
      SpeedCalculusDailyRun
      |> where([r], r.user_id == ^user_id and r.date == ^date and r.status == "in_progress")
      |> Repo.one()

    if active_run do
      now = now_utc()

      unless paused_countdown_active?(active_run) do
        pause_expires_at =
          DateTime.add(now, SpeedCalculusEngine.resume_pause_seconds(), :second)

        play_deadline_at =
          active_run.play_deadline_at
          |> add_manual_pause_extension(active_run.manual_paused_at, now)
          |> DateTime.add(SpeedCalculusEngine.resume_pause_seconds(), :second)

        SpeedCalculusDailyRun
        |> where([r], r.id == ^active_run.id)
        |> Repo.update_all(
          set: [
            pause_expires_at: pause_expires_at,
            play_deadline_at: play_deadline_at,
            manual_paused_at: nil
          ]
        )
      end
    end

    {:ok, build_speed_calculus_state(user_id, date)}
  end

  @doc "Finish the active run: score it, update quest, return result."
  def finish_speed_calculus(user_id, run_id, expected_quest_version \\ nil, synced_answers \\ nil) do
    date = current_reset_date_for_user(user_id)

    with {:ok, run} <- get_visible_speed_run(user_id, run_id),
         :ok <- validate_speed_calculus_version(user_id, date, expected_quest_version) do
      cond do
        is_nil(run) ->
          {:error, :run_not_found}

        run.status != "in_progress" ->
          {:error, :run_not_active}

        true ->
          with {:ok, answers} <- merge_speed_calculus_answers(run, synced_answers) do
            %{correct_answers: correct_answers} =
              SpeedCalculusEngine.evaluate_answers(run.seed, answers)

            reward = SpeedCalculusEngine.calculate_reward(correct_answers)
            now = now_utc()

            SpeedCalculusDailyRun
            |> where([r], r.id == ^run.id)
            |> Repo.update_all(
              set: [
                answers: answers,
                status: "completed",
                score: correct_answers,
                reward: reward,
                finished_at: now
              ]
            )

            sync_speed_calculus_quest_from_runs(user_id, run.date)
            state = build_speed_calculus_state(user_id, run.date)
            QuestResults.sync_safely(user_id, run.date, {:speed_calculus, run.id})

            {:ok, Map.merge(state, %{correctAnswers: correct_answers, reward: reward})}
          end
      end
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc "Settles globally expired ranked runs for quest-owned background reconciliation."
  @spec settle_expired_speed_calculus_runs_since(Date.t(), DateTime.t()) ::
          {non_neg_integer(), nil}
  def settle_expired_speed_calculus_runs_since(%Date{} = since, %DateTime{} = now \\ now_utc()) do
    expiration_cutoff =
      DateTime.add(now, -SpeedCalculusEngine.finish_grace_seconds(), :second)

    SpeedCalculusDailyRun
    |> where(
      [run],
      run.date >= ^since and run.status == "in_progress" and is_nil(run.manual_paused_at) and
        run.play_deadline_at < ^expiration_cutoff
    )
    |> Repo.update_all(set: [status: "abandoned", score: 0, reward: 0, finished_at: now])
  end

  @doc "Cash out: lock the speed calculus quest early with the best run's reward."
  def cashout_speed_calculus(user_id) do
    date = current_reset_date_for_user(user_id)
    settle_expired_runs(user_id, date)

    quest =
      DailyQuest
      |> where(
        [q],
        q.user_id == ^user_id and q.date == ^date and q.quest_type == "speed_calculus_daily"
      )
      |> Repo.one()

    cond do
      is_nil(quest) ->
        {:error, :quest_not_found}

      quest.completed ->
        {:error, :quest_already_locked}

      quest.claimed ->
        {:error, :quest_already_claimed}

      true ->
        runs =
          SpeedCalculusDailyRun
          |> where([r], r.user_id == ^user_id and r.date == ^date)
          |> order_by([r], asc: r.run_number)
          |> Repo.all()

        active_run = Enum.find(runs, &(&1.status == "in_progress"))
        settled_runs = Enum.filter(runs, &(&1.status != "in_progress"))

        cond do
          active_run ->
            {:error, :active_run_in_progress}

          settled_runs == [] ->
            {:error, :no_runs_completed}

          true ->
            latest = List.last(settled_runs)
            reward = SpeedCalculusEngine.calculate_reward(latest.score || 0)
            now = now_utc()

            DailyQuest
            |> where([q], q.id == ^quest.id)
            |> Repo.update_all(
              set: [
                progress: length(settled_runs),
                target: SpeedCalculusEngine.max_runs(),
                reward: reward,
                completed: true,
                completed_at: quest.completed_at || now,
                updated_at: now
              ]
            )

            {:ok, build_speed_calculus_state(user_id, date)}
        end
    end
  end

  # ── Private Helpers ──────────────────────────────────────────────────────────

  defp get_daily_word(date, locale) do
    candidates = get_wordle_candidates(locale)

    if candidates == [] do
      nil
    else
      WordleEngine.select_word_for_date(candidates, date)
    end
  end

  defp is_valid_wordle_word?(word, locale) do
    MapSet.member?(get_wordle_words_set(locale), word)
  end

  defp load_wordle_attempts(user_id, date, locale) do
    WordleDailyAttempt
    |> where([a], a.user_id == ^user_id and a.date == ^date and a.locale == ^locale)
    |> order_by([a], asc: a.attempt)
    |> Repo.all()
  end

  defp build_wordle_summary(user_id, date) do
    attempts =
      WordleDailyAttempt
      |> where([a], a.user_id == ^user_id and a.date == ^date)
      |> order_by([a], asc: a.attempt)
      |> Repo.all()

    attempts_by_locale = Enum.group_by(attempts, & &1.locale)

    by_locale =
      Map.new(@wordle_locales, fn locale ->
        locale_attempts = Map.get(attempts_by_locale, locale, [])
        count = length(locale_attempts)

        solved_attempt =
          locale_attempts
          |> Enum.find(& &1.solved)
          |> case do
            nil -> nil
            attempt -> attempt.attempt
          end

        attempts_used =
          cond do
            not is_nil(solved_attempt) -> solved_attempt
            count > 0 -> count
            true -> nil
          end

        {locale,
         %{
           count: count,
           solved: not is_nil(solved_attempt),
           exhausted: count >= @wordle_max_attempts,
           attemptsUsed: attempts_used
         }}
      end)

    %{byLocale: by_locale}
  end

  defp delete_daily_quests_for_reset(user_id, date, nil) do
    DailyQuest
    |> where([q], q.user_id == ^user_id and q.date == ^date)
    |> Repo.delete_all()
  end

  defp delete_daily_quests_for_reset(user_id, date, quest_type) do
    DailyQuest
    |> where([q], q.user_id == ^user_id and q.date == ^date and q.quest_type == ^quest_type)
    |> Repo.delete_all()
  end

  defp delete_wordle_attempts_for_reset(_user_id, _date, quest_type)
       when quest_type not in [nil, "wordle_daily_fr", "wordle_daily_en"] do
    {0, nil}
  end

  defp delete_wordle_attempts_for_reset(user_id, date, nil) do
    WordleDailyAttempt
    |> where([a], a.user_id == ^user_id and a.date == ^date)
    |> Repo.delete_all()
  end

  defp delete_wordle_attempts_for_reset(user_id, date, quest_type) do
    locale = wordle_locale_for_quest_type(quest_type)

    WordleDailyAttempt
    |> where([a], a.user_id == ^user_id and a.date == ^date and a.locale == ^locale)
    |> Repo.delete_all()
  end

  defp delete_speed_runs_for_reset(_user_id, _date, quest_type)
       when quest_type not in [nil, "speed_calculus_daily"] do
    {0, nil}
  end

  defp delete_speed_runs_for_reset(user_id, date, _quest_type) do
    SpeedCalculusDailyRun
    |> where([r], r.user_id == ^user_id and r.date == ^date)
    |> Repo.delete_all()
  end

  defp delete_perfect_timing_attempts_for_reset(_user_id, _date, quest_type)
       when quest_type not in [nil, "perfect_timing_daily"] do
    {0, nil}
  end

  defp delete_perfect_timing_attempts_for_reset(user_id, date, _quest_type) do
    PerfectTimingAttempt
    |> where([a], a.user_id == ^user_id and a.date == ^date)
    |> Repo.delete_all()
  end

  defp recover_previous_perfect_timing_attempts(user_id, current_date, timezone) do
    PerfectTimingAttempt
    |> where(
      [attempt],
      attempt.user_id == ^user_id and attempt.date < ^current_date and
        attempt.status == "started"
    )
    |> select([attempt], attempt.date)
    |> distinct(true)
    |> Repo.all()
    |> Enum.each(fn date ->
      _ = PerfectTiming.state(user_id, date, timezone)
    end)
  end

  defp delete_daily_numbers_attempts_for_reset(_user_id, _date, quest_type)
       when quest_type not in [
              nil,
              "daily_numbers_1_5",
              "daily_numbers_2_4",
              "daily_numbers_3_3"
            ] do
    {0, nil}
  end

  defp delete_daily_numbers_attempts_for_reset(user_id, date, nil) do
    result =
      DailyNumbersDailyAttempt
      |> where([a], a.user_id == ^user_id and a.date == ^date)
      |> Repo.delete_all()

    DailyNumbersSolutionHunt.delete_user_discoveries(user_id, date)
    result
  end

  defp delete_daily_numbers_attempts_for_reset(user_id, date, quest_type) do
    mode = daily_numbers_mode_for_quest_type(quest_type)

    result =
      DailyNumbersDailyAttempt
      |> where(
        [a],
        a.user_id == ^user_id and a.date == ^date and a.mode == ^mode
      )
      |> Repo.delete_all()

    DailyNumbersSolutionHunt.delete_user_discoveries(user_id, date, mode)
    result
  end

  defp maybe_set_reset_actor(_user_id, _date, _quest_type, nil), do: {0, nil}

  defp maybe_set_reset_actor(user_id, date, nil, admin_id) do
    DailyQuest
    |> where([q], q.user_id == ^user_id and q.date == ^date)
    |> Repo.update_all(set: [reset_by_user_id: admin_id, updated_at: now_utc()])
  end

  defp maybe_set_reset_actor(user_id, date, quest_type, admin_id) do
    DailyQuest
    |> where([q], q.user_id == ^user_id and q.date == ^date and q.quest_type == ^quest_type)
    |> Repo.update_all(set: [reset_by_user_id: admin_id, updated_at: now_utc()])
  end

  defp broadcast_quest_reset(user_id, payload) do
    Phoenix.PubSub.broadcast(PubSub, "quests:#{user_id}", {:quest_reset, payload})
  end

  defp admin_reset_name(nil), do: nil

  defp admin_reset_name(admin_id) do
    case Repo.get(User, admin_id) do
      %User{} = user -> user.display_name || user.email
      nil -> nil
    end
  end

  defp validate_speed_calculus_version(_user_id, _date, nil), do: :ok

  defp validate_speed_calculus_version(user_id, date, expected_quest_version) do
    quest = get_daily_quest(user_id, date, "speed_calculus_daily")

    if quest && quest.id == expected_quest_version do
      :ok
    else
      {:error, :speed_calculus_reset}
    end
  end

  defp get_visible_speed_run(user_id, run_id) do
    case Repo.get(SpeedCalculusDailyRun, run_id) do
      %SpeedCalculusDailyRun{user_id: ^user_id} = run -> {:ok, run}
      %SpeedCalculusDailyRun{} -> {:error, :run_not_found}
      nil -> {:ok, nil}
    end
  end

  defp merge_speed_calculus_answers(run, nil), do: {:ok, run.answers || []}

  defp merge_speed_calculus_answers(run, answers) when is_list(answers) do
    question_count = run.seed |> SpeedCalculusEngine.build_questions() |> length()

    cond do
      length(answers) > question_count ->
        {:error, :invalid_answers}

      length(answers) >= length(run.answers || []) ->
        {:ok, answers}

      true ->
        {:ok, run.answers || []}
    end
  end

  defp merge_speed_calculus_answers(_run, _answers), do: {:error, :invalid_answers}

  defp sync_speed_calculus_answers(run, answers) do
    SpeedCalculusDailyRun
    |> where([r], r.id == ^run.id)
    |> Repo.update_all(set: [answers: answers])
  end

  defp validate_wordle_version(_user_id, _date, _locale, nil), do: :ok

  defp validate_wordle_version(user_id, date, locale, expected_quest_version) do
    quest = get_daily_quest(user_id, date, wordle_quest_type(locale))

    if quest && quest.id == expected_quest_version do
      :ok
    else
      {:error, :wordle_reset}
    end
  end

  defp validate_daily_numbers_version(_user_id, _date, _mode, nil), do: :ok

  defp validate_daily_numbers_version(user_id, date, mode, expected_quest_version) do
    quest = get_daily_quest(user_id, date, daily_numbers_quest_type(mode))

    if quest && quest.id == expected_quest_version do
      :ok
    else
      {:error, :daily_numbers_reset}
    end
  end

  defp validate_daily_numbers_date(_date, nil), do: :ok

  defp validate_daily_numbers_date(date, expected_date_key) do
    if Date.to_iso8601(date) == expected_date_key do
      :ok
    else
      {:error, :daily_numbers_reset}
    end
  end

  defp get_daily_quest(user_id, date, quest_type) do
    DailyQuest
    |> where([q], q.user_id == ^user_id and q.date == ^date and q.quest_type == ^quest_type)
    |> Repo.one()
  end

  defp maybe_reset_by_name(nil), do: nil

  defp maybe_reset_by_name(%DailyQuest{} = quest) do
    reset_by_name(quest)
  end

  defp maybe_reset_by_name(_quest), do: nil

  defp reset_mode(nil), do: "all"
  defp reset_mode(_quest_type), do: "single"

  defp reset_by_name(%DailyQuest{reset_by_user_id: nil}), do: nil

  defp reset_by_name(%DailyQuest{reset_by_user_id: user_id}) do
    case Repo.get(User, user_id) do
      %User{} = user -> user.display_name || user.email
      nil -> nil
    end
  end

  defp reset_by_name(_quest), do: nil

  defp complete_wordle_quest(user_id, date, locale) do
    now = now_utc()
    quest_type = wordle_quest_type(locale)
    wordle_def = Enum.find(@quest_definitions, &(&1.quest_type == quest_type))
    existing_quest = get_daily_quest(user_id, date, quest_type)

    %DailyQuest{}
    |> DailyQuest.changeset(%{
      user_id: user_id,
      date: date,
      quest_type: quest_type,
      target: wordle_def.target,
      reward: wordle_def.reward,
      progress: wordle_def.target,
      completed: true,
      completed_at: now
    })
    |> Repo.insert(
      on_conflict: [set: [completed: true, completed_at: now, progress: 1, updated_at: now]],
      conflict_target: [:user_id, :date, :quest_type]
    )

    existing_quest == nil || !existing_quest.completed
  end

  defp wordle_quest_type("fr"), do: "wordle_daily_fr"
  defp wordle_quest_type("en"), do: "wordle_daily_en"

  defp wordle_locale_for_quest_type("wordle_daily_fr"), do: "fr"
  defp wordle_locale_for_quest_type("wordle_daily_en"), do: "en"
  defp wordle_locale_for_quest_type(_quest_type), do: nil

  defp settle_expired_runs(user_id, date) do
    now = now_utc()

    expiration_cutoff =
      DateTime.add(now, -SpeedCalculusEngine.finish_grace_seconds(), :second)

    expired_query =
      SpeedCalculusDailyRun
      |> where(
        [r],
        r.user_id == ^user_id and r.date == ^date and r.status == "in_progress" and
          is_nil(r.manual_paused_at) and r.play_deadline_at < ^expiration_cutoff
      )

    expired_run_ids = expired_query |> select([r], r.id) |> Repo.all()

    expired_query
    |> Repo.update_all(set: [status: "abandoned", score: 0, reward: 0, finished_at: now])

    Enum.each(expired_run_ids, fn run_id ->
      QuestResults.sync_safely(user_id, date, {:speed_calculus, run_id})
    end)

    :ok
  end

  defp sync_speed_calculus_quest_from_runs(user_id, date) do
    now = now_utc()

    runs =
      SpeedCalculusDailyRun
      |> where([r], r.user_id == ^user_id and r.date == ^date)
      |> order_by([r], asc: r.run_number)
      |> Repo.all()

    settled_runs = Enum.filter(runs, &(&1.status != "in_progress"))
    latest_settled = List.last(settled_runs)
    locked = length(settled_runs) >= SpeedCalculusEngine.max_runs()

    reward =
      SpeedCalculusEngine.calculate_reward(
        if(latest_settled, do: latest_settled.score || 0, else: 0)
      )

    DailyQuest
    |> where(
      [q],
      q.user_id == ^user_id and q.date == ^date and q.quest_type == "speed_calculus_daily"
    )
    |> Repo.update_all(
      set: [
        progress: length(settled_runs),
        target: SpeedCalculusEngine.max_runs(),
        reward: reward,
        completed: locked,
        completed_at: if(locked, do: now, else: nil),
        updated_at: now
      ]
    )

    :ok
  end

  defp build_speed_calculus_state(user_id, date) do
    {{quest, runs}, load_duration_ms} =
      timed(fn ->
        {get_daily_quest(user_id, date, "speed_calculus_daily"),
         load_speed_calculus_runs(user_id, date)}
      end)

    summary = build_speed_calculus_summary_from_data(date, quest, runs)
    settled_runs = Enum.filter(runs, &(&1.status != "in_progress"))
    active_run = Enum.find(runs, &(&1.status == "in_progress"))

    {active_run_payload, active_duration_ms} =
      timed(fn -> if active_run, do: serialize_active_run(active_run), else: nil end)

    {history_payload, history_duration_ms} =
      timed(fn -> Enum.map(settled_runs, &serialize_settled_run/1) end)

    total_duration_ms = load_duration_ms + active_duration_ms + history_duration_ms

    maybe_log_slow(
      total_duration_ms,
      @slow_speed_state_ms,
      "speed_calculus_state_slow",
      user_id: user_id,
      active_run: not is_nil(active_run),
      settled_runs: length(settled_runs),
      load_ms: load_duration_ms,
      active_ms: active_duration_ms,
      history_ms: history_duration_ms
    )

    Map.merge(summary, %{activeRun: active_run_payload, history: history_payload})
  end

  defp build_speed_calculus_answer_response(user_id, run, answers) do
    {quest, quest_duration_ms} =
      timed(fn -> get_daily_quest(user_id, run.date, "speed_calculus_daily") end)

    {active_run_payload, active_duration_ms} =
      timed(fn -> serialize_answer_active_run(run, answers) end)

    total_duration_ms = quest_duration_ms + active_duration_ms

    maybe_log_slow(
      total_duration_ms,
      @slow_speed_state_ms,
      "speed_calculus_answer_slow",
      user_id: user_id,
      run_id: run.id,
      question_index: active_run_payload.questionIndex,
      quest_ms: quest_duration_ms,
      active_ms: active_duration_ms
    )

    %{
      questVersion: if(quest, do: quest.id, else: nil),
      activeRun: active_run_payload
    }
  end

  defp build_speed_calculus_summary(user_id, date) do
    quest = get_daily_quest(user_id, date, "speed_calculus_daily")
    runs = load_speed_calculus_runs(user_id, date)
    build_speed_calculus_summary_from_data(date, quest, runs)
  end

  defp build_speed_calculus_summary_from_data(date, quest, runs) do
    settled_runs = Enum.filter(runs, &(&1.status != "in_progress"))
    active_run = Enum.find(runs, &(&1.status == "in_progress"))
    latest_settled = List.last(settled_runs)

    locked =
      if(quest, do: quest.completed, else: length(settled_runs) >= SpeedCalculusEngine.max_runs())

    claimed = if(quest, do: quest.claimed, else: false)
    runs_used = length(settled_runs)
    latest_score = if(latest_settled, do: latest_settled.score || 0, else: 0)
    reward_preview = SpeedCalculusEngine.calculate_reward(latest_score)

    %{
      date: Date.to_iso8601(date),
      questVersion: if(quest, do: quest.id, else: nil),
      resetByName: maybe_reset_by_name(quest),
      runsUsed: runs_used,
      maxRuns: SpeedCalculusEngine.max_runs(),
      latestScore: latest_score,
      rewardPreview: reward_preview,
      locked: locked,
      claimed: claimed,
      completed: locked,
      canCashOut: !locked && !claimed && is_nil(active_run) && runs_used > 0,
      canStartRun:
        !locked && !claimed && is_nil(active_run) && runs_used < SpeedCalculusEngine.max_runs(),
      rewardPerAnswer: SpeedCalculusEngine.reward_per_answer(),
      runDurationSeconds: SpeedCalculusEngine.run_duration_seconds()
    }
  end

  defp load_speed_calculus_runs(user_id, date) do
    SpeedCalculusDailyRun
    |> where([r], r.user_id == ^user_id and r.date == ^date)
    |> order_by([r], asc: r.run_number)
    |> Repo.all()
  end

  defp build_daily_numbers_state(user_id, date, mode) do
    {{quest, attempt, puzzle}, duration_ms} =
      timed(fn ->
        {
          get_daily_quest(user_id, date, daily_numbers_quest_type(mode)),
          get_daily_numbers_attempt(user_id, date, mode),
          DailyNumbersEngine.generate_puzzle(mode, date)
        }
      end)

    {:ok, puzzle_payload} = puzzle

    maybe_log_slow(
      duration_ms,
      @slow_daily_numbers_ms,
      "daily_numbers_state_slow",
      user_id: user_id,
      mode: mode
    )

    %{
      mode: mode,
      date: Date.to_iso8601(date),
      resetTimezone: reset_timezone_for_user(user_id),
      target: puzzle_payload.target,
      numbers: puzzle_payload.numbers,
      generationAttempt: puzzle_payload.generationAttempt,
      bestValue: puzzle_payload.bestValue,
      bestDistance: puzzle_payload.distance,
      questVersion: if(quest, do: quest.id, else: nil),
      resetByName: maybe_reset_by_name(quest),
      reward: if(quest, do: quest.reward, else: 0),
      claimed: if(quest, do: quest.claimed, else: false),
      completed: if(quest, do: quest.completed, else: false),
      submitted: not is_nil(attempt),
      submission: build_daily_numbers_submission_payload(attempt, puzzle_payload),
      solutionHunt:
        build_daily_numbers_solution_hunt_payload(
          user_id,
          date,
          mode,
          quest,
          attempt,
          puzzle_payload
        )
    }
  end

  defp build_daily_numbers_solution_hunt_payload(
         user_id,
         date,
         mode,
         %DailyQuest{completed: true},
         %DailyNumbersDailyAttempt{completed: true} = attempt,
         puzzle
       ) do
    with {:ok, solution_set} <-
           DailyNumbersSolutionHunt.ensure_solution_set(date, mode, puzzle),
         :ok <-
           maybe_register_ranked_daily_numbers_solution(user_id, solution_set, attempt, puzzle) do
      user_id
      |> DailyNumbersSolutionHunt.progress(solution_set)
      |> Map.put(:available, true)
    else
      {:error, reason} ->
        Logger.error("daily numbers solution hunt state unavailable",
          user_id: user_id,
          date: Date.to_iso8601(date),
          mode: mode,
          reason: inspect(reason)
        )

        nil
    end
  end

  defp build_daily_numbers_solution_hunt_payload(
         _user_id,
         _date,
         _mode,
         _quest,
         _attempt,
         _puzzle
       ),
       do: nil

  defp maybe_register_ranked_daily_numbers_solution(
         user_id,
         solution_set,
         %DailyNumbersDailyAttempt{exact: true} = attempt,
         puzzle
       ) do
    with {:ok, submission} <-
           DailyNumbersEngine.validate_submission(puzzle, attempt.submitted_steps),
         true <- submission.exact || {:error, :ranked_solution_not_exact},
         {:ok, _result} <-
           DailyNumbersSolutionHunt.record_solution(
             user_id,
             solution_set,
             submission.canonicalKey,
             submission.steps
           ) do
      :ok
    end
  end

  defp maybe_register_ranked_daily_numbers_solution(
         _user_id,
         _solution_set,
         %DailyNumbersDailyAttempt{},
         _puzzle
       ),
       do: :ok

  defp build_daily_numbers_submission_payload(nil, _puzzle), do: nil

  defp build_daily_numbers_submission_payload(%DailyNumbersDailyAttempt{} = attempt, puzzle) do
    %{
      finalValue: attempt.final_value,
      defaultDistance: puzzle.distance,
      distance: attempt.distance,
      exact: attempt.exact,
      score: attempt.score,
      completed: attempt.completed,
      elapsedMs: attempt.elapsed_ms,
      steps: attempt.submitted_steps,
      officialSolutionUnlocked: true,
      officialSolutionSteps: puzzle.solution
    }
  end

  defp build_daily_numbers_submission_payload(%DailyNumbersArchiveAttempt{} = attempt, puzzle) do
    %{
      finalValue: attempt.final_value,
      defaultDistance: puzzle.distance,
      distance: attempt.distance,
      exact: attempt.exact,
      score: attempt.score,
      completed: attempt.completed,
      elapsedMs: attempt.elapsed_ms,
      steps: attempt.submitted_steps,
      officialSolutionUnlocked: true,
      officialSolutionSteps: puzzle.solution
    }
  end

  defp build_daily_numbers_archive_state(user_id, date, mode) do
    {{attempt, puzzle}, duration_ms} =
      timed(fn ->
        archive_attempt = get_daily_numbers_archive_attempt(user_id, date, mode)
        daily_attempt = get_daily_numbers_attempt(user_id, date, mode)

        {
          archive_attempt || daily_attempt,
          DailyNumbersEngine.generate_puzzle(mode, date)
        }
      end)

    {:ok, puzzle_payload} = puzzle

    maybe_log_slow(
      duration_ms,
      @slow_daily_numbers_ms,
      "daily_numbers_archive_state_slow",
      user_id: user_id,
      mode: mode
    )

    %{
      archive: true,
      mode: mode,
      date: Date.to_iso8601(date),
      resetTimezone: reset_timezone_for_user(user_id),
      target: puzzle_payload.target,
      numbers: puzzle_payload.numbers,
      generationAttempt: puzzle_payload.generationAttempt,
      bestValue: puzzle_payload.bestValue,
      bestDistance: puzzle_payload.distance,
      questVersion: nil,
      resetByName: nil,
      reward: 0,
      claimed: false,
      completed: if(attempt, do: attempt.completed, else: false),
      submitted: not is_nil(attempt),
      status: daily_numbers_archive_status(attempt),
      submission: build_daily_numbers_submission_payload(attempt, puzzle_payload),
      officialSolutionSteps: puzzle_payload.solution
    }
  end

  defp load_daily_numbers_attempts(user_id, date) do
    DailyNumbersDailyAttempt
    |> where([a], a.user_id == ^user_id and a.date == ^date)
    |> Repo.all()
    |> Map.new(&{&1.mode, &1})
  end

  defp get_daily_numbers_attempt(user_id, date, mode) do
    DailyNumbersDailyAttempt
    |> where([a], a.user_id == ^user_id and a.date == ^date and a.mode == ^mode)
    |> Repo.one()
  end

  defp get_daily_numbers_archive_attempt(user_id, date, mode) do
    DailyNumbersArchiveAttempt
    |> where([a], a.user_id == ^user_id and a.date == ^date and a.mode == ^mode)
    |> Repo.one()
  end

  defp upsert_daily_numbers_archive_attempt(user_id, date, mode, attrs) do
    archive_attempt = get_daily_numbers_archive_attempt(user_id, date, mode)
    daily_attempt = get_daily_numbers_attempt(user_id, date, mode)

    case archive_attempt || daily_attempt do
      nil ->
        %DailyNumbersArchiveAttempt{}
        |> DailyNumbersArchiveAttempt.changeset(attrs)
        |> Repo.insert()

      %DailyNumbersArchiveAttempt{} = current ->
        if daily_numbers_archive_submission_better?(attrs, current) do
          current
          |> DailyNumbersArchiveAttempt.changeset(attrs)
          |> Repo.update()
        else
          {:ok, current}
        end

      %DailyNumbersDailyAttempt{} = current ->
        if daily_numbers_archive_submission_better?(attrs, current) do
          %DailyNumbersArchiveAttempt{}
          |> DailyNumbersArchiveAttempt.changeset(attrs)
          |> Repo.insert()
        else
          {:ok, current}
        end
    end
  end

  defp daily_numbers_archive_submission_better?(_attrs, %{exact: true}),
    do: false

  defp daily_numbers_archive_submission_better?(%{exact: true}, _current), do: true

  defp daily_numbers_archive_submission_better?(attrs, current) do
    {archive_result_rank(attrs), attrs.elapsed_ms} <
      {archive_result_rank(current), current.elapsed_ms}
  end

  defp archive_result_rank(%{distance: distance, score: score}) do
    {distance, -score}
  end

  defp build_daily_numbers_archive_mode_summary(nil, mode) do
    %{
      mode: mode,
      status: "unplayed",
      finalValue: nil,
      distance: nil,
      score: nil,
      exact: false,
      completed: false,
      elapsedMs: nil
    }
  end

  defp build_daily_numbers_archive_mode_summary(%DailyNumbersArchiveAttempt{} = attempt, mode) do
    build_daily_numbers_archive_attempt_summary(attempt, mode)
  end

  defp build_daily_numbers_archive_mode_summary(%DailyNumbersDailyAttempt{} = attempt, mode) do
    build_daily_numbers_archive_attempt_summary(attempt, mode)
  end

  defp build_daily_numbers_archive_attempt_summary(attempt, mode) do
    %{
      mode: mode,
      status: daily_numbers_archive_status(attempt),
      finalValue: attempt.final_value,
      distance: attempt.distance,
      score: attempt.score,
      exact: attempt.exact,
      completed: attempt.completed,
      elapsedMs: attempt.elapsed_ms
    }
  end

  defp daily_numbers_archive_status(nil), do: "unplayed"
  defp daily_numbers_archive_status(%{exact: true}), do: "exact"
  defp daily_numbers_archive_status(%{completed: true}), do: "solved"
  defp daily_numbers_archive_status(%{}), do: "tried"

  defp parse_daily_numbers_archive_date(date_key) when is_binary(date_key) do
    case Date.from_iso8601(date_key) do
      {:ok, date} -> {:ok, date}
      {:error, _reason} -> {:error, :invalid_daily_numbers_archive_date}
    end
  end

  defp parse_daily_numbers_archive_date(_date_key),
    do: {:error, :invalid_daily_numbers_archive_date}

  defp validate_daily_numbers_archive_date(user_id, date) do
    today = current_reset_date_for_user(user_id)
    window_start = Date.add(today, -@daily_numbers_archive_days)

    earliest =
      if Date.compare(window_start, @daily_numbers_launch_date) == :lt do
        @daily_numbers_launch_date
      else
        window_start
      end

    cond do
      Date.compare(date, today) != :lt ->
        {:error, :daily_numbers_archive_today_or_future}

      Date.compare(date, earliest) == :lt ->
        {:error, :daily_numbers_archive_out_of_range}

      true ->
        :ok
    end
  end

  defp normalize_daily_numbers_mode(mode) when is_binary(mode) do
    normalized =
      mode
      |> String.trim()
      |> String.downcase()
      |> daily_numbers_mode_alias()

    if DailyNumbersEngine.valid_mode?(normalized) do
      {:ok, normalized}
    else
      {:error, :invalid_daily_numbers_mode}
    end
  end

  defp normalize_daily_numbers_mode(_mode), do: {:error, :invalid_daily_numbers_mode}

  defp daily_numbers_modes, do: ["1-5", "2-4", "3-3"]

  defp daily_numbers_mode_alias("classic"), do: "1-5"
  defp daily_numbers_mode_alias("1_5"), do: "1-5"
  defp daily_numbers_mode_alias("balanced"), do: "2-4"
  defp daily_numbers_mode_alias("2_4"), do: "2-4"
  defp daily_numbers_mode_alias("expert"), do: "3-3"
  defp daily_numbers_mode_alias("3_3"), do: "3-3"
  defp daily_numbers_mode_alias(mode), do: mode

  defp daily_numbers_quest_type("1-5"), do: "daily_numbers_1_5"
  defp daily_numbers_quest_type("2-4"), do: "daily_numbers_2_4"
  defp daily_numbers_quest_type("3-3"), do: "daily_numbers_3_3"

  defp daily_numbers_mode_for_quest_type("daily_numbers_1_5"), do: "1-5"
  defp daily_numbers_mode_for_quest_type("daily_numbers_2_4"), do: "2-4"
  defp daily_numbers_mode_for_quest_type("daily_numbers_3_3"), do: "3-3"
  defp daily_numbers_mode_for_quest_type(_quest_type), do: nil

  defp serialize_answer_active_run(run, answers) do
    questions = SpeedCalculusEngine.build_questions(run.seed)

    %{correct_answers: correct_answers} =
      SpeedCalculusEngine.evaluate_answers_for_questions(questions, answers)

    %{remaining_seconds: remaining_seconds, pause_remaining_seconds: pause_remaining_seconds} =
      speed_calculus_time_snapshot(run)

    %{
      runId: run.id,
      runNumber: run.run_number,
      questionIndex: length(answers),
      correctAnswers: correct_answers,
      remainingSeconds: remaining_seconds,
      pauseRemainingSeconds: pause_remaining_seconds,
      isManuallyPaused: manually_paused?(run)
    }
  end

  defp serialize_active_run(run) do
    questions = SpeedCalculusEngine.build_questions(run.seed)

    %{correct_answers: correct_answers} =
      SpeedCalculusEngine.evaluate_answers_for_questions(questions, run.answers)

    %{remaining_seconds: remaining_seconds, pause_remaining_seconds: pause_remaining_seconds} =
      speed_calculus_time_snapshot(run)

    %{
      runId: run.id,
      runNumber: run.run_number,
      seed: run.seed,
      questionIndex: length(run.answers),
      questions: SpeedCalculusEngine.to_public_questions(questions),
      answers: run.answers,
      correctAnswers: correct_answers,
      remainingSeconds: remaining_seconds,
      pauseRemainingSeconds: pause_remaining_seconds,
      isManuallyPaused: manually_paused?(run),
      durationSeconds: SpeedCalculusEngine.run_duration_seconds(),
      pauseExpiresAt:
        if(run.pause_expires_at, do: DateTime.to_iso8601(run.pause_expires_at), else: nil),
      startedAt: DateTime.to_iso8601(run.started_at)
    }
  end

  defp serialize_settled_run(run) do
    questions = SpeedCalculusEngine.build_questions(run.seed)

    %{correct_answers: correct_answers, total_answered: total_answered} =
      SpeedCalculusEngine.evaluate_answers_for_questions(questions, run.answers)

    %{
      runId: run.id,
      runNumber: run.run_number,
      status: run.status,
      score: run.score || 0,
      reward: run.reward || 0,
      totalAnswered: total_answered,
      correctAnswers: correct_answers,
      history: SpeedCalculusEngine.build_run_history_for_questions(questions, run.answers)
    }
  end

  defp speed_calculus_time_snapshot(run) do
    now = DateTime.utc_now()
    now_ms = DateTime.to_unix(now, :millisecond)

    pause_remaining_seconds =
      if run.pause_expires_at do
        pause_ms = DateTime.to_unix(run.pause_expires_at, :millisecond)
        max(0, Float.ceil((pause_ms - now_ms) / 1000) |> trunc())
      else
        0
      end

    effective_now =
      cond do
        manually_paused?(run) -> run.manual_paused_at
        pause_remaining_seconds > 0 -> run.pause_expires_at
        true -> now
      end

    %{
      remaining_seconds: max(0, DateTime.diff(run.play_deadline_at, effective_now, :second)),
      pause_remaining_seconds: pause_remaining_seconds
    }
  end

  defp build_quest_entry(
         quest,
         def,
         wordle_summary,
         speed_state,
         perfect_timing_summary,
         daily_numbers_attempts
       ) do
    daily_numbers_attempt =
      if String.starts_with?(quest.quest_type, "daily_numbers_") do
        Map.get(daily_numbers_attempts, daily_numbers_mode_for_quest_type(quest.quest_type))
      else
        nil
      end

    base = %{
      id: quest.id,
      version: quest.id,
      type: quest.quest_type,
      title: def.quest_type,
      description: "#{def.quest_type}_desc",
      target:
        if(quest.quest_type == "speed_calculus_daily",
          do: speed_state.maxRuns,
          else: quest.target
        ),
      progress:
        if(quest.quest_type == "speed_calculus_daily",
          do: speed_state.runsUsed,
          else: quest.progress
        ),
      completed: quest.completed,
      claimed: quest.claimed,
      reward:
        if(quest.quest_type == "speed_calculus_daily",
          do: speed_state.rewardPreview,
          else: quest.reward
        ),
      icon: def.icon,
      actionPath: quest_action_path(quest.quest_type),
      resetByName: reset_by_name(quest),
      failed:
        (wordle_quest?(quest.quest_type) && !quest.completed &&
           wordle_locale_exhausted?(
             wordle_summary,
             wordle_locale_for_quest_type(quest.quest_type)
           )) ||
          (String.starts_with?(quest.quest_type, "daily_numbers_") && !quest.completed &&
             not is_nil(daily_numbers_attempt)) ||
          (quest.quest_type == "perfect_timing_daily" && perfect_timing_summary.failed)
    }

    case quest.quest_type do
      "wordle_daily_fr" ->
        merge_wordle_quest_entry(base, wordle_summary, "fr")

      "wordle_daily_en" ->
        merge_wordle_quest_entry(base, wordle_summary, "en")

      "speed_calculus_daily" ->
        Map.merge(base, %{
          runsUsed: speed_state.runsUsed,
          maxRuns: speed_state.maxRuns,
          latestScore: speed_state.latestScore,
          rewardPreview: speed_state.rewardPreview,
          locked: speed_state.locked
        })

      "perfect_timing_daily" ->
        Map.merge(base, perfect_timing_summary)

      "daily_numbers_1_5" ->
        merge_daily_numbers_quest_entry(base, daily_numbers_attempt, "1-5")

      "daily_numbers_2_4" ->
        merge_daily_numbers_quest_entry(base, daily_numbers_attempt, "2-4")

      "daily_numbers_3_3" ->
        merge_daily_numbers_quest_entry(base, daily_numbers_attempt, "3-3")

      _ ->
        base
    end
  end

  defp quest_action_path("wordle_daily_fr"), do: "/quests/wordle?language=fr"
  defp quest_action_path("wordle_daily_en"), do: "/quests/wordle?language=en"
  defp quest_action_path("speed_calculus_daily"), do: "/quests/speed-calculus"
  defp quest_action_path("perfect_timing_daily"), do: "/quests/perfect-timing"
  defp quest_action_path("daily_numbers_1_5"), do: "/quests/daily-numbers?mode=1-5"
  defp quest_action_path("daily_numbers_2_4"), do: "/quests/daily-numbers?mode=2-4"
  defp quest_action_path("daily_numbers_3_3"), do: "/quests/daily-numbers?mode=3-3"
  defp quest_action_path(_), do: nil

  defp quest_target(%{quest_type: "perfect_timing_daily"}, date) do
    PerfectTimingEngine.daily_target_ms(date)
  end

  defp quest_target(definition, _date), do: definition.target

  defp wordle_quest?(quest_type), do: quest_type in ["wordle_daily_fr", "wordle_daily_en"]

  defp wordle_locale_exhausted?(_wordle_summary, nil), do: false

  defp wordle_locale_exhausted?(wordle_summary, locale) do
    case Map.get(wordle_summary.byLocale, locale) do
      %{exhausted: exhausted} -> exhausted
      _ -> false
    end
  end

  defp merge_wordle_quest_entry(base, wordle_summary, locale) do
    locale_summary = Map.get(wordle_summary.byLocale, locale, %{})
    attempts_used = Map.get(locale_summary, :attemptsUsed)

    base = Map.put(base, :locale, locale)

    if is_integer(attempts_used) and attempts_used > 0 do
      Map.put(base, :attemptsUsed, attempts_used)
    else
      base
    end
  end

  defp merge_daily_numbers_quest_entry(base, nil, mode) do
    Map.merge(base, %{
      mode: mode,
      progress: 0
    })
  end

  defp merge_daily_numbers_quest_entry(base, %DailyNumbersDailyAttempt{} = attempt, mode) do
    Map.merge(base, %{
      mode: mode,
      progress: 1,
      score: attempt.score,
      distance: attempt.distance,
      finalValue: attempt.final_value,
      elapsedMs: attempt.elapsed_ms
    })
  end

  defp normalize_daily_numbers_elapsed_ms(elapsed_ms)
       when is_integer(elapsed_ms) and elapsed_ms >= 0,
       do: elapsed_ms

  defp normalize_daily_numbers_elapsed_ms(elapsed_ms) when is_binary(elapsed_ms) do
    case Integer.parse(elapsed_ms) do
      {value, ""} when value >= 0 -> value
      _ -> 0
    end
  end

  defp normalize_daily_numbers_elapsed_ms(_elapsed_ms), do: 0

  defp normalize_wordle_locale(nil), do: {:ok, @default_wordle_locale}

  defp normalize_wordle_locale(locale) when is_binary(locale) do
    normalized =
      locale
      |> String.trim()
      |> String.downcase()

    if normalized in @wordle_locales do
      {:ok, normalized}
    else
      {:error, :invalid_wordle_locale}
    end
  end

  defp normalize_wordle_locale(_locale), do: {:error, :invalid_wordle_locale}

  defp is_paused?(run) do
    manually_paused?(run) || paused_countdown_active?(run)
  end

  defp manually_paused?(run), do: run.manual_paused_at != nil

  defp paused_countdown_active?(run) do
    run.pause_expires_at != nil &&
      DateTime.compare(run.pause_expires_at, DateTime.utc_now()) == :gt
  end

  defp add_manual_pause_extension(play_deadline_at, nil, _now), do: play_deadline_at

  defp add_manual_pause_extension(play_deadline_at, manual_paused_at, now) do
    DateTime.add(play_deadline_at, DateTime.diff(now, manual_paused_at, :second), :second)
  end

  defp validate_expected_date(nil, _date), do: :ok

  defp validate_expected_date(expected_str, date) do
    case Date.from_iso8601(expected_str) do
      {:ok, expected_date} ->
        if expected_date == date, do: :ok, else: {:error, :wordle_reset}

      {:error, _} ->
        :ok
    end
  end

  defp validate_guess_format(guess) do
    if WordleEngine.valid_length_and_format?(guess) do
      :ok
    else
      {:error, :invalid_guess_format}
    end
  end

  defp validate_wordle_word(guess, locale) do
    if is_valid_wordle_word?(guess, locale) do
      :ok
    else
      {:error, :word_not_found}
    end
  end

  defp validate_not_already_solved(attempts) do
    if Enum.any?(attempts, & &1.solved) do
      {:error, :already_solved}
    else
      :ok
    end
  end

  defp validate_attempts_remaining(attempts) do
    if length(attempts) >= @wordle_max_attempts do
      {:error, :attempts_exhausted}
    else
      :ok
    end
  end

  defp validate_quest_ownership(quest, user_id) do
    if quest.user_id == user_id, do: :ok, else: {:error, :not_found}
  end

  defp validate_quest_completed(quest) do
    if quest.completed, do: :ok, else: {:error, :not_completed}
  end

  defp validate_quest_not_claimed(quest) do
    if !quest.claimed, do: :ok, else: {:error, :already_claimed}
  end

  defp timed(fun) do
    started_at = System.monotonic_time()
    result = fun.()

    duration_ms =
      System.convert_time_unit(System.monotonic_time() - started_at, :native, :millisecond)

    {result, duration_ms}
  end

  defp maybe_log_slow(duration_ms, threshold_ms, event, metadata)
       when duration_ms >= threshold_ms do
    formatted_metadata =
      metadata
      |> Enum.map(fn {key, value} -> "#{key}=#{inspect(value)}" end)
      |> Enum.join(" ")

    Logger.warning("[quests] #{event} duration_ms=#{duration_ms} #{formatted_metadata}")
  end

  defp maybe_log_slow(_duration_ms, _threshold_ms, _event, _metadata), do: :ok

  defp status_payload(user) do
    timezone = user.timezone || @reset_timezone
    can_claim = can_claim_daily?(user.last_daily_claim, timezone)

    %{
      coins: user.coins,
      canClaim: can_claim,
      timeUntilNextClaim: if(can_claim, do: 0, else: time_until_next_claim_ms(timezone)),
      dailyReward: @daily_reward,
      timezone: timezone
    }
  end

  defp conflict_payload(timezone) do
    %{
      error: "Already claimed today",
      code: "DAILY_ALREADY_CLAIMED",
      timeUntilNextClaim: time_until_next_claim_ms(timezone),
      timezone: timezone
    }
  end

  defp reset_date_for(last_claim, timezone) do
    last_claim
    |> DateTime.shift_zone!(timezone)
    |> DateTime.to_date()
  end

  defp now_in_reset_timezone(timezone) do
    DateTime.utc_now()
    |> DateTime.truncate(:second)
    |> DateTime.shift_zone!(timezone)
  end

  defp now_utc, do: DateTime.utc_now() |> DateTime.truncate(:second)
end
