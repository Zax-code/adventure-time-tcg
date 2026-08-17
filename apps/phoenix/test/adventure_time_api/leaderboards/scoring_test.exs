defmodule AdventureTimeApi.Leaderboards.ScoringTest do
  use ExUnit.Case, async: true

  alias AdventureTimeApi.Leaderboards.Scoring

  describe "score/3" do
    test "scores steps linearly at one point per 20 steps without a ceiling" do
      config = Scoring.launch_configuration()

      assert {:ok, 250_000} = Scoring.score(config, "steps/default", %{"steps" => 5_000})
      assert {:ok, 500_000} = Scoring.score(config, "steps/default", %{"steps" => 10_000})
      assert {:ok, 5_000_000} = Scoring.score(config, "steps/default", %{"steps" => 100_000})
    end

    test "scores exact Daily Numbers solutions with the locked piecewise power curve" do
      config = Scoring.launch_configuration()

      expected = %{
        10 => 7_943_000,
        100 => 3_981_000,
        500 => 2_456_000,
        1_000 => 1_995_000,
        2_000 => 1_621_000,
        3_000 => 1_435_000,
        5_000 => 1_231_000,
        8_000 => 1_069_000,
        10_000 => 1_000_000,
        30_000 => 439_000,
        60_000 => 261_000,
        120_000 => 155_000,
        240_000 => 92_000,
        600_000 => 46_000
      }

      for {elapsed_ms, points_milli} <- expected do
        assert {:ok, ^points_milli} =
                 Scoring.score(config, "daily-numbers/1-5", %{
                   "exact" => true,
                   "elapsedMs" => elapsed_ms
                 })
      end

      assert {:error, :invalid_raw_result} =
               Scoring.score(config, "daily-numbers/1-5", %{
                 "exact" => true,
                 "elapsedMs" => 0
               })
    end

    test "scores a settled non-exact Daily Numbers result as a valid zero" do
      config = Scoring.launch_configuration()

      assert {:ok, 0} =
               Scoring.score(config, "daily-numbers/1-5", %{
                 "exact" => false,
                 "elapsedMs" => 42_000
               })

      assert {:ok, 0} =
               Scoring.score(config, "daily-numbers/1-5", %{
                 "exact" => false,
                 "elapsedMs" => 0
               })
    end

    test "scores Wordle guesses with the locked even progression in both languages" do
      config = Scoring.launch_configuration()

      expected = %{
        1 => 1_200_000,
        2 => 1_000_000,
        3 => 800_000,
        4 => 600_000,
        5 => 400_000,
        6 => 200_000
      }

      for board <- ["wordle/en", "wordle/fr"], {guesses, points_milli} <- expected do
        assert {:ok, ^points_milli} =
                 Scoring.score(config, board, %{"outcome" => "solved", "guesses" => guesses})
      end
    end

    test "scores a failed Wordle as a valid zero" do
      config = Scoring.launch_configuration()

      assert {:ok, 0} =
               Scoring.score(config, "wordle/fr", %{"outcome" => "failed", "guesses" => 6})
    end

    test "scores Speed Calculus linearly at 50 points per correct answer without a ceiling" do
      config = Scoring.launch_configuration()

      assert {:ok, 1_000_000} =
               Scoring.score(config, "speed-calculus/ranked", %{"correctAnswers" => 20})

      assert {:ok, 5_000_000} =
               Scoring.score(config, "speed-calculus/ranked", %{"correctAnswers" => 100})
    end

    test "scores successful Perfect Timing results from 1,200 to 100 whole points" do
      config = Scoring.launch_configuration()

      expected = %{
        0 => 1_200_000,
        10 => 1_163_000,
        25 => 1_108_000,
        50 => 1_017_000,
        100 => 833_000,
        150 => 650_000,
        200 => 467_000,
        250 => 283_000,
        300 => 100_000
      }

      for {absolute_error_ms, points_milli} <- expected do
        assert {:ok, ^points_milli} =
                 Scoring.score(config, "perfect-timing/official", %{
                   "outcome" => "success",
                   "absoluteErrorMs" => absolute_error_ms
                 })
      end

      assert {:error, :invalid_raw_result} =
               Scoring.score(config, "perfect-timing/official", %{
                 "outcome" => "success",
                 "absoluteErrorMs" => 301
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
    test "sums every valid daily point value" do
      config = Scoring.launch_configuration()

      assert {:ok,
              %{
                status: :ranked,
                points_milli: 1_900_000,
                valid_result_count: 4,
                selected_points_milli: [900_000, 600_000, 300_000, 100_000]
              }} = Scoring.weekly(config, [100_000, 900_000, 600_000, 300_000])
    end

    test "ranks the best available results when fewer than three exist" do
      config = Scoring.launch_configuration()

      assert {:ok,
              %{
                status: :ranked,
                points_milli: 800_000,
                valid_result_count: 2,
                selected_points_milli: [800_000, 0]
              }} = Scoring.weekly(config, [0, 800_000])

      assert {:ok,
              %{
                status: :ranked,
                points_milli: 0,
                valid_result_count: 1,
                selected_points_milli: [0]
              }} = Scoring.weekly(config, [0])

      assert {:ok,
              %{
                status: :unranked,
                points_milli: nil,
                valid_result_count: 0,
                required_result_count: 1,
                selected_points_milli: []
              }} = Scoring.weekly(config, [])
    end

    test "preserves persisted legacy weekly calculations for finalized history" do
      config =
        Scoring.launch_configuration()
        |> Map.put(:weekly, %{
          formula: :average_best_n_qualified,
          best_results: 3,
          minimum_valid_results: 3
        })

      assert {:ok, %{status: :unranked, required_result_count: 3}} =
               Scoring.weekly(config, [900_000, 600_000])

      assert {:ok, %{status: :ranked, points_milli: 600_000}} =
               Scoring.weekly(config, [900_000, 600_000, 300_000, 100_000])
    end
  end

  describe "derived/3" do
    test "sums every eligible family member and treats a missing member as zero" do
      config = Scoring.launch_configuration()

      assert {:ok,
              %{
                points_milli: 1_200_000,
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

    test "accepts summed weekly member totals above the daily point ceiling" do
      config = Scoring.launch_configuration()

      assert {:ok, %{points_milli: 6_000_000}} =
               Scoring.derived(config, "daily-numbers/family", %{
                 "daily-numbers/1-5" => 4_000_000,
                 "daily-numbers/2-4" => 2_000_000
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
