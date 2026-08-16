defmodule AdventureTimeApi.Leaderboards.ScoringTest do
  use ExUnit.Case, async: true

  alias AdventureTimeApi.Leaderboards.Scoring

  describe "score/3" do
    test "scores displayed steps with the selected 20,000-step saturation scale" do
      config = Scoring.launch_configuration()

      assert {:ok, 632_121} =
               Scoring.score(config, "steps/default", %{"steps" => 20_000})
    end

    test "scores an exact Daily Numbers solution with the selected 120-second anchor" do
      config = Scoring.launch_configuration()

      assert {:ok, 550_000} =
               Scoring.score(config, "daily-numbers/1-5", %{
                 "exact" => true,
                 "elapsedMs" => 120_000
               })
    end

    test "scores a settled non-exact Daily Numbers result as a valid zero" do
      config = Scoring.launch_configuration()

      assert {:ok, 0} =
               Scoring.score(config, "daily-numbers/1-5", %{
                 "exact" => false,
                 "elapsedMs" => 42_000
               })
    end

    test "scores Wordle guesses from the selected fixed lookup" do
      config = Scoring.launch_configuration()

      assert {:ok, 750_000} =
               Scoring.score(config, "wordle/fr", %{"outcome" => "solved", "guesses" => 3})
    end

    test "scores a failed Wordle as a valid zero" do
      config = Scoring.launch_configuration()

      assert {:ok, 0} =
               Scoring.score(config, "wordle/fr", %{"outcome" => "failed", "guesses" => 6})
    end

    test "scores Speed Calculus with the selected 20-correct saturation scale" do
      config = Scoring.launch_configuration()

      assert {:ok, 632_121} =
               Scoring.score(config, "speed-calculus/ranked", %{"correctAnswers" => 20})
    end

    test "scores a successful Perfect Timing result linearly per millisecond" do
      config = Scoring.launch_configuration()

      assert {:ok, 850_000} =
               Scoring.score(config, "perfect-timing/official", %{
                 "outcome" => "success",
                 "absoluteErrorMs" => 50
               })
    end

    test "scores a Perfect Timing miss as a valid zero" do
      config = Scoring.launch_configuration()

      assert {:ok, 0} =
               Scoring.score(config, "perfect-timing/official", %{
                 "outcome" => "miss",
                 "absoluteErrorMs" => 301
               })
    end
  end

  describe "weekly/2" do
    test "averages the best three valid daily point values" do
      config = Scoring.launch_configuration()

      assert {:ok,
              %{
                status: :ranked,
                points_milli: 600_000,
                valid_result_count: 4,
                selected_points_milli: [900_000, 600_000, 300_000]
              }} = Scoring.weekly(config, [100_000, 900_000, 600_000, 300_000])
    end

    test "keeps players with fewer than three valid results unranked" do
      config = Scoring.launch_configuration()

      assert {:ok,
              %{
                status: :unranked,
                points_milli: nil,
                valid_result_count: 2,
                required_result_count: 3,
                selected_points_milli: [800_000, 0]
              }} = Scoring.weekly(config, [0, 800_000])
    end
  end

  describe "derived/3" do
    test "equally averages every family member and treats a missing member as zero" do
      config = Scoring.launch_configuration()

      assert {:ok,
              %{
                points_milli: 400_000,
                member_points_milli: %{
                  "daily-numbers/1-5" => 900_000,
                  "daily-numbers/2-4" => 300_000,
                  "daily-numbers/3-3" => 0
                }
              }} =
               Scoring.derived(config, "daily-numbers/family", %{
                 "daily-numbers/1-5" => 900_000,
                 "daily-numbers/2-4" => 300_000
               })
    end
  end

  describe "validate_configuration/2" do
    test "accepts the complete allow-listed launch configuration for a future Monday" do
      assert :ok =
               Scoring.validate_configuration(
                 Scoring.launch_configuration(),
                 ~D[2026-08-15]
               )
    end

    test "rejects incomplete board coverage" do
      config = Scoring.launch_configuration()
      config = put_in(config, [:boards], Map.delete(config.boards, "wordle/en"))

      assert {:error, :incomplete_board_coverage} =
               Scoring.validate_configuration(config, ~D[2026-08-15])
    end

    test "rejects activation dates that are not a future Monday" do
      config = %{Scoring.launch_configuration() | effective_competition_week: ~D[2026-08-18]}

      assert {:error, :invalid_effective_week} =
               Scoring.validate_configuration(config, ~D[2026-08-15])
    end

    test "rejects unknown or extra formula parameters" do
      config = Scoring.launch_configuration()

      config =
        put_in(
          config,
          [:boards, "steps/default", :parameters, :client_multiplier],
          2
        )

      assert {:error, :invalid_board_configuration} =
               Scoring.validate_configuration(config, ~D[2026-08-15])
    end
  end

  describe "overall/1" do
    test "averages the best four of five quest-family scores without account-age accumulation" do
      assert {:ok,
              %{
                status: :ranked,
                points_milli: 575_000,
                selected_families: [:steps, :daily_numbers, :wordle, :speed_calculus]
              }} =
               Scoring.overall(%{
                 steps: 800_000,
                 daily_numbers: 600_000,
                 wordle: 500_000,
                 speed_calculus: 400_000,
                 perfect_timing: 300_000
               })
    end

    test "uses zero for missing families but requires one valid family score" do
      assert {:ok, %{status: :ranked, points_milli: 200_000}} =
               Scoring.overall(%{steps: 800_000})

      assert {:ok, %{status: :unranked, points_milli: nil}} = Scoring.overall(%{})
    end
  end
end
