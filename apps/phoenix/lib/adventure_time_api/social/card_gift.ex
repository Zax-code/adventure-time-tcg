defmodule AdventureTimeApi.Social.CardGift do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @statuses [:pending, :accepted, :rejected, :expired]

  schema "card_gifts" do
    field(:quantity, :integer, default: 1)
    field(:message, :string)
    field(:status, Ecto.Enum, values: @statuses, default: :pending)
    field(:expires_at, :utc_datetime)

    belongs_to(:card, AdventureTimeApi.Catalog.Card)
    belongs_to(:from_user, AdventureTimeApi.Accounts.User)
    belongs_to(:to_user, AdventureTimeApi.Accounts.User)

    timestamps(type: :utc_datetime)
  end

  def changeset(card_gift, attrs) do
    card_gift
    |> cast(attrs, [:quantity, :message, :status, :expires_at])
    |> validate_required([:quantity, :status])
    |> validate_number(:quantity, greater_than: 0)
  end
end
