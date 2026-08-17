defmodule AdventureTimeApi.Leaderboards.BoardsTest do
  use AdventureTimeApi.DataCase, async: true

  alias AdventureTimeApi.Leaderboards.Boards

  test "exposes the approved source and derived boards in display order" do
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
             "perfect-timing/official",
             "overall/all-quests"
           ]

    assert Enum.count(boards, &(&1.board_kind == :source)) == 8
    assert Enum.count(boards, &(&1.board_kind == :derived_family)) == 2
    assert Enum.count(boards, &(&1.board_kind == :derived_overall)) == 1
    assert Enum.count(boards, & &1.prizes_enabled) == 10
    refute List.last(boards).prizes_enabled
  end

  test "loads the seeded enabled catalog from persistence" do
    persisted = Boards.list_enabled()

    assert Enum.map(persisted, & &1.key) == Enum.map(Boards.launch_catalog(), & &1.key)
    refute List.last(persisted).prizes_enabled
  end
end
