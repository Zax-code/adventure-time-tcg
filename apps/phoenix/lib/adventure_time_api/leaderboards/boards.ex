defmodule AdventureTimeApi.Leaderboards.Boards do
  @moduledoc "Allow-listed launch board catalog and quest-mode metadata."

  @launch_catalog [
    %{
      key: "steps/default",
      quest_family: :steps,
      mode: "default",
      direction: :higher,
      board_kind: :source,
      raw_result_kind: :steps,
      prizes_enabled: true
    },
    %{
      key: "daily-numbers/1-5",
      quest_family: :daily_numbers,
      mode: "1-5",
      direction: :lower,
      board_kind: :source,
      raw_result_kind: :exact_completion_time,
      prizes_enabled: true
    },
    %{
      key: "daily-numbers/2-4",
      quest_family: :daily_numbers,
      mode: "2-4",
      direction: :lower,
      board_kind: :source,
      raw_result_kind: :exact_completion_time,
      prizes_enabled: true
    },
    %{
      key: "daily-numbers/3-3",
      quest_family: :daily_numbers,
      mode: "3-3",
      direction: :lower,
      board_kind: :source,
      raw_result_kind: :exact_completion_time,
      prizes_enabled: true
    },
    %{
      key: "daily-numbers/family",
      quest_family: :daily_numbers,
      mode: "family",
      direction: :points,
      board_kind: :derived_family,
      raw_result_kind: :member_breakdown,
      prizes_enabled: true,
      derived_members: [
        "daily-numbers/1-5",
        "daily-numbers/2-4",
        "daily-numbers/3-3"
      ]
    },
    %{
      key: "wordle/fr",
      quest_family: :wordle,
      mode: "fr",
      direction: :lower,
      board_kind: :source,
      raw_result_kind: :wordle_outcome,
      prizes_enabled: true
    },
    %{
      key: "wordle/en",
      quest_family: :wordle,
      mode: "en",
      direction: :lower,
      board_kind: :source,
      raw_result_kind: :wordle_outcome,
      prizes_enabled: true
    },
    %{
      key: "wordle/family",
      quest_family: :wordle,
      mode: "family",
      direction: :points,
      board_kind: :derived_family,
      raw_result_kind: :member_breakdown,
      prizes_enabled: true,
      derived_members: ["wordle/fr", "wordle/en"]
    },
    %{
      key: "speed-calculus/ranked",
      quest_family: :speed_calculus,
      mode: "ranked",
      direction: :higher,
      board_kind: :source,
      raw_result_kind: :correct_answers,
      prizes_enabled: true
    },
    %{
      key: "perfect-timing/official",
      quest_family: :perfect_timing,
      mode: "official",
      direction: :lower,
      board_kind: :source,
      raw_result_kind: :duration_error_ms,
      prizes_enabled: true
    },
    %{
      key: "overall/all-quests",
      quest_family: :overall,
      mode: "all-quests",
      direction: :points,
      board_kind: :derived_overall,
      raw_result_kind: :member_breakdown,
      prizes_enabled: false,
      derived_members: [
        "steps/default",
        "daily-numbers/family",
        "wordle/family",
        "speed-calculus/ranked",
        "perfect-timing/official"
      ]
    }
  ]

  @spec launch_catalog() :: [map()]
  def launch_catalog do
    Enum.with_index(@launch_catalog, 1)
    |> Enum.map(fn {board, display_order} ->
      board
      |> Map.put_new(:derived_members, [])
      |> Map.put(:display_order, display_order)
    end)
  end

  @spec fetch(String.t()) :: {:ok, map()} | {:error, :unknown_board}
  def fetch(key) when is_binary(key) do
    case Enum.find(launch_catalog(), &(&1.key == key)) do
      nil -> {:error, :unknown_board}
      board -> {:ok, board}
    end
  end

  @spec list_enabled() :: [AdventureTimeApi.Leaderboards.Board.t()]
  def list_enabled do
    import Ecto.Query

    AdventureTimeApi.Leaderboards.Board
    |> where([board], board.enabled)
    |> order_by([board], asc: board.display_order)
    |> AdventureTimeApi.Repo.all()
  end
end
