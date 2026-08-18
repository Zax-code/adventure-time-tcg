defmodule AdventureTimeApi.Quests.DailyNumbersSolutionHuntTest do
  use AdventureTimeApi.DataCase, async: false

  alias AdventureTimeApi.Accounts.User

  alias AdventureTimeApi.Quests.{
    DailyNumbersSolutionHunt,
    DailyNumbersSolutionSet,
    DailyNumbersSolver
  }

  test "persists a solution set once and records discoveries idempotently" do
    user = create_user("solution-hunt-one@example.com")
    puzzle = puzzle([2, 3], 5)

    assert {:ok, solution_set} =
             DailyNumbersSolutionHunt.ensure_solution_set(~D[2026-08-18], "1-5", puzzle)

    assert solution_set.solution_count == 1

    assert {:ok, :new} =
             DailyNumbersSolutionHunt.record_solution(
               user.id,
               solution_set,
               "+(n:2,n:3)",
               []
             )

    assert {:ok, :already_found} =
             DailyNumbersSolutionHunt.record_solution(
               user.id,
               solution_set,
               "+(n:2,n:3)",
               []
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

    {:ok, first_set} =
      DailyNumbersSolutionHunt.ensure_solution_set(~D[2026-08-18], "2-4", puzzle)

    assert {:ok, :new} =
             DailyNumbersSolutionHunt.record_solution(
               first_user.id,
               first_set,
               first_solution.canonical_key,
               []
             )

    assert {:ok, :new} =
             DailyNumbersSolutionHunt.record_solution(
               first_user.id,
               first_set,
               second_solution.canonical_key,
               []
             )

    assert {:ok, :new} =
             DailyNumbersSolutionHunt.record_solution(
               second_user.id,
               first_set,
               first_solution.canonical_key,
               []
             )

    {:ok, next_day_set} =
      DailyNumbersSolutionHunt.ensure_solution_set(~D[2026-08-19], "2-4", puzzle)

    assert {:ok, :new} =
             DailyNumbersSolutionHunt.record_solution(
               first_user.id,
               next_day_set,
               first_solution.canonical_key,
               []
             )

    assert DailyNumbersSolutionHunt.progress(first_user.id, first_set).solutionsFound == 2
    assert DailyNumbersSolutionHunt.progress(second_user.id, first_set).solutionsFound == 1
    assert DailyNumbersSolutionHunt.progress(first_user.id, next_day_set).solutionsFound == 1
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
               second_steps
             )

    assert {:ok, :new} =
             DailyNumbersSolutionHunt.record_solution(
               user.id,
               solution_set,
               first.canonical_key,
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
