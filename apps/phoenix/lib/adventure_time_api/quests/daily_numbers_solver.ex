defmodule AdventureTimeApi.Quests.DailyNumbersSolver do
  @moduledoc """
  Exhaustively enumerates canonical exact solutions for a Daily Numbers puzzle.

  Number tiles are tracked by subset bit, so equal-valued tiles remain distinct
  resources. A compact subset/value reachability pass is followed by memoized,
  target-directed expression construction. Canonical expressions are
  deduplicated at every memo entry.
  """

  import Bitwise

  alias AdventureTimeApi.Quests.DailyNumbersExpression, as: Expression

  def solve(number_tiles, target) when is_list(number_tiles) and is_integer(target) do
    started_at = System.monotonic_time()
    max_mask = (1 <<< length(number_tiles)) - 1
    value_maps = build_value_maps(number_tiles, max_mask)

    {solutions_by_key, _memo} =
      Enum.reduce(1..max_mask, {%{}, %{}}, fn mask, {solutions, memo} ->
        if MapSet.member?(Map.fetch!(value_maps, mask), target) do
          {mask_solutions, next_memo} = expressions_for(mask, target, value_maps, memo)
          {Map.merge(solutions, mask_solutions), next_memo}
        else
          {solutions, memo}
        end
      end)

    solutions =
      solutions_by_key
      |> Enum.map(fn {canonical_key, expression} ->
        %{canonical_key: canonical_key, expression: expression}
      end)
      |> Enum.sort_by(& &1.canonical_key)

    computation_ms =
      System.monotonic_time()
      |> Kernel.-(started_at)
      |> System.convert_time_unit(:native, :microsecond)
      |> Kernel./(1000)

    %{solutions: solutions, total: length(solutions), computation_ms: computation_ms}
  end

  def materialize_steps(expression, number_tiles) when is_list(number_tiles) do
    available_tiles = Enum.map(number_tiles, &%{id: &1.id, value: &1.value})

    case materialize(expression, available_tiles, 0) do
      {:ok, _result, _remaining_tiles, _next_index, steps} ->
        {:ok, steps}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp build_value_maps(number_tiles, max_mask) do
    seed_maps =
      number_tiles
      |> Enum.with_index()
      |> Map.new(fn {tile, index} -> {1 <<< index, MapSet.new([tile.value])} end)

    1..max_mask
    |> Enum.sort_by(fn mask -> {popcount(mask), mask} end)
    |> Enum.reduce(seed_maps, fn mask, acc ->
      if popcount(mask) == 1 do
        acc
      else
        Map.put(acc, mask, build_mask_values(mask, acc))
      end
    end)
  end

  defp build_mask_values(mask, value_maps) do
    mask
    |> unique_partitions()
    |> Enum.reduce(MapSet.new(), fn {left_mask, right_mask}, results ->
      Enum.reduce(Map.fetch!(value_maps, left_mask), results, fn left, left_acc ->
        Enum.reduce(Map.fetch!(value_maps, right_mask), left_acc, fn right, acc ->
          Enum.reduce(operation_candidates(left, right), acc, fn {_operator, _reversed, value},
                                                                 values ->
            MapSet.put(values, value)
          end)
        end)
      end)
    end)
  end

  defp expressions_for(mask, value, value_maps, memo) do
    cache_key = {mask, value}

    case Map.fetch(memo, cache_key) do
      {:ok, expressions} ->
        {expressions, memo}

      :error ->
        {expressions, next_memo} =
          if popcount(mask) == 1 do
            expression = Expression.number(value)
            {%{Expression.canonical_key(expression) => expression}, memo}
          else
            build_expressions(mask, value, value_maps, memo)
          end

        {expressions, Map.put(next_memo, cache_key, expressions)}
    end
  end

  defp build_expressions(mask, target, value_maps, memo) do
    mask
    |> unique_partitions()
    |> Enum.reduce({%{}, memo}, fn {left_mask, right_mask}, {results, partition_memo} ->
      Enum.reduce(
        Map.fetch!(value_maps, left_mask),
        {results, partition_memo},
        fn left_value, {left_results, left_memo} ->
          Enum.reduce(
            Map.fetch!(value_maps, right_mask),
            {left_results, left_memo},
            fn right_value, {right_results, right_memo} ->
              operation_candidates(left_value, right_value)
              |> Enum.filter(fn {_operator, _reversed, result} -> result == target end)
              |> Enum.reduce(
                {right_results, right_memo},
                fn {operator, reversed, _result}, {operation_results, operation_memo} ->
                  {first_mask, first_value, second_mask, second_value} =
                    if reversed do
                      {right_mask, right_value, left_mask, left_value}
                    else
                      {left_mask, left_value, right_mask, right_value}
                    end

                  {first_expressions, operation_memo} =
                    expressions_for(first_mask, first_value, value_maps, operation_memo)

                  {second_expressions, operation_memo} =
                    expressions_for(second_mask, second_value, value_maps, operation_memo)

                  combined =
                    combine_expressions(
                      operation_results,
                      operator,
                      first_expressions,
                      second_expressions
                    )

                  {combined, operation_memo}
                end
              )
            end
          )
        end
      )
    end)
  end

  defp combine_expressions(results, operator, left_expressions, right_expressions) do
    Enum.reduce(left_expressions, results, fn {_left_key, left}, left_acc ->
      Enum.reduce(right_expressions, left_acc, fn {_right_key, right}, acc ->
        expression =
          operator
          |> Expression.operation(left, right)
          |> Expression.canonicalize()

        Map.put_new(acc, Expression.canonical_key(expression), expression)
      end)
    end)
  end

  defp materialize(%{type: :number, value: value}, available_tiles, next_index) do
    case Enum.find_index(available_tiles, &(&1.value == value)) do
      nil ->
        {:error, :number_instance_unavailable}

      index ->
        {tile, remaining_tiles} = List.pop_at(available_tiles, index)
        {:ok, tile, remaining_tiles, next_index, []}
    end
  end

  defp materialize(
         %{type: :operation, operator: operator, children: children},
         available_tiles,
         next_index
       ) do
    with {:ok, materialized_children, remaining_tiles, next_index, child_steps} <-
           materialize_children(children, available_tiles, next_index, [], []) do
      [first | rest] = materialized_children

      Enum.reduce_while(
        rest,
        {:ok, first, remaining_tiles, next_index, child_steps},
        fn right, {:ok, left, remaining, result_index, steps} ->
          case Expression.apply_operator(left.value, operator, right.value) do
            {:ok, result_value} ->
              result_id = "r#{result_index}"

              step = %{
                leftId: left.id,
                leftValue: left.value,
                operator: operator,
                rightId: right.id,
                rightValue: right.value,
                resultId: result_id,
                resultValue: result_value
              }

              {:cont,
               {:ok, %{id: result_id, value: result_value}, remaining, result_index + 1,
                steps ++ [step]}}

            {:error, reason} ->
              {:halt, {:error, reason}}
          end
        end
      )
    end
  end

  defp materialize_children([], available_tiles, next_index, children, steps) do
    {:ok, Enum.reverse(children), available_tiles, next_index, steps}
  end

  defp materialize_children(
         [child | rest],
         available_tiles,
         next_index,
         children,
         steps
       ) do
    case materialize(child, available_tiles, next_index) do
      {:ok, materialized_child, remaining_tiles, next_index, child_steps} ->
        materialize_children(
          rest,
          remaining_tiles,
          next_index,
          [materialized_child | children],
          steps ++ child_steps
        )

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp operation_candidates(left, right) do
    [{"+", false}, {"*", false}, {"-", false}, {"-", true}, {"/", false}, {"/", true}]
    |> Enum.flat_map(fn {operator, reversed} ->
      {first, second} = if reversed, do: {right, left}, else: {left, right}

      case Expression.apply_operator(first, operator, second) do
        {:ok, result} -> [{operator, reversed, result}]
        {:error, _reason} -> []
      end
    end)
  end

  defp unique_partitions(mask), do: do_partitions(mask, band(mask - 1, mask), [])
  defp do_partitions(_mask, 0, acc), do: Enum.reverse(acc)

  defp do_partitions(mask, submask, acc) do
    other = bxor(mask, submask)
    next_acc = if other != 0 and submask < other, do: [{submask, other} | acc], else: acc
    do_partitions(mask, band(submask - 1, mask), next_acc)
  end

  defp popcount(0), do: 0
  defp popcount(value), do: band(value, 1) + popcount(value >>> 1)
end
