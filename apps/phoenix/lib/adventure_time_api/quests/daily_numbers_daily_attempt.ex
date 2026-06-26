defmodule AdventureTimeApi.Quests.DailyNumbersDailyAttempt do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "daily_numbers_daily_attempts" do
    field(:user_id, :binary_id)
    field(:date, :date)
    field(:mode, :string)
    field(:submitted_steps, {:array, :map}, default: [])
    field(:final_value, :integer)
    field(:distance, :integer)
    field(:score, :integer)
    field(:exact, :boolean, default: false)
    field(:completed, :boolean, default: false)

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(attempt, attrs) do
    attempt
    |> cast(attrs, [
      :user_id,
      :date,
      :mode,
      :submitted_steps,
      :final_value,
      :distance,
      :score,
      :exact,
      :completed
    ])
    |> validate_required([
      :user_id,
      :date,
      :mode,
      :submitted_steps,
      :final_value,
      :distance,
      :score,
      :exact,
      :completed
    ])
    |> validate_inclusion(:mode, ["1-5", "2-4", "3-3"])
    |> validate_number(:final_value, greater_than: 0)
    |> validate_number(:distance, greater_than_or_equal_to: 0)
    |> validate_number(:score, greater_than_or_equal_to: 0)
    |> unique_constraint([:user_id, :date, :mode],
      name: :daily_numbers_daily_attempts_user_id_date_mode_key
    )
  end
end
