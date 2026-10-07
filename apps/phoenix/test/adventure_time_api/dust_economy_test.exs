defmodule AdventureTimeApi.DustEconomyTest do
  use ExUnit.Case, async: true

  alias AdventureTimeApi.{Catalog, Inventory}

  @rarities ["Common", "Uncommon", "Rare", "Epic", "Legendary", " epic ", "LEGENDARY", "Mythic"]

  test "advertised rarity dust and craft prices match what crafting and recycling charge" do
    for rarity <- @rarities do
      assert Catalog.rarity_dust_value(rarity) == Inventory.dust_sacrifice_value(rarity),
             "dust value differs for #{inspect(rarity)}"

      assert Catalog.rarity_craft_cost(rarity) == Inventory.dust_craft_cost(rarity),
             "craft cost differs for #{inspect(rarity)}"
    end
  end

  test "the economy table is unchanged" do
    assert Enum.map(~w(Common Uncommon Rare Epic Legendary), &Inventory.dust_sacrifice_value/1) ==
             [1, 5, 20, 50, 100]

    assert Enum.map(~w(Common Uncommon Rare Epic Legendary), &Inventory.dust_craft_cost/1) ==
             [5, 25, 100, 250, 500]

    assert Inventory.dust_sacrifice_value("Mythic") == 1
  end
end
