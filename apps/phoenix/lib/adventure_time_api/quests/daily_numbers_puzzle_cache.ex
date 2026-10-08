defmodule AdventureTimeApi.Quests.DailyNumbersPuzzleCache do
  @moduledoc """
  Node-local cache of deterministic Daily Numbers puzzles.

  A puzzle is a pure function of `{date, mode, generation_attempt}`, so entries never
  need invalidation; the key also carries the solution key version. The table is
  repopulated lazily after a restart. Entries older than two days are pruned on
  every insert.
  """

  use GenServer

  @table __MODULE__
  @retained_days 2

  def start_link(opts \\ []), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  @spec get(Date.t(), String.t(), pos_integer(), pos_integer()) :: {:ok, map()} | :miss
  def get(%Date{} = date, mode, generation_attempt, version) do
    with true <- started?(),
         [{_key, puzzle}] <- :ets.lookup(@table, {date, mode, generation_attempt, version}) do
      {:ok, puzzle}
    else
      _ -> :miss
    end
  end

  @spec put(Date.t(), String.t(), pos_integer(), pos_integer(), map()) :: :ok
  def put(%Date{} = date, mode, generation_attempt, version, puzzle) when is_map(puzzle) do
    if started?() do
      prune(Date.add(Date.utc_today(), -@retained_days))
      :ets.insert(@table, {{date, mode, generation_attempt, version}, puzzle})
    end

    :ok
  end

  @impl true
  def init(_opts) do
    :ets.new(@table, [:named_table, :set, :public, read_concurrency: true])
    {:ok, nil}
  end

  defp started?, do: :ets.whereis(@table) != :undefined

  defp prune(oldest_date) do
    fn {{date, _mode, _attempt, _version} = key, _puzzle}, stale ->
      if Date.compare(date, oldest_date) == :lt, do: [key | stale], else: stale
    end
    |> :ets.foldl([], @table)
    |> Enum.each(&:ets.delete(@table, &1))
  end
end
