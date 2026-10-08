defmodule AdventureTimeApi.Quests.WordleCacheWarmer do
  @moduledoc "Warms the Wordle dictionary cache once at boot, without staying resident."

  use Task, restart: :temporary

  require Logger

  def start_link(_opts \\ []), do: Task.start_link(&warm/0)

  def warm do
    case AdventureTimeApi.Quests.wordle_cache_warm() do
      :ok -> :ok
      other -> Logger.warning("Unexpected Wordle cache warm result: #{inspect(other)}")
    end
  rescue
    error ->
      Logger.warning("Failed to warm Wordle cache on startup: #{Exception.message(error)}")
  end
end
