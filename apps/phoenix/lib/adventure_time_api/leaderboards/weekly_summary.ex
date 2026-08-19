defmodule AdventureTimeApi.Leaderboards.WeeklySummary do
  @moduledoc "Builds human-readable summaries from the daily results selected for a week."

  defguardp is_daily_numbers_board(board_key)
            when board_key in [
                   "daily-numbers/1-5",
                   "daily-numbers/2-4",
                   "daily-numbers/3-3"
                 ]

  defguardp is_wordle_board(board_key) when board_key in ["wordle/en", "wordle/fr"]

  @spec source(String.t(), [map()]) :: map()
  def source("steps/default", results) do
    summary("weekly_steps", results, %{
      "steps" => sum_raw(results, "steps")
    })
  end

  def source(board_key, results) when is_daily_numbers_board(board_key) do
    exact_results = Enum.filter(results, &get_in(&1.raw_result, ["exact"]))

    summary("weekly_exact_completion", results, %{
      "exactResults" => length(exact_results),
      "totalElapsedMs" => sum_raw(exact_results, "elapsedMs")
    })
  end

  def source(board_key, results) when is_wordle_board(board_key) do
    solved_results =
      Enum.filter(results, &(get_in(&1.raw_result, ["outcome"]) == "solved"))

    summary("weekly_wordle", results, %{
      "solvedResults" => length(solved_results),
      "totalGuesses" => sum_raw(solved_results, "guesses")
    })
  end

  def source("speed-calculus/ranked", results) do
    summary("weekly_correct_answers", results, %{
      "correctAnswers" => sum_raw(results, "correctAnswers")
    })
  end

  def source("perfect-timing/official", results) do
    successful_results =
      Enum.filter(results, &(get_in(&1.raw_result, ["outcome"]) == "success"))

    summary("weekly_duration_error", results, %{
      "successfulResults" => length(successful_results),
      "totalAbsoluteErrorMs" => sum_raw(successful_results, "absoluteErrorMs")
    })
  end

  @spec combine(String.t(), [map()]) :: map()
  def combine("daily-numbers/family", rows) do
    combine_summaries("weekly_exact_completion", rows, [
      "exactResults",
      "totalElapsedMs"
    ])
  end

  def combine("wordle/family", rows) do
    combine_summaries("weekly_wordle", rows, ["solvedResults", "totalGuesses"])
  end

  @spec overall([map()]) :: map()
  def overall(rows) do
    raw_results = Enum.map(rows, & &1.raw_result)

    %{
      "kind" => "weekly_overall",
      "familiesPlayed" => Enum.count(raw_results, &(&1["resultCount"] > 0)),
      "resultCount" => sum_field(raw_results, "resultCount"),
      "scoringResultCount" => sum_field(raw_results, "scoringResultCount")
    }
  end

  defp summary(kind, results, fields) do
    Map.merge(fields, %{
      "kind" => kind,
      "resultCount" => length(results),
      "scoringResultCount" => Enum.count(results, &(&1.points_milli > 0))
    })
  end

  defp combine_summaries(kind, rows, fields) do
    raw_results = Enum.map(rows, & &1.raw_result)

    fields
    |> Enum.concat(["resultCount", "scoringResultCount"])
    |> Map.new(&{&1, sum_field(raw_results, &1)})
    |> Map.put("kind", kind)
  end

  defp sum_raw(results, field) do
    Enum.reduce(results, 0, &(&2 + Map.fetch!(&1.raw_result, field)))
  end

  defp sum_field(maps, field) do
    Enum.reduce(maps, 0, &(&2 + Map.fetch!(&1, field)))
  end
end
