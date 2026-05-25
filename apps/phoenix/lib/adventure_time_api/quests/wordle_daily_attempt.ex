defmodule AdventureTimeApi.Quests.WordleDailyAttempt do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "wordle_daily_attempts" do
    field(:user_id, :binary_id)
    field(:date, :date)
    field(:attempt, :integer)
    field(:guess, :string)
    field(:evaluation, {:array, :string})
    field(:solved, :boolean)

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(attempt, attrs) do
    attempt
    |> cast(attrs, [:user_id, :date, :attempt, :guess, :evaluation, :solved])
    |> validate_required([:user_id, :date, :attempt, :guess, :evaluation, :solved])
    |> validate_number(:attempt, greater_than_or_equal_to: 1, less_than_or_equal_to: 6)
    |> unique_constraint([:user_id, :date, :attempt],
      name: :wordle_daily_attempts_user_id_date_attempt_key
    )
  end
end
