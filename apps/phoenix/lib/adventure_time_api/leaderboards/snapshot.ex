defmodule AdventureTimeApi.Leaderboards.Snapshot do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "leaderboard_snapshots" do
    field(:period_id, :binary_id)
    field(:board_id, :binary_id)
    field(:revision, :integer)
    field(:status, Ecto.Enum, values: [:building, :closed, :superseded, :failed])
    field(:scoring_version_id, :binary_id)
    field(:participant_count, :integer, default: 0)
    field(:valid_result_count, :integer, default: 0)
    field(:configuration_hash, :string)
    field(:source_cutoff, :utc_datetime_usec)
    field(:finalized_at, :utc_datetime_usec)
    field(:finalized_by, :string)
    field(:correction_reason, :string)
    field(:supersedes_snapshot_id, :binary_id)
    field(:current, :boolean, default: false)
    timestamps(type: :utc_datetime_usec)
  end

  def changeset(snapshot, attrs) do
    snapshot
    |> cast(attrs, [
      :period_id,
      :board_id,
      :revision,
      :status,
      :scoring_version_id,
      :participant_count,
      :valid_result_count,
      :configuration_hash,
      :source_cutoff,
      :finalized_at,
      :finalized_by,
      :correction_reason,
      :supersedes_snapshot_id,
      :current
    ])
    |> validate_required([
      :period_id,
      :board_id,
      :revision,
      :status,
      :scoring_version_id,
      :configuration_hash,
      :source_cutoff,
      :current
    ])
    |> validate_number(:revision, greater_than: 0)
    |> unique_constraint([:period_id, :board_id, :revision])
  end
end
