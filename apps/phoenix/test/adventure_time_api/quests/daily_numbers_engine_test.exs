defmodule AdventureTimeApi.Quests.DailyNumbersEngineTest do
  use ExUnit.Case, async: true

  alias AdventureTimeApi.Quests.DailyNumbersEngine

  defp puzzle(target) do
    %{
      target: target,
      numbers: [
        %{id: "n0", value: 100, source: "initial"},
        %{id: "n1", value: 10, source: "initial"},
        %{id: "n2", value: 7, source: "initial"},
        %{id: "n3", value: 5, source: "initial"},
        %{id: "n4", value: 3, source: "initial"},
        %{id: "n5", value: 2, source: "initial"}
      ]
    }
  end

  test "generate_puzzle supports the three numeric number mixes" do
    date = ~D[2026-06-25]

    assert {:ok, one_five} = DailyNumbersEngine.generate_puzzle("1-5", date)
    assert {:ok, two_four} = DailyNumbersEngine.generate_puzzle("2-4", date)
    assert {:ok, three_three} = DailyNumbersEngine.generate_puzzle("3-3", date)

    assert one_five.mode == "1-5"
    assert two_four.mode == "2-4"
    assert three_three.mode == "3-3"

    assert Enum.count(one_five.numbers, &(&1.value in [25, 50, 75, 100])) == 1
    assert Enum.count(two_four.numbers, &(&1.value in [25, 50, 75, 100])) == 2
    assert Enum.count(three_three.numbers, &(&1.value in [25, 50, 75, 100])) == 3

    assert one_five.shortestExactOperationsCount > 2
    assert two_four.shortestExactOperationsCount > 2
    assert three_three.shortestExactOperationsCount > 2
  end

  test "generate_puzzle skips exact puzzles solvable in two steps or fewer" do
    assert {:ok, puzzle} = DailyNumbersEngine.generate_puzzle("2-4", ~D[2026-06-05])

    assert puzzle.generationAttempt == 2
    assert puzzle.shortestExactOperationsCount > 2
    assert length(puzzle.solution) > 2
  end

  test "future puzzle generation prefers the bounded Solution Hunt count range" do
    assert DailyNumbersEngine.solution_hunt_solution_range() == 5..30
    assert DailyNumbersEngine.max_solution_hunt_quality_checks() == 20

    for mode <- ["1-5", "2-4", "3-3"] do
      assert {:ok, puzzle} = DailyNumbersEngine.generate_puzzle(mode, ~D[2026-08-19])
      assert puzzle.solutionCount in DailyNumbersEngine.solution_hunt_solution_range()
      assert puzzle.shortestExactOperationsCount > 2
    end
  end

  test "validate_submission starts the untouched board at 0 percent" do
    assert {:ok, submission} = DailyNumbersEngine.validate_submission(puzzle(850), [])

    assert submission.defaultDistance == 750
    assert submission.distance == 750
    assert submission.score == 0
    assert submission.completed == false
  end

  test "validate_submission returns a percentage for closer non-exact results" do
    assert {:ok, submission} =
             DailyNumbersEngine.validate_submission(puzzle(850), [
               %{
                 "leftId" => "n0",
                 "operator" => "*",
                 "rightId" => "n1",
                 "resultId" => "r0"
               }
             ])

    assert submission.defaultDistance == 750
    assert submission.finalValue == 1000
    assert submission.distance == 150
    assert submission.score == 80
    assert submission.completed == true
    assert submission.exact == false
  end

  test "validate_submission clamps worse-than-start results to 0 percent" do
    assert {:ok, submission} =
             DailyNumbersEngine.validate_submission(puzzle(850), [
               %{
                 "leftId" => "n0",
                 "operator" => "/",
                 "rightId" => "n5",
                 "resultId" => "r0"
               }
             ])

    assert submission.defaultDistance == 750
    assert submission.finalValue == 50
    assert submission.distance == 800
    assert submission.score == 0
    assert submission.completed == false
  end

  test "validate_submission returns 100 percent for exact results" do
    assert {:ok, submission} =
             DailyNumbersEngine.validate_submission(puzzle(1000), [
               %{
                 "leftId" => "n0",
                 "operator" => "*",
                 "rightId" => "n1",
                 "resultId" => "r0"
               }
             ])

    assert submission.defaultDistance == 900
    assert submission.distance == 0
    assert submission.score == 100
    assert submission.completed == true
    assert submission.exact == true
  end
end
