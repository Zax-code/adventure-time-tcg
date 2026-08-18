defmodule AdventureTimeApiWeb.DailyNumbersSolutionHuntControllerTest do
  use AdventureTimeApiWeb.ConnCase, async: false

  alias AdventureTimeApi.Accounts.{EmailCredential, User}
  alias AdventureTimeApi.Leaderboards.DailyResult

  alias AdventureTimeApi.Quests.{
    DailyNumbersDailyAttempt,
    DailyNumbersEngine,
    DailyNumbersSolver,
    DailyQuest
  }

  alias AdventureTimeApi.Repo

  test "Solution Hunt is unavailable before the ranked Daily Numbers quest is complete" do
    user = create_user_with_password("solution-hunt-locked@example.com", "password123")
    access_token = login_access_token(user.email, "password123")

    state =
      access_token
      |> auth_conn()
      |> get(~p"/quests/daily-numbers?mode=1-5")
      |> json_response(200)

    response =
      access_token
      |> auth_conn()
      |> post(~p"/quests/daily-numbers/solution-hunt/submit", %{
        "mode" => "1-5",
        "dateKey" => state["date"],
        "questVersion" => state["questVersion"],
        "steps" => []
      })
      |> json_response(403)

    assert response == %{
             "error" => "Complete the ranked Daily Numbers quest first",
             "code" => "DAILY_NUMBERS_SOLUTION_HUNT_LOCKED"
           }
  end

  test "ranked exact solution starts progress and distinct hunt submissions never alter ranked rewards" do
    user = create_user_with_password("solution-hunt-flow@example.com", "password123")
    access_token = login_access_token(user.email, "password123")
    date = AdventureTimeApi.Quests.current_reset_date_for_user(user.id)
    {:ok, puzzle} = DailyNumbersEngine.generate_puzzle("3-3", date)

    state =
      access_token
      |> auth_conn()
      |> get(~p"/quests/daily-numbers?mode=3-3")
      |> json_response(200)

    ranked =
      access_token
      |> auth_conn()
      |> post(~p"/quests/daily-numbers/submit", %{
        "mode" => "3-3",
        "dateKey" => state["date"],
        "questVersion" => state["questVersion"],
        "elapsedMs" => 42_000,
        "steps" => step_inputs(puzzle.solution)
      })
      |> json_response(200)

    assert ranked["solutionHunt"]["available"] == true
    assert ranked["solutionHunt"]["solutionsFound"] == 1
    assert ranked["solutionHunt"]["totalSolutions"] > 1
    assert Enum.map(ranked["solutionHunt"]["yourSolutions"], & &1["number"]) == [1]

    assert length(ranked["solutionHunt"]["otherSolutions"]) ==
             ranked["solutionHunt"]["totalSolutions"] - 1

    attempt =
      Repo.get_by!(DailyNumbersDailyAttempt, user_id: user.id, date: date, mode: "3-3")

    quest =
      Repo.get_by!(DailyQuest,
        user_id: user.id,
        date: date,
        quest_type: "daily_numbers_3_3"
      )

    claimed =
      access_token
      |> auth_conn()
      |> post(~p"/quests/claim", %{"questId" => quest.id})
      |> json_response(200)

    ranked_attempt_snapshot = Map.take(attempt, ranked_attempt_fields())
    ranked_quest_snapshot = Map.take(Repo.reload!(quest), ranked_quest_fields())

    ranked_results_snapshot =
      DailyResult
      |> Repo.all()
      |> Enum.filter(&(&1.user_id == user.id))
      |> Enum.map(&Map.take(&1, ranked_result_fields()))

    coin_balance = claimed["newBalance"]

    {:ok, ranked_submission} =
      DailyNumbersEngine.validate_submission(puzzle, puzzle.solution)

    solver_result = DailyNumbersSolver.solve(puzzle.numbers, puzzle.target)

    alternative =
      Enum.find(
        solver_result.solutions,
        &(&1.canonical_key != ranked_submission.canonicalKey and
            String.contains?(&1.canonical_key, ["+(", "*("]))
      ) ||
        Enum.find(solver_result.solutions, &(&1.canonical_key != ranked_submission.canonicalKey))

    assert alternative

    {:ok, alternative_steps} =
      DailyNumbersSolver.materialize_steps(alternative.expression, puzzle.numbers)

    new_solution = submit_hunt(access_token, state, alternative_steps, 200)

    assert new_solution["valid"] == true
    assert new_solution["newSolution"] == true
    assert new_solution["alreadyFound"] == false
    assert new_solution["solutionsFound"] == 2
    assert Enum.map(new_solution["yourSolutions"], & &1["number"]) == [1, 2]

    assert length(new_solution["otherSolutions"]) ==
             new_solution["totalSolutions"] - 2

    reordered_steps = reorder_commutative_step(alternative_steps)
    duplicate = submit_hunt(access_token, state, reordered_steps, 200)

    assert duplicate["valid"] == true
    assert duplicate["newSolution"] == false
    assert duplicate["alreadyFound"] == true
    assert duplicate["solutionsFound"] == 2
    assert duplicate["yourSolutions"] == new_solution["yourSolutions"]
    assert duplicate["otherSolutions"] == new_solution["otherSolutions"]

    wrong_target = submit_hunt(access_token, state, [], 400)
    assert wrong_target["code"] == "DAILY_NUMBERS_SOLUTION_HUNT_NOT_EXACT"

    invalid_usage =
      submit_hunt(
        access_token,
        state,
        [%{"leftId" => "missing", "operator" => "+", "rightId" => "n0", "resultId" => "r0"}],
        400
      )

    assert invalid_usage["code"] == "INVALID_DAILY_NUMBERS_SUBMISSION"

    final_progress =
      Enum.reduce(solver_result.solutions, duplicate, fn solution, _progress ->
        {:ok, steps} = DailyNumbersSolver.materialize_steps(solution.expression, puzzle.numbers)
        submit_hunt(access_token, state, steps, 200)
      end)

    assert final_progress["solutionsFound"] == solver_result.total
    assert final_progress["totalSolutions"] == solver_result.total
    assert final_progress["allSolutionsFound"] == true
    assert final_progress["otherSolutions"] == []

    assert Repo.reload!(user).coins == coin_balance
    assert Map.take(Repo.reload!(attempt), ranked_attempt_fields()) == ranked_attempt_snapshot
    assert Map.take(Repo.reload!(quest), ranked_quest_fields()) == ranked_quest_snapshot

    assert DailyResult
           |> Repo.all()
           |> Enum.filter(&(&1.user_id == user.id))
           |> Enum.map(&Map.take(&1, ranked_result_fields())) == ranked_results_snapshot
  end

  defp create_user_with_password(email, password) do
    user =
      Repo.insert!(
        User.registration_changeset(%User{}, %{email: email, display_name: "Solver"})
        |> User.access_changeset(%{role: :user, access_status: :approved})
      )

    Repo.insert!(
      EmailCredential.changeset(%EmailCredential{}, %{
        password_hash: Bcrypt.hash_pwd_salt(password),
        email_verified_at: DateTime.utc_now() |> DateTime.truncate(:second)
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

  defp step_inputs(steps) do
    Enum.map(steps, fn step ->
      if is_map_key(step, "leftId") do
        step
      else
        %{
          "leftId" => step.leftId,
          "operator" => step.operator,
          "rightId" => step.rightId,
          "resultId" => step.resultId
        }
      end
    end)
  end

  defp submit_hunt(access_token, state, steps, expected_status) do
    access_token
    |> auth_conn()
    |> post(~p"/quests/daily-numbers/solution-hunt/submit", %{
      "mode" => "3-3",
      "dateKey" => state["date"],
      "questVersion" => state["questVersion"],
      "steps" => step_inputs(steps)
    })
    |> json_response(expected_status)
  end

  defp reorder_commutative_step(steps) do
    {reordered, changed?} =
      Enum.map_reduce(steps, false, fn step, changed? ->
        if !changed? and step.operator in ["+", "*"] do
          {%{step | leftId: step.rightId, rightId: step.leftId}, true}
        else
          {step, changed?}
        end
      end)

    assert changed?
    reordered
  end

  defp ranked_attempt_fields do
    [
      :submitted_steps,
      :final_value,
      :distance,
      :score,
      :exact,
      :completed,
      :elapsed_ms,
      :inserted_at
    ]
  end

  defp ranked_quest_fields do
    [:progress, :reward, :completed, :claimed, :completed_at, :updated_at]
  end

  defp ranked_result_fields do
    [
      :source_id,
      :raw_result,
      :raw_numeric_value,
      :outcome,
      :points_milli,
      :result_status,
      :integrity_status,
      :eligibility_status,
      :submitted_at,
      :updated_at
    ]
  end
end
