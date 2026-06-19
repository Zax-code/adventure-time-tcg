defmodule AdventureTimeApi.Inventory do
  @moduledoc """
  Inventory boundary for player-owned cards and future reward flows.
  """

  import Ecto.Query

  alias AdventureTimeApi.Accounts.User
  alias AdventureTimeApi.Catalog.{Card, CardType, Pack, Rarity}
  alias AdventureTimeApi.Inventory.{OwnedCard, PackOpening}
  alias AdventureTimeApi.Pvp
  alias AdventureTimeApi.Repo

  def owned_card_module, do: OwnedCard

  @dust_sacrifice %{common: 1, uncommon: 5, rare: 20, epic: 50, legendary: 100}
  @craft_cost_multiplier 5

  def dust_sacrifice_value(rarity_name) do
    key = rarity_name |> to_string() |> String.trim() |> String.downcase() |> String.to_atom()
    Map.get(@dust_sacrifice, key, @dust_sacrifice.common)
  end

  def dust_craft_cost(rarity_name), do: dust_sacrifice_value(rarity_name) * @craft_cost_multiplier

  def craft_card(user_id, card_id, quantity) do
    with :ok <- validate_positive_quantity(quantity),
         %Card{} = card <- Repo.get(Card, card_id) |> Repo.preload(:rarity),
         %User{} = user <- lock_user(user_id) do
      dust_cost = dust_craft_cost(card.rarity.name) * quantity

      if user.dust < dust_cost do
        {:error, :not_enough_dust, dust_cost, user.dust}
      else
        now = DateTime.utc_now() |> DateTime.truncate(:second)
        new_dust = user.dust - dust_cost

        Ecto.Multi.new()
        |> Ecto.Multi.run(:deduct_dust, fn repo, _changes ->
          {1, _} =
            from(u in User, where: u.id == ^user_id)
            |> repo.update_all(set: [dust: new_dust, updated_at: now])

          {:ok, new_dust}
        end)
        |> Ecto.Multi.run(:upsert_owned_card, fn repo, _changes ->
          case repo.get_by(OwnedCard, user_id: user_id, card_id: card_id) do
            nil ->
              %OwnedCard{}
              |> OwnedCard.changeset(%{quantity: quantity, obtained_at: now})
              |> Ecto.Changeset.put_change(:user_id, user_id)
              |> Ecto.Changeset.put_change(:card_id, card_id)
              |> repo.insert()

            %OwnedCard{} = owned ->
              owned
              |> Ecto.Changeset.change(quantity: owned.quantity + quantity)
              |> repo.update()
          end
        end)
        |> Repo.transaction()
        |> case do
          {:ok, _} ->
            {:ok,
             %{
               success: true,
               cardId: card_id,
               quantityCrafted: quantity,
               dustSpent: dust_cost,
               newDustBalance: new_dust
             }}

          {:error, _step, reason, _changes} ->
            {:error, reason}
        end
      end
    else
      {:error, reason} -> {:error, reason}
      nil -> {:error, :not_found}
    end
  end

  def recycle_card(user_id, card_id, quantity) do
    owned =
      OwnedCard
      |> where([o], o.user_id == ^user_id and o.card_id == ^card_id)
      |> preload(card: [:rarity])
      |> Repo.one()

    with :ok <- validate_positive_quantity(quantity),
         %OwnedCard{} = owned <- owned || nil,
         :ok <- ensure_enough_copies(owned.quantity, quantity),
         :ok <- ensure_not_in_active_pvp(user_id, card_id, owned.quantity, quantity),
         %User{} = user <- Repo.get(User, user_id) do
      dust_gained = dust_sacrifice_value(owned.card.rarity.name) * quantity
      new_dust = user.dust + dust_gained
      now = DateTime.utc_now() |> DateTime.truncate(:second)

      Ecto.Multi.new()
      |> Ecto.Multi.run(:update_owned_card, fn repo, _changes ->
        if owned.quantity == quantity do
          repo.delete(owned)
        else
          owned
          |> Ecto.Changeset.change(quantity: owned.quantity - quantity)
          |> repo.update()
        end
      end)
      |> Ecto.Multi.run(:add_dust, fn repo, _changes ->
        {1, _} =
          from(u in User, where: u.id == ^user_id)
          |> repo.update_all(set: [dust: new_dust, updated_at: now])

        {:ok, new_dust}
      end)
      |> Repo.transaction()
      |> case do
        {:ok, _} ->
          {:ok,
           %{
             success: true,
             cardId: card_id,
             quantityRecycled: quantity,
             dustGained: dust_gained,
             newDustBalance: new_dust
           }}

        {:error, _step, reason, _changes} ->
          {:error, reason}
      end
    else
      nil -> {:error, :not_owned}
      {:error, reason} -> {:error, reason}
    end
  end

  defp lock_user(user_id) do
    User
    |> where([u], u.id == ^user_id)
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  defp ensure_enough_copies(owned_qty, requested) when owned_qty >= requested, do: :ok
  defp ensure_enough_copies(owned_qty, _requested), do: {:error, {:not_enough_copies, owned_qty}}

  defp validate_positive_quantity(quantity) when is_integer(quantity) and quantity > 0, do: :ok
  defp validate_positive_quantity(_quantity), do: {:error, :invalid_quantity}

  defp ensure_not_in_active_pvp(user_id, card_id, owned_qty, quantity) do
    if owned_qty == quantity do
      active_ids = Pvp.active_card_ids_for_user(user_id)

      if card_id in active_ids do
        {:error, :card_in_active_match}
      else
        :ok
      end
    else
      :ok
    end
  end

  def open_pack_for_user(user_id, pack_id) do
    Repo.transaction(fn ->
      with {:ok, user} <- fetch_locked_user(user_id),
           {:ok, pack} <- fetch_active_pack(pack_id),
           :ok <- ensure_can_afford_pack(user, pack),
           available_cards when available_cards != [] <- available_cards(),
           available_rarities when available_rarities != [] <- available_rarities() do
        selected_cards = select_cards_for_pack(pack, available_cards, available_rarities)

        owned_card_ids_before_open =
          OwnedCard
          |> where([owned_card], owned_card.user_id == ^user_id)
          |> select([owned_card], owned_card.card_id)
          |> Repo.all()
          |> MapSet.new()

        now = DateTime.utc_now() |> DateTime.truncate(:second)
        new_balance = user.coins - pack.cost

        {1, _} =
          from(existing_user in User, where: existing_user.id == ^user_id)
          |> Repo.update_all(set: [coins: new_balance, updated_at: now])

        Enum.each(selected_cards, fn card ->
          case Repo.get_by(OwnedCard, user_id: user_id, card_id: card.id) do
            nil ->
              %OwnedCard{}
              |> OwnedCard.changeset(%{quantity: 1, obtained_at: now})
              |> Ecto.Changeset.put_change(:user_id, user_id)
              |> Ecto.Changeset.put_change(:card_id, card.id)
              |> Repo.insert!()

            %OwnedCard{} = owned_card ->
              owned_card
              |> Ecto.Changeset.change(quantity: owned_card.quantity + 1)
              |> Repo.update!()
          end
        end)

        %{
          pack: to_pack_response(pack),
          cards:
            Enum.map(selected_cards, fn card ->
              card
              |> to_card_payload()
              |> Map.put(:isNewForUser, not MapSet.member?(owned_card_ids_before_open, card.id))
            end),
          newBalance: new_balance
        }
      else
        {:error, reason} -> Repo.rollback(reason)
        [] -> Repo.rollback(:no_cards_available)
      end
    end)
    |> case do
      {:ok, response} -> {:ok, response}
      {:error, :user_not_found} -> {:error, :user_not_found}
      {:error, :pack_not_found_or_inactive} -> {:error, :pack_not_found_or_inactive}
      {:error, :not_enough_coins} -> {:error, :not_enough_coins}
      {:error, :no_cards_available} -> {:error, :no_cards_available}
    end
  end

  def collection_for_user(user_id) do
    owned_cards_by_card_id =
      OwnedCard
      |> where([owned_card], owned_card.user_id == ^user_id)
      |> preload(card: [:rarity])
      |> Repo.all()
      |> Map.new(&{&1.card_id, &1})

    cards =
      Card
      |> where([card], card.is_archived == false)
      |> preload([:rarity])
      |> order_by([card], asc: card.name, asc: card.id)
      |> Repo.all()
      |> Enum.map(fn card ->
        to_collection_entry(card, Map.get(owned_cards_by_card_id, card.id))
      end)

    %{
      cards: cards,
      dust: user_dust(user_id),
      stats: collection_stats_for_entries(cards)
    }
  end

  def collection_stats_for_user(user_id) do
    unique_owned =
      OwnedCard
      |> join(:inner, [owned_card], card in Card, on: owned_card.card_id == card.id)
      |> where(
        [owned_card, card],
        owned_card.user_id == ^user_id and card.is_archived == false
      )
      |> select([owned_card], count(owned_card.id))
      |> Repo.one()
      |> Kernel.||(0)

    total_catalog_cards = total_collectible_catalog_cards()

    completion_percentage =
      if total_catalog_cards == 0 do
        0
      else
        round(unique_owned / total_catalog_cards * 100)
      end

    %{
      totalCards: total_catalog_cards,
      uniqueOwned: unique_owned,
      completionPercentage: completion_percentage
    }
  end

  defp to_collection_entry(card, nil) do
    %{
      id: "catalog:" <> card.id,
      cardId: card.id,
      quantity: 0,
      obtainedAt: nil,
      card: to_card_payload(card)
    }
  end

  defp to_collection_entry(card, owned_card) do
    %{
      id: owned_card.id,
      cardId: card.id,
      quantity: owned_card.quantity,
      obtainedAt: DateTime.to_iso8601(owned_card.obtained_at),
      card: to_card_payload(card)
    }
  end

  defp fetch_locked_user(user_id) do
    case User |> where([user], user.id == ^user_id) |> lock("FOR UPDATE") |> Repo.one() do
      %User{} = user -> {:ok, user}
      nil -> {:error, :user_not_found}
    end
  end

  defp fetch_active_pack(pack_id) do
    case Pack |> where([pack], pack.id == ^pack_id and pack.is_active == true) |> Repo.one() do
      %Pack{} = pack -> {:ok, pack}
      nil -> {:error, :pack_not_found_or_inactive}
    end
  end

  defp ensure_can_afford_pack(user, pack) do
    if user.coins >= pack.cost do
      :ok
    else
      {:error, :not_enough_coins}
    end
  end

  defp available_cards do
    Card
    |> where([card], card.is_archived == false)
    |> preload([:rarity])
    |> Repo.all()
  end

  defp available_rarities do
    Rarity
    |> order_by([rarity], desc: rarity.drop_rate)
    |> Repo.all()
  end

  defp select_cards_for_pack(pack, available_cards, available_rarities) do
    guaranteed_cards =
      case pack.guaranteed_rarity do
        rarity when is_binary(rarity) and rarity != "" ->
          [PackOpening.select_card(available_cards, available_rarities, rarity)]

        _ ->
          []
      end

    remaining_slots = max(pack.card_count - length(guaranteed_cards), 0)

    random_cards =
      if remaining_slots == 0 do
        []
      else
        for _slot <- 1..remaining_slots do
          PackOpening.select_card(available_cards, available_rarities)
        end
      end

    guaranteed_cards
    |> Kernel.++(random_cards)
    |> PackOpening.shuffle()
  end

  defp to_pack_response(pack) do
    %{
      id: pack.id,
      name: pack.name,
      description: pack.description,
      cardCount: pack.card_count,
      cost: pack.cost,
      color: pack.color,
      isActive: pack.is_active,
      guaranteedRarity: pack.guaranteed_rarity
    }
  end

  defp to_card_payload(card) do
    %{
      id: card.id,
      name: card.name,
      character: card.character,
      description: card.description,
      hp: card.hp,
      attack: card.attack,
      defense: card.defense,
      speed: card.speed,
      type: CardType.canonicalize!(card.type),
      rarity: %{
        id: card.rarity.id,
        name: card.rarity.name,
        dropRate: card.rarity.drop_rate,
        color: card.rarity.color
      },
      imageAssetId: card.image_asset_id
    }
  end

  defp collection_stats_for_entries(entries) do
    total_cards = Enum.reduce(entries, 0, fn entry, sum -> sum + entry.quantity end)
    unique_owned = Enum.count(entries, &(&1.quantity > 0))
    total_catalog_cards = total_collectible_catalog_cards()

    completion_percentage =
      if total_catalog_cards == 0 do
        0
      else
        round(unique_owned / total_catalog_cards * 100)
      end

    %{
      totalCards: total_cards,
      uniqueOwned: unique_owned,
      completionPercentage: completion_percentage
    }
  end

  defp total_collectible_catalog_cards do
    Card
    |> where([card], card.is_archived == false)
    |> Repo.aggregate(:count, :id)
  end

  defp user_dust(user_id) do
    AdventureTimeApi.Accounts.User
    |> Repo.get(user_id)
    |> case do
      nil -> 0
      user -> user.dust
    end
  end
end
