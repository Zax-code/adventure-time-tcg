defmodule AdventureTimeApi.Quests.DailyNumbersUserSolution do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "daily_numbers_user_solutions" do
    field(:user_id, :binary_id)
    field(:solution_set_id, :binary_id)
    field(:canonical_key, :string)
    field(:submitted_steps, {:array, :map}, default: [])
    field(:found_at, :utc_datetime)
  end

  def changeset(user_solution, attrs) do
    user_solution
    |> cast(attrs, [:user_id, :solution_set_id, :canonical_key, :submitted_steps, :found_at])
    |> validate_required([
      :user_id,
      :solution_set_id,
      :canonical_key,
      :submitted_steps,
      :found_at
    ])
    |> unique_constraint([:user_id, :solution_set_id, :canonical_key],
      name: :daily_numbers_user_solutions_user_set_key
    )
  end
end
