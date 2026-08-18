defmodule AdventureTimeApi.Quests.DailyNumbersSolutionHuntTest do
  use AdventureTimeApi.DataCase, async: false

  alias AdventureTimeApi.Accounts.User

  alias AdventureTimeApi.Quests.{
    DailyNumbersDailyAttempt,
    DailyNumbersEngine,
    DailyNumbersExpression,
    DailyNumbersSolution,
    DailyNumbersSolutionHunt,
    DailyNumbersSolutionSet,
    DailyNumbersSolver,
    DailyNumbersUserSolution
  }

  test "persists a solution set once and records discoveries idempotently" do
    user = create_user("solution-hunt-one@example.com")
    puzzle = puzzle([2, 3], 5)

    assert {:ok, solution_set} =
             DailyNumbersSolutionHunt.ensure_solution_set(~D[2026-08-18], "1-5", puzzle)

    assert solution_set.solution_count == 1
    [solution] = DailyNumbersSolver.solve(puzzle.numbers, puzzle.target).solutions
    {:ok, steps} = DailyNumbersSolver.materialize_steps(solution.expression, puzzle.numbers)

    assert {:ok, :new} =
             DailyNumbersSolutionHunt.record_solution(
               user.id,
               solution_set,
               solution.canonical_key,
               solution.solution_key,
               steps
             )

    assert {:ok, :already_found} =
             DailyNumbersSolutionHunt.record_solution(
               user.id,
               solution_set,
               solution.canonical_key,
               solution.solution_key,
               steps
             )

    assert DailyNumbersSolutionHunt.progress(user.id, solution_set) == %{
             solutionsFound: 1,
             totalSolutions: 1,
             allSolutionsFound: true
           }
  end

  test "scopes discoveries by user, challenge, and canonical solution" do
    first_user = create_user("solution-hunt-scope-one@example.com")
    second_user = create_user("solution-hunt-scope-two@example.com")
    puzzle = puzzle([2, 3, 5], 5)

    [first_solution, second_solution | _rest] =
      DailyNumbersSolver.solve(puzzle.numbers, 5).solutions

    {:ok, first_steps} =
      DailyNumbersSolver.materialize_steps(first_solution.expression, puzzle.numbers)

    {:ok, second_steps} =
      DailyNumbersSolver.materialize_steps(second_solution.expression, puzzle.numbers)

    {:ok, first_set} =
      DailyNumbersSolutionHunt.ensure_solution_set(~D[2026-08-18], "2-4", puzzle)

    assert {:ok, :new} =
             DailyNumbersSolutionHunt.record_solution(
               first_user.id,
               first_set,
               first_solution.canonical_key,
               first_solution.solution_key,
               first_steps
             )

    assert {:ok, :new} =
             DailyNumbersSolutionHunt.record_solution(
               first_user.id,
               first_set,
               second_solution.canonical_key,
               second_solution.solution_key,
               second_steps
             )

    assert {:ok, :new} =
             DailyNumbersSolutionHunt.record_solution(
               second_user.id,
               first_set,
               first_solution.canonical_key,
               first_solution.solution_key,
               first_steps
             )

    {:ok, next_day_set} =
      DailyNumbersSolutionHunt.ensure_solution_set(~D[2026-08-19], "2-4", puzzle)

    assert {:ok, :new} =
             DailyNumbersSolutionHunt.record_solution(
               first_user.id,
               next_day_set,
               first_solution.canonical_key,
               first_solution.solution_key,
               first_steps
             )

    assert DailyNumbersSolutionHunt.progress(first_user.id, first_set).solutionsFound == 2
    assert DailyNumbersSolutionHunt.progress(second_user.id, first_set).solutionsFound == 1
    assert DailyNumbersSolutionHunt.progress(first_user.id, next_day_set).solutionsFound == 1
  end

  test "trace-equivalent trees count as the same discovery when equal values swap provenance" do
    user = create_user("solution-hunt-trace-equivalence@example.com")
    puzzle = puzzle([1, 2, 3, 4], 15)

    first_steps = [
      %{leftId: "n0", operator: "+", rightId: "n1", resultId: "r0"},
      %{leftId: "r0", operator: "*", rightId: "n3", resultId: "r1"},
      %{leftId: "r1", operator: "+", rightId: "n2", resultId: "r2"}
    ]

    second_steps = [
      %{leftId: "n2", operator: "*", rightId: "n3", resultId: "r0"},
      %{leftId: "n0", operator: "+", rightId: "n1", resultId: "r1"},
      %{leftId: "r0", operator: "+", rightId: "r1", resultId: "r2"}
    ]

    assert {:ok, first} = DailyNumbersEngine.validate_submission(puzzle, first_steps)
    assert {:ok, second} = DailyNumbersEngine.validate_submission(puzzle, second_steps)
    refute first.canonicalKey == second.canonicalKey
    assert first.solutionKey == second.solutionKey

    assert {:ok, solution_set} =
             DailyNumbersSolutionHunt.ensure_solution_set(~D[2026-08-21], "2-4", puzzle)

    assert solution_set.solution_count == 6

    assert {:ok, :new} =
             DailyNumbersSolutionHunt.record_solution(
               user.id,
               solution_set,
               first.canonicalKey,
               first.solutionKey,
               first.steps
             )

    assert {:ok, :already_found} =
             DailyNumbersSolutionHunt.record_solution(
               user.id,
               solution_set,
               second.canonicalKey,
               second.solutionKey,
               second.steps
             )

    assert DailyNumbersSolutionHunt.progress(user.id, solution_set).solutionsFound == 1
  end

  test "persists the generated challenge and reuses it without rerunning enumeration" do
    assert {:ok, first} =
             DailyNumbersSolutionHunt.get_or_create_puzzle(~D[2026-08-19], "2-4")

    assert first.solution_set.generation_attempt == first.puzzle.generationAttempt
    assert first.solution_set.solution_count == first.puzzle.solutionCount

    log =
      ExUnit.CaptureLog.capture_log(fn ->
        assert {:ok, second} =
                 DailyNumbersSolutionHunt.get_or_create_puzzle(~D[2026-08-19], "2-4")

        assert second.solution_set.id == first.solution_set.id
        assert second.puzzle.numbers == first.puzzle.numbers
        assert second.puzzle.target == first.puzzle.target
      end)

    refute log =~ "daily numbers solution set computed"
    assert Repo.aggregate(DailyNumbersSolutionSet, :count, :id) == 1
  end

  test "lazily upgrades persisted structural sets and preserves distinct discoveries" do
    user = create_user("solution-hunt-upgrade@example.com")
    puzzle = puzzle([1, 2, 3], 6)
    solver_result = DailyNumbersSolver.solve(puzzle.numbers, puzzle.target)

    player_steps = [
      %{leftId: "n1", operator: "+", rightId: "n2", resultId: "r0"},
      %{leftId: "n0", operator: "+", rightId: "r0", resultId: "r1"}
    ]

    assert {:ok, submission} = DailyNumbersEngine.validate_submission(puzzle, player_steps)
    assert submission.exact

    refute submission.solutionKey ==
             DailyNumbersExpression.solution_key_from_steps(submission.steps)

    {:ok, solution_set} =
      DailyNumbersSolutionHunt.ensure_solution_set(~D[2026-08-22], "2-4", puzzle)

    assert {:ok, :new} =
             DailyNumbersSolutionHunt.record_solution(
               user.id,
               solution_set,
               submission.canonicalKey,
               submission.solutionKey,
               submission.steps
             )

    DailyNumbersSolution
    |> where([solution], solution.solution_set_id == ^solution_set.id)
    |> Repo.update_all(set: [solution_key: nil])

    DailyNumbersUserSolution
    |> where([discovery], discovery.solution_set_id == ^solution_set.id)
    |> Repo.update_all(set: [solution_key: nil])

    sample_solution =
      Repo.one!(
        from(solution in DailyNumbersSolution,
          where: solution.solution_set_id == ^solution_set.id,
          limit: 1
        )
      )

    Repo.insert!(%DailyNumbersSolution{
      solution_set_id: solution_set.id,
      canonical_key: "legacy-duplicate-structure",
      expression: sample_solution.expression
    })

    discovery =
      Repo.get_by!(DailyNumbersUserSolution,
        user_id: user.id,
        solution_set_id: solution_set.id
      )

    Repo.insert!(%DailyNumbersUserSolution{
      user_id: user.id,
      solution_set_id: solution_set.id,
      canonical_key: "legacy-duplicate-structure",
      submitted_steps: discovery.submitted_steps,
      found_at: DateTime.add(discovery.found_at, 1, :microsecond)
    })

    solution_set
    |> Ecto.Changeset.change(%{solution_key_version: 2, solution_count: 3})
    |> Repo.update!()

    assert {:ok, upgraded} =
             DailyNumbersSolutionHunt.ensure_solution_set(~D[2026-08-22], "2-4", puzzle)

    assert upgraded.solution_key_version == 3
    assert upgraded.solution_count == solver_result.total

    upgraded_solutions =
      Repo.all(
        from(solution in DailyNumbersSolution,
          where: solution.solution_set_id == ^solution_set.id
        )
      )

    assert length(upgraded_solutions) == solver_result.total
    assert Enum.all?(upgraded_solutions, &is_binary(&1.solution_key))
    assert MapSet.size(MapSet.new(upgraded_solutions, & &1.solution_key)) == solver_result.total

    upgraded_discoveries =
      Repo.all(
        from(discovery in DailyNumbersUserSolution,
          where: discovery.solution_set_id == ^solution_set.id
        )
      )

    assert length(upgraded_discoveries) == 1

    assert hd(upgraded_discoveries).solution_key == submission.solutionKey

    assert hd(upgraded_discoveries).submitted_steps ==
             Jason.decode!(Jason.encode!(submission.steps))
  end

  test "reconstructs exact ranked solutions while replacing an old official set" do
    user = create_user("solution-hunt-ranked-recovery@example.com")
    date = ~D[2026-08-23]
    mode = "1-5"
    puzzle = puzzle([1, 2, 3], 6)

    ranked_steps = [
      %{leftId: "n1", operator: "+", rightId: "n2", resultId: "r0"},
      %{leftId: "n0", operator: "+", rightId: "r0", resultId: "r1"}
    ]

    assert {:ok, ranked_submission} =
             DailyNumbersEngine.validate_submission(puzzle, ranked_steps)

    {:ok, solution_set} = DailyNumbersSolutionHunt.ensure_solution_set(date, mode, puzzle)

    %DailyNumbersDailyAttempt{}
    |> DailyNumbersDailyAttempt.changeset(%{
      user_id: user.id,
      date: date,
      mode: mode,
      submitted_steps: ranked_steps,
      final_value: 6,
      distance: 0,
      score: 100,
      exact: true,
      completed: true,
      elapsed_ms: 12_345
    })
    |> Repo.insert!()

    solution_set
    |> Ecto.Changeset.change(%{solution_key_version: 2})
    |> Repo.update!()

    assert {:ok, upgraded} =
             DailyNumbersSolutionHunt.ensure_solution_set(date, mode, puzzle)

    assert upgraded.solution_key_version == 3

    assert %DailyNumbersUserSolution{
             canonical_key: canonical_key,
             solution_key: solution_key,
             submitted_steps: submitted_steps
           } =
             Repo.get_by!(DailyNumbersUserSolution,
               user_id: user.id,
               solution_set_id: solution_set.id
             )

    assert canonical_key == ranked_submission.canonicalKey
    assert solution_key == ranked_submission.solutionKey
    assert submitted_steps == Jason.decode!(Jason.encode!(ranked_submission.steps))
  end

  test "lists discoveries in discovery order and remaining solutions deterministically" do
    user = create_user("solution-hunt-lists@example.com")
    puzzle = puzzle([2, 3, 5], 5)
    solver_result = DailyNumbersSolver.solve(puzzle.numbers, puzzle.target)
    [first, second | remaining] = solver_result.solutions

    {:ok, solution_set} =
      DailyNumbersSolutionHunt.ensure_solution_set(~D[2026-08-20], "2-4", puzzle)

    {:ok, first_steps} = DailyNumbersSolver.materialize_steps(first.expression, puzzle.numbers)
    {:ok, second_steps} = DailyNumbersSolver.materialize_steps(second.expression, puzzle.numbers)

    assert {:ok, :new} =
             DailyNumbersSolutionHunt.record_solution(
               user.id,
               solution_set,
               second.canonical_key,
               second.solution_key,
               second_steps
             )

    assert {:ok, :new} =
             DailyNumbersSolutionHunt.record_solution(
               user.id,
               solution_set,
               first.canonical_key,
               first.solution_key,
               first_steps
             )

    payload = DailyNumbersSolutionHunt.payload(user.id, solution_set, puzzle)

    assert Enum.map(payload.yourSolutions, & &1.number) == [1, 2]

    assert Enum.map(payload.yourSolutions, & &1.steps) ==
             Jason.decode!(Jason.encode!([second_steps, first_steps]))

    assert Enum.map(payload.otherSolutions, & &1.number) ==
             Enum.to_list(3..solver_result.total)

    assert payload.solutionsFound == 2
    assert length(payload.otherSolutions) == solver_result.total - 2

    Enum.each(remaining, fn solution ->
      {:ok, steps} = DailyNumbersSolver.materialize_steps(solution.expression, puzzle.numbers)

      assert {:ok, :new} =
               DailyNumbersSolutionHunt.record_solution(
                 user.id,
                 solution_set,
                 solution.canonical_key,
                 solution.solution_key,
                 steps
               )
    end)

    completed_payload = DailyNumbersSolutionHunt.payload(user.id, solution_set, puzzle)
    assert completed_payload.allSolutionsFound
    assert completed_payload.otherSolutions == []
  end

  defp create_user(email) do
    %User{}
    |> User.registration_changeset(%{email: email, display_name: "Solver"})
    |> User.access_changeset(%{role: :user, access_status: :approved})
    |> Repo.insert!()
  end

  defp puzzle(values, target) do
    %{
      target: target,
      numbers:
        values
        |> Enum.with_index()
        |> Enum.map(fn {value, index} ->
          %{id: "n#{index}", value: value, source: "initial", status: "available"}
        end)
    }
  end
end
