defmodule AdventureTimeApi.Catalog do
  @moduledoc """
  Catalog boundary for rarities, cards, packs, and image metadata.
  """

  import Ecto.Query
  alias Ecto.Changeset

  alias AdventureTimeApi.Repo
  alias AdventureTimeApi.Catalog.{Card, CardType, ImageAsset, Pack, Rarity}
  alias AdventureTimeApi.Media

  @dust_sacrifice_by_rarity %{
    "common" => 1,
    "uncommon" => 5,
    "rare" => 20,
    "epic" => 50,
    "legendary" => 100
  }
  @craft_cost_multiplier 5

  def rarity_module, do: Rarity
  def image_asset_module, do: ImageAsset
  def card_module, do: Card
  def pack_module, do: Pack

  def list_rarities do
    Rarity
    |> order_by([rarity], desc: rarity.drop_rate)
    |> Repo.all()
    |> Enum.map(&to_rarity_response/1)
  end

  def list_active_packs do
    Pack
    |> where([pack], pack.is_active == true)
    |> order_by([pack], asc: pack.cost, asc: pack.inserted_at)
    |> Repo.all()
    |> Enum.map(&to_pack_response/1)
  end

  def list_admin_packs do
    Pack
    |> order_by([pack], asc: pack.cost, asc: pack.inserted_at)
    |> Repo.all()
    |> Enum.map(&to_pack_response/1)
  end

  def create_admin_pack(attrs) do
    %Pack{}
    |> Pack.changeset(normalize_admin_pack_attrs(attrs))
    |> Repo.insert()
    |> case do
      {:ok, pack} -> {:ok, to_pack_response(pack)}
      {:error, changeset} -> {:error, changeset}
    end
  end

  def patch_admin_pack(pack_id, attrs) do
    case Repo.get(Pack, pack_id) do
      %Pack{} = pack ->
        pack
        |> Pack.changeset(normalize_admin_pack_patch_attrs(attrs))
        |> Repo.update()
        |> case do
          {:ok, updated} -> {:ok, to_pack_response(updated)}
          {:error, changeset} -> {:error, changeset}
        end

      nil ->
        {:error, :not_found}
    end
  end

  def list_featured_cards do
    Card
    |> where([card], card.is_featured == true and card.is_archived == false)
    |> preload([:rarity])
    |> order_by([card], asc: card.inserted_at)
    |> Repo.all()
    |> Enum.map(&to_featured_collection_entry/1)
  end

  def list_admin_cards do
    Card
    |> preload([:rarity])
    |> order_by([card], asc: card.name)
    |> Repo.all()
    |> Enum.map(&to_admin_card_payload/1)
  end

  def get_admin_card(card_id) do
    Card
    |> preload([:rarity])
    |> Repo.get(card_id)
    |> case do
      %Card{} = card -> {:ok, to_admin_card_payload(card)}
      nil -> {:error, :not_found}
    end
  end

  def create_admin_card(attrs) do
    %Card{}
    |> Card.changeset(normalize_admin_card_attrs(attrs))
    |> Repo.insert()
    |> case do
      {:ok, card} -> get_admin_card(card.id)
      {:error, changeset} -> {:error, changeset}
    end
  end

  def update_admin_card(card_id, attrs) do
    case Repo.get(Card, card_id) do
      %Card{} = card ->
        card
        |> Card.changeset(normalize_admin_card_attrs(attrs))
        |> Repo.update()
        |> case do
          {:ok, updated} -> get_admin_card(updated.id)
          {:error, changeset} -> {:error, changeset}
        end

      nil ->
        {:error, :not_found}
    end
  end

  def patch_admin_card(card_id, attrs) do
    case Repo.get(Card, card_id) do
      %Card{} = card ->
        card
        |> Changeset.change(normalize_admin_card_patch_attrs(attrs, card))
        |> Repo.update()
        |> case do
          {:ok, updated} -> get_admin_card(updated.id)
          {:error, changeset} -> {:error, changeset}
        end

      nil ->
        {:error, :not_found}
    end
  end

  def attach_card_image(card_id, binary_data, mime_type) do
    case Repo.get(Card, card_id) do
      %Card{} -> Media.store_card_image(card_id, binary_data, mime_type)
      nil -> {:error, :not_found}
    end
  end

  def rarity_dust_value(name) do
    name
    |> String.trim()
    |> String.downcase()
    |> then(&Map.get(@dust_sacrifice_by_rarity, &1, @dust_sacrifice_by_rarity["common"]))
  end

  def rarity_craft_cost(name) do
    rarity_dust_value(name) * @craft_cost_multiplier
  end

  defp to_rarity_response(rarity) do
    %{
      id: rarity.id,
      name: rarity.name,
      dropRate: rarity.drop_rate,
      color: rarity.color,
      dustValue: rarity_dust_value(rarity.name),
      craftCost: rarity_craft_cost(rarity.name)
    }
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

  defp normalize_admin_pack_attrs(attrs) do
    attrs
    |> Map.take([
      "name",
      "description",
      "cardCount",
      "cost",
      "color",
      "isActive",
      "guaranteedRarity"
    ])
    |> Enum.reduce(%{}, fn
      {"cardCount", value}, acc ->
        Map.put(acc, :card_count, value)

      {"isActive", value}, acc ->
        Map.put(acc, :is_active, value)

      {"guaranteedRarity", value}, acc ->
        Map.put(acc, :guaranteed_rarity, normalize_blank_string(value))

      {key, value}, acc ->
        Map.put(acc, String.to_existing_atom(key), value)
    end)
  end

  defp normalize_admin_pack_patch_attrs(attrs) do
    attrs
    |> Map.take([
      "name",
      "description",
      "cardCount",
      "cost",
      "color",
      "isActive",
      "guaranteedRarity"
    ])
    |> Enum.reduce(%{}, fn
      {"cardCount", value}, acc ->
        Map.put(acc, :card_count, value)

      {"isActive", value}, acc ->
        Map.put(acc, :is_active, value)

      {"guaranteedRarity", value}, acc ->
        Map.put(acc, :guaranteed_rarity, normalize_blank_string(value))

      {key, value}, acc ->
        Map.put(acc, String.to_existing_atom(key), value)
    end)
  end

  defp normalize_blank_string(value) when value in [nil, ""], do: nil
  defp normalize_blank_string(value), do: value

  defp to_featured_collection_entry(card) do
    now = DateTime.utc_now() |> DateTime.truncate(:second) |> DateTime.to_iso8601()

    %{
      id: card.id,
      cardId: card.id,
      quantity: 1,
      obtainedAt: now,
      card: %{
        id: card.id,
        name: card.name,
        character: card.character,
        description: card.description,
        hp: card.hp,
        attack: card.attack,
        defense: card.defense,
        speed: card.speed,
        type: CardType.canonicalize!(card.type),
        rarity: to_rarity_response(card.rarity),
        imageAssetId: card.image_asset_id
      }
    }
  end

  defp to_admin_card_payload(card) do
    %{
      id: card.id,
      name: card.name,
      character: card.character,
      rarityName: card.rarity.name,
      rarityId: card.rarity_id,
      isArchived: card.is_archived,
      isFeatured: card.is_featured,
      description: card.description,
      hp: card.hp,
      attack: card.attack,
      defense: card.defense,
      speed: card.speed,
      type: CardType.canonicalize!(card.type),
      imageAssetId: card.image_asset_id
    }
  end

  defp normalize_admin_card_attrs(attrs) do
    attrs
    |> Map.take([
      "name",
      "character",
      "description",
      "hp",
      "attack",
      "defense",
      "speed",
      "type",
      "rarityId",
      "isFeatured",
      "isArchived"
    ])
    |> Enum.reduce(%{}, fn
      {"rarityId", value}, acc -> Map.put(acc, :rarity_id, value)
      {"isFeatured", value}, acc -> Map.put(acc, :is_featured, value)
      {"isArchived", value}, acc -> Map.put(acc, :is_archived, value)
      {"type", value}, acc -> Map.put(acc, :type, CardType.normalize_input(value))
      {key, value}, acc -> Map.put(acc, String.to_existing_atom(key), value)
    end)
    |> maybe_clear_featured_when_archived()
  end

  defp normalize_admin_card_patch_attrs(attrs, card) do
    attrs
    |> Map.take(["isFeatured", "isArchived"])
    |> Enum.reduce(%{}, fn
      {"isFeatured", value}, acc -> Map.put(acc, :is_featured, value)
      {"isArchived", value}, acc -> Map.put(acc, :is_archived, value)
    end)
    |> case do
      %{is_archived: true} = patch -> Map.put(patch, :is_featured, false)
      %{is_archived: false} = patch -> Map.put_new(patch, :is_featured, card.is_featured)
      patch -> patch
    end
  end

  defp maybe_clear_featured_when_archived(%{is_archived: true} = attrs),
    do: Map.put(attrs, :is_featured, false)

  defp maybe_clear_featured_when_archived(attrs), do: attrs
end
