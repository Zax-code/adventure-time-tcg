defmodule AdventureTimeApi.Leaderboards.BoardsTest do
  use AdventureTimeApi.DataCase, async: true

  alias AdventureTimeApi.Leaderboards.Boards

  test "exposes the ten approved source and derived boards in display order" do
    boards = Boards.launch_catalog()

    assert Enum.map(boards, & &1.key) == [
             "steps/default",
             "daily-numbers/1-5",
             "daily-numbers/2-4",
             "daily-numbers/3-3",
             "daily-numbers/family",
             "wordle/fr",
             "wordle/en",
             "wordle/family",
             "speed-calculus/ranked",
             "perfect-timing/official"
           ]

    assert Enum.count(boards, &(&1.board_kind == :source)) == 8
    assert Enum.count(boards, &(&1.board_kind == :derived_family)) == 2
  end

  test "loads the seeded enabled catalog from persistence" do
    assert Boards.list_enabled() |> Enum.map(& &1.key) ==
             Boards.launch_catalog() |> Enum.map(& &1.key)
  end
end
