defmodule AdventureTimeApiWeb.QuestsControllerTest do
  use AdventureTimeApiWeb.ConnCase, async: false

  alias AdventureTimeApi.Accounts.{EmailCredential, User}
  alias AdventureTimeApi.Fitbit.Account
  alias AdventureTimeApi.Health.StepSnapshot
  alias AdventureTimeApi.Quests

  alias AdventureTimeApi.Quests.{
    DailyNumbersArchiveAttempt,
    DailyNumbersDailyAttempt,
    DailyNumbersEngine,
    DailyQuest,
    PerfectTimingAttempt,
    SpeedCalculusDailyRun,
    WordleDictionaryWord,
    WordleDictionaryWordDefinition,
    WordleEngine
  }

  alias AdventureTimeApi.Repo

  setup do
    :persistent_term.erase({:wordle_candidates, "fr"})
    :persistent_term.erase({:wordle_words_set, "fr"})
    :persistent_term.erase({:wordle_candidates, "en"})
    :persistent_term.erase({:wordle_words_set, "en"})

    Repo.delete_all(WordleDictionaryWord)

    for word <- ["AMOUR", "BANJO", "CHIEN", "AVION", "FLEUR", "GLACE", "NUAGE"] do
      Repo.insert!(
        WordleDictionaryWord.changeset(%WordleDictionaryWord{}, %{
          locale: "fr",
          word: word,
          is_allowed_guess: true,
          is_solution_candidate: true
        })
      )
    end

    for word <- ["APPLE", "BANJO", "CRANE", "GHOST", "HOUSE", "LIGHT", "ZEBRA"] do
      Repo.insert!(
        WordleDictionaryWord.changeset(%WordleDictionaryWord{}, %{
          locale: "en",
          word: word,
          is_allowed_guess: true,
          is_solution_candidate: true
        })
      )
    end

    Quests.wordle_cache_warm()

    :ok
  end

  test "GET /quests materializes daily quests and POST /quests/claim preserves reward semantics",
       _context do
    user = create_user_with_password("quests@example.com", "password123")
    access_token = login_access_token(user.email, "password123")
    date = Quests.current_reset_date()

    response = access_token |> auth_conn() |> get(~p"/quests") |> json_response(200)
    assert response["fitbitConnected"] == false
    assert length(response["quests"]) == 8

    assert Enum.sort(Enum.map(response["quests"], & &1["type"])) == [
             "daily_numbers_1_5",
             "daily_numbers_2_4",
             "daily_numbers_3_3",
             "perfect_timing_daily",
             "speed_calculus_daily",
             "steps_10k",
             "wordle_daily_en",
             "wordle_daily_fr"
           ]

    quest = Repo.get_by!(DailyQuest, user_id: user.id, date: date, quest_type: "steps_10k")

    Repo.update!(
      Ecto.Changeset.change(quest,
        progress: quest.target,
        completed: true,
        completed_at: DateTime.utc_now() |> DateTime.truncate(:second)
      )
    )

    claimed =
      access_token
      |> auth_conn()
      |> post(~p"/quests/claim", %{"questId" => quest.id})
      |> json_response(200)

    assert claimed["success"] == true
    assert claimed["reward"] == quest.reward
    assert claimed["newBalance"] == 100 + quest.reward

    assert claimed["quest"] == %{
             "id" => quest.id,
             "type" => "steps_10k",
             "completed" => true,
             "claimed" => true
           }

    already_claimed =
      access_token
      |> auth_conn()
      |> post(~p"/quests/claim", %{"questId" => quest.id})
      |> json_response(409)

    assert already_claimed == %{
             "error" => "Quest already claimed",
             "code" => "QUEST_ALREADY_CLAIMED"
           }

    incomplete_quest =
      Repo.get_by!(DailyQuest, user_id: user.id, date: date, quest_type: "wordle_daily_fr")

    not_completed =
      access_token
      |> auth_conn()
      |> post(~p"/quests/claim", %{"questId" => incomplete_quest.id})
      |> json_response(400)

    assert not_completed == %{
             "error" => "Quest not completed",
             "code" => "QUEST_NOT_COMPLETED"
           }

    missing_params =
      access_token |> auth_conn() |> post(~p"/quests/claim", %{}) |> json_response(400)

    assert missing_params == %{"error" => "questId is required"}
  end

  test "GET /quests reports Fitbit connection and uses the preferred step source snapshot",
       _context do
    user = create_user_with_password("fitbit-quests@example.com", "password123")
    access_token = login_access_token(user.email, "password123")
    date = Quests.current_reset_date()

    Repo.update!(Ecto.Changeset.change(user, preferred_step_source: :fitbit))

    Repo.insert!(
      Account.changeset(%Account{}, %{
        user_id: user.id,
        fitbit_user_id: "fitbit-user-1",
        access_token: "access-token",
        refresh_token: "refresh-token",
        token_expires_at: DateTime.utc_now() |> DateTime.add(3600, :second),
        scope: "activity"
      })
    )

    Repo.insert!(
      StepSnapshot.changeset(%StepSnapshot{}, %{
        user_id: user.id,
        source: :device_health,
        step_count: 1200,
        recorded_for: date
      })
    )

    Repo.insert!(
      StepSnapshot.changeset(%StepSnapshot{}, %{
        user_id: user.id,
        source: :fitbit,
        step_count: 6400,
        recorded_for: date
      })
    )

    response = access_token |> auth_conn() |> get(~p"/quests") |> json_response(200)

    assert response["fitbitConnected"] == true

    assert Enum.find(response["quests"], &(&1["type"] == "steps_10k"))["progress"] == 6400
  end

  test "POST /quests/claim returns 404 for unknown and foreign quests", _context do
    user = create_user_with_password("quest-owner@example.com", "password123")
    other_user = create_user_with_password("quest-other@example.com", "password123")
    access_token = login_access_token(user.email, "password123")
    date = Quests.current_reset_date()

    Quests.materialize_daily_quests(other_user.id, date)

    foreign_quest =
      Repo.get_by!(DailyQuest, user_id: other_user.id, date: date, quest_type: "steps_10k")

    missing =
      access_token
      |> auth_conn()
      |> post(~p"/quests/claim", %{"questId" => Ecto.UUID.generate()})
      |> json_response(404)

    assert missing == %{"error" => "Quest not found"}

    foreign =
      access_token
      |> auth_conn()
      |> post(~p"/quests/claim", %{"questId" => foreign_quest.id})
      |> json_response(404)

    assert foreign == %{"error" => "Quest not found"}
  end

  test "Perfect Timing API starts, scores, keeps, grants once, and isolates training", _context do
    user = create_user_with_password("perfect-timing-api@example.com", "password123")
    access_token = login_access_token(user.email, "password123")

    state =
      access_token
      |> auth_conn()
      |> get(~p"/quests/perfect-timing")
      |> json_response(200)

    assert state["status"] == "ready"
    assert state["targetMs"] in 3_000..10_000
    assert rem(state["targetMs"], 100) == 0
    assert state["remainingAttempts"] == 3

    training =
      access_token
      |> auth_conn()
      |> post(~p"/quests/perfect-timing/training/target", %{})
      |> json_response(200)

    assert training["targetMs"] in 3_000..10_000
    refute training["targetMs"] == state["targetMs"]

    started =
      access_token
      |> auth_conn()
      |> post(~p"/quests/perfect-timing/start", %{
        "dateKey" => state["date"],
        "questVersion" => state["questVersion"]
      })
      |> json_response(200)

    assert started["status"] == "active"
    assert started["attemptsUsed"] == 1

    attempt = Repo.get!(PerfectTimingAttempt, started["activeAttempt"]["id"])

    Repo.update!(
      Ecto.Changeset.change(attempt,
        started_at:
          DateTime.utc_now()
          |> DateTime.add(-(state["targetMs"] + 2_000), :millisecond)
          |> DateTime.truncate(:microsecond)
      )
    )

    stopped =
      access_token
      |> auth_conn()
      |> post(~p"/quests/perfect-timing/stop", %{
        "attemptId" => attempt.id,
        "elapsedMs" => state["targetMs"] + 51,
        "stopReason" => "manual",
        "dateKey" => state["date"],
        "questVersion" => state["questVersion"]
      })
      |> json_response(200)

    assert stopped["status"] == "result"
    assert stopped["currentResult"]["tier"] == "great"
    assert stopped["currentResult"]["reward"] == 63

    kept =
      access_token
      |> auth_conn()
      |> post(~p"/quests/perfect-timing/keep", %{
        "attemptId" => attempt.id,
        "dateKey" => state["date"],
        "questVersion" => state["questVersion"]
      })
      |> json_response(200)

    assert kept["finalized"] == true
    assert kept["completed"] == true
    assert kept["rewardGranted"] == true
    assert kept["finalReward"] == 63
    assert kept["remainingAttempts"] == 0
    assert kept["coinBalance"] == 163

    repeated =
      access_token
      |> auth_conn()
      |> post(~p"/quests/perfect-timing/keep", %{
        "attemptId" => attempt.id,
        "dateKey" => state["date"],
        "questVersion" => state["questVersion"]
      })
      |> json_response(200)

    assert repeated["coinBalance"] == 163
    assert Repo.get!(User, user.id).coins == 163
    assert Repo.aggregate(PerfectTimingAttempt, :count, :id) == 1
  end

  test "GET /quests/daily-numbers and POST /quests/daily-numbers/submit preserve deterministic puzzle and percentage reward contracts",
       _context do
    user = create_user_with_password("daily-numbers@example.com", "password123")
    other_user = create_user_with_password("daily-numbers-two@example.com", "password123")
    access_token = login_access_token(user.email, "password123")
    other_access_token = login_access_token(other_user.email, "password123")
    date = Quests.current_reset_date()
    {:ok, puzzle} = DailyNumbersEngine.generate_puzzle("1-5", date)

    state =
      access_token
      |> auth_conn()
      |> get(~p"/quests/daily-numbers?mode=1-5")
      |> json_response(200)

    other_state =
      other_access_token
      |> auth_conn()
      |> get(~p"/quests/daily-numbers?mode=1-5")
      |> json_response(200)

    balanced_state =
      access_token
      |> auth_conn()
      |> get(~p"/quests/daily-numbers?mode=2-4")
      |> json_response(200)

    assert state["mode"] == "1-5"
    assert balanced_state["mode"] == "2-4"
    assert state["target"] == other_state["target"]
    assert state["numbers"] == other_state["numbers"]
    assert state["generationAttempt"] == other_state["generationAttempt"]
    assert state["date"] == Date.to_iso8601(date)
    assert state["submitted"] == false

    solution_steps =
      Enum.map(puzzle.solution, fn step ->
        %{
          "leftId" => step.leftId,
          "operator" => step.operator,
          "rightId" => step.rightId,
          "resultId" => step.resultId
        }
      end)

    submitted =
      access_token
      |> auth_conn()
      |> post(~p"/quests/daily-numbers/submit", %{
        "mode" => "1-5",
        "dateKey" => state["date"],
        "questVersion" => state["questVersion"],
        "elapsedMs" => 83_421,
        "steps" => solution_steps
      })
      |> json_response(200)

    assert submitted["submitted"] == true
    assert submitted["completed"] == true
    assert submitted["submission"]["defaultDistance"] == state["bestDistance"]
    assert submitted["submission"]["distance"] == 0
    assert submitted["submission"]["score"] == 100
    assert submitted["submission"]["elapsedMs"] == 83_421
    assert submitted["submission"]["officialSolutionUnlocked"] == true
    assert length(submitted["submission"]["officialSolutionSteps"]) > 0

    quest =
      Repo.get_by!(DailyQuest, user_id: user.id, date: date, quest_type: "daily_numbers_1_5")

    attempt =
      Repo.get_by!(DailyNumbersDailyAttempt, user_id: user.id, date: date, mode: "1-5")

    assert quest.progress == 1
    assert quest.completed == true
    assert quest.reward == 45
    assert attempt.elapsed_ms == 83_421

    already_submitted =
      access_token
      |> auth_conn()
      |> post(~p"/quests/daily-numbers/submit", %{
        "mode" => "1-5",
        "dateKey" => state["date"],
        "questVersion" => state["questVersion"],
        "steps" => []
      })
      |> json_response(409)

    assert already_submitted == %{
             "error" => "Daily Numbers already submitted for today",
             "code" => "DAILY_NUMBERS_ALREADY_SUBMITTED"
           }
  end

  test "POST /quests/daily-numbers/submit keeps the quest failed at 0 percent when the result does not improve",
       _context do
    user = create_user_with_password("daily-numbers-zero@example.com", "password123")
    access_token = login_access_token(user.email, "password123")
    date = Quests.current_reset_date()

    state =
      access_token
      |> auth_conn()
      |> get(~p"/quests/daily-numbers?mode=1-5")
      |> json_response(200)

    submitted =
      access_token
      |> auth_conn()
      |> post(~p"/quests/daily-numbers/submit", %{
        "mode" => "1-5",
        "dateKey" => state["date"],
        "questVersion" => state["questVersion"],
        "steps" => []
      })
      |> json_response(200)

    assert submitted["submitted"] == true
    assert submitted["completed"] == false
    assert submitted["reward"] == 0
    assert submitted["submission"]["defaultDistance"] == state["bestDistance"]
    assert submitted["submission"]["score"] == 0

    quest =
      Repo.get_by!(DailyQuest, user_id: user.id, date: date, quest_type: "daily_numbers_1_5")

    assert quest.progress == 1
    assert quest.completed == false
    assert quest.reward == 0

    not_completed =
      access_token
      |> auth_conn()
      |> post(~p"/quests/claim", %{"questId" => quest.id})
      |> json_response(400)

    assert not_completed == %{
             "error" => "Quest not completed",
             "code" => "QUEST_NOT_COMPLETED"
           }
  end

  test "Daily Numbers archive lists previous days and saves non-rewarding results", _context do
    user = create_user_with_password("daily-numbers-archive@example.com", "password123")
    access_token = login_access_token(user.email, "password123")
    today = Quests.current_reset_date()
    archive_date = Date.add(today, -1)
    launch_date = ~D[2026-06-19]
    {:ok, puzzle} = DailyNumbersEngine.generate_puzzle("2-4", archive_date)

    history =
      access_token
      |> auth_conn()
      |> get(~p"/quests/daily-numbers/history")
      |> json_response(200)

    assert history["today"] == Date.to_iso8601(today)
    refute Enum.any?(history["days"], &(&1["date"] == Date.to_iso8601(today)))
    assert Enum.any?(history["days"], &(&1["date"] == Date.to_iso8601(archive_date)))

    assert Enum.all?(
             history["days"],
             &(Date.compare(Date.from_iso8601!(&1["date"]), launch_date) != :lt)
           )

    too_old_date = Date.add(launch_date, -1)

    too_old =
      access_token
      |> auth_conn()
      |> get(~p"/quests/daily-numbers/archive?date=#{Date.to_iso8601(too_old_date)}&mode=1-5")
      |> json_response(404)

    assert too_old["code"] == "DAILY_NUMBERS_ARCHIVE_OUT_OF_RANGE"

    state =
      access_token
      |> auth_conn()
      |> get(~p"/quests/daily-numbers/archive?date=#{Date.to_iso8601(archive_date)}&mode=2-4")
      |> json_response(200)

    assert state["archive"] == true
    assert state["date"] == Date.to_iso8601(archive_date)
    assert state["reward"] == 0
    assert state["submitted"] == false
    assert length(state["officialSolutionSteps"]) > 0

    solution_steps =
      Enum.map(puzzle.solution, fn step ->
        %{
          "leftId" => step.leftId,
          "operator" => step.operator,
          "rightId" => step.rightId,
          "resultId" => step.resultId
        }
      end)

    submitted =
      access_token
      |> auth_conn()
      |> post(~p"/quests/daily-numbers/archive/submit", %{
        "mode" => "2-4",
        "dateKey" => Date.to_iso8601(archive_date),
        "elapsedMs" => 12_345,
        "steps" => solution_steps
      })
      |> json_response(200)

    assert submitted["archive"] == true
    assert submitted["submitted"] == true
    assert submitted["status"] == "exact"
    assert submitted["reward"] == 0
    assert submitted["submission"]["elapsedMs"] == 12_345

    refute Repo.get_by(DailyQuest,
             user_id: user.id,
             date: archive_date,
             quest_type: "daily_numbers_2_4"
           )

    attempt =
      Repo.get_by!(DailyNumbersArchiveAttempt,
        user_id: user.id,
        date: archive_date,
        mode: "2-4"
      )

    assert attempt.exact == true
    assert attempt.elapsed_ms == 12_345
  end

  test "Daily Numbers archive uses the player's original daily result as history", _context do
    user =
      create_user_with_password("daily-numbers-archive-daily-history@example.com", "password123")

    access_token = login_access_token(user.email, "password123")
    archive_date = Date.add(Quests.current_reset_date(), -1)
    {:ok, puzzle} = DailyNumbersEngine.generate_puzzle("1-5", archive_date)

    {:ok, daily_submission} = DailyNumbersEngine.validate_submission(puzzle, puzzle.solution)

    Repo.insert!(
      DailyNumbersDailyAttempt.changeset(%DailyNumbersDailyAttempt{}, %{
        user_id: user.id,
        date: archive_date,
        mode: "1-5",
        submitted_steps: daily_submission.steps,
        final_value: daily_submission.finalValue,
        distance: daily_submission.distance,
        score: daily_submission.score,
        exact: daily_submission.exact,
        completed: daily_submission.completed,
        elapsed_ms: 32_100
      })
    )

    history =
      access_token
      |> auth_conn()
      |> get(~p"/quests/daily-numbers/history")
      |> json_response(200)

    archive_day = Enum.find(history["days"], &(&1["date"] == Date.to_iso8601(archive_date)))
    one_five = Enum.find(archive_day["modes"], &(&1["mode"] == "1-5"))

    assert one_five["status"] == "exact"
    assert one_five["exact"] == true
    assert one_five["elapsedMs"] == 32_100

    state =
      access_token
      |> auth_conn()
      |> get(~p"/quests/daily-numbers/archive?date=#{Date.to_iso8601(archive_date)}&mode=1-5")
      |> json_response(200)

    assert state["submitted"] == true
    assert state["status"] == "exact"
    assert state["submission"]["elapsedMs"] == 32_100

    solution_steps =
      Enum.map(puzzle.solution, fn step ->
        %{
          "leftId" => step.leftId,
          "operator" => step.operator,
          "rightId" => step.rightId,
          "resultId" => step.resultId
        }
      end)

    replayed =
      access_token
      |> auth_conn()
      |> post(~p"/quests/daily-numbers/archive/submit", %{
        "mode" => "1-5",
        "dateKey" => Date.to_iso8601(archive_date),
        "elapsedMs" => 5_000,
        "steps" => solution_steps
      })
      |> json_response(200)

    assert replayed["submission"]["elapsedMs"] == 32_100

    refute Repo.get_by(DailyNumbersArchiveAttempt,
             user_id: user.id,
             date: archive_date,
             mode: "1-5"
           )
  end

  test "Daily Numbers archive replay can improve a non-exact daily baseline", _context do
    user =
      create_user_with_password("daily-numbers-archive-daily-improve@example.com", "password123")

    access_token = login_access_token(user.email, "password123")
    archive_date = Date.add(Quests.current_reset_date(), -1)
    {:ok, puzzle} = DailyNumbersEngine.generate_puzzle("2-4", archive_date)
    {:ok, missed_submission} = DailyNumbersEngine.validate_submission(puzzle, [])

    Repo.insert!(
      DailyNumbersDailyAttempt.changeset(%DailyNumbersDailyAttempt{}, %{
        user_id: user.id,
        date: archive_date,
        mode: "2-4",
        submitted_steps: missed_submission.steps,
        final_value: missed_submission.finalValue,
        distance: missed_submission.distance,
        score: missed_submission.score,
        exact: missed_submission.exact,
        completed: missed_submission.completed,
        elapsed_ms: 45_000
      })
    )

    solution_steps =
      Enum.map(puzzle.solution, fn step ->
        %{
          "leftId" => step.leftId,
          "operator" => step.operator,
          "rightId" => step.rightId,
          "resultId" => step.resultId
        }
      end)

    replayed =
      access_token
      |> auth_conn()
      |> post(~p"/quests/daily-numbers/archive/submit", %{
        "mode" => "2-4",
        "dateKey" => Date.to_iso8601(archive_date),
        "elapsedMs" => 12_000,
        "steps" => solution_steps
      })
      |> json_response(200)

    assert replayed["status"] == "exact"
    assert replayed["submission"]["elapsedMs"] == 12_000

    attempt =
      Repo.get_by!(DailyNumbersArchiveAttempt,
        user_id: user.id,
        date: archive_date,
        mode: "2-4"
      )

    assert attempt.exact == true
    assert attempt.elapsed_ms == 12_000
  end

  test "Daily Numbers archive exact result keeps the first exact elapsed time", _context do
    user = create_user_with_password("daily-numbers-archive-exact@example.com", "password123")
    access_token = login_access_token(user.email, "password123")
    archive_date = Date.add(Quests.current_reset_date(), -1)
    {:ok, puzzle} = DailyNumbersEngine.generate_puzzle("1-5", archive_date)

    solution_steps =
      Enum.map(puzzle.solution, fn step ->
        %{
          "leftId" => step.leftId,
          "operator" => step.operator,
          "rightId" => step.rightId,
          "resultId" => step.resultId
        }
      end)

    first =
      access_token
      |> auth_conn()
      |> post(~p"/quests/daily-numbers/archive/submit", %{
        "mode" => "1-5",
        "dateKey" => Date.to_iso8601(archive_date),
        "elapsedMs" => 20_000,
        "steps" => solution_steps
      })
      |> json_response(200)

    assert first["submission"]["elapsedMs"] == 20_000

    second =
      access_token
      |> auth_conn()
      |> post(~p"/quests/daily-numbers/archive/submit", %{
        "mode" => "1-5",
        "dateKey" => Date.to_iso8601(archive_date),
        "elapsedMs" => 5_000,
        "steps" => solution_steps
      })
      |> json_response(200)

    assert second["submission"]["elapsedMs"] == 20_000

    attempt =
      Repo.get_by!(DailyNumbersArchiveAttempt,
        user_id: user.id,
        date: archive_date,
        mode: "1-5"
      )

    assert attempt.elapsed_ms == 20_000
  end

  test "GET /wordle and POST /wordle preserve guess, solve, and reset contracts", _context do
    user = create_user_with_password("wordle@example.com", "password123")
    access_token = login_access_token(user.email, "password123")
    date = Quests.current_reset_date()
    target = WordleEngine.select_word_for_date(sorted_words(), date)
    wrong_guess = Enum.find(sorted_words(), &(&1 != target))

    initial = access_token |> auth_conn() |> get(~p"/wordle") |> json_response(200)
    assert initial["locale"] == "fr"
    assert Enum.sort(initial["availableLocales"]) == ["en", "fr"]
    assert initial["guesses"] == []
    assert initial["solved"] == false
    assert initial["targetWord"] == nil

    guessed =
      access_token
      |> auth_conn()
      |> post(~p"/wordle", %{"guess" => wrong_guess})
      |> json_response(200)

    assert guessed["solved"] == false
    assert guessed["questJustCompleted"] == false
    assert length(guessed["evaluation"]) == 5
    assert guessed["targetWord"] == nil

    state_after_guess = access_token |> auth_conn() |> get(~p"/wordle") |> json_response(200)
    assert [%{"guess" => ^wrong_guess}] = state_after_guess["guesses"]

    solved =
      access_token
      |> auth_conn()
      |> post(~p"/wordle", %{"guess" => String.downcase(target)})
      |> json_response(200)

    assert solved == %{
             "locale" => "fr",
             "evaluation" => ["correct", "correct", "correct", "correct", "correct"],
             "solved" => true,
             "date" => Date.to_iso8601(date),
             "questJustCompleted" => true,
             "targetWord" => nil
           }

    solved_again =
      access_token
      |> auth_conn()
      |> post(~p"/wordle", %{"guess" => target})
      |> json_response(409)

    assert solved_again == %{
             "error" => "Already solved today's Wordle",
             "code" => "WORDLE_ALREADY_SOLVED"
           }

    reset_error =
      access_token
      |> auth_conn()
      |> post(~p"/wordle", %{"guess" => target, "expectedDate" => "2000-01-01"})
      |> json_response(409)

    assert reset_error == %{
             "error" => "Wordle has reset since this game began",
             "code" => "WORDLE_RESET"
           }
  end

  test "POST /wordle validates guess format, dictionary membership, and attempt exhaustion",
       _context do
    user = create_user_with_password("wordle-errors@example.com", "password123")
    access_token = login_access_token(user.email, "password123")
    date = Quests.current_reset_date()
    target = WordleEngine.select_word_for_date(sorted_words(), date)
    wrong_guesses = sorted_words() |> Enum.reject(&(&1 == target)) |> Enum.take(6)
    opening_guesses = Enum.take(wrong_guesses, 5)

    invalid_format =
      access_token
      |> auth_conn()
      |> post(~p"/wordle", %{"guess" => "abc"})
      |> json_response(400)

    assert invalid_format == %{
             "error" => "Guess must be exactly 5 letters",
             "code" => "INVALID_GUESS"
           }

    word_not_found =
      access_token
      |> auth_conn()
      |> post(~p"/wordle", %{"guess" => "ZZZZZ"})
      |> json_response(400)

    assert word_not_found == %{
             "error" => "Word not found in dictionary",
             "code" => "WORD_NOT_FOUND"
           }

    Enum.each(opening_guesses, fn guess ->
      response =
        access_token
        |> auth_conn()
        |> post(~p"/wordle", %{"guess" => guess})
        |> json_response(200)

      assert response["solved"] == false
    end)

    final_guess_response =
      access_token
      |> auth_conn()
      |> post(~p"/wordle", %{"guess" => List.last(wrong_guesses)})
      |> json_response(200)

    assert final_guess_response["solved"] == false
    assert final_guess_response["targetWord"] == target

    exhausted =
      access_token
      |> auth_conn()
      |> post(~p"/wordle", %{"guess" => target})
      |> json_response(409)

    assert exhausted == %{
             "error" => "No attempts remaining",
             "code" => "WORDLE_ATTEMPTS_EXHAUSTED"
           }

    finished_state = access_token |> auth_conn() |> get(~p"/wordle") |> json_response(200)
    assert finished_state["targetWord"] == target
  end

  test "GET /wordle/definition returns localized definitions stored in the DB", _context do
    user = create_user_with_password("wordle-definition@example.com", "password123")
    access_token = login_access_token(user.email, "password123")
    date = Quests.current_reset_date()
    french_target = WordleEngine.select_word_for_date(sorted_words("fr"), date)
    english_target = WordleEngine.select_word_for_date(sorted_words("en"), date)

    Repo.get_by!(WordleDictionaryWord, locale: "fr", word: french_target)
    |> Ecto.Changeset.change(%{
      display_word: String.downcase(french_target),
      definition: "(Psychologie) Sentiment intense et agréable qui incite les êtres à s’unir.",
      definition_part_of_speech: "Nom commun",
      definition_source_name: "DBnary / Wiktionnaire",
      definition_source_url:
        "https://fr.wiktionary.org/wiki/#{String.downcase(french_target)}#Fran%C3%A7ais",
      definition_fetched_at: DateTime.utc_now() |> DateTime.truncate(:microsecond)
    })
    |> Repo.update!()

    Repo.get_by!(WordleDictionaryWord, locale: "en", word: english_target)
    |> Ecto.Changeset.change(%{
      display_word: String.downcase(english_target),
      definition: "A common, firm, round fruit produced by a tree of the genus Malus.",
      definition_part_of_speech: "Noun",
      definition_source_name: "Open English WordNet",
      definition_source_url: "https://en-word.net/",
      definition_fetched_at: DateTime.utc_now() |> DateTime.truncate(:microsecond)
    })
    |> Repo.update!()

    french_row = Repo.get_by!(WordleDictionaryWord, locale: "fr", word: french_target)
    english_row = Repo.get_by!(WordleDictionaryWord, locale: "en", word: english_target)

    Repo.insert!(
      WordleDictionaryWordDefinition.changeset(%WordleDictionaryWordDefinition{}, %{
        wordle_dictionary_word_id: french_row.id,
        display_word: String.downcase(french_target),
        definition: "(Psychologie) Sentiment intense et agréable qui incite les êtres à s’unir.",
        part_of_speech: "Nom commun",
        source_name: "DBnary / Wiktionnaire",
        source_url:
          "https://fr.wiktionary.org/wiki/#{String.downcase(french_target)}#Fran%C3%A7ais",
        fetched_at: DateTime.utc_now() |> DateTime.truncate(:microsecond)
      })
    )

    Repo.insert!(
      WordleDictionaryWordDefinition.changeset(%WordleDictionaryWordDefinition{}, %{
        wordle_dictionary_word_id: english_row.id,
        display_word: String.downcase(english_target),
        definition: "A common, firm, round fruit produced by a tree of the genus Malus.",
        part_of_speech: "Noun",
        source_name: "Open English WordNet",
        source_url: "https://en-word.net/",
        fetched_at: DateTime.utc_now() |> DateTime.truncate(:microsecond)
      })
    )

    french_definition =
      access_token
      |> auth_conn()
      |> get(~p"/wordle/definition?locale=fr")
      |> json_response(200)

    assert french_definition == %{
             "locale" => "fr",
             "word" => french_target,
             "displayWord" => String.downcase(french_target),
             "definition" =>
               "(Psychologie) Sentiment intense et agréable qui incite les êtres à s’unir.",
             "partOfSpeech" => "Nom commun",
             "sourceName" => "DBnary / Wiktionnaire",
             "sourceUrl" =>
               "https://fr.wiktionary.org/wiki/#{String.downcase(french_target)}#Fran%C3%A7ais",
             "variants" => [
               %{
                 "displayWord" => String.downcase(french_target),
                 "definition" =>
                   "(Psychologie) Sentiment intense et agréable qui incite les êtres à s’unir.",
                 "partOfSpeech" => "Nom commun",
                 "sourceName" => "DBnary / Wiktionnaire",
                 "sourceUrl" =>
                   "https://fr.wiktionary.org/wiki/#{String.downcase(french_target)}#Fran%C3%A7ais"
               }
             ]
           }

    english_definition =
      access_token
      |> auth_conn()
      |> get(~p"/wordle/definition?locale=en")
      |> json_response(200)

    assert english_definition == %{
             "locale" => "en",
             "word" => english_target,
             "displayWord" => String.downcase(english_target),
             "definition" => "A common, firm, round fruit produced by a tree of the genus Malus.",
             "partOfSpeech" => "Noun",
             "sourceName" => "Open English WordNet",
             "sourceUrl" => "https://en-word.net/",
             "variants" => [
               %{
                 "displayWord" => String.downcase(english_target),
                 "definition" =>
                   "A common, firm, round fruit produced by a tree of the genus Malus.",
                 "partOfSpeech" => "Noun",
                 "sourceName" => "Open English WordNet",
                 "sourceUrl" => "https://en-word.net/"
               }
             ]
           }

    cached_french =
      access_token
      |> auth_conn()
      |> get(~p"/wordle/definition?locale=fr")
      |> json_response(200)

    assert cached_french == french_definition

    assert french_row.definition == french_definition["definition"]
    assert french_row.definition_part_of_speech == "Nom commun"
    assert is_struct(french_row.definition_fetched_at, DateTime)

    assert english_row.definition == english_definition["definition"]
    assert english_row.definition_part_of_speech == "Noun"
    assert is_struct(english_row.definition_fetched_at, DateTime)
  end

  test "GET /wordle/definition returns 404 when the DB has no stored definition", _context do
    user = create_user_with_password("wordle-definition-missing@example.com", "password123")
    access_token = login_access_token(user.email, "password123")

    response =
      access_token
      |> auth_conn()
      |> get(~p"/wordle/definition?locale=fr")
      |> json_response(404)

    assert response == %{
             "error" => "Definition not found for today's Wordle word",
             "code" => "WORDLE_DEFINITION_NOT_FOUND"
           }
  end

  test "wordle keeps language boards separate and awards a quest per language", _context do
    user = create_user_with_password("wordle-bilingual@example.com", "password123")
    access_token = login_access_token(user.email, "password123")
    date = Quests.current_reset_date()
    french_target = WordleEngine.select_word_for_date(sorted_words("fr"), date)
    english_target = WordleEngine.select_word_for_date(sorted_words("en"), date)

    initial_english =
      access_token
      |> auth_conn()
      |> get(~p"/wordle?locale=en")
      |> json_response(200)

    assert initial_english["locale"] == "en"
    assert initial_english["guesses"] == []
    assert initial_english["solved"] == false

    solved_french =
      access_token
      |> auth_conn()
      |> post(~p"/wordle", %{"locale" => "fr", "guess" => String.downcase(french_target)})
      |> json_response(200)

    assert solved_french["locale"] == "fr"
    assert solved_french["solved"] == true
    assert solved_french["questJustCompleted"] == true

    quests_after_french = access_token |> auth_conn() |> get(~p"/quests") |> json_response(200)

    french_quest_after_french =
      Enum.find(quests_after_french["quests"], &(&1["type"] == "wordle_daily_fr"))

    assert french_quest_after_french["completed"] == true
    assert french_quest_after_french["claimed"] == false
    assert french_quest_after_french["attemptsUsed"] == 1

    english_quest_after_french =
      Enum.find(quests_after_french["quests"], &(&1["type"] == "wordle_daily_en"))

    assert english_quest_after_french["completed"] == false
    assert english_quest_after_french["claimed"] == false

    english_still_open =
      access_token
      |> auth_conn()
      |> get(~p"/wordle?locale=en")
      |> json_response(200)

    assert english_still_open["locale"] == "en"
    assert english_still_open["guesses"] == []
    assert english_still_open["solved"] == false

    solved_english =
      access_token
      |> auth_conn()
      |> post(~p"/wordle", %{"locale" => "en", "guess" => String.downcase(english_target)})
      |> json_response(200)

    assert solved_english["locale"] == "en"
    assert solved_english["solved"] == true
    assert solved_english["questJustCompleted"] == true

    french_quest =
      Repo.get_by!(DailyQuest, user_id: user.id, date: date, quest_type: "wordle_daily_fr")

    english_quest =
      Repo.get_by!(DailyQuest, user_id: user.id, date: date, quest_type: "wordle_daily_en")

    claimed_french =
      access_token
      |> auth_conn()
      |> post(~p"/quests/claim", %{"questId" => french_quest.id})
      |> json_response(200)

    assert claimed_french["success"] == true
    assert claimed_french["reward"] == french_quest.reward

    claimed_english =
      access_token
      |> auth_conn()
      |> post(~p"/quests/claim", %{"questId" => english_quest.id})
      |> json_response(200)

    assert claimed_english["success"] == true
    assert claimed_english["reward"] == english_quest.reward

    already_claimed =
      access_token
      |> auth_conn()
      |> post(~p"/quests/claim", %{"questId" => french_quest.id})
      |> json_response(409)

    assert already_claimed == %{
             "error" => "Quest already claimed",
             "code" => "QUEST_ALREADY_CLAIMED"
           }
  end

  test "each wordle language quest fails once its own board is exhausted", _context do
    user = create_user_with_password("wordle-two-boards@example.com", "password123")
    access_token = login_access_token(user.email, "password123")
    date = Quests.current_reset_date()
    french_target = WordleEngine.select_word_for_date(sorted_words("fr"), date)
    english_target = WordleEngine.select_word_for_date(sorted_words("en"), date)

    french_wrong_guesses =
      sorted_words("fr")
      |> Enum.reject(&(&1 == french_target))
      |> Enum.take(6)

    english_wrong_guesses =
      sorted_words("en")
      |> Enum.reject(&(&1 == english_target))
      |> Enum.take(6)

    Enum.each(french_wrong_guesses, fn guess ->
      access_token
      |> auth_conn()
      |> post(~p"/wordle", %{"locale" => "fr", "guess" => guess})
      |> json_response(200)
    end)

    quests_after_french =
      access_token |> auth_conn() |> get(~p"/quests") |> json_response(200)

    french_quest_after_french =
      Enum.find(quests_after_french["quests"], &(&1["type"] == "wordle_daily_fr"))

    assert french_quest_after_french["failed"] == true
    assert french_quest_after_french["attemptsUsed"] == 6

    english_quest_after_french =
      Enum.find(quests_after_french["quests"], &(&1["type"] == "wordle_daily_en"))

    assert english_quest_after_french["failed"] == false

    Enum.each(english_wrong_guesses, fn guess ->
      access_token
      |> auth_conn()
      |> post(~p"/wordle", %{"locale" => "en", "guess" => guess})
      |> json_response(200)
    end)

    quests_after_both =
      access_token |> auth_conn() |> get(~p"/quests") |> json_response(200)

    english_quest_after_both =
      Enum.find(quests_after_both["quests"], &(&1["type"] == "wordle_daily_en"))

    assert english_quest_after_both["failed"] == true
    assert english_quest_after_both["attemptsUsed"] == 6
  end

  test "wordle returns reset metadata and detects admin reset version mismatch", _context do
    super_admin =
      create_user_with_password("wordle-boss@example.com", "password123", "Reset Boss",
        verified?: true,
        access_status: :approved,
        role: :super_admin
      )

    user = create_user_with_password("wordle-reset@example.com", "password123")
    access_token = login_access_token(user.email, "password123")
    admin_token = login_access_token(super_admin.email, "password123")
    date = Quests.current_reset_date()
    target = WordleEngine.select_word_for_date(sorted_words(), date)
    wrong_guess = Enum.find(sorted_words(), &(&1 != target))

    Quests.materialize_daily_quests(user.id, date)

    initial_state = access_token |> auth_conn() |> get(~p"/wordle") |> json_response(200)

    assert is_binary(initial_state["questVersion"])
    assert initial_state["resetByName"] == nil

    access_token
    |> auth_conn()
    |> post(~p"/wordle", %{"guess" => wrong_guess})
    |> json_response(200)

    old_version = initial_state["questVersion"]

    build_conn()
    |> put_req_header("authorization", "Bearer #{admin_token}")
    |> post(~p"/admin/users/#{user.id}/reset-daily-quests", %{
      "mode" => "single",
      "questType" => "wordle_daily_fr"
    })
    |> json_response(200)

    reset_state = access_token |> auth_conn() |> get(~p"/wordle") |> json_response(200)

    assert reset_state["guesses"] == []
    assert reset_state["solved"] == false
    assert reset_state["targetWord"] == nil
    assert is_binary(reset_state["questVersion"])
    assert reset_state["questVersion"] != old_version
    assert reset_state["resetByName"] == (super_admin.display_name || super_admin.email)

    reset_error =
      access_token
      |> auth_conn()
      |> post(~p"/wordle", %{
        "guess" => wrong_guess,
        "questVersion" => old_version
      })
      |> json_response(409)

    assert reset_error == %{
             "error" => "Wordle has reset since this game began",
             "code" => "WORDLE_RESET"
           }
  end

  test "speed calculus routes preserve start, pause, answer, finish, resume, and cashout contracts",
       _context do
    user = create_user_with_password("speed@example.com", "password123")
    access_token = login_access_token(user.email, "password123")
    date = Quests.current_reset_date()

    initial_state =
      access_token |> auth_conn() |> get(~p"/quests/speed-calculus") |> json_response(200)

    assert is_binary(initial_state["questVersion"])
    assert initial_state["resetByName"] == nil
    assert initial_state["runsUsed"] == 0
    assert initial_state["activeRun"] == nil
    assert initial_state["canStartRun"] == true

    started =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/start", %{})
      |> json_response(200)

    run_id = started["activeRun"]["runId"]
    assert started["activeRun"]["runNumber"] == 1
    assert started["activeRun"]["isManuallyPaused"] == false

    paused_countdown =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/answer", %{
        "runId" => run_id,
        "answer" => 7,
        "questVersion" => started["questVersion"]
      })
      |> json_response(400)

    assert paused_countdown == %{"error" => "Run is paused", "code" => "RUN_IS_PAUSED"}

    resume_state =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/resume", %{})
      |> json_response(200)

    assert resume_state["activeRun"]["runId"] == run_id

    SpeedCalculusDailyRun
    |> Repo.get!(run_id)
    |> Ecto.Changeset.change(
      pause_expires_at:
        DateTime.utc_now() |> DateTime.truncate(:second) |> DateTime.add(-1, :second)
    )
    |> Repo.update!()

    answered =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/answer", %{
        "runId" => run_id,
        "answer" => 7,
        "questVersion" => started["questVersion"]
      })
      |> json_response(200)

    assert answered["questVersion"] == started["questVersion"]
    assert answered["activeRun"]["questionIndex"] == 1
    assert is_integer(answered["activeRun"]["correctAnswers"])
    assert is_integer(answered["activeRun"]["remainingSeconds"])
    assert answered["activeRun"]["pauseRemainingSeconds"] == 0
    refute Map.has_key?(answered["activeRun"], "questions")
    refute Map.has_key?(answered["activeRun"], "answers")
    refute Map.has_key?(answered, "history")

    manually_paused =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/pause", %{})
      |> json_response(200)

    assert manually_paused["activeRun"]["runId"] == run_id
    assert manually_paused["activeRun"]["isManuallyPaused"] == true

    paused_answer =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/answer", %{
        "runId" => run_id,
        "answer" => 8,
        "questVersion" => started["questVersion"]
      })
      |> json_response(400)

    assert paused_answer == %{"error" => "Run is paused", "code" => "RUN_IS_PAUSED"}

    stored_paused_run = Repo.get!(SpeedCalculusDailyRun, run_id)
    assert stored_paused_run.manual_paused_at != nil

    resumed_after_manual_pause =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/resume", %{})
      |> json_response(200)

    assert resumed_after_manual_pause["activeRun"]["isManuallyPaused"] == false
    assert resumed_after_manual_pause["activeRun"]["pauseRemainingSeconds"] == 5

    finished =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/finish", %{
        "runId" => run_id,
        "questVersion" => started["questVersion"]
      })
      |> json_response(200)

    assert finished["activeRun"] == nil
    assert finished["runsUsed"] == 1
    assert is_integer(finished["correctAnswers"])
    assert is_integer(finished["reward"])

    cashed_out =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/cashout", %{})
      |> json_response(200)

    assert cashed_out["locked"] == true
    assert cashed_out["canCashOut"] == false

    cannot_start =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/start", %{})
      |> json_response(400)

    assert cannot_start == %{
             "error" => "Cannot start a new run at this time",
             "code" => "CANNOT_START_RUN"
           }

    locked =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/cashout", %{})
      |> json_response(409)

    assert locked == %{"error" => "Quest already locked", "code" => "QUEST_ALREADY_LOCKED"}

    missing_finish =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/finish", %{})
      |> json_response(400)

    assert missing_finish == %{"error" => "runId is required"}

    missing_answer =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/answer", %{})
      |> json_response(400)

    assert missing_answer == %{"error" => "runId and answer are required"}

    bad_answer =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/answer", %{
        "runId" => run_id,
        "answer" => "abc",
        "questVersion" => started["questVersion"]
      })
      |> json_response(400)

    assert bad_answer == %{"error" => "answer must be an integer"}

    wrong_run =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/finish", %{"runId" => Ecto.UUID.generate()})
      |> json_response(404)

    assert wrong_run == %{"error" => "Run not found"}

    quest =
      Repo.get_by!(DailyQuest, user_id: user.id, date: date, quest_type: "speed_calculus_daily")

    claimed_user = user |> Ecto.Changeset.change(coins: 500) |> Repo.update!()
    assert claimed_user.id == user.id

    Repo.update!(
      Ecto.Changeset.change(quest,
        claimed: true,
        claimed_at: DateTime.utc_now() |> DateTime.truncate(:second)
      )
    )

    claimed_error =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/cashout", %{})
      |> json_response(409)

    assert claimed_error == %{"error" => "Quest already locked", "code" => "QUEST_ALREADY_LOCKED"}
  end

  test "speed calculus training starts a stateless practice run without persisting attempts",
       _context do
    user = create_user_with_password("speed-training@example.com", "password123")
    access_token = login_access_token(user.email, "password123")

    before_count = Repo.aggregate(SpeedCalculusDailyRun, :count, :id)

    first_run =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/training/start", %{})
      |> json_response(200)

    second_run =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/training/start", %{})
      |> json_response(200)

    assert is_binary(first_run["runId"])
    assert first_run["seed"] == first_run["runId"]
    assert first_run["runDurationSeconds"] == 30
    assert first_run["pauseDurationSeconds"] == 5
    assert first_run["rewardPerAnswer"] == 2
    assert length(first_run["questions"]) == 120
    first_question = hd(first_run["questions"])
    assert first_question["index"] == 0
    assert is_integer(first_question["left"])
    assert is_integer(first_question["right"])
    assert first_question["operator"] in ["+", "-"]
    refute Map.has_key?(first_question, "answer")
    refute first_run["seed"] == second_run["seed"]

    after_count = Repo.aggregate(SpeedCalculusDailyRun, :count, :id)
    assert after_count == before_count
  end

  test "speed calculus syncs local answer batches on pause and finish", _context do
    user = create_user_with_password("speed-local-sync@example.com", "password123")
    access_token = login_access_token(user.email, "password123")

    started =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/start", %{})
      |> json_response(200)

    run_id = started["activeRun"]["runId"]
    questions = started["activeRun"]["questions"]
    first_answer = speed_question_answer(Enum.at(questions, 0))
    second_answer = speed_question_answer(Enum.at(questions, 1))

    SpeedCalculusDailyRun
    |> Repo.get!(run_id)
    |> Ecto.Changeset.change(
      pause_expires_at:
        DateTime.utc_now() |> DateTime.truncate(:second) |> DateTime.add(-1, :second)
    )
    |> Repo.update!()

    paused =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/pause", %{
        "answers" => [first_answer],
        "questVersion" => started["questVersion"]
      })
      |> json_response(200)

    assert paused["activeRun"]["isManuallyPaused"] == true
    assert paused["activeRun"]["answers"] == [first_answer]
    assert Repo.get!(SpeedCalculusDailyRun, run_id).answers == [first_answer]

    resumed =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/resume", %{})
      |> json_response(200)

    assert resumed["activeRun"]["answers"] == [first_answer]

    finished =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/finish", %{
        "runId" => run_id,
        "answers" => [first_answer, second_answer],
        "questVersion" => started["questVersion"]
      })
      |> json_response(200)

    assert finished["activeRun"] == nil
    assert finished["correctAnswers"] == 2
    assert Repo.get!(SpeedCalculusDailyRun, run_id).answers == [first_answer, second_answer]
  end

  test "speed calculus rejects active-run and empty-history cashout cases", _context do
    user = create_user_with_password("speed-errors@example.com", "password123")
    access_token = login_access_token(user.email, "password123")

    _state = access_token |> auth_conn() |> get(~p"/quests/speed-calculus") |> json_response(200)

    no_runs =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/cashout", %{})
      |> json_response(400)

    assert no_runs == %{
             "error" => "No completed runs to cash out",
             "code" => "NO_RUNS_COMPLETED"
           }

    started =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/start", %{})
      |> json_response(200)

    run_id = started["activeRun"]["runId"]

    active_run =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/cashout", %{})
      |> json_response(400)

    assert active_run == %{
             "error" => "A run is in progress",
             "code" => "ACTIVE_RUN_IN_PROGRESS"
           }

    other_user = create_user_with_password("speed-other@example.com", "password123")
    other_token = login_access_token(other_user.email, "password123")

    foreign =
      other_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/answer", %{
        "runId" => run_id,
        "answer" => 1,
        "questVersion" => started["questVersion"]
      })
      |> json_response(404)

    assert foreign == %{"error" => "Run not found"}
  end

  test "speed calculus returns reset metadata and detects admin reset version mismatch",
       _context do
    super_admin =
      create_user_with_password("speed-boss@example.com", "password123", "Reset Boss",
        verified?: true,
        access_status: :approved,
        role: :super_admin
      )

    user = create_user_with_password("speed-reset@example.com", "password123")
    access_token = login_access_token(user.email, "password123")
    admin_token = login_access_token(super_admin.email, "password123")

    started =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/start", %{})
      |> json_response(200)

    old_version = started["questVersion"]
    run_id = started["activeRun"]["runId"]

    build_conn()
    |> put_req_header("authorization", "Bearer #{admin_token}")
    |> post(~p"/admin/users/#{user.id}/reset-daily-quests", %{
      "mode" => "single",
      "questType" => "speed_calculus_daily"
    })
    |> json_response(200)

    reset_state =
      access_token |> auth_conn() |> get(~p"/quests/speed-calculus") |> json_response(200)

    assert is_binary(reset_state["questVersion"])
    assert reset_state["questVersion"] != old_version
    assert reset_state["resetByName"] == (super_admin.display_name || super_admin.email)
    assert reset_state["activeRun"] == nil

    reset_error =
      access_token
      |> auth_conn()
      |> post(~p"/quests/speed-calculus/answer", %{
        "runId" => run_id,
        "answer" => 7,
        "questVersion" => old_version
      })
      |> json_response(409)

    assert reset_error == %{
             "error" => "Speed Calculus was reset while you were playing",
             "code" => "SPEED_CALCULUS_RESET"
           }
  end

  defp sorted_words(locale \\ "fr")

  defp sorted_words("fr"), do: ["AMOUR", "AVION", "BANJO", "CHIEN", "FLEUR", "GLACE", "NUAGE"]

  defp sorted_words("en"), do: ["APPLE", "BANJO", "CRANE", "GHOST", "HOUSE", "LIGHT", "ZEBRA"]

  defp speed_question_answer(%{"left" => left, "operator" => "+", "right" => right}),
    do: left + right

  defp speed_question_answer(%{"left" => left, "operator" => "-", "right" => right}),
    do: left - right

  defp create_user_with_password(email, password, display_name \\ "Tester", opts \\ []) do
    role = Keyword.get(opts, :role, :user)
    access_status = Keyword.get(opts, :access_status, :approved)
    verified? = Keyword.get(opts, :verified?, true)

    user =
      Repo.insert!(
        User.registration_changeset(%User{}, %{email: email, display_name: display_name})
        |> User.access_changeset(%{role: role, access_status: access_status})
      )

    Repo.insert!(
      EmailCredential.changeset(%EmailCredential{}, %{
        password_hash: Bcrypt.hash_pwd_salt(password),
        email_verified_at:
          if(verified?, do: DateTime.utc_now() |> DateTime.truncate(:second), else: nil)
      })
      |> Ecto.Changeset.put_change(:user_id, user.id)
    )

    user
  end

  defp login_access_token(email, password) do
    build_conn()
    |> post(~p"/auth/login", %{email: email, password: password})
    |> json_response(200)
    |> get_in(["tokens", "accessToken"])
  end

  defp auth_conn(access_token) do
    build_conn()
    |> put_req_header("authorization", "Bearer #{access_token}")
  end
end
