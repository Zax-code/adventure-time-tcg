defmodule Mix.Tasks.Catalog.ImportPackVisuals do
  use Mix.Task

  import Ecto.Query

  alias AdventureTimeApi.Catalog
  alias AdventureTimeApi.Catalog.Pack
  alias AdventureTimeApi.Media
  alias AdventureTimeApi.Repo

  @shortdoc "Import bundled pack-opening and card-back artwork into catalog assets"

  @pack_art_files %{
    "basic" => "basic-pack.png",
    "standard" => "standard-pack.png",
    "premium" => "premium-pack.png",
    "epic" => "epic-pack.png",
    "legendary" => "legendary-pack.png"
  }

  @card_back_files [
    {"candy", "Common", "backcover-candy-common.png"},
    {"candy", "Uncommon", "backcover-candy-uncommon.png"},
    {"candy", "Rare", "backcover-candy-rare.png"},
    {"candy", "Epic", "backcover-candy-epic.png"},
    {"candy", "Legendary", "backcover-candy-legendary.png"},
    {"ice", "Common", "backcover-ice-common.png"},
    {"ice", "Uncommon", "backcover-ice-uncommon.png"},
    {"ice", "Rare", "backcover-ice-rare.png"},
    {"ice", "Epic", "backcover-ice-epic.png"},
    {"ice", "Legendary", "backcover-ice-legendary.png"},
    {"nightosphere", "Common", "backcover-nightosphere-common.png"},
    {"nightosphere", "Uncommon", "backcover-nightosphere-uncommon.png"},
    {"nightosphere", "Rare", "backcover-nightosphere-rare.png"},
    {"nightosphere", "Epic", "backcover-nightosphere-epic.png"},
    {"nightosphere", "Legendary", "backcover-nightosphere-legendary.png"}
  ]

  @impl Mix.Task
  def run(args) do
    Mix.Task.run("app.start")

    {opts, _rest, _invalid} = OptionParser.parse(args, strict: [overwrite: :boolean])
    overwrite? = Keyword.get(opts, :overwrite, false)
    repo_root = Path.expand("../../../../..", __DIR__)

    pack_art_assets =
      Enum.map(@pack_art_files, fn {art_kind, filename} ->
        path = Path.join([repo_root, "apps", "mobile", "assets", "pack-opening", filename])
        object_key = "catalog/pack-opening/#{filename}"
        asset = ensure_catalog_asset!(path, object_key)
        {art_kind, asset.id}
      end)
      |> Map.new()

    card_back_assets =
      Enum.map(@card_back_files, fn {theme_name, rarity_name, filename} ->
        path = Path.join([repo_root, "apps", "mobile", "assets", "backcovers", filename])
        object_key = "catalog/card-backs/#{theme_name}/#{filename}"
        asset = ensure_catalog_asset!(path, object_key)
        {{theme_name, rarity_name}, asset.id}
      end)
      |> Map.new()

    pack_update_count =
      Pack
      |> Repo.all()
      |> Enum.reduce(0, fn pack, count ->
        pack_art_asset_id = Map.fetch!(pack_art_assets, pack_art_kind(pack))

        if overwrite? or is_nil(pack.pack_art_asset_id) do
          {updated_count, _} =
            from(existing_pack in Pack, where: existing_pack.id == ^pack.id)
            |> Repo.update_all(set: [pack_art_asset_id: pack_art_asset_id])

          count + updated_count
        else
          count
        end
      end)

    Enum.each(card_back_assets, fn {{theme_name, rarity_name}, asset_id} ->
      case Catalog.upsert_admin_card_back_visual(%{
             "themeName" => theme_name,
             "rarityName" => rarity_name,
             "imageAssetId" => asset_id
           }) do
        {:ok, _visual} ->
          :ok

        {:error, reason} ->
          Mix.raise(
            "Failed to map card back visual #{theme_name}/#{rarity_name}: #{inspect(reason)}"
          )
      end
    end)

    Mix.shell().info(
      "Imported #{map_size(pack_art_assets)} pack art assets, #{map_size(card_back_assets)} card back assets, updated #{pack_update_count} packs#{if overwrite?, do: " with overwrite", else: ""}."
    )
  end

  defp ensure_catalog_asset!(path, object_key) do
    mime_type = mime_type_for_path(path)
    binary_data = File.read!(path)

    case Media.ensure_catalog_image(object_key, binary_data, mime_type) do
      {:ok, asset} -> asset
      {:error, reason} -> Mix.raise("Failed to import #{path}: #{inspect(reason)}")
    end
  end

  defp mime_type_for_path(path) do
    case Path.extname(path) do
      ".png" -> "image/png"
      ".jpg" -> "image/jpeg"
      ".jpeg" -> "image/jpeg"
      ".webp" -> "image/webp"
      ".svg" -> "image/svg+xml"
      extension -> Mix.raise("Unsupported asset extension #{extension} for #{path}")
    end
  end

  defp pack_art_kind(pack) do
    rarity_rank = pack_rarity_rank(pack.guaranteed_rarity)
    normalized_name = String.downcase(pack.name || "")

    cond do
      String.contains?(normalized_name, "legendary") or rarity_rank >= 4 -> "legendary"
      String.contains?(normalized_name, "epic") or rarity_rank >= 3 -> "epic"
      String.contains?(normalized_name, "premium") or rarity_rank >= 2 -> "premium"
      String.contains?(normalized_name, "standard") -> "standard"
      true -> "basic"
    end
  end

  defp pack_rarity_rank("Legendary"), do: 4
  defp pack_rarity_rank("Epic"), do: 3
  defp pack_rarity_rank("Rare"), do: 2
  defp pack_rarity_rank("Uncommon"), do: 1
  defp pack_rarity_rank(_value), do: 0
end
