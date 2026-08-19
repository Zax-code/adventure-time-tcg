defmodule AdventureTimeApi.Leaderboards.WeeklySummaryTest do
  use ExUnit.Case, async: true

  alias AdventureTimeApi.Leaderboards.WeeklySummary

  test "sums additive weekly results" do
    assert WeeklySummary.source("steps/default", [
             result(%{"steps" => 12_000}, 600_000),
             result(%{"steps" => 8_500}, 425_000)
           ]) == %{
             "kind" => "weekly_steps",
             "resultCount" => 2,
             "scoringResultCount" => 2,
             "steps" => 20_500
           }

    assert WeeklySummary.source("speed-calculus/ranked", [
             result(%{"correctAnswers" => 18}, 900_000),
             result(%{"correctAnswers" => 0}, 0),
             result(%{"correctAnswers" => 23}, 1_150_000)
           ]) == %{
             "correctAnswers" => 41,
             "kind" => "weekly_correct_answers",
             "resultCount" => 3,
             "scoringResultCount" => 2
           }
  end

  test "only sums successful Daily Numbers, Wordle, and Perfect Timing outcomes" do
    assert WeeklySummary.source("daily-numbers/1-5", [
             result(%{"exact" => true, "elapsedMs" => 34_000}, 400_000),
             result(%{"exact" => false, "elapsedMs" => 90_000}, 0),
             result(%{"exact" => true, "elapsedMs" => 26_000}, 500_000)
           ]) == %{
             "exactResults" => 2,
             "kind" => "weekly_exact_completion",
             "resultCount" => 3,
             "scoringResultCount" => 2,
             "totalElapsedMs" => 60_000
           }

    assert WeeklySummary.source("wordle/en", [
             result(%{"outcome" => "solved", "guesses" => 3}, 800_000),
             result(%{"outcome" => "failed", "guesses" => 6}, 0),
             result(%{"outcome" => "solved", "guesses" => 4}, 600_000)
           ]) == %{
             "kind" => "weekly_wordle",
             "resultCount" => 3,
             "scoringResultCount" => 2,
             "solvedResults" => 2,
             "totalGuesses" => 7
           }

    assert WeeklySummary.source("perfect-timing/official", [
             result(%{"outcome" => "success", "absoluteErrorMs" => 40}, 1_000_000),
             result(%{"outcome" => "miss", "absoluteErrorMs" => 900}, 0),
             result(%{"outcome" => "success", "absoluteErrorMs" => 22}, 1_100_000)
           ]) == %{
             "kind" => "weekly_duration_error",
             "resultCount" => 3,
             "scoringResultCount" => 2,
             "successfulResults" => 2,
             "totalAbsoluteErrorMs" => 62
           }
  end

  test "combines family summaries and produces an all-quests result ratio" do
    daily_numbers = [
      row(%{
        "exactResults" => 4,
        "kind" => "weekly_exact_completion",
        "resultCount" => 6,
        "scoringResultCount" => 4,
        "totalElapsedMs" => 90_000
      }),
      row(%{
        "exactResults" => 5,
        "kind" => "weekly_exact_completion",
        "resultCount" => 6,
        "scoringResultCount" => 5,
        "totalElapsedMs" => 110_000
      })
    ]

    combined = WeeklySummary.combine("daily-numbers/family", daily_numbers)

    assert combined == %{
             "exactResults" => 9,
             "kind" => "weekly_exact_completion",
             "resultCount" => 12,
             "scoringResultCount" => 9,
             "totalElapsedMs" => 200_000
           }

    assert WeeklySummary.overall([
             row(combined),
             row(%{
               "kind" => "weekly_correct_answers",
               "correctAnswers" => 60,
               "resultCount" => 5,
               "scoringResultCount" => 5
             })
           ]) == %{
             "familiesPlayed" => 2,
             "kind" => "weekly_overall",
             "resultCount" => 17,
             "scoringResultCount" => 14
           }
  end

  defp result(raw_result, points_milli) do
    %{raw_result: raw_result, points_milli: points_milli}
  end

  defp row(raw_result), do: %{raw_result: raw_result}
end
