defmodule AdventureTimeApi.Leaderboards.SnapshotCorrection do
  use Ecto.Schema

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "leaderboard_snapshot_corrections" do
    field(:source_snapshot_id, :binary_id)
    field(:source_revision, :integer)
    field(:status, Ecto.Enum, values: [:previewed, :confirmed, :applied, :failed])
    field(:preview_hash, :string)
    field(:reason, :string)
    field(:actor_user_id, :binary_id)
    field(:proposed_changes, :map)
    field(:rank_delta, :map, default: %{})
    field(:reward_delta, :map, default: %{})
    field(:resulting_snapshot_id, :binary_id)
    field(:error_metadata, :map)
    field(:previewed_at, :utc_datetime_usec)
    field(:confirmed_at, :utc_datetime_usec)
    field(:applied_at, :utc_datetime_usec)
    timestamps(type: :utc_datetime_usec)
  end
end
