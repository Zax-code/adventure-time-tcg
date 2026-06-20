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
