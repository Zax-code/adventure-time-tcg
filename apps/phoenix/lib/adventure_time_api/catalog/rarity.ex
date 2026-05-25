defmodule AdventureTimeApi.Catalog.Rarity do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "rarities" do
    field :name, :string
    field :drop_rate, :float
    field :color, :string

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(rarity, attrs) do
    rarity
    |> cast(attrs, [:name, :drop_rate, :color])
    |> validate_required([:name, :drop_rate, :color])
    |> unique_constraint(:name, name: :rarities_name_key)
  end
end
