defmodule AdventureTimeApi.Leaderboards.ProjectionCache do
  @moduledoc """
  Short-lived node-local cache of live leaderboard projections.

  Callers key entries by everything the projection reads (board, period, scoring
  version and the latest result and user changes), so a new or changed result or
  profile is visible on the next read; the TTL only bounds memory and staleness of
  board configuration.
  """

  use GenServer

  @table __MODULE__
  @ttl_ms 30_000

  def start_link(opts \\ []), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  @spec fetch(term(), (-> term())) :: term()
  def fetch(key, compute) when is_function(compute, 0) do
    now = System.monotonic_time(:millisecond)

    with true <- started?(),
         [{^key, value, stored_at}] <- :ets.lookup(@table, key),
         true <- now - stored_at < @ttl_ms do
      value
    else
      _ ->
        value = compute.()
        put(key, value, now)
        value
    end
  end

  @impl true
  def init(_opts) do
    :ets.new(@table, [:named_table, :set, :public, read_concurrency: true])
    {:ok, nil}
  end

  defp put(key, value, now) do
    if started?() do
      :ets.select_delete(@table, [{{:_, :_, :"$1"}, [{:<, :"$1", now - @ttl_ms}], [true]}])
      :ets.insert(@table, {key, value, now})
    end

    :ok
  end

  defp started?, do: :ets.whereis(@table) != :undefined
end
