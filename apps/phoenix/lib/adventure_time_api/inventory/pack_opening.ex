defmodule AdventureTimeApi.Inventory.PackOpening do
  @moduledoc false

  @canonical_rarity_names ["Common", "Uncommon", "Rare", "Epic", "Legendary"]

  def select_card(available_cards, available_rarities, guaranteed_rarity \\ nil)

  def select_card(available_cards, available_rarities, guaranteed_rarity)
      when is_binary(guaranteed_rarity) do
    case select_card_for_rarity(available_cards, available_rarities, guaranteed_rarity) do
      {:ok, card} -> card
      :error -> select_card(available_cards, available_rarities, nil)
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

  def base_rarity_percentages([]), do: nil

  def base_rarity_percentages(available_rarities) when is_list(available_rarities) do
    if representable_rarities?(available_rarities) do
      weights_by_name = Map.new(available_rarities, &{&1.name, &1.drop_rate})
      max_weight = available_rarities |> Enum.map(& &1.drop_rate) |> Enum.max()

      if max_weight > 0 do
        scaled_total =
          Enum.reduce(available_rarities, 0.0, &(&1.drop_rate / max_weight + &2))

        @canonical_rarity_names
        |> Enum.map(fn rarity_name ->
          %{
            rarity: rarity_name,
            percentage:
              Map.get(weights_by_name, rarity_name, 0.0) / max_weight / scaled_total * 100.0
          }
        end)
        |> normalize_percentage_total()
      else
        first_rarity_name = hd(available_rarities).name

        Enum.map(@canonical_rarity_names, fn rarity_name ->
          %{
            rarity: rarity_name,
            percentage: if(rarity_name == first_rarity_name, do: 100.0, else: 0.0)
          }
        end)
      end
    end
  end

  def select_card_for_rarity(available_cards, available_rarities, rarity_name)
      when is_binary(rarity_name) do
    case Enum.find(available_rarities, &(&1.name == rarity_name)) do
      nil ->
        :error

      rarity ->
        available_cards
        |> Enum.filter(&(&1.rarity_id == rarity.id))
        |> case do
          [] -> :error
          cards -> {:ok, Enum.random(cards)}
        end
    end
  end

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

  defp representable_rarities?(available_rarities) do
    rarity_names = Enum.map(available_rarities, & &1.name)

    Enum.all?(available_rarities, fn rarity ->
      rarity.name in @canonical_rarity_names and valid_weight?(rarity.drop_rate)
    end) and MapSet.size(MapSet.new(rarity_names)) == length(rarity_names)
  end

  defp valid_weight?(weight) when is_number(weight), do: weight >= 0 and weight == weight
  defp valid_weight?(_weight), do: false

  defp normalize_percentage_total(percentages) do
    correction = 100.0 - Enum.reduce(percentages, 0.0, &(&1.percentage + &2))

    {_, largest_index} =
      percentages
      |> Enum.with_index()
      |> Enum.max_by(fn {%{percentage: percentage}, _index} -> percentage end)

    List.update_at(percentages, largest_index, fn percentage ->
      %{percentage | percentage: percentage.percentage + correction}
    end)
  end
end
