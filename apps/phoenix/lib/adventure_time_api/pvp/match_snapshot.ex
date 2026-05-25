defmodule AdventureTimeApi.Pvp.MatchSnapshot do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "pvp_match_snapshots" do
    field(:seq_at, :integer)
    field(:turn_at, :integer)
    field(:state, :map)

    belongs_to(:match, AdventureTimeApi.Pvp.Match)

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(match_snapshot, attrs) do
    match_snapshot
    |> cast(attrs, [:match_id, :seq_at, :turn_at, :state])
    |> validate_required([:match_id, :seq_at, :turn_at, :state])
    |> validate_number(:seq_at, greater_than_or_equal_to: 0)
    |> validate_number(:turn_at, greater_than_or_equal_to: 0)
    |> unique_constraint(:seq_at, name: :pvp_match_snapshots_match_id_seq_at_idx)
  end
end
