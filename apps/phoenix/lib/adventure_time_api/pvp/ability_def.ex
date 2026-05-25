defmodule AdventureTimeApi.Pvp.AbilityDef do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @valid_types ~w(PASSIVE SKILL ULTIMATE)

  schema "ability_defs" do
    field :key, :string
    field :name, :string
    field :name_fr, :string
    field :description, :string
    field :description_fr, :string
    field :type, :string
    field :cost, :integer, default: 0
    field :cooldown, :integer
    field :once_per_match, :boolean, default: false
    field :payload, :map

    timestamps()
  end

  def changeset(ability_def, attrs) do
    ability_def
    |> cast(attrs, [
      :key,
      :name,
      :name_fr,
      :description,
      :description_fr,
      :type,
      :cost,
      :cooldown,
      :once_per_match,
      :payload
    ])
    |> validate_required([:key, :name, :description, :type, :payload])
    |> validate_inclusion(:type, @valid_types)
    |> validate_number(:cost, greater_than_or_equal_to: 0)
    |> unique_constraint(:key)
  end
end
