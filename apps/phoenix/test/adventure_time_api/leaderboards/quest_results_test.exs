defmodule AdventureTimeApi.Leaderboards.QuestResultsTest do
  use AdventureTimeApi.DataCase, async: false

  alias AdventureTimeApi.Accounts.User
  alias AdventureTimeApi.Health.StepSnapshot

  alias AdventureTimeApi.Leaderboards.{
    Configuration,
    DailyResult,
    QuestResults,
    RankedSessions
  }

  alias AdventureTimeApi.Quests.{
    DailyNumbersDailyAttempt,
    PerfectTimingAttempt,
    SpeedCalculusDailyRun,
    WordleDailyAttempt
  }

  setup do
    {:ok, _version} = Configuration.ensure_launch_version()
    {:ok, _version} = Configuration.activate_due(~U[2026-08-17 00:01:00.000000Z])

    user =
      %User{}
      |> User.registration_changeset(%{
        email: "quest-results-#{System.unique_integer([:positive])}@example.com",
        display_name: "Finn",
        timezone: "Etc/UTC"
      })
      |> Repo.insert!()

    %{user: user, date: ~D[2026-08-17]}
  end

  test "records only the user's selected step source", %{user: user, date: date} do
    selected = insert_steps!(user.id, :device_health, 20_000, date)
    _unselected = insert_steps!(user.id, :fitbit, 40_000, date)

    assert {:ok, result} = QuestResults.sync(user.id, date, :steps)
    assert result.source_id == selected.id
    assert result.raw_result == %{"kind" => "steps", "steps" => 20_000}
    assert result.points_milli == 632_121

    selected
    |> StepSnapshot.changeset(%{step_count: 30_000})
    |> Repo.update!()

    assert {:ok, updated} = QuestResults.sync(user.id, date, :steps)
    assert updated.id == result.id
    assert updated.raw_result == %{"kind" => "steps", "steps" => 30_000}
    assert Repo.aggregate(DailyResult, :count) == 1
  end

  test "maps final quest outcomes without trusting client points", %{user: user, date: date} do
    daily_numbers =
      %DailyNumbersDailyAttempt{}
      |> DailyNumbersDailyAttempt.changeset(%{
        user_id: user.id,
        date: date,
        mode: "1-5",
        submitted_steps: [],
        final_value: 42,
        distance: 0,
        score: 100,
        exact: true,
        completed: true,
        elapsed_ms: 30_000
      })
      |> Repo.insert!()

    assert {:ok, _session} =
             RankedSessions.start_daily_numbers(
               user,
               date,
               "1-5",
               ~U[2026-08-17 11:59:15.000000Z]
             )

    assert {:ok, _session} =
             RankedSessions.settle_daily_numbers(
               user.id,
               date,
               "1-5",
               daily_numbers.id,
               ~U[2026-08-17 12:00:00.000000Z]
             )

    wordle =
      %WordleDailyAttempt{}
      |> WordleDailyAttempt.changeset(%{
        user_id: user.id,
        date: date,
        locale: "en",
        attempt: 3,
        guess: "APPLE",
        evaluation: ["correct", "correct", "correct", "correct", "correct"],
        solved: true
      })
      |> Repo.insert!()

    speed =
      %SpeedCalculusDailyRun{}
      |> SpeedCalculusDailyRun.changeset(%{
        user_id: user.id,
        date: date,
        run_number: 1,
        seed: "seed",
        answers: [],
        status: "completed",
        score: 12,
        reward: 0,
        started_at: ~U[2026-08-17 12:00:00Z],
        finished_at: ~U[2026-08-17 12:01:00Z],
        play_deadline_at: ~U[2026-08-17 12:01:00Z]
      })
      |> Repo.insert!()

    perfect =
      %PerfectTimingAttempt{user_id: user.id}
      |> PerfectTimingAttempt.start_changeset(%{
        date: date,
        attempt_number: 1,
        target_ms: 5_000,
        started_at: ~U[2026-08-17 13:00:00.000000Z]
      })
      |> Repo.insert!()
      |> PerfectTimingAttempt.result_changeset(%{
        status: "kept",
        stop_reason: "manual",
        elapsed_ms: 5_040,
        deviation_ms: 40,
        direction: "late",
        tier: "amazing",
        reward: 50,
        completed_at: ~U[2026-08-17 13:00:05.040000Z]
      })
      |> Repo.update!()

    assert {:ok, dn_result} = QuestResults.sync(user.id, date, {:daily_numbers, "1-5"})
    assert dn_result.source_id == daily_numbers.id

    assert dn_result.raw_result == %{
             "kind" => "exact_completion_time",
             "elapsedMs" => 45_000,
             "exact" => true
           }

    assert {:ok, wordle_result} = QuestResults.sync(user.id, date, {:wordle, "en"})
    assert wordle_result.source_id == wordle.id

    assert wordle_result.raw_result == %{
             "kind" => "wordle_outcome",
             "guesses" => 3,
             "outcome" => "solved"
           }

    assert {:ok, speed_result} = QuestResults.sync(user.id, date, {:speed_calculus, speed.id})
    assert speed_result.raw_result == %{"kind" => "correct_answers", "correctAnswers" => 12}

    assert {:ok, perfect_result} = QuestResults.sync(user.id, date, :perfect_timing)
    assert perfect_result.source_id == perfect.id

    assert perfect_result.raw_result == %{
             "kind" => "duration_error_ms",
             "absoluteErrorMs" => 40,
             "outcome" => "success",
             "tier" => "amazing"
           }

    assert Repo.aggregate(DailyResult, :count) == 4
  end

  test "rejects exact Daily Numbers results without server timing evidence", %{
    user: user,
    date: date
  } do
    %DailyNumbersDailyAttempt{}
    |> DailyNumbersDailyAttempt.changeset(%{
      user_id: user.id,
      date: date,
      mode: "1-5",
      submitted_steps: [],
      final_value: 42,
      distance: 0,
      score: 100,
      exact: true,
      completed: true,
      elapsed_ms: 0
    })
    |> Repo.insert!()

    assert {:error, :untrusted_ranked_timing} =
             QuestResults.sync(user.id, date, {:daily_numbers, "1-5"})

    assert Repo.aggregate(DailyResult, :count) == 0
  end

  test "does not record unfinished Wordle or Perfect Timing attempts", %{user: user, date: date} do
    %WordleDailyAttempt{}
    |> WordleDailyAttempt.changeset(%{
      user_id: user.id,
      date: date,
      locale: "fr",
      attempt: 1,
      guess: "POIRE",
      evaluation: ["absent", "absent", "absent", "absent", "absent"],
      solved: false
    })
    |> Repo.insert!()

    %PerfectTimingAttempt{user_id: user.id}
    |> PerfectTimingAttempt.start_changeset(%{
      date: date,
      attempt_number: 1,
      target_ms: 5_000,
      started_at: ~U[2026-08-17 13:00:00.000000Z]
    })
    |> Repo.insert!()

    assert {:ok, :not_final} = QuestResults.sync(user.id, date, {:wordle, "fr"})
    assert {:ok, :not_final} = QuestResults.sync(user.id, date, :perfect_timing)
    assert Repo.aggregate(DailyResult, :count) == 0
  end

  test "does not attribute a skill result settled after its locked local midnight", %{
    user: user,
    date: date
  } do
    run =
      %SpeedCalculusDailyRun{}
      |> SpeedCalculusDailyRun.changeset(%{
        user_id: user.id,
        date: date,
        run_number: 1,
        seed: "late-seed",
        answers: [],
        status: "completed",
        score: 10,
        reward: 0,
        started_at: ~U[2026-08-17 23:59:00Z],
        finished_at: ~U[2026-08-18 00:00:00Z],
        play_deadline_at: ~U[2026-08-18 00:00:00Z]
      })
      |> Repo.insert!()

    assert {:error, :slot_attribution_closed} =
             QuestResults.sync(user.id, date, {:speed_calculus, run.id})

    assert Repo.aggregate(DailyResult, :count) == 0
  end

  defp insert_steps!(user_id, source, count, date) do
    %StepSnapshot{}
    |> StepSnapshot.changeset(%{
      user_id: user_id,
      source: source,
      step_count: count,
      recorded_for: date
    })
    |> Repo.insert!()
  end
end
