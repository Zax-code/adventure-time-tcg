defmodule AdventureTimeApi.Quests.DailyNumbersSolverTest do
  use ExUnit.Case, async: true

  alias AdventureTimeApi.Quests.{
    DailyNumbersEngine,
    DailyNumbersExpression,
    DailyNumbersSolver
  }

  test "enumerates each canonical exact solution once" do
    result = DailyNumbersSolver.solve(tiles([2, 3]), 5)

    assert result.total == 1
    assert Enum.map(result.solutions, & &1.canonical_key) == ["+(n:2,n:3)"]

    assert Enum.all?(result.solutions, fn solution ->
             DailyNumbersExpression.evaluate(solution.expression) == 5
           end)
  end

  test "enforces single-use tiles while allowing duplicate number instances" do
    assert DailyNumbersSolver.solve(tiles([2]), 4).total == 0

    duplicate_result = DailyNumbersSolver.solve(tiles([2, 2]), 4)

    assert Enum.map(duplicate_result.solutions, & &1.canonical_key) == [
             "*(n:2,n:2)",
             "+(n:2,n:2)"
           ]
  end

  test "uses only positive integer intermediates and exact division" do
    assert Enum.map(DailyNumbersSolver.solve(tiles([3, 2]), 1).solutions, & &1.canonical_key) == [
             "-(n:3,n:2)"
           ]

    assert Enum.map(DailyNumbersSolver.solve(tiles([6, 3]), 2).solutions, & &1.canonical_key) == [
             "/(n:6,n:3)"
           ]

    assert DailyNumbersSolver.solve(tiles([2, 2]), 0).total == 0
  end

  test "materializes every enumerated expression into validator-approved tile steps" do
    number_tiles = tiles([2, 3, 7])
    puzzle = %{numbers: Enum.map(number_tiles, &Map.put(&1, :source, "initial")), target: 5}
    result = DailyNumbersSolver.solve(number_tiles, 5)

    assert result.total > 0

    Enum.each(result.solutions, fn solution ->
      assert {:ok, steps} =
               DailyNumbersSolver.materialize_steps(solution.expression, number_tiles)

      assert {:ok, submission} = DailyNumbersEngine.validate_submission(puzzle, steps)
      assert submission.exact
      assert submission.canonicalKey == solution.canonical_key
    end)
  end

  test "deduplicates solutions whose visible arithmetic steps only swap equal-valued resources" do
    number_tiles = tiles([1, 2, 3, 4])
    result = DailyNumbersSolver.solve(number_tiles, 15)

    display_signatures =
      Enum.map(result.solutions, fn solution ->
        {:ok, steps} = DailyNumbersSolver.materialize_steps(solution.expression, number_tiles)

        steps
        |> Enum.map(fn step ->
          operands =
            if step.operator in ["+", "*"],
              do: Enum.sort([step.leftValue, step.rightValue]),
              else: [step.leftValue, step.rightValue]

          {step.operator, operands, step.resultValue}
        end)
        |> Enum.sort()
      end)

    assert result.total == 6
    assert length(display_signatures) == MapSet.size(MapSet.new(display_signatures))
  end

  test "player submissions use the solver key after associative canonicalization" do
    number_tiles = tiles([3, 5, 10, 8, 100, 6])
    puzzle = %{numbers: Enum.map(number_tiles, &Map.put(&1, :source, "initial")), target: 956}

    player_steps = [
      %{leftId: "n0", operator: "*", rightId: "n1", resultId: "r0"},
      %{leftId: "n2", operator: "*", rightId: "r0", resultId: "r1"},
      %{leftId: "n3", operator: "*", rightId: "n4", resultId: "r2"},
      %{leftId: "r1", operator: "+", rightId: "r2", resultId: "r3"},
      %{leftId: "n5", operator: "+", rightId: "r3", resultId: "r4"}
    ]

    assert {:ok, submission} = DailyNumbersEngine.validate_submission(puzzle, player_steps)
    assert submission.exact

    matching_solution =
      number_tiles
      |> DailyNumbersSolver.solve(puzzle.target)
      |> Map.fetch!(:solutions)
      |> Enum.find(&(&1.canonical_key == submission.canonicalKey))

    assert matching_solution
    assert submission.solutionKey == matching_solution.solution_key
  end

  defp tiles(values) do
    values
    |> Enum.with_index()
    |> Enum.map(fn {value, index} -> %{id: "n#{index}", value: value} end)
  end
end
