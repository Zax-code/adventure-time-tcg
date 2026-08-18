defmodule AdventureTimeApi.Quests.DailyNumbersUserSolution do
  use Ecto.Schema

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "daily_numbers_user_solutions" do
    field(:user_id, :binary_id)
    field(:solution_set_id, :binary_id)
    field(:canonical_key, :string)
    field(:submitted_steps, {:array, :map}, default: [])
    field(:found_at, :utc_datetime_usec)
  end
end
