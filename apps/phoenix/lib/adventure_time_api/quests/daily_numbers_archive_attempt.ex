defmodule AdventureTimeApi.Quests.DailyNumbersArchiveAttempt do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "daily_numbers_archive_attempts" do
    field(:user_id, :binary_id)
    field(:date, :date)
    field(:mode, :string)
    field(:submitted_steps, {:array, :map}, default: [])
    field(:final_value, :integer)
    field(:distance, :integer)
    field(:score, :integer)
    field(:exact, :boolean, default: false)
    field(:completed, :boolean, default: false)
    field(:elapsed_ms, :integer, default: 0)

    timestamps(type: :utc_datetime)
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
      :completed,
      :elapsed_ms
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
      :completed,
      :elapsed_ms
    ])
    |> validate_inclusion(:mode, ["1-5", "2-4", "3-3"])
    |> validate_number(:final_value, greater_than: 0)
    |> validate_number(:distance, greater_than_or_equal_to: 0)
    |> validate_number(:score, greater_than_or_equal_to: 0)
    |> validate_number(:elapsed_ms, greater_than_or_equal_to: 0)
    |> unique_constraint([:user_id, :date, :mode],
      name: :daily_numbers_archive_attempts_user_id_date_mode_key
    )
  end
end
