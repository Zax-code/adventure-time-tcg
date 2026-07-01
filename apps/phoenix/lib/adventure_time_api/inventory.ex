defmodule AdventureTimeApi.Inventory do
  @moduledoc """
  Inventory boundary for player-owned cards and future reward flows.
  """

  import Ecto.Query

  alias AdventureTimeApi.Accounts.User
  alias AdventureTimeApi.Catalog.{Card, CardType, Pack, Rarity}
  alias AdventureTimeApi.Inventory.{OwnedCard, PackOpening, PackOpeningRecord}
  alias AdventureTimeApi.Pvp
  alias AdventureTimeApi.Repo

  def owned_card_module, do: OwnedCard

  @dust_sacrifice %{common: 1, uncommon: 5, rare: 20, epic: 50, legendary: 100}
  @craft_cost_multiplier 5
  @weekly_limited_rarity "legendary"
  @weekly_pack_limit 1
  @epic_spark_threshold 50
  @legendary_spark_threshold 150
  @legendary_pack_random_legendary_rate 0.25
  @low_rarity_names MapSet.new(["Common", "Uncommon", "Rare"])

  def list_active_packs_for_user(user_id) do
    Pack
    |> where([pack], pack.is_active == true)
    |> order_by([pack], asc: pack.cost, asc: pack.inserted_at)
    |> Repo.all()
    |> Enum.map(&to_pack_response(&1, user_id))
  end

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
           :ok <- ensure_weekly_pack_limit(user, pack),
           available_cards when available_cards != [] <- available_cards(),
           available_rarities when available_rarities != [] <- available_rarities() do
        {selected_drops, spark_counters} =
          select_drops_for_pack(user, pack, available_cards, available_rarities)

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
          |> Repo.update_all(
            set: [
              coins: new_balance,
              pack_epic_spark_counter: spark_counters.epic,
              pack_legendary_spark_counter: spark_counters.legendary,
              updated_at: now
            ]
          )

        Enum.each(selected_drops, fn %{card: card} ->
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

        %PackOpeningRecord{}
        |> PackOpeningRecord.changeset(%{pack_name: pack.name, opened_at: now})
        |> Ecto.Changeset.put_change(:user_id, user_id)
        |> Ecto.Changeset.put_change(:pack_id, pack.id)
        |> Repo.insert!()

        %{
          pack: to_pack_response(pack, user_id, DateTime.add(now, 1, :second)),
          cards:
            Enum.map(selected_drops, fn %{card: card} = drop ->
              card_payload =
                card
                |> to_card_payload()
                |> Map.put(:isNewForUser, not MapSet.member?(owned_card_ids_before_open, card.id))

              maybe_put_reveal_source(card_payload, drop)
            end),
          newBalance: new_balance
        }
      else
        {:error, reason} -> Repo.rollback(reason)
        [] -> Repo.rollback(:no_cards_available)
      end
    end)
    |> case do
      {:ok, response} ->
        {:ok, response}

      {:error, :user_not_found} ->
        {:error, :user_not_found}

      {:error, :pack_not_found_or_inactive} ->
        {:error, :pack_not_found_or_inactive}

      {:error, :not_enough_coins} ->
        {:error, :not_enough_coins}

      {:error, {:weekly_pack_limit_reached, payload}} ->
        {:error, :weekly_pack_limit_reached, payload}

      {:error, :no_cards_available} ->
        {:error, :no_cards_available}
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

  defp ensure_weekly_pack_limit(user, pack) do
    availability = pack_availability(user.id, user.timezone, pack)

    if availability.canOpen do
      :ok
    else
      {:error, {:weekly_pack_limit_reached, availability}}
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

  defp select_drops_for_pack(user, pack, available_cards, available_rarities) do
    guaranteed_cards =
      case pack.guaranteed_rarity do
        rarity when is_binary(rarity) and rarity != "" ->
          [
            %{
              card: PackOpening.select_card(available_cards, available_rarities, rarity),
              source: :guaranteed
            }
          ]

        _ ->
          []
      end

    remaining_slots = max(pack.card_count - length(guaranteed_cards), 0)
    spark_counters = spark_counters_for_user(user)
    random_rarities = random_rarities_for_pack(pack, available_rarities)

    {random_drops, spark_counters} =
      if remaining_slots == 0 do
        {[], spark_counters}
      else
        select_random_drops(
          remaining_slots,
          available_cards,
          random_rarities,
          spark_counters,
          legendary_spark_allowed?(pack)
        )
      end

    guaranteed_cards
    |> Kernel.++(random_drops)
    |> order_drops_for_reveal()
    |> then(&{&1, spark_counters})
  end

  defp select_random_drops(
         slot_count,
         available_cards,
         available_rarities,
         spark_counters,
         allow_legendary_spark?
       ) do
    1..slot_count
    |> Enum.reduce({[], spark_counters}, fn _slot, {drops, counters} ->
      {drop, counters} =
        select_random_drop(
          available_cards,
          available_rarities,
          counters,
          allow_legendary_spark?
        )

      {[drop | drops], counters}
    end)
    |> then(fn {drops, counters} -> {Enum.reverse(drops), counters} end)
  end

  defp select_random_drop(available_cards, available_rarities, counters, allow_legendary_spark?) do
    case spark_rarity(counters, allow_legendary_spark?) do
      "Legendary" ->
        select_spark_drop(available_cards, available_rarities, counters, "Legendary")

      "Epic" ->
        select_spark_drop(available_cards, available_rarities, counters, "Epic")

      nil ->
        card = PackOpening.select_card(available_cards, available_rarities)

        {
          %{card: card, source: :random},
          advance_spark_counters(counters, card.rarity.name)
        }
    end
  end

  defp select_spark_drop(available_cards, available_rarities, counters, rarity_name) do
    case PackOpening.select_card_for_rarity(available_cards, available_rarities, rarity_name) do
      {:ok, card} ->
        {
          %{card: card, source: :spark, revealSource: "spark"},
          reset_spark_counter(counters, rarity_name)
        }

      :error ->
        card = PackOpening.select_card(available_cards, available_rarities)

        {
          %{card: card, source: :random},
          advance_spark_counters(counters, card.rarity.name)
        }
    end
  end

  defp spark_rarity(%{spark_used?: true}, _allow_legendary_spark?), do: nil

  defp spark_rarity(%{legendary: legendary}, true) when legendary >= @legendary_spark_threshold,
    do: "Legendary"

  defp spark_rarity(%{epic: epic}, _allow_legendary_spark?)
       when epic >= @epic_spark_threshold,
       do: "Epic"

  defp spark_rarity(_counters, _allow_legendary_spark?), do: nil

  defp legendary_spark_allowed?(pack), do: not weekly_limited_pack?(pack)

  defp random_rarities_for_pack(pack, available_rarities) do
    if weekly_limited_pack?(pack) do
      reduce_legendary_pack_random_rate(available_rarities)
    else
      available_rarities
    end
  end

  defp reduce_legendary_pack_random_rate(available_rarities) do
    legendary_rate =
      available_rarities
      |> Enum.find(&(&1.name == "Legendary"))
      |> case do
        nil -> 0.0
        rarity -> rarity.drop_rate
      end

    common_bonus = max(legendary_rate - @legendary_pack_random_legendary_rate, 0.0)

    Enum.map(available_rarities, fn
      %{name: "Legendary"} = rarity ->
        %{rarity | drop_rate: min(rarity.drop_rate, @legendary_pack_random_legendary_rate)}

      %{name: "Common"} = rarity ->
        %{rarity | drop_rate: rarity.drop_rate + common_bonus}

      rarity ->
        rarity
    end)
  end

  defp spark_counters_for_user(user) do
    %{
      epic: max(user.pack_epic_spark_counter || 0, 0),
      legendary: max(user.pack_legendary_spark_counter || 0, 0),
      spark_used?: false
    }
  end

  defp advance_spark_counters(counters, rarity_name) do
    cond do
      MapSet.member?(@low_rarity_names, rarity_name) ->
        %{counters | epic: counters.epic + 1, legendary: counters.legendary + 1}

      rarity_name == "Epic" ->
        %{counters | epic: 0}

      rarity_name == "Legendary" ->
        %{counters | legendary: 0}

      true ->
        counters
    end
  end

  defp reset_spark_counter(counters, "Legendary"),
    do: %{counters | legendary: 0, spark_used?: true}

  defp reset_spark_counter(counters, "Epic"),
    do: %{counters | epic: 0, spark_used?: true}

  defp order_drops_for_reveal(drops) do
    {spark_drops, regular_drops} = Enum.split_with(drops, &(&1[:source] == :spark))

    if spark_drops == [] do
      PackOpening.shuffle(drops)
    else
      PackOpening.shuffle(regular_drops) ++ spark_drops
    end
  end

  defp to_pack_response(pack, user_id, now \\ DateTime.utc_now()) do
    %{
      id: pack.id,
      name: pack.name,
      description: pack.description,
      cardCount: pack.card_count,
      cost: pack.cost,
      color: pack.color,
      isActive: pack.is_active,
      guaranteedRarity: pack.guaranteed_rarity,
      packArtAssetId: pack.pack_art_asset_id,
      availability: pack_availability(user_id, nil, pack, now)
    }
  end

  defp pack_availability(user_id, timezone, pack) do
    pack_availability(user_id, timezone, pack, DateTime.utc_now())
  end

  defp pack_availability(nil, _timezone, _pack, _now) do
    %{
      canOpen: true,
      reason: nil,
      nextAvailableAt: nil,
      opensRemaining: nil,
      limit: nil
    }
  end

  defp pack_availability(user_id, nil, pack, now) do
    timezone =
      case Repo.get(User, user_id) do
        %User{timezone: timezone} when is_binary(timezone) and timezone != "" -> timezone
        _ -> "Europe/Paris"
      end

    pack_availability(user_id, timezone, pack, now)
  end

  defp pack_availability(user_id, timezone, pack, now) do
    if weekly_limited_pack?(pack) do
      {week_start, next_week_start} = weekly_window(now, timezone || "Europe/Paris")

      openings =
        PackOpeningRecord
        |> where(
          [opening],
          opening.user_id == ^user_id and opening.pack_id == ^pack.id and
            opening.opened_at >= ^week_start and opening.opened_at < ^next_week_start
        )
        |> Repo.aggregate(:count, :id)

      opens_remaining = max(@weekly_pack_limit - openings, 0)

      %{
        canOpen: opens_remaining > 0,
        reason: if(opens_remaining > 0, do: nil, else: "weekly_limit"),
        nextAvailableAt: DateTime.to_iso8601(next_week_start),
        opensRemaining: opens_remaining,
        limit: @weekly_pack_limit
      }
    else
      %{
        canOpen: true,
        reason: nil,
        nextAvailableAt: nil,
        opensRemaining: nil,
        limit: nil
      }
    end
  end

  defp weekly_limited_pack?(pack) do
    pack.guaranteed_rarity
    |> to_string()
    |> String.trim()
    |> String.downcase()
    |> Kernel.==(@weekly_limited_rarity)
  end

  defp weekly_window(now, timezone) do
    local_now = DateTime.shift_zone!(now, timezone)
    local_date = DateTime.to_date(local_now)
    week_start_date = Date.add(local_date, 1 - Date.day_of_week(local_date))
    next_week_start_date = Date.add(week_start_date, 7)

    week_start =
      week_start_date
      |> DateTime.new!(~T[00:00:00], timezone)
      |> DateTime.shift_zone!("Etc/UTC")
      |> DateTime.truncate(:second)

    next_week_start =
      next_week_start_date
      |> DateTime.new!(~T[00:00:00], timezone)
      |> DateTime.shift_zone!("Etc/UTC")
      |> DateTime.truncate(:second)

    {week_start, next_week_start}
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

  defp maybe_put_reveal_source(card_payload, %{revealSource: reveal_source})
       when is_binary(reveal_source) do
    Map.put(card_payload, :revealSource, reveal_source)
  end

  defp maybe_put_reveal_source(card_payload, _drop), do: card_payload

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
