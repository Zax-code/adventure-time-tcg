defmodule AdventureTimeApi.Leaderboards.Ranking do
  @moduledoc """
  Pure competition ranking for snapshot construction.

  Callers provide a tuple/list composed only of approved competitive values. Identity,
  account age, and submission timestamps must never be included.
  """

  @spec rank([map()], (map() -> term())) :: [map()]
  def rank(rows, competitive_key) when is_list(rows) and is_function(competitive_key, 1) do
    rows
    |> Enum.map(&{competitive_key.(&1), &1})
    |> Enum.sort_by(&elem(&1, 0), :desc)
    |> Enum.with_index(1)
    |> Enum.map_reduce(nil, fn {{key, row}, position}, previous ->
      rank =
        case previous do
          {^key, previous_rank} -> previous_rank
          _ -> position
        end

      {Map.merge(row, %{position: position, rank: rank}), {key, rank}}
    end)
    |> elem(0)
  end
end
