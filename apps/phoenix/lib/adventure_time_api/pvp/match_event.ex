defmodule AdventureTimeApi.Pvp.MatchEvent do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "pvp_match_events" do
    field(:seq, :integer)
    field(:turn, :integer)
    field(:type, :string)
    field(:payload, :map)

    belongs_to(:match, AdventureTimeApi.Pvp.Match)

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(match_event, attrs) do
    match_event
    |> cast(attrs, [:match_id, :seq, :turn, :type, :payload])
    |> validate_required([:match_id, :seq, :turn, :type, :payload])
    |> validate_number(:seq, greater_than_or_equal_to: 0)
    |> validate_number(:turn, greater_than_or_equal_to: 0)
    |> unique_constraint(:seq, name: :pvp_match_events_match_id_seq_idx)
  end
end
