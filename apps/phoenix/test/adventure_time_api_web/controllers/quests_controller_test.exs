defmodule AdventureTimeApiWeb.QuestsControllerTest do
  use AdventureTimeApiWeb.ConnCase, async: false

  alias AdventureTimeApi.Accounts.{EmailCredential, User}
  alias AdventureTimeApi.Fitbit.Account
  alias AdventureTimeApi.Health.StepSnapshot
  alias AdventureTimeApi.Quests

  alias AdventureTimeApi.Quests.{
    DailyQuest,
    SpeedCalculusDailyRun,
    WordleDictionaryWord,
    WordleEngine
  }

  alias AdventureTimeApi.Repo

  setup do
    :persistent_term.erase({:wordle_candidates, "fr"})
    :persistent_term.erase({:wordle_words_set, "fr"})

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
    assert length(response["quests"]) == 3

    assert Enum.sort(Enum.map(response["quests"], & &1["type"])) == [
             "speed_calculus_daily",
             "steps_10k",
             "wordle_daily"
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
      Repo.get_by!(DailyQuest, user_id: user.id, date: date, quest_type: "wordle_daily")

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

  test "GET /wordle and POST /wordle preserve guess, solve, and reset contracts", _context do
    user = create_user_with_password("wordle@example.com", "password123")
    access_token = login_access_token(user.email, "password123")
    date = Quests.current_reset_date()
    target = WordleEngine.select_word_for_date(sorted_words(), date)
    wrong_guess = Enum.find(sorted_words(), &(&1 != target))

    initial = access_token |> auth_conn() |> get(~p"/wordle") |> json_response(200)
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
      "questType" => "wordle_daily"
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
    assert first_run["rewardPerAnswer"] == 4
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

  defp sorted_words, do: ["AMOUR", "AVION", "BANJO", "CHIEN", "FLEUR", "GLACE", "NUAGE"]

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
