defmodule AdventureTimeApi.Quests.DailyNumbersSolution do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "daily_numbers_solutions" do
    field(:solution_set_id, :binary_id)
    field(:canonical_key, :string)
    field(:expression, :map)

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(solution, attrs) do
    solution
    |> cast(attrs, [:solution_set_id, :canonical_key, :expression])
    |> validate_required([:solution_set_id, :canonical_key, :expression])
    |> unique_constraint([:solution_set_id, :canonical_key],
      name: :daily_numbers_solutions_set_key
    )
  end
end
