defmodule AdventureTimeApi.Quests.DailyNumbersSolutionHunt do
  @moduledoc """
  Persistent, challenge-scoped Solution Hunt sets and user discoveries.

  A PostgreSQL advisory transaction lock makes lazy generation safe when a
  challenge predates the stored solution set or concurrent players finish it.
  """

  import Ecto.Query

  require Logger

  alias AdventureTimeApi.Quests.{
    DailyNumbersExpression,
    DailyNumbersSolution,
    DailyNumbersSolutionSet,
    DailyNumbersSolver,
    DailyNumbersUserSolution
  }

  alias AdventureTimeApi.Repo

  def ensure_solution_set(%Date{} = date, mode, puzzle) do
    numbers = Enum.map(puzzle.numbers, & &1.value)
    lock_key = "daily-numbers-solution-set:#{Date.to_iso8601(date)}:#{mode}"

    case Repo.transaction(fn ->
           Repo.query!("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [lock_key])

           case Repo.get_by(DailyNumbersSolutionSet, date: date, mode: mode) do
             nil -> create_solution_set(date, mode, numbers, puzzle)
             solution_set -> validate_solution_set!(solution_set, numbers, puzzle.target)
           end
         end) do
      {:ok, solution_set} -> {:ok, solution_set}
      {:error, reason} -> {:error, reason}
    end
  end

  def record_solution(user_id, %DailyNumbersSolutionSet{} = solution_set, canonical_key, steps)
      when is_binary(canonical_key) and is_list(steps) do
    solution_exists? =
      DailyNumbersSolution
      |> where(
        [solution],
        solution.solution_set_id == ^solution_set.id and
          solution.canonical_key == ^canonical_key
      )
      |> Repo.exists?()

    if solution_exists? do
      now = DateTime.utc_now() |> DateTime.truncate(:second)

      {inserted_count, _rows} =
        Repo.insert_all(
          DailyNumbersUserSolution,
          [
            %{
              id: Ecto.UUID.generate(),
              user_id: user_id,
              solution_set_id: solution_set.id,
              canonical_key: canonical_key,
              submitted_steps: steps,
              found_at: now
            }
          ],
          on_conflict: :nothing,
          conflict_target: [:user_id, :solution_set_id, :canonical_key]
        )

      {:ok, if(inserted_count == 1, do: :new, else: :already_found)}
    else
      {:error, :unknown_solution}
    end
  end

  def progress(user_id, %DailyNumbersSolutionSet{} = solution_set) do
    solutions_found =
      DailyNumbersUserSolution
      |> where(
        [user_solution],
        user_solution.user_id == ^user_id and
          user_solution.solution_set_id == ^solution_set.id
      )
      |> Repo.aggregate(:count, :id)

    %{
      solutionsFound: solutions_found,
      totalSolutions: solution_set.solution_count,
      allSolutionsFound: solutions_found == solution_set.solution_count
    }
  end

  def delete_user_discoveries(user_id, %Date{} = date, mode \\ nil) do
    solution_set_ids =
      DailyNumbersSolutionSet
      |> where([solution_set], solution_set.date == ^date)
      |> then(fn query ->
        if mode,
          do: where(query, [solution_set], solution_set.mode == ^mode),
          else: query
      end)
      |> select([solution_set], solution_set.id)

    DailyNumbersUserSolution
    |> where(
      [user_solution],
      user_solution.user_id == ^user_id and
        user_solution.solution_set_id in subquery(solution_set_ids)
    )
    |> Repo.delete_all()
  end

  defp create_solution_set(date, mode, numbers, puzzle) do
    solver_result = DailyNumbersSolver.solve(puzzle.numbers, puzzle.target)

    if solver_result.total == 0 do
      Repo.rollback(:no_daily_numbers_solutions)
    end

    computation_ms = round(solver_result.computation_ms)
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    solution_set =
      %DailyNumbersSolutionSet{}
      |> DailyNumbersSolutionSet.changeset(%{
        date: date,
        mode: mode,
        target: puzzle.target,
        numbers: numbers,
        solution_count: solver_result.total,
        computation_ms: computation_ms
      })
      |> Repo.insert!()

    rows =
      Enum.map(solver_result.solutions, fn solution ->
        %{
          id: Ecto.UUID.generate(),
          solution_set_id: solution_set.id,
          canonical_key: solution.canonical_key,
          expression: DailyNumbersExpression.to_storage(solution.expression),
          inserted_at: now
        }
      end)

    {inserted_count, _rows} = Repo.insert_all(DailyNumbersSolution, rows)

    if inserted_count != solver_result.total do
      Repo.rollback(:incomplete_daily_numbers_solution_set)
    end

    Logger.info("daily numbers solution set computed",
      event: "daily_numbers_solver",
      date: Date.to_iso8601(date),
      mode: mode,
      numbers: inspect(numbers),
      target: puzzle.target,
      unique_solutions: solver_result.total,
      computation_ms: solver_result.computation_ms
    )

    solution_set
  end

  defp validate_solution_set!(solution_set, numbers, target) do
    if solution_set.numbers == numbers and solution_set.target == target do
      solution_set
    else
      Repo.rollback(:daily_numbers_solution_set_puzzle_mismatch)
    end
  end
end
