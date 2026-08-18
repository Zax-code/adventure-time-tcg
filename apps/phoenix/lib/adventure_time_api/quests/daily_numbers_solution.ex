defmodule AdventureTimeApi.Quests.DailyNumbersSolution do
  use Ecto.Schema

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "daily_numbers_solutions" do
    field(:solution_set_id, :binary_id)
    field(:canonical_key, :string)
    field(:solution_key, :string)
    field(:expression, :map)

    timestamps(type: :utc_datetime, updated_at: false)
  end
end
