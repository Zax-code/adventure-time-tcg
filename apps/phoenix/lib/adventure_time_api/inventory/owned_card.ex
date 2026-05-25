defmodule AdventureTimeApi.Inventory.OwnedCard do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "owned_cards" do
    field(:quantity, :integer, default: 1)
    field(:obtained_at, :utc_datetime)

    belongs_to(:user, AdventureTimeApi.Accounts.User)
    belongs_to(:card, AdventureTimeApi.Catalog.Card)

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(owned_card, attrs) do
    owned_card
    |> cast(attrs, [:quantity, :obtained_at])
    |> validate_required([:quantity, :obtained_at])
    |> validate_number(:quantity, greater_than_or_equal_to: 0)
    |> unique_constraint(:user_card, name: :owned_cards_user_id_card_id_key)
  end
end
