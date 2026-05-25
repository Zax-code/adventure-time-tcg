defmodule AdventureTimeApi.Quests.WordleCacheWarmer do
  use GenServer

  require Logger

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, :ok, opts)
  end

  @impl true
  def init(:ok) do
    send(self(), :warm_cache)
    {:ok, %{}}
  end

  @impl true
  def handle_info(:warm_cache, state) do
    case AdventureTimeApi.Quests.wordle_cache_warm() do
      :ok -> :ok
      other -> Logger.warning("Unexpected Wordle cache warm result: #{inspect(other)}")
    end

    {:noreply, state}
  rescue
    error ->
      Logger.warning("Failed to warm Wordle cache on startup: #{Exception.message(error)}")
      {:noreply, state}
  end
end
