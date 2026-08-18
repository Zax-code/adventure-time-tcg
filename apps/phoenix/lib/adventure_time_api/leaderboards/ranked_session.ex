defmodule AdventureTimeApi.Leaderboards.RankedSession do
  use Ecto.Schema

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "ranked_sessions" do
    field(:user_id, :binary_id)
    field(:board_id, :binary_id)
    field(:competition_slot_id, :binary_id)
    field(:competition_date, :date)
    field(:source_kind, :string)
    field(:source_id, :binary_id)
    field(:session_number, :integer)
    field(:status, Ecto.Enum, values: [:started, :settled, :expired, :cancelled, :excluded])
    field(:server_started_at, :utc_datetime_usec)
    field(:server_deadline_at, :utc_datetime_usec)
    field(:server_ended_at, :utc_datetime_usec)
    field(:challenge_version, :string)
    field(:nonce_hash, :string)
    field(:client_metadata, :map, default: %{})

    field(:integrity_status, Ecto.Enum,
      values: [:pending, :accepted, :review, :rejected],
      default: :pending
    )

    field(:integrity_reason_codes, {:array, :string}, default: [])
    timestamps(type: :utc_datetime_usec)
  end
end
