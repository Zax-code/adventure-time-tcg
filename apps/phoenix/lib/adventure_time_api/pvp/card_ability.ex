defmodule AdventureTimeApi.Pvp.CardAbility do
  use Ecto.Schema
  import Ecto.Changeset

  alias AdventureTimeApi.Pvp.AbilityDef

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "card_abilities" do
    field(:card_id, :binary_id)
    belongs_to(:passive, AbilityDef, foreign_key: :passive_id, type: :binary_id)
    belongs_to(:skill, AbilityDef, foreign_key: :skill_id, type: :binary_id)
    belongs_to(:ultimate, AbilityDef, foreign_key: :ultimate_id, type: :binary_id)

    timestamps()
  end

  def changeset(card_ability, attrs) do
    card_ability
    |> cast(attrs, [:card_id, :passive_id, :skill_id, :ultimate_id])
    |> validate_required([:card_id])
    |> unique_constraint(:card_id)
    |> foreign_key_constraint(:card_id)
    |> foreign_key_constraint(:passive_id)
    |> foreign_key_constraint(:skill_id)
    |> foreign_key_constraint(:ultimate_id)
  end
end
