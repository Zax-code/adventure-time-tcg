defmodule AdventureTimeApi.Pvp.Match do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "pvp_matches" do
    field(:inviter_id, :binary_id)
    field(:invitee_id, :binary_id)
    field(:status, :string, default: "pending")
    field(:inviter_card_ids, {:array, :string})
    field(:invitee_card_ids, {:array, :string})
    field(:winner_id, :binary_id)
    field(:seed, :string)
    field(:initial_state, :map)
    field(:current_turn, :integer, default: 0)
    field(:turn_started_at, :utc_datetime)
    field(:expires_at, :utc_datetime)

    timestamps()
  end

  def changeset(match, attrs) do
    match
    |> cast(attrs, [
      :inviter_id,
      :invitee_id,
      :status,
      :inviter_card_ids,
      :invitee_card_ids,
      :winner_id,
      :seed,
      :initial_state,
      :current_turn,
      :turn_started_at,
      :expires_at
    ])
    |> validate_required([:inviter_id, :invitee_id, :status, :inviter_card_ids])
    |> validate_inclusion(:status, ["pending", "in_progress", "completed", "declined", "expired"])
  end
end
