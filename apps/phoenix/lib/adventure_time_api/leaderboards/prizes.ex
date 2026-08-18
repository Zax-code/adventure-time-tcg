defmodule AdventureTimeApi.Leaderboards.Prizes do
  @moduledoc "Pure podium award planning, separate from quest rewards and coins."

  @podium %{1 => {:gold, 3}, 2 => {:silver, 2}, 3 => {:bronze, 1}}
  @crown_families [:steps, :daily_numbers, :wordle, :speed_calculus, :perfect_timing]

  @spec plan([map()], atom(), keyword()) :: [map()]
  def plan(rows, crown_family, options)
      when is_list(rows) and crown_family in @crown_families and is_list(options) do
    if Keyword.get(options, :prizes_allowed, false) do
      Enum.flat_map(rows, fn row ->
        case @podium[row.rank] do
          nil ->
            []

          {medal_tier, crowns} ->
            [
              %{
                user_id: row.user_id,
                medal_tier: medal_tier,
                crown_family: crown_family,
                crowns: crowns
              }
            ]
        end
      end)
    else
      []
    end
  end
end
