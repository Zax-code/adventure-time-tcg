defmodule AdventureTimeApi.Quests.DailyNumbersSolutionHuntTest do
  use AdventureTimeApi.DataCase, async: false

  alias AdventureTimeApi.Accounts.User
  alias AdventureTimeApi.Quests.{DailyNumbersSolutionHunt, DailyNumbersSolver}

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
