defmodule AdventureTimeApi.Leaderboards.UserAchievement do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "user_achievements" do
    field(:user_id, :binary_id)
    field(:achievement_key, :string)
    field(:board_id, :binary_id)
    field(:snapshot_id, :binary_id)
    field(:tier, Ecto.Enum, values: [:gold, :silver, :bronze])
    field(:status, Ecto.Enum, values: [:active, :reversed], default: :active)
    field(:awarded_at, :utc_datetime_usec)
    field(:reversed_at, :utc_datetime_usec)
    field(:reversal_reason, :string)
    field(:reversed_by_user_id, :binary_id)
    field(:replacement_snapshot_id, :binary_id)
    timestamps(type: :utc_datetime_usec)
  end

  def changeset(achievement, attrs) do
    achievement
    |> cast(attrs, [
      :user_id,
      :achievement_key,
      :board_id,
      :snapshot_id,
      :tier,
      :status,
      :awarded_at,
      :reversed_at,
      :reversal_reason,
      :reversed_by_user_id,
      :replacement_snapshot_id
    ])
    |> validate_required([
      :user_id,
      :achievement_key,
      :board_id,
      :snapshot_id,
      :tier,
      :status,
      :awarded_at
    ])
    |> unique_constraint([:snapshot_id, :tier, :user_id])
  end
end
