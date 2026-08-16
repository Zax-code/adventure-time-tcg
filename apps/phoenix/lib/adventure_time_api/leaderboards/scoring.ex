defmodule AdventureTimeApi.Leaderboards.Scoring do
  @moduledoc """
  Pure, versioned conversion of validated leaderboard outcomes into milli-points.

  This module does not validate quest gameplay and does not award quest or leaderboard
  rewards. Callers must supply a server-validated normalized outcome.
  """

  @display_max 1_000
  @storage_scale 1_000

  @spec launch_configuration() :: map()
  def launch_configuration do
    %{
      schema_version: 1,
      version: "2026-W34-v1",
      effective_competition_week: ~D[2026-08-17],
      points: %{
        display_max: @display_max,
        storage_scale: @storage_scale,
        rounding: :half_up
      },
      boards: %{
        "steps/default" => %{
          formula: :saturating_higher_better,
          parameters: %{minimum: 0, scale: 20_000}
        },
        "daily-numbers/1-5" => daily_numbers_configuration(),
        "daily-numbers/2-4" => daily_numbers_configuration(),
        "daily-numbers/3-3" => daily_numbers_configuration(),
        "wordle/fr" => %{
          formula: :outcome_lookup,
          parameters: wordle_parameters()
        },
        "wordle/en" => %{
          formula: :outcome_lookup,
          parameters: wordle_parameters()
        },
        "speed-calculus/ranked" => %{
          formula: :saturating_higher_better,
          parameters: %{minimum: 0, scale: 20}
        },
        "perfect-timing/official" => %{
          formula: :successful_linear_error,
          parameters: %{miss_points: 0, minimum_successful_points: 100, max_error_ms: 300}
        },
        "daily-numbers/family" => %{
          formula: :derived_equal_average,
          parameters: %{
            members: ["daily-numbers/1-5", "daily-numbers/2-4", "daily-numbers/3-3"],
            missing_member_points: 0
          }
        },
        "wordle/family" => %{
          formula: :derived_equal_average,
          parameters: %{
            members: ["wordle/fr", "wordle/en"],
            missing_member_points: 0
          }
        }
      },
      weekly: %{formula: :average_best_n_qualified, best_results: 3, minimum_valid_results: 3}
    }
  end

  @spec validate_configuration(map(), Date.t()) :: :ok | {:error, atom()}
  def validate_configuration(config, %Date{} = today) do
    expected_board_keys =
      AdventureTimeApi.Leaderboards.Boards.launch_catalog()
      |> MapSet.new(& &1.key)

    with %{schema_version: 1, version: version, effective_competition_week: effective_week} <-
           config,
         true <- (is_binary(version) and version != "") or {:error, :invalid_version},
         true <- valid_effective_week?(effective_week, today) or {:error, :invalid_effective_week},
         %{boards: boards} when is_map(boards) <- config,
         true <-
           MapSet.new(Map.keys(boards)) == expected_board_keys or
             {:error, :incomplete_board_coverage},
         true <-
           Enum.all?(boards, &valid_board_configuration?/1) or
             {:error, :invalid_board_configuration},
         true <-
           valid_weekly_configuration?(config[:weekly]) or
             {:error, :invalid_weekly_configuration} do
      :ok
    else
      {:error, reason} -> {:error, reason}
      _ -> {:error, :invalid_configuration}
    end
  end

  def validate_configuration(_config, _today), do: {:error, :invalid_configuration}

  @spec score(map(), String.t(), map()) :: {:ok, non_neg_integer()} | {:error, atom()}
  def score(config, board_key, raw_result) do
    with {:ok, board_config} <- fetch_board(config, board_key) do
      score_formula(board_config, raw_result)
    end
  end

  @spec weekly(map(), [non_neg_integer()]) :: {:ok, map()} | {:error, atom()}
  def weekly(
        %{weekly: %{best_results: best_results, minimum_valid_results: minimum_valid_results}},
        points_milli
      )
      when is_list(points_milli) and is_integer(best_results) and best_results > 0 and
             is_integer(minimum_valid_results) and minimum_valid_results > 0 do
    if Enum.all?(points_milli, &valid_points_milli?/1) do
      selected_points_milli =
        points_milli
        |> Enum.sort(:desc)
        |> Enum.take(best_results)

      if length(points_milli) >= minimum_valid_results do
        {:ok,
         %{
           status: :ranked,
           points_milli:
             divide_half_up(Enum.sum(selected_points_milli), length(selected_points_milli)),
           valid_result_count: length(points_milli),
           selected_points_milli: selected_points_milli
         }}
      else
        {:ok,
         %{
           status: :unranked,
           points_milli: nil,
           valid_result_count: length(points_milli),
           required_result_count: minimum_valid_results,
           selected_points_milli: selected_points_milli
         }}
      end
    else
      {:error, :invalid_weekly_results}
    end
  end

  def weekly(_config, _points_milli), do: {:error, :invalid_weekly_results}

  @spec derived(map(), String.t(), %{optional(String.t()) => non_neg_integer()}) ::
          {:ok, map()} | {:error, atom()}
  def derived(config, board_key, member_points) when is_map(member_points) do
    with {:ok,
          %{
            formula: :derived_equal_average,
            parameters: %{members: members, missing_member_points: missing_points}
          }} <- fetch_board(config, board_key),
         true <- is_list(members) and members != [] and valid_points_milli?(missing_points),
         true <-
           Enum.all?(member_points, fn {key, value} ->
             key in members and valid_points_milli?(value)
           end) do
      normalized = Map.new(members, &{&1, Map.get(member_points, &1, missing_points)})

      {:ok,
       %{
         points_milli: divide_half_up(Enum.sum(Map.values(normalized)), length(members)),
         member_points_milli: normalized
       }}
    else
      _ -> {:error, :invalid_derived_results}
    end
  end

  def derived(_config, _board_key, _member_points), do: {:error, :invalid_derived_results}

  @overall_families [:steps, :daily_numbers, :wordle, :speed_calculus, :perfect_timing]

  @spec overall(%{optional(atom()) => non_neg_integer()}) :: {:ok, map()} | {:error, atom()}
  def overall(family_points) when is_map(family_points) do
    if Enum.all?(family_points, fn {family, points} ->
         family in @overall_families and valid_points_milli?(points)
       end) do
      if map_size(family_points) == 0 do
        {:ok, %{status: :unranked, points_milli: nil, selected_families: []}}
      else
        selected =
          @overall_families
          |> Enum.map(&{&1, Map.get(family_points, &1, 0)})
          |> Enum.sort_by(fn {_family, points} -> points end, :desc)
          |> Enum.take(4)

        {:ok,
         %{
           status: :ranked,
           points_milli: divide_half_up(Enum.sum(Enum.map(selected, &elem(&1, 1))), 4),
           selected_families: Enum.map(selected, &elem(&1, 0))
         }}
      end
    else
      {:error, :invalid_overall_results}
    end
  end

  def overall(_family_points), do: {:error, :invalid_overall_results}

  defp fetch_board(%{boards: boards}, board_key) when is_map(boards) do
    case Map.fetch(boards, board_key) do
      {:ok, board_config} -> {:ok, board_config}
      :error -> {:error, :unknown_board}
    end
  end

  defp fetch_board(_config, _board_key), do: {:error, :invalid_configuration}

  defp score_formula(
         %{formula: :saturating_higher_better, parameters: %{minimum: minimum, scale: scale}},
         %{"steps" => value}
       )
       when is_integer(value) and value >= minimum and is_number(scale) and scale > 0 do
    points_milli =
      (@display_max * @storage_scale * (1.0 - :math.exp(-(value - minimum) / scale)))
      |> round()

    {:ok, points_milli}
  end

  defp score_formula(
         %{formula: :saturating_higher_better, parameters: %{minimum: minimum, scale: scale}},
         %{"correctAnswers" => value}
       )
       when is_integer(value) and value >= minimum and is_number(scale) and scale > 0 do
    points_milli =
      (@display_max * @storage_scale * (1.0 - :math.exp(-(value - minimum) / scale)))
      |> round()

    {:ok, points_milli}
  end

  defp score_formula(
         %{
           formula: :exact_asymptotic_lower_better,
           parameters: %{scale_ms: scale_ms, base_points: base_points}
         },
         %{"exact" => true, "elapsedMs" => elapsed_ms}
       )
       when is_integer(elapsed_ms) and elapsed_ms >= 0 and is_integer(scale_ms) and
              scale_ms > 0 and is_integer(base_points) and base_points >= 0 and
              base_points < @display_max do
    variable_points_milli =
      divide_half_up(
        (@display_max - base_points) * @storage_scale * scale_ms,
        scale_ms + elapsed_ms
      )

    {:ok, base_points * @storage_scale + variable_points_milli}
  end

  defp score_formula(
         %{formula: :exact_asymptotic_lower_better},
         %{"exact" => false, "elapsedMs" => elapsed_ms}
       )
       when is_integer(elapsed_ms) and elapsed_ms >= 0,
       do: {:ok, 0}

  defp score_formula(
         %{formula: :outcome_lookup, parameters: %{solved: solved}},
         %{"outcome" => "solved", "guesses" => guesses}
       )
       when is_integer(guesses) do
    case Map.fetch(solved, guesses) do
      {:ok, points} -> {:ok, points * @storage_scale}
      :error -> {:error, :invalid_raw_result}
    end
  end

  defp score_formula(
         %{formula: :outcome_lookup, parameters: %{failed: failed}},
         %{"outcome" => "failed", "guesses" => guesses}
       )
       when is_integer(guesses) and guesses >= 1,
       do: {:ok, failed * @storage_scale}

  defp score_formula(
         %{
           formula: :successful_linear_error,
           parameters: %{
             minimum_successful_points: minimum_points,
             max_error_ms: max_error_ms
           }
         },
         %{"outcome" => "success", "absoluteErrorMs" => absolute_error_ms}
       )
       when is_integer(absolute_error_ms) and absolute_error_ms >= 0 and
              is_integer(minimum_points) and minimum_points >= 0 and
              minimum_points < @display_max and is_integer(max_error_ms) and
              max_error_ms > 0 do
    ranked_error_ms = min(absolute_error_ms, max_error_ms)

    variable_points_milli =
      divide_half_up(
        (@display_max - minimum_points) * @storage_scale *
          (max_error_ms - ranked_error_ms),
        max_error_ms
      )

    {:ok, minimum_points * @storage_scale + variable_points_milli}
  end

  defp score_formula(
         %{formula: :successful_linear_error, parameters: %{miss_points: miss_points}},
         %{"outcome" => "miss", "absoluteErrorMs" => absolute_error_ms}
       )
       when is_integer(absolute_error_ms) and absolute_error_ms >= 0 and
              is_integer(miss_points) and miss_points >= 0,
       do: {:ok, miss_points * @storage_scale}

  defp score_formula(_board_config, _raw_result), do: {:error, :invalid_raw_result}

  defp valid_points_milli?(points_milli) do
    is_integer(points_milli) and points_milli >= 0 and
      points_milli <= @display_max * @storage_scale
  end

  defp valid_effective_week?(%Date{} = effective_week, %Date{} = today) do
    Date.compare(effective_week, today) == :gt and Date.day_of_week(effective_week) == 1
  end

  defp valid_effective_week?(_effective_week, _today), do: false

  defp valid_board_configuration?(
         {_key,
          %{
            formula: :saturating_higher_better,
            parameters: %{minimum: minimum, scale: scale} = parameters
          }}
       ) do
    map_size(parameters) == 2 and is_integer(minimum) and minimum >= 0 and
      is_number(scale) and scale > 0
  end

  defp valid_board_configuration?(
         {_key,
          %{
            formula: :exact_asymptotic_lower_better,
            parameters: %{scale_ms: scale_ms, base_points: base_points} = parameters
          }}
       ) do
    map_size(parameters) == 2 and is_integer(scale_ms) and scale_ms > 0 and
      is_integer(base_points) and base_points >= 0 and base_points < @display_max
  end

  defp valid_board_configuration?(
         {_key,
          %{
            formula: :outcome_lookup,
            parameters: %{solved: solved, failed: failed} = parameters
          }}
       ) do
    map_size(parameters) == 2 and Map.keys(solved) |> Enum.sort() == Enum.to_list(1..6) and
      Enum.all?(solved, fn {_guesses, points} -> valid_display_points?(points) end) and
      valid_display_points?(failed)
  end

  defp valid_board_configuration?(
         {_key,
          %{
            formula: :successful_linear_error,
            parameters:
              %{
                miss_points: miss_points,
                minimum_successful_points: minimum_points,
                max_error_ms: max_error_ms
              } = parameters
          }}
       ) do
    map_size(parameters) == 3 and valid_display_points?(miss_points) and
      valid_display_points?(minimum_points) and minimum_points < @display_max and
      is_integer(max_error_ms) and max_error_ms > 0
  end

  defp valid_board_configuration?(
         {_key,
          %{
            formula: :derived_equal_average,
            parameters: %{members: members, missing_member_points: missing_points} = parameters
          }}
       ) do
    map_size(parameters) == 2 and is_list(members) and members != [] and
      Enum.all?(members, &is_binary/1) and length(Enum.uniq(members)) == length(members) and
      valid_points_milli?(missing_points)
  end

  defp valid_board_configuration?(_board), do: false

  defp valid_display_points?(points) do
    is_integer(points) and points >= 0 and points <= @display_max
  end

  defp valid_weekly_configuration?(%{
         formula: :average_best_n_qualified,
         best_results: best_results,
         minimum_valid_results: minimum_valid_results
       }) do
    is_integer(best_results) and best_results > 0 and
      is_integer(minimum_valid_results) and minimum_valid_results > 0 and
      best_results == minimum_valid_results
  end

  defp valid_weekly_configuration?(_weekly), do: false

  defp divide_half_up(numerator, denominator) do
    div(2 * numerator + denominator, 2 * denominator)
  end

  defp daily_numbers_configuration do
    %{
      formula: :exact_asymptotic_lower_better,
      parameters: %{scale_ms: 120_000, base_points: 100}
    }
  end

  defp wordle_parameters do
    %{
      solved: %{1 => 1_000, 2 => 900, 3 => 750, 4 => 550, 5 => 350, 6 => 200},
      failed: 0
    }
  end
end
