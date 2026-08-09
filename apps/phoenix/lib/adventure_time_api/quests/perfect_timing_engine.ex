defmodule AdventureTimeApi.Quests.PerfectTimingEngine do
  @moduledoc """
  Pure Perfect Timing target generation, integer-millisecond scoring, and rewards.
  """

  @base_reward 50
  @minimum_target_ms 3_000
  @maximum_target_ms 10_000
  @target_step_ms 100
  @target_count div(@maximum_target_ms - @minimum_target_ms, @target_step_ms) + 1

  @tiers [
    {"perfect", 10, 100},
    {"amazing", 50, 50},
    {"great", 150, 25},
    {"close", 300, 10}
  ]

  def base_reward, do: @base_reward
  def minimum_target_ms, do: @minimum_target_ms
  def maximum_target_ms, do: @maximum_target_ms
  def target_step_ms, do: @target_step_ms

  def daily_target_ms(%Date{} = date), do: daily_target_ms(Date.to_iso8601(date))

  def daily_target_ms(date_key) when is_binary(date_key) do
    <<roll::unsigned-big-integer-size(64), _rest::binary>> =
      :crypto.hash(:sha256, "perfect-timing:#{date_key}")

    @minimum_target_ms + rem(roll, @target_count) * @target_step_ms
  end

  def score(target_ms, elapsed_ms)
      when is_integer(target_ms) and is_integer(elapsed_ms) do
    deviation_ms = abs(elapsed_ms - target_ms)
    tier = tier_for_deviation(deviation_ms)

    %{
      deviation_ms: deviation_ms,
      direction: direction(target_ms, elapsed_ms),
      tier: tier,
      reward: reward_for_tier(tier)
    }
  end

  def tier_for_deviation(deviation_ms)
      when is_integer(deviation_ms) and deviation_ms >= 0 do
    case Enum.find(@tiers, fn {_tier, maximum_ms, _bonus_percent} ->
           deviation_ms <= maximum_ms
         end) do
      {tier, _maximum_ms, _bonus_percent} -> tier
      nil -> "miss"
    end
  end

  def reward_for_tier("miss"), do: 0

  def reward_for_tier(tier) when is_binary(tier) do
    case Enum.find(@tiers, fn {candidate, _maximum_ms, _bonus_percent} ->
           candidate == tier
         end) do
      {_tier, _maximum_ms, bonus_percent} ->
        div(@base_reward * (100 + bonus_percent) + 99, 100)

      nil ->
        0
    end
  end

  def successful_tier?(tier), do: tier in ["perfect", "amazing", "great", "close"]

  defp direction(target_ms, elapsed_ms) when elapsed_ms < target_ms, do: "early"
  defp direction(target_ms, elapsed_ms) when elapsed_ms > target_ms, do: "late"
  defp direction(_target_ms, _elapsed_ms), do: "exact"
end
