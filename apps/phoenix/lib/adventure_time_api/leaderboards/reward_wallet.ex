defmodule AdventureTimeApi.Leaderboards.RewardWallet do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "leaderboard_reward_wallets" do
    field(:user_id, :binary_id)

    field(:crown_family, Ecto.Enum,
      values: [:steps, :daily_numbers, :wordle, :speed_calculus, :perfect_timing]
    )

    field(:balance, :integer, default: 0)
    timestamps(type: :utc_datetime_usec)
  end

  def changeset(wallet, attrs) do
    wallet
    |> cast(attrs, [:user_id, :crown_family, :balance])
    |> validate_required([:user_id, :crown_family, :balance])
    |> validate_number(:balance, greater_than_or_equal_to: 0)
    |> unique_constraint([:user_id, :crown_family])
  end
end
