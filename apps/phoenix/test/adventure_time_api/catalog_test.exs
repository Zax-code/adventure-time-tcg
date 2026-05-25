defmodule AdventureTimeApi.CatalogTest do
  use AdventureTimeApi.DataCase, async: true

  alias AdventureTimeApi.Catalog
  alias AdventureTimeApi.Catalog.Rarity
  alias AdventureTimeApi.Repo

  test "list_rarities returns mobile-compatible rarity metadata ordered by drop rate" do
    Repo.insert!(Rarity.changeset(%Rarity{}, %{name: "Rare", drop_rate: 10.0, color: "#3B82F6"}))

    Repo.insert!(
      Rarity.changeset(%Rarity{}, %{name: "Common", drop_rate: 60.0, color: "#9CA3AF"})
    )

    assert [common, rare] = Catalog.list_rarities()

    assert %{name: "Common", dropRate: 60.0, color: "#9CA3AF", dustValue: 1, craftCost: 5} =
             common

    assert %{name: "Rare", dropRate: 10.0, color: "#3B82F6", dustValue: 20, craftCost: 100} =
             rare

    assert is_binary(common.id)
    assert is_binary(rare.id)
  end

  test "rarity_dust_value falls back to common for unknown names" do
    assert Catalog.rarity_dust_value("mystery") == 1
    assert Catalog.rarity_craft_cost("mystery") == 5
  end
end
