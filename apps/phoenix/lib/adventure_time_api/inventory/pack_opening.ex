defmodule AdventureTimeApi.Inventory.PackOpening do
  @moduledoc false

  def select_card(available_cards, available_rarities, guaranteed_rarity \\ nil)

  def select_card(available_cards, available_rarities, guaranteed_rarity)
      when is_binary(guaranteed_rarity) do
    case Enum.find(available_rarities, &(&1.name == guaranteed_rarity)) do
      nil ->
        select_card(available_cards, available_rarities, nil)

      rarity ->
        case Enum.filter(available_cards, &(&1.rarity_id == rarity.id)) do
          [] -> select_card(available_cards, available_rarities, nil)
          cards -> Enum.random(cards)
        end
    end
  end

  def select_card(available_cards, available_rarities, nil) do
    selected_rarity_id = weighted_rarity_id(available_rarities)

    available_cards
    |> Enum.filter(&(&1.rarity_id == selected_rarity_id))
    |> case do
      [] -> Enum.random(available_cards)
      cards -> Enum.random(cards)
    end
  end

  def shuffle(cards), do: Enum.shuffle(cards)

  defp weighted_rarity_id([first_rarity | _] = available_rarities) do
    total_weight = Enum.reduce(available_rarities, 0.0, &(&1.drop_rate + &2))
    roll = :rand.uniform() * total_weight

    available_rarities
    |> Enum.reduce_while(roll, fn rarity, remaining_roll ->
      next_roll = remaining_roll - rarity.drop_rate

      if next_roll <= 0 do
        {:halt, rarity.id}
      else
        {:cont, next_roll}
      end
    end)
    |> case do
      rarity_id when is_binary(rarity_id) -> rarity_id
      _ -> first_rarity.id
    end
  end
end
