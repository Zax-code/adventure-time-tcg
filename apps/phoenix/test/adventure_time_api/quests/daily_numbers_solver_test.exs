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

  defp tiles(values) do
    values
    |> Enum.with_index()
    |> Enum.map(fn {value, index} -> %{id: "n#{index}", value: value} end)
  end
end
