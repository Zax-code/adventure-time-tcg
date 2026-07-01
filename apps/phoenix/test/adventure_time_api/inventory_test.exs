defmodule AdventureTimeApi.InventoryTest do
  use AdventureTimeApi.DataCase, async: true

  alias AdventureTimeApi.Accounts.{EmailCredential, User}
  alias AdventureTimeApi.Catalog.{Card, Pack, Rarity}
  alias AdventureTimeApi.Inventory
  alias AdventureTimeApi.Inventory.OwnedCard
  alias AdventureTimeApi.Repo

  test "open_pack_for_user increments existing owned cards and returns non-new cards" do
    user = create_user("inventory-existing@example.com") |> grant_coins(300)
    common = create_rarity("Common", 60.0, "#9CA3AF")
    common_card = create_card("Finn", common.id)
    pack = create_pack("Common Pack", 2, 100, nil)

    Repo.insert!(
      OwnedCard.changeset(%OwnedCard{}, %{
        quantity: 1,
        obtained_at: DateTime.utc_now() |> DateTime.truncate(:second)
      })
      |> Ecto.Changeset.put_change(:user_id, user.id)
      |> Ecto.Changeset.put_change(:card_id, common_card.id)
    )

    assert {:ok, response} = Inventory.open_pack_for_user(user.id, pack.id)
    assert response.newBalance == 200
    assert Enum.all?(response.cards, &(&1.id == common_card.id and &1.isNewForUser == false))

    owned_card = Repo.get_by!(OwnedCard, user_id: user.id, card_id: common_card.id)
    assert owned_card.quantity == 3
  end

  test "open_pack_for_user guarantees a matching rarity when available" do
    user = create_user("inventory-guarantee@example.com") |> grant_coins(300)
    common = create_rarity("Common", 60.0, "#9CA3AF")
    rare = create_rarity("Rare", 10.0, "#3B82F6")

    _common_card = create_card("Jake", common.id)
    rare_card = create_card("Marceline", rare.id)
    pack = create_pack("Rare Pack", 3, 100, "Rare")

    assert {:ok, response} = Inventory.open_pack_for_user(user.id, pack.id)
    assert response.newBalance == 200
    assert Enum.any?(response.cards, &(&1.id == rare_card.id and &1.rarity.name == "Rare"))
  end

  test "open_pack_for_user advances hidden spark counters only on low random rarities" do
    user = create_user("inventory-spark-advance@example.com") |> grant_coins(300)
    common = create_rarity("Common", 52.0, "#9CA3AF")
    common_card = create_card("Finn", common.id)
    pack = create_pack("Basic Pack", 2, 100, nil)

    assert {:ok, response} = Inventory.open_pack_for_user(user.id, pack.id)
    assert Enum.all?(response.cards, &(&1.id == common_card.id))
    assert Enum.all?(response.cards, &(Map.get(&1, :revealSource) == nil))

    user = Repo.get!(User, user.id)
    assert user.pack_epic_spark_counter == 2
    assert user.pack_legendary_spark_counter == 2
  end

  test "open_pack_for_user silently forces epic spark and preserves legendary counter" do
    user =
      create_user("inventory-epic-spark@example.com")
      |> grant_coins(300)
      |> set_spark_counters(50, 37)

    _common = create_rarity("Common", 52.0, "#9CA3AF")
    epic = create_rarity("Epic", 4.0, "#8B5CF6")
    epic_card = create_card("BMO", epic.id)
    pack = create_pack("Basic Pack", 1, 100, nil)

    assert {:ok, response} = Inventory.open_pack_for_user(user.id, pack.id)
    assert [%{id: card_id, rarity: %{name: "Epic"}, revealSource: "spark"}] = response.cards
    assert card_id == epic_card.id

    user = Repo.get!(User, user.id)
    assert user.pack_epic_spark_counter == 0
    assert user.pack_legendary_spark_counter == 37
  end

  test "open_pack_for_user silently forces legendary spark before epic spark" do
    user =
      create_user("inventory-legendary-spark@example.com")
      |> grant_coins(300)
      |> set_spark_counters(50, 150)

    _common = create_rarity("Common", 52.0, "#9CA3AF")
    _epic = create_rarity("Epic", 4.0, "#8B5CF6")
    legendary = create_rarity("Legendary", 1.0, "#F59E0B")
    legendary_card = create_card("The Lich", legendary.id)
    pack = create_pack("Basic Pack", 1, 100, nil)

    assert {:ok, response} = Inventory.open_pack_for_user(user.id, pack.id)

    assert [%{id: card_id, rarity: %{name: "Legendary"}, revealSource: "spark"}] =
             response.cards

    assert card_id == legendary_card.id

    user = Repo.get!(User, user.id)
    assert user.pack_epic_spark_counter == 50
    assert user.pack_legendary_spark_counter == 0
  end

  test "open_pack_for_user does not trigger legendary spark inside legendary packs" do
    user =
      create_user("inventory-legendary-pack-spark@example.com")
      |> grant_coins(5_000)
      |> set_spark_counters(12, 150)

    common = create_rarity("Common", 1_000_000.0, "#9CA3AF")
    legendary = create_rarity("Legendary", 1.0, "#F59E0B")
    _common_card = create_card("Banana Guard", common.id)
    legendary_card = create_card("Golb", legendary.id)
    pack = create_pack("Legendary Pack", 2, 100, "Legendary")

    assert {:ok, response} = Inventory.open_pack_for_user(user.id, pack.id)
    assert Enum.any?(response.cards, &(&1.id == legendary_card.id))
    refute Enum.any?(response.cards, &(Map.get(&1, :revealSource) == "spark"))
  end

  test "open_pack_for_user random epic resets epic spark without advancing legendary spark" do
    user =
      create_user("inventory-random-epic-spark@example.com")
      |> grant_coins(300)
      |> set_spark_counters(12, 34)

    epic = create_rarity("Epic", 4.0, "#8B5CF6")
    epic_card = create_card("Flame Princess", epic.id)
    pack = create_pack("Basic Pack", 1, 100, nil)

    assert {:ok, response} = Inventory.open_pack_for_user(user.id, pack.id)
    assert [%{id: card_id, rarity: %{name: "Epic"}} = opened_card] = response.cards
    assert card_id == epic_card.id
    refute Map.has_key?(opened_card, :revealSource)

    user = Repo.get!(User, user.id)
    assert user.pack_epic_spark_counter == 0
    assert user.pack_legendary_spark_counter == 34
  end

  test "open_pack_for_user random legendary resets legendary spark without advancing epic spark" do
    user =
      create_user("inventory-random-legendary-spark@example.com")
      |> grant_coins(300)
      |> set_spark_counters(12, 34)

    legendary = create_rarity("Legendary", 1.0, "#F59E0B")
    legendary_card = create_card("Billy", legendary.id)
    pack = create_pack("Basic Pack", 1, 100, nil)

    assert {:ok, response} = Inventory.open_pack_for_user(user.id, pack.id)
    assert [%{id: card_id, rarity: %{name: "Legendary"}} = opened_card] = response.cards
    assert card_id == legendary_card.id
    refute Map.has_key?(opened_card, :revealSource)

    user = Repo.get!(User, user.id)
    assert user.pack_epic_spark_counter == 12
    assert user.pack_legendary_spark_counter == 0
  end

  test "open_pack_for_user guaranteed high rarities do not reset or advance spark counters" do
    user =
      create_user("inventory-guaranteed-spark@example.com")
      |> grant_coins(300)
      |> set_spark_counters(12, 34)

    epic = create_rarity("Epic", 4.0, "#8B5CF6")
    epic_card = create_card("Lumpy Space Princess", epic.id)
    pack = create_pack("Epic Pack", 1, 100, "Epic")

    assert {:ok, response} = Inventory.open_pack_for_user(user.id, pack.id)
    assert [%{id: card_id, rarity: %{name: "Epic"}} = opened_card] = response.cards
    assert card_id == epic_card.id
    refute Map.has_key?(opened_card, :revealSource)

    user = Repo.get!(User, user.id)
    assert user.pack_epic_spark_counter == 12
    assert user.pack_legendary_spark_counter == 34
  end

  test "craft_card rejects non-positive quantities" do
    user = create_user("inventory-craft-invalid@example.com") |> grant_dust(200)
    rare = create_rarity("Rare", 10.0, "#3B82F6")
    card = create_card("Peppermint Butler", rare.id)

    assert Inventory.craft_card(user.id, card.id, 0) == {:error, :invalid_quantity}
    assert Inventory.craft_card(user.id, card.id, -1) == {:error, :invalid_quantity}
  end

  test "recycle_card rejects non-positive quantities and blocks recycling the final active PvP copy" do
    user = create_user("inventory-recycle-invalid@example.com") |> grant_dust(10)
    opponent = create_user("inventory-recycle-opponent@example.com")
    rare = create_rarity("Epic", 5.0, "#8B5CF6")
    card = create_card("Ice King", rare.id)

    Repo.insert!(
      OwnedCard.changeset(%OwnedCard{}, %{
        quantity: 1,
        obtained_at: DateTime.utc_now() |> DateTime.truncate(:second)
      })
      |> Ecto.Changeset.put_change(:user_id, user.id)
      |> Ecto.Changeset.put_change(:card_id, card.id)
    )

    assert Inventory.recycle_card(user.id, card.id, 0) == {:error, :invalid_quantity}
    assert Inventory.recycle_card(user.id, card.id, -1) == {:error, :invalid_quantity}

    Repo.insert!(%AdventureTimeApi.Pvp.Match{
      inviter_id: user.id,
      invitee_id: opponent.id,
      status: "in_progress",
      inviter_card_ids: [card.id],
      invitee_card_ids: [card.id],
      current_turn: 1
    })

    assert Inventory.recycle_card(user.id, card.id, 1) == {:error, :card_in_active_match}
  end

  defp create_user(email) do
    user =
      Repo.insert!(
        User.registration_changeset(%User{}, %{email: email, display_name: "Tester"})
        |> User.access_changeset(%{role: :user, access_status: :approved})
      )

    Repo.insert!(
      EmailCredential.changeset(%EmailCredential{}, %{
        password_hash: Bcrypt.hash_pwd_salt("secret123"),
        email_verified_at: DateTime.utc_now() |> DateTime.truncate(:second)
      })
      |> Ecto.Changeset.put_change(:user_id, user.id)
    )

    user
  end

  defp grant_coins(user, coins) do
    user
    |> Ecto.Changeset.change(coins: coins)
    |> Repo.update!()
  end

  defp grant_dust(user, dust) do
    user
    |> Ecto.Changeset.change(dust: dust)
    |> Repo.update!()
  end

  defp set_spark_counters(user, epic_counter, legendary_counter) do
    user
    |> Ecto.Changeset.change(
      pack_epic_spark_counter: epic_counter,
      pack_legendary_spark_counter: legendary_counter
    )
    |> Repo.update!()
  end

  defp create_rarity(name, drop_rate, color) do
    Repo.insert!(Rarity.changeset(%Rarity{}, %{name: name, drop_rate: drop_rate, color: color}))
  end

  defp create_card(name, rarity_id) do
    Repo.insert!(
      Card.changeset(%Card{}, %{
        name: name,
        character: name,
        description: "#{name} description.",
        hp: 15,
        attack: 7,
        defense: 5,
        speed: 50,
        type: "Hero",
        rarity_id: rarity_id
      })
    )
  end

  defp create_pack(name, card_count, cost, guaranteed_rarity) do
    Repo.insert!(
      Pack.changeset(%Pack{}, %{
        name: name,
        description: "#{name} description.",
        card_count: card_count,
        cost: cost,
        color: "#F59E0B",
        is_active: true,
        guaranteed_rarity: guaranteed_rarity
      })
    )
  end
end
