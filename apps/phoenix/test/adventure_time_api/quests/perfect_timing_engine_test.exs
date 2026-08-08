defmodule AdventureTimeApi.Quests.PerfectTimingEngineTest do
  use ExUnit.Case, async: true

  alias AdventureTimeApi.Quests.PerfectTimingEngine

  test "daily targets are deterministic, global, in range, and aligned to 100 milliseconds" do
    dates = Date.range(~D[2026-01-01], ~D[2026-12-31])

    targets = Enum.map(dates, &PerfectTimingEngine.daily_target_ms/1)

    assert targets == Enum.map(dates, &PerfectTimingEngine.daily_target_ms/1)
    assert Enum.all?(targets, &(&1 in 3_000..10_000))
    assert Enum.all?(targets, &(rem(&1, 100) == 0))
  end

  test "target generation permits consecutive dates to repeat" do
    repeated_pair =
      Date.range(~D[2026-01-01], ~D[2030-12-31])
      |> Enum.chunk_every(2, 1, :discard)
      |> Enum.find(fn [left, right] ->
        PerfectTimingEngine.daily_target_ms(left) ==
          PerfectTimingEngine.daily_target_ms(right)
      end)

    assert [_left, _right] = repeated_pair
  end

  test "integer millisecond scoring uses the exact inclusive tier boundaries" do
    target_ms = 6_500

    assert %{deviation_ms: 10, tier: "perfect", reward: 100} =
             PerfectTimingEngine.score(target_ms, target_ms + 10)

    assert %{deviation_ms: 11, tier: "amazing", reward: 75} =
             PerfectTimingEngine.score(target_ms, target_ms + 11)

    assert %{deviation_ms: 50, tier: "amazing", reward: 75} =
             PerfectTimingEngine.score(target_ms, target_ms - 50)

    assert %{deviation_ms: 51, tier: "great", reward: 63} =
             PerfectTimingEngine.score(target_ms, target_ms - 51)

    assert %{deviation_ms: 150, tier: "great", reward: 63} =
             PerfectTimingEngine.score(target_ms, target_ms + 150)

    assert %{deviation_ms: 151, tier: "close", reward: 55} =
             PerfectTimingEngine.score(target_ms, target_ms + 151)

    assert %{deviation_ms: 300, tier: "close", reward: 55} =
             PerfectTimingEngine.score(target_ms, target_ms - 300)

    assert %{deviation_ms: 301, tier: "miss", reward: 0} =
             PerfectTimingEngine.score(target_ms, target_ms - 301)
  end

  test "great reward rounds the 62.5 coin result upward" do
    assert PerfectTimingEngine.reward_for_tier("great") == 63
  end
end
