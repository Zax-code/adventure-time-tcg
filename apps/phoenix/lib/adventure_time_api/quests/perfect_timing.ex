defmodule AdventureTimeApi.Quests.PerfectTiming do
  @moduledoc """
  Transactional Perfect Timing attempt state machine inside the daily quest model.
  """

  import Ecto.Query

  alias AdventureTimeApi.Accounts.User
  alias AdventureTimeApi.Quests.{DailyQuest, PerfectTimingAttempt, PerfectTimingEngine}
  alias AdventureTimeApi.Repo

  @quest_type "perfect_timing_daily"
  @max_attempts 3
  @client_elapsed_leeway_ms 1_000
  @max_client_elapsed_ms 86_400_000
  @stop_reasons ["manual", "navigation", "background"]
  @final_statuses ["kept", "auto_finalized", "failed"]

  def quest_type, do: @quest_type
  def max_attempts, do: @max_attempts

  def state(user_id, %Date{} = date, timezone, now \\ DateTime.utc_now()) do
    transact(fn ->
      quest = lock_quest(user_id, date)
      attempts = lock_attempts(user_id, date)

      case Enum.find(attempts, &(&1.status == "started")) do
        nil ->
          build_state(user_id, date, timezone, quest, attempts)

        %PerfectTimingAttempt{} = attempt ->
          settle_attempt(quest, attempt, server_elapsed_ms(attempt, now), "server_recovery", now)
          build_current_state(user_id, date, timezone)
      end
    end)
  end

  def start(user_id, %Date{} = date, timezone, date_key, quest_version, now \\ DateTime.utc_now()) do
    transact(fn ->
      quest = lock_quest(user_id, date)
      validate_request!(quest, date, date_key, quest_version)
      attempts = lock_attempts(user_id, date)

      cond do
        finalized_attempt(attempts) ->
          build_state(user_id, date, timezone, quest, attempts)

        Enum.any?(attempts, &(&1.status == "started")) ->
          build_state(user_id, date, timezone, quest, attempts)

        Enum.any?(attempts, &(&1.status == "result")) ->
          Repo.rollback(:result_awaiting_decision)

        length(attempts) >= @max_attempts ->
          Repo.rollback(:attempts_exhausted)

        true ->
          attempt_number = length(attempts) + 1

          %PerfectTimingAttempt{user_id: user_id, status: "started", reward: 0}
          |> PerfectTimingAttempt.start_changeset(%{
            date: date,
            attempt_number: attempt_number,
            target_ms: quest.target,
            started_at: normalize_now(now)
          })
          |> Repo.insert!()

          update_quest(quest, progress: attempt_number, updated_at: quest_now(now))
          build_current_state(user_id, date, timezone)
      end
    end)
  end

  def stop(
        user_id,
        %Date{} = date,
        timezone,
        attempt_id,
        elapsed_ms,
        stop_reason,
        date_key,
        quest_version,
        now \\ DateTime.utc_now()
      ) do
    transact(fn ->
      quest = lock_quest(user_id, date)
      validate_request!(quest, date, date_key, quest_version)
      validate_attempt_id!(attempt_id)

      attempt =
        PerfectTimingAttempt
        |> where([a], a.id == ^attempt_id and a.user_id == ^user_id and a.date == ^date)
        |> lock("FOR UPDATE")
        |> Repo.one()

      if is_nil(attempt) do
        Repo.rollback(:attempt_not_found)
      end

      if attempt.status == "started" do
        validate_client_elapsed!(attempt, elapsed_ms, stop_reason, now)
        settle_attempt(quest, attempt, elapsed_ms, stop_reason, now)
      end

      build_current_state(user_id, date, timezone)
    end)
  end

  def discard_result(
        user_id,
        %Date{} = date,
        timezone,
        attempt_id,
        date_key,
        quest_version
      ) do
    transact(fn ->
      quest = lock_quest(user_id, date)
      validate_request!(quest, date, date_key, quest_version)
      validate_attempt_id!(attempt_id)
      attempts = lock_attempts(user_id, date)
      attempt = Enum.find(attempts, &(&1.id == attempt_id))

      cond do
        is_nil(attempt) ->
          Repo.rollback(:attempt_not_found)

        attempt.status == "result" ->
          attempt
          |> PerfectTimingAttempt.status_changeset("discarded")
          |> Repo.update!()

        attempt.status == "discarded" ->
          :ok

        true ->
          Repo.rollback(:result_not_active)
      end

      build_current_state(user_id, date, timezone)
    end)
  end

  def keep_result(
        user_id,
        %Date{} = date,
        timezone,
        attempt_id,
        date_key,
        quest_version,
        now \\ DateTime.utc_now()
      ) do
    transact(fn ->
      quest = lock_quest(user_id, date)
      validate_request!(quest, date, date_key, quest_version)
      validate_attempt_id!(attempt_id)
      attempts = lock_attempts(user_id, date)
      attempt = Enum.find(attempts, &(&1.id == attempt_id))

      cond do
        is_nil(attempt) ->
          Repo.rollback(:attempt_not_found)

        attempt.status == "kept" ->
          :ok

        attempt.status != "result" ->
          Repo.rollback(:result_not_active)

        not PerfectTimingEngine.successful_tier?(attempt.tier) ->
          Repo.rollback(:cannot_keep_miss)

        true ->
          kept_attempt =
            attempt
            |> PerfectTimingAttempt.status_changeset("kept")
            |> Repo.update!()

          finalize_quest(quest, kept_attempt, now)
      end

      build_current_state(user_id, date, timezone)
    end)
  end

  def training_target(%Date{} = date) do
    official_target = PerfectTimingEngine.daily_target_ms(date)
    official_index = div(official_target - PerfectTimingEngine.minimum_target_ms(), 100)
    <<roll::unsigned-big-integer-size(32)>> = :crypto.strong_rand_bytes(4)
    alternative_index = rem(roll, 70)

    target_index =
      if alternative_index >= official_index, do: alternative_index + 1, else: alternative_index

    PerfectTimingEngine.minimum_target_ms() + target_index * PerfectTimingEngine.target_step_ms()
  end

  def summary(user_id, %Date{} = date) do
    attempts = load_attempts(user_id, date)
    final = finalized_attempt(attempts)

    %{
      attemptsUsed: length(attempts),
      maxAttempts: @max_attempts,
      finalized: not is_nil(final),
      finalTier: if(final, do: final.tier, else: nil),
      finalReward: if(final, do: final.reward, else: 0),
      failed: not is_nil(final) and final.tier == "miss"
    }
  end

  defp transact(fun) do
    case Repo.transaction(fun) do
      {:ok, payload} -> {:ok, payload}
      {:error, reason} -> {:error, reason}
    end
  end

  defp lock_quest(user_id, date) do
    quest =
      DailyQuest
      |> where(
        [q],
        q.user_id == ^user_id and q.date == ^date and q.quest_type == ^@quest_type
      )
      |> lock("FOR UPDATE")
      |> Repo.one()

    quest || Repo.rollback(:quest_not_found)
  end

  defp lock_attempts(user_id, date) do
    PerfectTimingAttempt
    |> where([a], a.user_id == ^user_id and a.date == ^date)
    |> order_by([a], asc: a.attempt_number)
    |> lock("FOR UPDATE")
    |> Repo.all()
  end

  defp load_attempts(user_id, date) do
    PerfectTimingAttempt
    |> where([a], a.user_id == ^user_id and a.date == ^date)
    |> order_by([a], asc: a.attempt_number)
    |> Repo.all()
  end

  defp validate_request!(quest, date, date_key, quest_version) do
    if date_key != Date.to_iso8601(date) or quest_version != quest.id do
      Repo.rollback(:perfect_timing_reset)
    end
  end

  defp validate_attempt_id!(attempt_id) do
    case Ecto.UUID.cast(attempt_id) do
      {:ok, _id} -> :ok
      :error -> Repo.rollback(:attempt_not_found)
    end
  end

  defp validate_client_elapsed!(attempt, elapsed_ms, stop_reason, now) do
    server_elapsed = server_elapsed_ms(attempt, now)

    unless stop_reason in @stop_reasons do
      Repo.rollback(:invalid_stop_reason)
    end

    unless is_integer(elapsed_ms) and elapsed_ms >= 0 and elapsed_ms <= @max_client_elapsed_ms do
      Repo.rollback(:invalid_elapsed_ms)
    end

    if elapsed_ms > server_elapsed + @client_elapsed_leeway_ms do
      Repo.rollback(:impossible_elapsed_ms)
    end
  end

  defp server_elapsed_ms(attempt, now) do
    elapsed_us = max(0, DateTime.diff(normalize_now(now), attempt.started_at, :microsecond))
    div(elapsed_us + 500, 1_000)
  end

  defp settle_attempt(quest, attempt, elapsed_ms, stop_reason, now) do
    score = PerfectTimingEngine.score(attempt.target_ms, elapsed_ms)

    status =
      cond do
        attempt.attempt_number < @max_attempts -> "result"
        PerfectTimingEngine.successful_tier?(score.tier) -> "auto_finalized"
        true -> "failed"
      end

    settled_attempt =
      attempt
      |> PerfectTimingAttempt.result_changeset(%{
        status: status,
        stop_reason: stop_reason,
        elapsed_ms: elapsed_ms,
        deviation_ms: score.deviation_ms,
        direction: score.direction,
        tier: score.tier,
        reward: score.reward,
        completed_at: normalize_now(now)
      })
      |> Repo.update!()

    if status in ["auto_finalized", "failed"] do
      finalize_quest(quest, settled_attempt, now)
    end

    settled_attempt
  end

  defp finalize_quest(quest, attempt, now) do
    successful = PerfectTimingEngine.successful_tier?(attempt.tier)
    reward = if successful, do: attempt.reward, else: 0
    timestamp = quest_now(now)

    if successful do
      User
      |> where([u], u.id == ^quest.user_id)
      |> lock("FOR UPDATE")
      |> Repo.one!()

      User
      |> where([u], u.id == ^quest.user_id)
      |> Repo.update_all(inc: [coins: reward], set: [updated_at: timestamp])
    end

    update_quest(quest,
      progress: attempt.attempt_number,
      reward: reward,
      completed: successful,
      claimed: successful,
      completed_at: if(successful, do: timestamp, else: nil),
      claimed_at: if(successful, do: timestamp, else: nil),
      updated_at: timestamp
    )
  end

  defp update_quest(quest, updates) do
    quest
    |> Ecto.Changeset.change(updates)
    |> Repo.update!()
  end

  defp build_current_state(user_id, date, timezone) do
    quest =
      DailyQuest
      |> where(
        [q],
        q.user_id == ^user_id and q.date == ^date and q.quest_type == ^@quest_type
      )
      |> Repo.one!()

    build_state(user_id, date, timezone, quest, load_attempts(user_id, date))
  end

  defp build_state(user_id, date, timezone, quest, attempts) do
    active = Enum.find(attempts, &(&1.status == "started"))
    candidate = Enum.find(attempts, &(&1.status == "result"))
    final = finalized_attempt(attempts)
    user = Repo.get!(User, user_id)

    status =
      cond do
        final -> "finalized"
        active -> "active"
        candidate -> "result"
        true -> "ready"
      end

    %{
      date: Date.to_iso8601(date),
      resetTimezone: timezone,
      questVersion: quest.id,
      resetByName: reset_by_name(quest),
      targetMs: quest.target,
      maxAttempts: @max_attempts,
      attemptsUsed: length(attempts),
      remainingAttempts: if(final, do: 0, else: max(0, @max_attempts - length(attempts))),
      status: status,
      completed: quest.completed,
      failed: not is_nil(final) and final.tier == "miss",
      finalized: not is_nil(final),
      rewardGranted: quest.claimed,
      finalReward: if(final, do: final.reward, else: 0),
      finalTier: if(final, do: final.tier, else: nil),
      finalizedAttemptNumber: if(final, do: final.attempt_number, else: nil),
      coinBalance: user.coins,
      activeAttempt: serialize_attempt(active),
      currentResult: serialize_attempt(candidate || final),
      attempts: Enum.map(attempts, &serialize_attempt/1)
    }
  end

  defp serialize_attempt(nil), do: nil

  defp serialize_attempt(attempt) do
    %{
      id: attempt.id,
      attemptNumber: attempt.attempt_number,
      targetMs: attempt.target_ms,
      status: attempt.status,
      stopReason: attempt.stop_reason,
      elapsedMs: attempt.elapsed_ms,
      deviationMs: attempt.deviation_ms,
      direction: attempt.direction,
      tier: attempt.tier,
      reward: attempt.reward,
      startedAt: DateTime.to_iso8601(attempt.started_at),
      completedAt:
        if(attempt.completed_at, do: DateTime.to_iso8601(attempt.completed_at), else: nil)
    }
  end

  defp finalized_attempt(attempts) do
    Enum.find(attempts, &(&1.status in @final_statuses))
  end

  defp reset_by_name(%DailyQuest{reset_by_user_id: nil}), do: nil

  defp reset_by_name(%DailyQuest{reset_by_user_id: user_id}) do
    case Repo.get(User, user_id) do
      %User{} = user -> user.display_name || user.email
      nil -> nil
    end
  end

  defp normalize_now(%DateTime{} = now), do: DateTime.truncate(now, :microsecond)
  defp quest_now(%DateTime{} = now), do: DateTime.truncate(now, :second)
end
