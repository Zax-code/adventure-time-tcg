defmodule AdventureTimeApi.Pvp.Loadout do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "pvp_loadouts" do
    field :owner_id, :binary_id
    field :name, :string
    field :card_ids, {:array, :string}

    timestamps()
  end

  def changeset(loadout, attrs) do
    loadout
    |> cast(attrs, [:owner_id, :name, :card_ids])
    |> validate_required([:owner_id, :name, :card_ids])
    |> validate_length(:name, min: 1, max: 50)
    |> validate_card_ids()
  end

  defp validate_card_ids(changeset) do
    card_ids = get_field(changeset, :card_ids)

    cond do
      is_nil(card_ids) ->
        changeset

      length(card_ids) != 6 ->
        add_error(changeset, :card_ids, "must contain exactly 6 cards")

      length(card_ids) != length(Enum.uniq(card_ids)) ->
        add_error(changeset, :card_ids, "must contain unique cards")

      true ->
        changeset
    end
  end
end
