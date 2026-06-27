defmodule AdventureTimeApi.Inventory.PackOpeningRecord do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "pack_openings" do
    field(:pack_name, :string)
    field(:opened_at, :utc_datetime)

    belongs_to(:user, AdventureTimeApi.Accounts.User)
    belongs_to(:pack, AdventureTimeApi.Catalog.Pack)

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(record, attrs) do
    record
    |> cast(attrs, [:pack_name, :opened_at])
    |> validate_required([:pack_name, :opened_at])
  end
end
