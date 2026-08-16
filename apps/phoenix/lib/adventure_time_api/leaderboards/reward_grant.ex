defmodule AdventureTimeApi.Leaderboards.RewardGrant do
  use Ecto.Schema

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "leaderboard_reward_grants" do
    field(:user_id, :binary_id)
    field(:snapshot_id, :binary_id)
    field(:board_id, :binary_id)
    field(:medal_tier, Ecto.Enum, values: [:gold, :silver, :bronze])

    field(:crown_family, Ecto.Enum,
      values: [:steps, :daily_numbers, :wordle, :speed_calculus, :perfect_timing]
    )

    field(:amount, :integer)
    field(:status, Ecto.Enum, values: [:active, :reversed], default: :active)
    field(:idempotency_key, :string)
    field(:reversed_at, :utc_datetime_usec)
    field(:reversal_reason, :string)
    field(:reversed_by_user_id, :binary_id)
    field(:superseding_grant_id, :binary_id)
    timestamps(type: :utc_datetime_usec)
  end
end
