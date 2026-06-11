defmodule AdventureTimeApi.Catalog.CardBackVisual do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @theme_names ~w(candy ice nightosphere)
  @rarity_names ~w(Common Uncommon Rare Epic Legendary)

  schema "card_back_visuals" do
    field(:theme_name, :string)
    field(:rarity_name, :string)

    belongs_to(:image_asset, AdventureTimeApi.Catalog.ImageAsset)

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def theme_names, do: @theme_names
  def rarity_names, do: @rarity_names

  def changeset(card_back_visual, attrs) do
    card_back_visual
    |> cast(attrs, [:theme_name, :rarity_name, :image_asset_id])
    |> validate_required([:theme_name, :rarity_name, :image_asset_id])
    |> validate_inclusion(:theme_name, @theme_names)
    |> validate_inclusion(:rarity_name, @rarity_names)
    |> unique_constraint(:theme_name,
      name: :card_back_visuals_theme_rarity_key,
      message: "theme and rarity mapping already exists"
    )
  end
end
