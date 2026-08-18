defmodule AdventureTimeApi.Quests.DailyNumbersSolutionHunt do
  @moduledoc """
  Persistent, challenge-scoped Solution Hunt sets and user discoveries.

  A PostgreSQL advisory transaction lock makes lazy generation safe when a
  challenge predates the stored solution set or concurrent players finish it.
  """

  import Ecto.Query

  require Logger

  alias AdventureTimeApi.Quests.{
    DailyNumbersEngine,
    DailyNumbersExpression,
    DailyNumbersSolution,
    DailyNumbersSolutionSet,
    DailyNumbersSolver,
    DailyNumbersUserSolution
  }

  alias AdventureTimeApi.Repo

  @solution_key_version 2

  def get_or_create_puzzle(%Date{} = date, mode) do
    lock_key = solution_set_lock_key(date, mode)

    case Repo.transaction(fn ->
           lock_solution_set!(lock_key)

           case Repo.get_by(DailyNumbersSolutionSet, date: date, mode: mode) do
             nil ->
               case DailyNumbersEngine.generate_puzzle(mode, date) do
                 {:ok, puzzle} ->
                   solution_set =
                     create_solution_set(date, mode, Enum.map(puzzle.numbers, & &1.value), puzzle)

                   %{puzzle: puzzle, solution_set: solution_set}

                 {:error, reason} ->
                   Repo.rollback(reason)
               end

             solution_set ->
               case DailyNumbersEngine.generate_puzzle_at_attempt(
                      mode,
                      date,
                      solution_set.generation_attempt
                    ) do
                 {:ok, puzzle} ->
                   numbers = Enum.map(puzzle.numbers, & &1.value)
                   validate_solution_set!(solution_set, numbers, puzzle.target)
                   solution_set = upgrade_solution_set!(solution_set, puzzle)
                   puzzle = Map.put(puzzle, :solutionCount, solution_set.solution_count)
                   %{puzzle: puzzle, solution_set: solution_set}

                 {:error, reason} ->
                   Repo.rollback(reason)
               end
           end
         end) do
      {:ok, result} -> {:ok, result}
      {:error, reason} -> {:error, reason}
    end
  end

  def ensure_solution_set(%Date{} = date, mode, puzzle) do
    numbers = Enum.map(puzzle.numbers, & &1.value)
    lock_key = solution_set_lock_key(date, mode)

    case Repo.transaction(fn ->
           lock_solution_set!(lock_key)

           case Repo.get_by(DailyNumbersSolutionSet, date: date, mode: mode) do
             nil ->
               create_solution_set(date, mode, numbers, puzzle)

             solution_set ->
               validate_solution_set!(solution_set, numbers, puzzle.target)
               upgrade_solution_set!(solution_set, puzzle)
           end
         end) do
      {:ok, solution_set} -> {:ok, solution_set}
      {:error, reason} -> {:error, reason}
    end
  end

  def record_solution(user_id, %DailyNumbersSolutionSet{} = solution_set, canonical_key, steps)
      when is_binary(canonical_key) and is_list(steps) do
    solution_key = DailyNumbersExpression.solution_key_from_steps(steps)

    solution_exists? =
      DailyNumbersSolution
      |> where(
        [solution],
        solution.solution_set_id == ^solution_set.id and
          solution.solution_key == ^solution_key
      )
      |> Repo.exists?()

    if solution_exists? do
      now = DateTime.utc_now()

      {inserted_count, _rows} =
        Repo.insert_all(
          DailyNumbersUserSolution,
          [
            %{
              id: Ecto.UUID.generate(),
              user_id: user_id,
              solution_set_id: solution_set.id,
              canonical_key: canonical_key,
              solution_key: solution_key,
              submitted_steps: steps,
              found_at: now
            }
          ],
          on_conflict: :nothing,
          conflict_target: [:user_id, :solution_set_id, :solution_key]
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

  def payload(user_id, %DailyNumbersSolutionSet{} = solution_set, puzzle) do
    discoveries =
      DailyNumbersUserSolution
      |> where(
        [user_solution],
        user_solution.user_id == ^user_id and
          user_solution.solution_set_id == ^solution_set.id
      )
      |> order_by([user_solution],
        asc: user_solution.found_at,
        asc: user_solution.solution_key,
        asc: user_solution.canonical_key
      )
      |> Repo.all()

    discovered_keys = MapSet.new(discoveries, & &1.solution_key)

    your_solutions =
      discoveries
      |> Enum.with_index(1)
      |> Enum.map(fn {discovery, number} ->
        %{number: number, steps: discovery.submitted_steps}
      end)

    other_solutions =
      DailyNumbersSolution
      |> where([solution], solution.solution_set_id == ^solution_set.id)
      |> order_by([solution], asc: solution.canonical_key)
      |> Repo.all()
      |> Enum.with_index(1)
      |> Enum.reject(fn {solution, _number} ->
        MapSet.member?(discovered_keys, solution.solution_key)
      end)
      |> Enum.map(fn {solution, number} ->
        expression = DailyNumbersExpression.from_storage(solution.expression)
        {:ok, steps} = DailyNumbersSolver.materialize_steps(expression, puzzle.numbers)
        %{number: number, steps: steps}
      end)

    %{
      solutionsFound: length(your_solutions),
      totalSolutions: solution_set.solution_count,
      allSolutionsFound: length(your_solutions) == solution_set.solution_count,
      yourSolutions: your_solutions,
      otherSolutions: other_solutions
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
    solver_result =
      Map.get_lazy(puzzle, :solutionHuntSolverResult, fn ->
        DailyNumbersSolver.solve(puzzle.numbers, puzzle.target)
      end)

    if solver_result.total == 0 do
      Repo.rollback(:no_daily_numbers_solutions)
    end

    computation_ms = round(solver_result.computation_ms)
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    solution_set =
      %DailyNumbersSolutionSet{
        date: date,
        mode: mode,
        target: puzzle.target,
        numbers: numbers,
        generation_attempt: Map.get(puzzle, :generationAttempt, 1),
        solution_count: solver_result.total,
        computation_ms: computation_ms,
        solution_key_version: @solution_key_version
      }
      |> DailyNumbersSolutionSet.changeset()
      |> Repo.insert!()

    rows =
      Enum.map(solver_result.solutions, fn solution ->
        %{
          id: Ecto.UUID.generate(),
          solution_set_id: solution_set.id,
          canonical_key: solution.canonical_key,
          solution_key: solution.solution_key,
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

  defp upgrade_solution_set!(
         %DailyNumbersSolutionSet{solution_key_version: version} = solution_set,
         _puzzle
       )
       when version >= @solution_key_version,
       do: solution_set

  defp upgrade_solution_set!(%DailyNumbersSolutionSet{} = solution_set, puzzle) do
    previous_version = solution_set.solution_key_version
    solver_result = DailyNumbersSolver.solve(puzzle.numbers, puzzle.target)

    if solver_result.total == 0 do
      Repo.rollback(:no_daily_numbers_solutions)
    end

    valid_solution_keys = MapSet.new(solver_result.solutions, & &1.solution_key)

    discoveries =
      DailyNumbersUserSolution
      |> where([discovery], discovery.solution_set_id == ^solution_set.id)
      |> order_by([discovery],
        asc: discovery.found_at,
        asc: discovery.canonical_key,
        asc: discovery.id
      )
      |> Repo.all()

    upgraded_discoveries =
      Enum.reduce(discoveries, %{}, fn discovery, unique ->
        solution_key =
          DailyNumbersExpression.solution_key_from_steps(discovery.submitted_steps)

        identity = {discovery.user_id, solution_key}

        if MapSet.member?(valid_solution_keys, solution_key) do
          Map.put_new(unique, identity, %{discovery | solution_key: solution_key})
        else
          unique
        end
      end)
      |> Map.values()

    DailyNumbersUserSolution
    |> where([discovery], discovery.solution_set_id == ^solution_set.id)
    |> Repo.delete_all()

    DailyNumbersSolution
    |> where([solution], solution.solution_set_id == ^solution_set.id)
    |> Repo.delete_all()

    now = DateTime.utc_now() |> DateTime.truncate(:second)

    solution_rows =
      Enum.map(solver_result.solutions, fn solution ->
        %{
          id: Ecto.UUID.generate(),
          solution_set_id: solution_set.id,
          canonical_key: solution.canonical_key,
          solution_key: solution.solution_key,
          expression: DailyNumbersExpression.to_storage(solution.expression),
          inserted_at: now
        }
      end)

    {inserted_count, _rows} = Repo.insert_all(DailyNumbersSolution, solution_rows)

    if inserted_count != solver_result.total do
      Repo.rollback(:incomplete_daily_numbers_solution_set_upgrade)
    end

    discovery_rows =
      Enum.map(upgraded_discoveries, fn discovery ->
        %{
          id: discovery.id,
          user_id: discovery.user_id,
          solution_set_id: discovery.solution_set_id,
          canonical_key: discovery.canonical_key,
          solution_key: discovery.solution_key,
          submitted_steps: discovery.submitted_steps,
          found_at: discovery.found_at
        }
      end)

    if discovery_rows != [] do
      Repo.insert_all(DailyNumbersUserSolution, discovery_rows)
    end

    solution_set =
      solution_set
      |> Ecto.Changeset.change(%{
        solution_key_version: @solution_key_version,
        solution_count: solver_result.total,
        computation_ms: round(solver_result.computation_ms)
      })
      |> Repo.update!()

    Logger.info("daily numbers solution set canonicalization upgraded",
      event: "daily_numbers_solver_upgrade",
      date: Date.to_iso8601(solution_set.date),
      mode: solution_set.mode,
      previous_version: previous_version,
      solution_key_version: @solution_key_version,
      unique_solutions: solver_result.total,
      discoveries_preserved: length(discovery_rows),
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

  defp solution_set_lock_key(date, mode) do
    "daily-numbers-solution-set:#{Date.to_iso8601(date)}:#{mode}"
  end

  defp lock_solution_set!(lock_key) do
    Repo.query!("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [lock_key])
  end
end
