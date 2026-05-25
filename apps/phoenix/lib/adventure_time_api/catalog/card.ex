defmodule AdventureTimeApi.Catalog.Card do
  use Ecto.Schema

  import Ecto.Changeset

  alias AdventureTimeApi.Catalog.CardType

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "cards" do
    field(:name, :string)
    field(:character, :string)
    field(:description, :string)
    field(:hp, :integer)
    field(:attack, :integer)
    field(:defense, :integer)
    field(:speed, :integer, default: 40)
    field(:type, :string)
    field(:is_featured, :boolean, default: false)
    field(:is_archived, :boolean, default: false)

    belongs_to(:rarity, AdventureTimeApi.Catalog.Rarity)
    belongs_to(:image_asset, AdventureTimeApi.Catalog.ImageAsset)

    timestamps(type: :utc_datetime)
  end

  def changeset(card, attrs) do
    card
    |> cast(attrs, [
      :name,
      :character,
      :description,
      :hp,
      :attack,
      :defense,
      :speed,
      :type,
      :rarity_id,
      :image_asset_id,
      :is_featured,
      :is_archived
    ])
    |> update_change(:type, &CardType.normalize_input/1)
    |> validate_required([
      :name,
      :character,
      :description,
      :hp,
      :attack,
      :defense,
      :speed,
      :type,
      :rarity_id
    ])
    |> validate_number(:hp, greater_than: 0)
    |> validate_number(:attack, greater_than_or_equal_to: 0)
    |> validate_number(:defense, greater_than_or_equal_to: 0)
    |> validate_number(:speed, greater_than: 0)
    |> validate_inclusion(:type, CardType.values())
  end
end
