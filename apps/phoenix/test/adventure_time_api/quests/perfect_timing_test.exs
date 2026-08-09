defmodule AdventureTimeApi.Quests.PerfectTimingTest do
  use AdventureTimeApi.DataCase, async: true

  alias AdventureTimeApi.Accounts.User

  alias AdventureTimeApi.Quests.{
    DailyQuest,
    PerfectTiming,
    PerfectTimingAttempt,
    PerfectTimingEngine
  }

  alias AdventureTimeApi.Quests

  @date ~D[2026-08-08]
  @timezone "Europe/Paris"
  @now ~U[2026-08-08 12:00:00.000000Z]

  setup do
    user = create_user("perfect-timing-#{System.unique_integer([:positive])}@example.com")
    Quests.materialize_daily_quests(user.id, @date)
    quest = quest_for(user)
    %{user: user, quest: quest}
  end

  test "all players receive the same authoritative target for a date", %{quest: quest} do
    other = create_user("perfect-timing-other-#{System.unique_integer([:positive])}@example.com")
    Quests.materialize_daily_quests(other.id, @date)

    assert quest.target == quest_for(other).target
    assert quest.target == PerfectTimingEngine.daily_target_ms(@date)
  end

  test "continue permanently discards the candidate and state restores after refresh", %{
    user: user,
    quest: quest
  } do
    state = start(user, quest)
    elapsed_ms = state.targetMs + 51
    result = stop(user, state, elapsed_ms, "manual")

    assert result.status == "result"
    assert result.currentResult.tier == "great"
    assert result.currentResult.reward == 63

    assert {:ok, restored} = PerfectTiming.state(user.id, @date, @timezone, at(elapsed_ms + 10))
    assert restored.currentResult.id == result.currentResult.id

    assert {:ok, continued} =
             PerfectTiming.discard_result(
               user.id,
               @date,
               @timezone,
               result.currentResult.id,
               result.date,
               result.questVersion
             )

    assert continued.status == "ready"
    assert Enum.at(continued.attempts, 0).status == "discarded"

    assert {:error, :result_not_active} =
             PerfectTiming.keep_result(
               user.id,
               @date,
               @timezone,
               result.currentResult.id,
               result.date,
               result.questVersion,
               at(elapsed_ms + 20)
             )
  end

  test "keeping a successful result ends the quest, discards unused attempts, and grants once", %{
    user: user,
    quest: quest
  } do
    state = start(user, quest)
    result = stop(user, state, state.targetMs + 10, "manual")

    assert {:ok, kept} =
             PerfectTiming.keep_result(
               user.id,
               @date,
               @timezone,
               result.currentResult.id,
               result.date,
               result.questVersion,
               at(state.targetMs + 20)
             )

    assert kept.finalized
    assert kept.completed
    assert kept.rewardGranted
    assert kept.finalReward == 100
    assert kept.remainingAttempts == 0
    assert kept.attemptsUsed == 1
    assert kept.coinBalance == 200
    assert Enum.at(kept.attempts, 0).status == "kept"

    assert {:ok, repeated} =
             PerfectTiming.keep_result(
               user.id,
               @date,
               @timezone,
               result.currentResult.id,
               result.date,
               result.questVersion,
               at(state.targetMs + 30)
             )

    assert repeated.coinBalance == 200
    assert Repo.get!(User, user.id).coins == 200
    assert quest_for(user).claimed

    assert {:ok, no_replay} =
             PerfectTiming.start(
               user.id,
               @date,
               @timezone,
               kept.date,
               kept.questVersion,
               at(state.targetMs + 40)
             )

    assert no_replay.finalized
    assert no_replay.attemptsUsed == 1
  end

  test "a miss cannot be kept and the third successful attempt finalizes automatically", %{
    user: user,
    quest: quest
  } do
    first = start(user, quest)
    first_result = stop(user, first, first.targetMs + 301, "navigation")
    assert first_result.currentResult.tier == "miss"

    assert {:error, :cannot_keep_miss} =
             PerfectTiming.keep_result(
               user.id,
               @date,
               @timezone,
               first_result.currentResult.id,
               first_result.date,
               first_result.questVersion,
               at(first.targetMs + 400)
             )

    second = discard_and_start(user, first_result, at(first.targetMs + 500))
    second_result = stop(user, second, second.targetMs + 301, "background", 10_000)
    third = discard_and_start(user, second_result, at(20_000))
    third_result = stop(user, third, third.targetMs + 150, "manual", 30_000)

    assert third_result.finalized
    assert third_result.completed
    assert third_result.finalTier == "great"
    assert third_result.finalReward == 63
    assert third_result.coinBalance == 163
    assert third_result.attemptsUsed == 3
    assert Enum.at(third_result.attempts, 2).status == "auto_finalized"

    assert {:ok, replay_start} =
             PerfectTiming.start(
               user.id,
               @date,
               @timezone,
               third_result.date,
               third_result.questVersion,
               at(40_000)
             )

    assert replay_start.attemptsUsed == 3
    assert Repo.aggregate(PerfectTimingAttempt, :count, :id) == 3
  end

  test "a third-attempt miss fails the quest without granting currency", %{
    user: user,
    quest: quest
  } do
    final = play_three_misses(user, quest)

    assert final.finalized
    assert final.failed
    refute final.completed
    refute final.rewardGranted
    assert final.finalReward == 0
    assert final.coinBalance == 100
    assert Enum.at(final.attempts, 2).status == "failed"
    refute quest_for(user).claimed
  end

  test "an unresolved attempt is recovered once using authoritative server time", %{
    user: user,
    quest: quest
  } do
    active = start(user, quest)
    recovery_now = at(active.targetMs + 25)

    assert {:ok, recovered} = PerfectTiming.state(user.id, @date, @timezone, recovery_now)
    assert recovered.status == "result"
    assert recovered.currentResult.elapsedMs == active.targetMs + 25
    assert recovered.currentResult.stopReason == "server_recovery"
    assert recovered.currentResult.tier == "amazing"

    assert {:ok, repeated} = PerfectTiming.state(user.id, @date, @timezone, at(50_000))
    assert repeated.currentResult.elapsedMs == active.targetMs + 25
    assert Repo.aggregate(PerfectTimingAttempt, :count, :id) == 1
  end

  test "a client stop from the previous reset settles by attempt id", %{user: user} do
    current_date = Quests.current_reset_date_for_user(user.id)
    previous_date = Date.add(current_date, -1)
    Quests.materialize_daily_quests(user.id, previous_date)
    previous_quest = quest_for(user, previous_date)
    started_at = DateTime.add(DateTime.utc_now(), -5, :second)

    assert {:ok, active} =
             PerfectTiming.start(
               user.id,
               previous_date,
               @timezone,
               Date.to_iso8601(previous_date),
               previous_quest.id,
               started_at
             )

    assert {:ok, settled} =
             Quests.stop_perfect_timing(
               user.id,
               active.activeAttempt.id,
               active.targetMs,
               "background",
               active.date,
               active.questVersion
             )

    assert settled.date == Date.to_iso8601(previous_date)
    assert settled.currentResult.stopReason == "background"

    assert {:ok, current} = Quests.perfect_timing_state(user.id)
    assert current.date == Date.to_iso8601(current_date)
  end

  test "state recovery closes unresolved attempts from a previous reset", %{user: user} do
    current_date = Quests.current_reset_date_for_user(user.id)
    previous_date = Date.add(current_date, -1)
    Quests.materialize_daily_quests(user.id, previous_date)
    previous_quest = quest_for(user, previous_date)
    started_at = DateTime.add(DateTime.utc_now(), -5, :second)

    assert {:ok, active} =
             PerfectTiming.start(
               user.id,
               previous_date,
               @timezone,
               Date.to_iso8601(previous_date),
               previous_quest.id,
               started_at
             )

    assert {:ok, current} = Quests.perfect_timing_state(user.id)
    assert current.date == Date.to_iso8601(current_date)

    recovered = Repo.get!(PerfectTimingAttempt, active.activeAttempt.id)
    assert recovered.status == "result"
    assert recovered.stop_reason == "server_recovery"
  end

  test "malformed and impossible stop submissions do not alter an open attempt", %{
    user: user,
    quest: quest
  } do
    active = start(user, quest)

    assert {:error, :attempt_not_found} =
             PerfectTiming.stop(
               user.id,
               @date,
               @timezone,
               "not-a-uuid",
               0,
               "manual",
               active.date,
               active.questVersion,
               @now
             )

    assert {:error, :impossible_elapsed_ms} =
             PerfectTiming.stop(
               user.id,
               @date,
               @timezone,
               active.activeAttempt.id,
               2_000,
               "manual",
               active.date,
               active.questVersion,
               @now
             )

    attempt = Repo.get!(PerfectTimingAttempt, active.activeAttempt.id)
    assert attempt.status == "started"
    assert is_nil(attempt.elapsed_ms)
  end

  test "training targets exclude the official target and never mutate quest or wallet state", %{
    user: user,
    quest: quest
  } do
    targets = Enum.map(1..200, fn _ -> PerfectTiming.training_target(@date) end)

    assert Enum.all?(targets, &(&1 in 3_000..10_000))
    assert Enum.all?(targets, &(rem(&1, 100) == 0))
    refute quest.target in targets
    assert Repo.aggregate(PerfectTimingAttempt, :count, :id) == 0
    assert Repo.get!(User, user.id).coins == 100
    assert quest_for(user).progress == 0
  end

  defp create_user(email) do
    %User{}
    |> User.registration_changeset(%{email: email, timezone: @timezone})
    |> Repo.insert!()
  end

  defp quest_for(user, date \\ @date) do
    Repo.get_by!(DailyQuest,
      user_id: user.id,
      date: date,
      quest_type: PerfectTiming.quest_type()
    )
  end

  defp start(user, quest, offset_ms \\ 0) do
    assert {:ok, state} =
             PerfectTiming.start(
               user.id,
               @date,
               @timezone,
               Date.to_iso8601(@date),
               quest.id,
               at(offset_ms)
             )

    state
  end

  defp stop(user, state, elapsed_ms, reason, offset_ms \\ 0) do
    assert {:ok, result} =
             PerfectTiming.stop(
               user.id,
               @date,
               @timezone,
               state.activeAttempt.id,
               elapsed_ms,
               reason,
               state.date,
               state.questVersion,
               at(offset_ms + elapsed_ms)
             )

    result
  end

  defp discard_and_start(user, result, now) do
    assert {:ok, ready} =
             PerfectTiming.discard_result(
               user.id,
               @date,
               @timezone,
               result.currentResult.id,
               result.date,
               result.questVersion
             )

    assert {:ok, active} =
             PerfectTiming.start(
               user.id,
               @date,
               @timezone,
               ready.date,
               ready.questVersion,
               now
             )

    active
  end

  defp play_three_misses(user, quest) do
    first = start(user, quest)
    first_result = stop(user, first, first.targetMs + 301, "manual")
    second = discard_and_start(user, first_result, at(10_000))
    second_result = stop(user, second, second.targetMs + 301, "manual", 10_000)
    third = discard_and_start(user, second_result, at(20_000))
    stop(user, third, third.targetMs + 301, "manual", 20_000)
  end

  defp at(offset_ms), do: DateTime.add(@now, offset_ms, :millisecond)
end
