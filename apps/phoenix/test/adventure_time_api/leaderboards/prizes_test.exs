defmodule AdventureTimeApi.Leaderboards.PrizesTest do
  use ExUnit.Case, async: true

  alias AdventureTimeApi.Leaderboards.Prizes

  test "gives every tied podium player the full rank reward and skips absent ranks" do
    rows = [
      %{user_id: "finn", rank: 1},
      %{user_id: "jake", rank: 1},
      %{user_id: "bmo", rank: 3},
      %{user_id: "marceline", rank: 4}
    ]

    assert Prizes.plan(rows, :steps, prizes_allowed: true) == [
             %{user_id: "finn", medal_tier: :gold, crown_family: :steps, crowns: 3},
             %{user_id: "jake", medal_tier: :gold, crown_family: :steps, crowns: 3},
             %{user_id: "bmo", medal_tier: :bronze, crown_family: :steps, crowns: 1}
           ]
  end

  test "does not create prizes for the first partial launch week" do
    assert Prizes.plan([%{user_id: "finn", rank: 1}], :wordle, prizes_allowed: false) == []
  end
end
