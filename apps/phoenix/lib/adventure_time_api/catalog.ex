defmodule AdventureTimeApi.Catalog do
  @moduledoc """
  Catalog boundary for rarities, cards, packs, and image metadata.
  """

  import Ecto.Query
  alias Ecto.Changeset

  alias AdventureTimeApi.Repo
  alias AdventureTimeApi.Catalog.{Card, CardBackVisual, CardType, ImageAsset, Pack, Rarity}
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

  def list_card_back_visuals do
    existing_visuals =
      CardBackVisual
      |> Repo.all()
      |> Map.new(fn visual ->
        {{visual.theme_name, visual.rarity_name}, visual.image_asset_id}
      end)

    for theme_name <- CardBackVisual.theme_names(),
        rarity_name <- CardBackVisual.rarity_names() do
      %{
        themeName: theme_name,
        rarityName: rarity_name,
        imageAssetId: Map.get(existing_visuals, {theme_name, rarity_name})
      }
    end
  end

  def list_admin_card_back_visuals, do: list_card_back_visuals()

  def create_admin_pack(attrs) do
    attrs = normalize_admin_pack_attrs(attrs)

    %Pack{}
    |> Pack.changeset(attrs)
    |> validate_catalog_asset_id(attrs, :pack_art_asset_id)
    |> Repo.insert()
    |> case do
      {:ok, pack} -> {:ok, to_pack_response(pack)}
      {:error, changeset} -> {:error, changeset}
    end
  end

  def patch_admin_pack(pack_id, attrs) do
    case Repo.get(Pack, pack_id) do
      %Pack{} = pack ->
        attrs = normalize_admin_pack_patch_attrs(attrs)

        pack
        |> Pack.changeset(attrs)
        |> validate_catalog_asset_id(attrs, :pack_art_asset_id)
        |> Repo.update()
        |> case do
          {:ok, updated} -> {:ok, to_pack_response(updated)}
          {:error, changeset} -> {:error, changeset}
        end

      nil ->
        {:error, :not_found}
    end
  end

  def upsert_admin_card_back_visual(attrs) do
    normalized_attrs = normalize_admin_card_back_visual_attrs(attrs)

    base_changeset =
      %CardBackVisual{}
      |> CardBackVisual.changeset(%{
        theme_name: normalized_attrs.theme_name,
        rarity_name: normalized_attrs.rarity_name,
        image_asset_id: normalized_attrs.image_asset_id || Ecto.UUID.generate()
      })
      |> validate_catalog_asset_id(normalized_attrs, :image_asset_id)

    with true <- base_changeset.valid? || {:error, base_changeset} do
      persist_admin_card_back_visual(normalized_attrs)
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
      guaranteedRarity: pack.guaranteed_rarity,
      packArtAssetId: pack.pack_art_asset_id
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
      "guaranteedRarity",
      "packArtAssetId"
    ])
    |> Enum.reduce(%{}, fn
      {"cardCount", value}, acc ->
        Map.put(acc, :card_count, value)

      {"isActive", value}, acc ->
        Map.put(acc, :is_active, value)

      {"guaranteedRarity", value}, acc ->
        Map.put(acc, :guaranteed_rarity, normalize_blank_string(value))

      {"packArtAssetId", value}, acc ->
        Map.put(acc, :pack_art_asset_id, normalize_blank_string(value))

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
      "guaranteedRarity",
      "packArtAssetId"
    ])
    |> Enum.reduce(%{}, fn
      {"cardCount", value}, acc ->
        Map.put(acc, :card_count, value)

      {"isActive", value}, acc ->
        Map.put(acc, :is_active, value)

      {"guaranteedRarity", value}, acc ->
        Map.put(acc, :guaranteed_rarity, normalize_blank_string(value))

      {"packArtAssetId", value}, acc ->
        Map.put(acc, :pack_art_asset_id, normalize_blank_string(value))

      {key, value}, acc ->
        Map.put(acc, String.to_existing_atom(key), value)
    end)
  end

  defp normalize_admin_card_back_visual_attrs(attrs) do
    %{
      theme_name:
        attrs
        |> Map.get("themeName", Map.get(attrs, :theme_name))
        |> normalize_blank_string(),
      rarity_name:
        attrs
        |> Map.get("rarityName", Map.get(attrs, :rarity_name))
        |> normalize_blank_string(),
      image_asset_id:
        attrs
        |> Map.get("imageAssetId", Map.get(attrs, :image_asset_id))
        |> normalize_blank_string()
    }
  end

  defp normalize_blank_string(value) when value in [nil, ""], do: nil
  defp normalize_blank_string(value), do: value

  defp validate_catalog_asset_id(changeset, attrs, field) do
    if Map.has_key?(attrs, field) do
      case Map.get(attrs, field) do
        nil ->
          changeset

        asset_id ->
          case Repo.get(ImageAsset, asset_id) do
            %ImageAsset{kind: :catalog} ->
              changeset

            _ ->
              Changeset.add_error(changeset, field, "must reference a catalog image asset")
          end
      end
    else
      changeset
    end
  end

  defp persist_admin_card_back_visual(%{
         theme_name: theme_name,
         rarity_name: rarity_name,
         image_asset_id: image_asset_id
       }) do
    existing_visual =
      CardBackVisual
      |> where(
        [visual],
        visual.theme_name == ^theme_name and visual.rarity_name == ^rarity_name
      )
      |> Repo.one()

    case {existing_visual, image_asset_id} do
      {%CardBackVisual{} = visual, nil} ->
        case Repo.delete(visual) do
          {:ok, _deleted} ->
            {:ok,
             %{
               themeName: theme_name,
               rarityName: rarity_name,
               imageAssetId: nil
             }}

          {:error, changeset} ->
            {:error, changeset}
        end

      {nil, nil} ->
        {:ok,
         %{
           themeName: theme_name,
           rarityName: rarity_name,
           imageAssetId: nil
         }}

      {%CardBackVisual{} = visual, _asset_id} ->
        visual
        |> CardBackVisual.changeset(%{
          theme_name: theme_name,
          rarity_name: rarity_name,
          image_asset_id: image_asset_id
        })
        |> Repo.update()
        |> case do
          {:ok, updated_visual} -> {:ok, to_card_back_visual_response(updated_visual)}
          {:error, changeset} -> {:error, changeset}
        end

      {nil, _asset_id} ->
        %CardBackVisual{}
        |> CardBackVisual.changeset(%{
          theme_name: theme_name,
          rarity_name: rarity_name,
          image_asset_id: image_asset_id
        })
        |> Repo.insert()
        |> case do
          {:ok, inserted_visual} -> {:ok, to_card_back_visual_response(inserted_visual)}
          {:error, changeset} -> {:error, changeset}
        end
    end
  end

  defp to_card_back_visual_response(visual) do
    %{
      themeName: visual.theme_name,
      rarityName: visual.rarity_name,
      imageAssetId: visual.image_asset_id
    }
  end

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
