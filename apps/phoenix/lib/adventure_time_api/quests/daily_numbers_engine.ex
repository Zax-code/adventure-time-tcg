defmodule AdventureTimeApi.Quests.DailyNumbersEngine do
  @moduledoc """
  Pure Daily Numbers logic: deterministic puzzle generation, solving, and
  backend submission validation.
  """

  import Bitwise

  @mask32 0xFFFFFFFF
  @max_attempts 500

  @large_numbers [25, 50, 75, 100]
  @small_numbers [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10]

  @mode_configs %{
    "1-5" => %{large_count: 1, small_count: 5, min_exact_numbers_used: 4},
    "2-4" => %{large_count: 2, small_count: 4, min_exact_numbers_used: 5},
    "3-3" => %{large_count: 3, small_count: 3, min_exact_numbers_used: 5}
  }

  def max_attempts, do: @max_attempts
  def modes, do: Map.keys(@mode_configs)
  def valid_mode?(mode), do: is_binary(mode) and Map.has_key?(@mode_configs, mode)

  def generate_puzzle(mode, %Date{} = date) do
    generate_puzzle(mode, Date.to_iso8601(date))
  end

  def generate_puzzle(mode, date_key) when is_binary(mode) and is_binary(date_key) do
    with {:ok, config} <- fetch_mode_config(mode) do
      find_puzzle(mode, date_key, config, 1, nil)
    end
  end

  def validate_submission(puzzle, steps) when is_map(puzzle) do
    with true <- is_list(steps) || {:error, "steps must be a list"} do
      initial_tiles =
        puzzle
        |> Map.fetch!(:numbers)
        |> Enum.map(fn tile ->
          %{
            id: Map.fetch!(tile, :id),
            value: Map.fetch!(tile, :value),
            source: Map.fetch!(tile, :source)
          }
        end)

      state = %{
        target: Map.fetch!(puzzle, :target),
        tiles: Map.new(initial_tiles, &{&1.id, &1}),
        available_ids: MapSet.new(Enum.map(initial_tiles, & &1.id)),
        validated_steps: []
      }

      default_distance =
        initial_tiles
        |> choose_best_available_tile(state.target)
        |> then(&abs(&1.value - state.target))

      with {:ok, next_state} <-
             Enum.reduce_while(Enum.with_index(steps), {:ok, state}, &apply_step/2) do
        available_tiles =
          next_state.available_ids
          |> Enum.map(&Map.fetch!(next_state.tiles, &1))

        final_tile = choose_best_available_tile(available_tiles, next_state.target)
        distance = abs(final_tile.value - next_state.target)
        exact = distance == 0
        score = submission_score(default_distance, distance)
        completed = score > 0

        {:ok,
         %{
           finalValue: final_tile.value,
           defaultDistance: default_distance,
           distance: distance,
           exact: exact,
           score: score,
           completed: completed,
           steps: next_state.validated_steps
         }}
      end
    end
  end

  defp fetch_mode_config(mode) do
    case Map.fetch(@mode_configs, mode) do
      {:ok, config} -> {:ok, config}
      :error -> {:error, :invalid_mode}
    end
  end

  defp find_puzzle(_mode, _date_key, _config, attempt, nil) when attempt > @max_attempts,
    do: {:error, :no_exact_puzzle}

  defp find_puzzle(_mode, _date_key, _config, attempt, first_exact)
       when attempt > @max_attempts,
       do: {:ok, first_exact}

  defp find_puzzle(mode, date_key, config, attempt, first_exact) do
    candidate = build_candidate(mode, date_key, attempt, config)
    solver = solve(candidate.numbers, candidate.target)

    puzzle =
      candidate
      |> Map.put(:bestValue, solver.bestValue)
      |> Map.put(:distance, solver.distance)
      |> Map.put(:solution, solver.solution)
      |> Map.put(:numbersUsed, solver.numbersUsed)
      |> Map.put(:operationsCount, solver.operationsCount)

    cond do
      solver.exact && solver.numbersUsed >= config.min_exact_numbers_used ->
        {:ok, puzzle}

      solver.exact ->
        find_puzzle(mode, date_key, config, attempt + 1, first_exact || puzzle)

      true ->
        find_puzzle(mode, date_key, config, attempt + 1, first_exact)
    end
  end

  defp build_candidate(mode, date_key, attempt, config) do
    seed = "daily-numbers:#{mode}:#{date_key}:attempt:#{attempt}"
    state = hash_seed(seed)

    {large_numbers, state} =
      @large_numbers
      |> deterministic_shuffle(state)
      |> then(fn {values, next_state} -> {Enum.take(values, config.large_count), next_state} end)

    {small_numbers, state} =
      @small_numbers
      |> deterministic_shuffle(state)
      |> then(fn {values, next_state} -> {Enum.take(values, config.small_count), next_state} end)

    {numbers, state} = deterministic_shuffle(large_numbers ++ small_numbers, state)
    {target_roll, _state} = lcg_next(state)

    %{
      mode: mode,
      dateKey: date_key,
      target: trunc(target_roll * 899) + 101,
      generationAttempt: attempt,
      numbers:
        numbers
        |> Enum.with_index()
        |> Enum.map(fn {value, index} ->
          %{
            id: "n#{index}",
            value: value,
            source: "initial",
            status: "available"
          }
        end)
    }
  end

  defp solve(number_tiles, target) do
    count = length(number_tiles)
    max_mask = (1 <<< count) - 1

    seed_maps =
      number_tiles
      |> Enum.with_index()
      |> Enum.reduce(%{}, fn {tile, index}, acc ->
        Map.put(acc, 1 <<< index, %{tile.value => leaf_expression(tile.id, tile.value)})
      end)

    expression_maps =
      1..max_mask
      |> Enum.to_list()
      |> Enum.sort_by(fn mask -> {popcount(mask), mask} end)
      |> Enum.reduce(seed_maps, fn mask, acc ->
        if popcount(mask) == 1 do
          acc
        else
          Map.put(acc, mask, build_mask_results(mask, acc))
        end
      end)

    expressions =
      expression_maps
      |> Map.values()
      |> Enum.flat_map(&Map.values/1)

    best_expression =
      Enum.min_by(expressions, fn expression ->
        {abs(expression.value - target), -expression.numbers_used, expression.operations_count,
         expression.value}
      end)

    exact_expression =
      expressions
      |> Enum.filter(&(&1.value == target))
      |> Enum.sort_by(fn expression ->
        {-expression.numbers_used, expression.operations_count}
      end)
      |> List.first()

    %{
      exact: not is_nil(exact_expression),
      bestValue: best_expression.value,
      distance: abs(best_expression.value - target),
      solution: if(exact_expression, do: expression_to_steps(exact_expression), else: []),
      numbersUsed: if(exact_expression, do: exact_expression.numbers_used, else: 0),
      operationsCount: if(exact_expression, do: exact_expression.operations_count, else: 0)
    }
  end

  defp build_mask_results(mask, expression_maps) do
    unique_partitions(mask)
    |> Enum.reduce(%{}, fn {left_mask, right_mask}, results ->
      left_expressions =
        expression_maps
        |> Map.fetch!(left_mask)
        |> Enum.sort_by(fn {value, expression} ->
          {value, expression.operations_count}
        end)

      right_expressions =
        expression_maps
        |> Map.fetch!(right_mask)
        |> Enum.sort_by(fn {value, expression} ->
          {value, expression.operations_count}
        end)

      Enum.reduce(left_expressions, results, fn {_left_value, left_expression}, left_results ->
        Enum.reduce(right_expressions, left_results, fn {_right_value, right_expression}, acc ->
          left_expression
          |> legal_operations(right_expression)
          |> Enum.reduce(acc, &put_better_expression(&2, &1))
        end)
      end)
    end)
  end

  defp unique_partitions(mask) do
    do_partitions(mask, band(mask - 1, mask), [])
  end

  defp do_partitions(_mask, 0, acc), do: Enum.reverse(acc)

  defp do_partitions(mask, submask, acc) do
    other = bxor(mask, submask)

    next_acc =
      if other != 0 and submask < other do
        [{submask, other} | acc]
      else
        acc
      end

    do_partitions(mask, band(submask - 1, mask), next_acc)
  end

  defp leaf_expression(id, value) do
    %{
      id: id,
      value: value,
      left: nil,
      operator: nil,
      right: nil,
      numbers_used: 1,
      operations_count: 0
    }
  end

  defp legal_operations(left_expression, right_expression) do
    left_value = left_expression.value
    right_value = right_expression.value

    [
      combine_expression(left_expression, "+", right_expression, left_value + right_value),
      combine_expression(left_expression, "*", right_expression, left_value * right_value)
    ]
    |> maybe_cons(right_value < left_value, fn ->
      combine_expression(left_expression, "-", right_expression, left_value - right_value)
    end)
    |> maybe_cons(left_value < right_value, fn ->
      combine_expression(right_expression, "-", left_expression, right_value - left_value)
    end)
    |> maybe_cons(rem(left_value, right_value) == 0, fn ->
      combine_expression(left_expression, "/", right_expression, div(left_value, right_value))
    end)
    |> maybe_cons(left_value != right_value and rem(right_value, left_value) == 0, fn ->
      combine_expression(right_expression, "/", left_expression, div(right_value, left_value))
    end)
  end

  defp maybe_cons(list, true, build_fun), do: list ++ [build_fun.()]
  defp maybe_cons(list, false, _build_fun), do: list

  defp combine_expression(left_expression, operator, right_expression, result_value) do
    %{
      id: nil,
      value: result_value,
      left: left_expression,
      operator: operator,
      right: right_expression,
      numbers_used: left_expression.numbers_used + right_expression.numbers_used,
      operations_count: left_expression.operations_count + right_expression.operations_count + 1
    }
  end

  defp put_better_expression(results, expression) do
    Map.update(results, expression.value, expression, fn current ->
      if expression.operations_count < current.operations_count, do: expression, else: current
    end)
  end

  defp expression_to_steps(expression) do
    {_result_id, steps, _next_index} = materialize_expression_steps(expression, 0)
    steps
  end

  defp materialize_expression_steps(%{operator: nil, id: id}, next_index) do
    {id, [], next_index}
  end

  defp materialize_expression_steps(expression, next_index) do
    {left_id, left_steps, next_index} =
      materialize_expression_steps(expression.left, next_index)

    {right_id, right_steps, next_index} =
      materialize_expression_steps(expression.right, next_index)

    result_id = "r#{next_index}"

    step = %{
      leftId: left_id,
      leftValue: expression.left.value,
      operator: expression.operator,
      rightId: right_id,
      rightValue: expression.right.value,
      resultId: result_id,
      resultValue: expression.value
    }

    {result_id, left_steps ++ right_steps ++ [step], next_index + 1}
  end

  defp apply_step({step, index}, {:ok, state}) do
    with {:ok, left_id} <- fetch_string(step, "leftId"),
         {:ok, operator} <- fetch_string(step, "operator"),
         {:ok, right_id} <- fetch_string(step, "rightId"),
         {:ok, result_id} <- fetch_string(step, "resultId"),
         true <-
           left_id != right_id ||
             {:error, "Step #{index + 1}: choose two different available numbers"},
         {:ok, left_tile} <- fetch_available_tile(state, left_id, index),
         {:ok, right_tile} <- fetch_available_tile(state, right_id, index),
         true <-
           not Map.has_key?(state.tiles, result_id) ||
             {:error, "Step #{index + 1}: resultId must be unique"},
         {:ok, result_value} <- apply_operator(left_tile.value, operator, right_tile.value, index) do
      next_tiles =
        state.tiles
        |> Map.put(result_id, %{id: result_id, value: result_value, source: "derived"})

      next_available_ids =
        state.available_ids
        |> MapSet.delete(left_id)
        |> MapSet.delete(right_id)
        |> MapSet.put(result_id)

      validated_step = %{
        leftId: left_id,
        leftValue: left_tile.value,
        operator: operator,
        rightId: right_id,
        rightValue: right_tile.value,
        resultId: result_id,
        resultValue: result_value
      }

      {:cont,
       {:ok,
        %{
          state
          | tiles: next_tiles,
            available_ids: next_available_ids,
            validated_steps: state.validated_steps ++ [validated_step]
        }}}
    else
      {:error, reason} -> {:halt, {:error, reason}}
      false -> {:halt, {:error, "Step #{index + 1}: invalid player step"}}
    end
  end

  defp fetch_string(step, key) do
    value = Map.get(step, key) || Map.get(step, String.to_atom(key))

    if is_binary(value) and String.trim(value) != "" do
      {:ok, String.trim(value)}
    else
      {:error, "Each step must include #{key}"}
    end
  end

  defp fetch_available_tile(state, tile_id, index) do
    if MapSet.member?(state.available_ids, tile_id) do
      {:ok, Map.fetch!(state.tiles, tile_id)}
    else
      {:error, "Step #{index + 1}: referenced tile #{tile_id} is not available"}
    end
  end

  defp apply_operator(left_value, "+", right_value, _index), do: {:ok, left_value + right_value}
  defp apply_operator(left_value, "*", right_value, _index), do: {:ok, left_value * right_value}

  defp apply_operator(left_value, "-", right_value, _index) do
    result = left_value - right_value

    if result > 0 do
      {:ok, result}
    else
      {:error, "Result must be positive"}
    end
  end

  defp apply_operator(left_value, "/", right_value, _index) do
    cond do
      right_value == 0 ->
        {:error, "Division must be exact"}

      rem(left_value, right_value) != 0 ->
        {:error, "Division must be exact"}

      div(left_value, right_value) <= 0 ->
        {:error, "Result must be positive"}

      true ->
        {:ok, div(left_value, right_value)}
    end
  end

  defp apply_operator(_left_value, _operator, _right_value, _index) do
    {:error, "Operator must be one of +, -, *, /"}
  end

  defp choose_best_available_tile(available_tiles, target) do
    Enum.min_by(available_tiles, fn tile ->
      {abs(tile.value - target), tile.value, tile.id}
    end)
  end

  defp submission_score(default_distance, distance)
       when is_integer(default_distance) and default_distance > 0 and is_integer(distance) do
    improvement = max(default_distance - distance, 0)

    improvement
    |> Kernel./(default_distance)
    |> Kernel.*(100)
    |> round()
    |> min(100)
  end

  defp submission_score(_default_distance, _distance), do: 0

  defp deterministic_shuffle(items, state), do: do_shuffle(items, state, [])

  defp do_shuffle([], state, acc), do: {Enum.reverse(acc), state}

  defp do_shuffle(items, state, acc) do
    {roll, next_state} = lcg_next(state)
    index = trunc(roll * length(items))
    {item, remaining} = List.pop_at(items, index)
    do_shuffle(remaining, next_state, [item | acc])
  end

  defp hash_seed(seed) do
    seed
    |> to_charlist()
    |> Enum.reduce(2_166_136_261, fn char, hash ->
      band(bxor(hash, char) * 16_777_619, @mask32)
    end)
    |> case do
      0 -> 1
      value -> value
    end
  end

  defp lcg_next(state) do
    next_state = band(state * 1_664_525 + 1_013_904_223, @mask32)
    {next_state / 4_294_967_296.0, next_state}
  end

  defp popcount(0), do: 0
  defp popcount(value), do: band(value, 1) + popcount(value >>> 1)
end
