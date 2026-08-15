defmodule AdventureTimeApi.Leaderboards.SnapshotRow do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "leaderboard_snapshot_rows" do
    field(:snapshot_id, :binary_id)
    field(:user_id, :binary_id)
    field(:public_profile_id, Ecto.UUID)
    field(:anonymous_tombstone, :string)
    field(:position, :integer)
    field(:rank, :integer)
    field(:tie_group, :integer)
    field(:points_milli, :integer)
    field(:raw_result, :map, default: %{})
    field(:selected_daily_result_ids, {:array, :binary_id}, default: [])
    field(:selected_points_milli, {:array, :integer}, default: [])
    field(:medal_tier, Ecto.Enum, values: [:gold, :silver, :bronze])
    field(:identity_audit, :map, default: %{})
    timestamps(type: :utc_datetime_usec, updated_at: false)
  end

  def changeset(row, attrs) do
    row
    |> cast(attrs, [
      :snapshot_id,
      :user_id,
      :public_profile_id,
      :anonymous_tombstone,
      :position,
      :rank,
      :tie_group,
      :points_milli,
      :raw_result,
      :selected_daily_result_ids,
      :selected_points_milli,
      :medal_tier,
      :identity_audit
    ])
    |> validate_required([
      :snapshot_id,
      :position,
      :rank,
      :tie_group,
      :points_milli,
      :raw_result
    ])
    |> validate_number(:points_milli,
      greater_than_or_equal_to: 0,
      less_than_or_equal_to: 1_000_000
    )
    |> unique_constraint([:snapshot_id, :position])
  end
end
