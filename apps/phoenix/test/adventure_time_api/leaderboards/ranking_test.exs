defmodule AdventureTimeApi.Leaderboards.RankingTest do
  use ExUnit.Case, async: true

  alias AdventureTimeApi.Leaderboards.Ranking

  test "uses competition ranks and keeps genuinely equal players tied" do
    rows = [
      %{user: :finn, points_milli: 900_000, raw: 10},
      %{user: :jake, points_milli: 900_000, raw: 10},
      %{user: :bmo, points_milli: 800_000, raw: 20}
    ]

    ranked = Ranking.rank(rows, &{&1.points_milli, &1.raw})

    assert Enum.map(ranked, &{&1.user, &1.position, &1.rank}) == [
             {:finn, 1, 1},
             {:jake, 2, 1},
             {:bmo, 3, 3}
           ]
  end

  test "uses competitive values only and can normalize lower raw results" do
    rows = [
      %{user: :later_signup, points_milli: 900_000, elapsed_ms: 12_000},
      %{user: :older_account, points_milli: 900_000, elapsed_ms: 10_000}
    ]

    ranked = Ranking.rank(rows, &{&1.points_milli, -&1.elapsed_ms})

    assert Enum.map(ranked, & &1.user) == [:older_account, :later_signup]
    assert Enum.map(ranked, & &1.rank) == [1, 2]
  end
end
