defmodule AdventureTimeApi.Catalog.Pack do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "packs" do
    field(:name, :string)
    field(:description, :string)
    field(:card_count, :integer, default: 5)
    field(:cost, :integer, default: 100)
    field(:color, :string, default: "#EC4899")
    field(:is_active, :boolean, default: true)
    field(:guaranteed_rarity, :string)

    belongs_to(:pack_art_asset, AdventureTimeApi.Catalog.ImageAsset)

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(pack, attrs) do
    pack
    |> cast(attrs, [
      :name,
      :description,
      :card_count,
      :cost,
      :color,
      :is_active,
      :guaranteed_rarity,
      :pack_art_asset_id
    ])
    |> validate_required([:name, :description, :card_count, :cost, :color])
    |> validate_number(:card_count, greater_than: 0)
    |> validate_number(:cost, greater_than_or_equal_to: 0)
    |> unique_constraint(:name, name: :packs_name_key)
  end
end
