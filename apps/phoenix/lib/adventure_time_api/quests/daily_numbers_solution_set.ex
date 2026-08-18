defmodule AdventureTimeApi.Quests.DailyNumbersSolutionSet do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "daily_numbers_solution_sets" do
    field(:date, :date)
    field(:mode, :string)
    field(:target, :integer)
    field(:numbers, {:array, :integer})
    field(:generation_attempt, :integer)
    field(:solution_count, :integer)
    field(:computation_ms, :integer)

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(solution_set, attrs) do
    solution_set
    |> change(attrs)
    |> validate_required([
      :date,
      :mode,
      :target,
      :numbers,
      :generation_attempt,
      :solution_count,
      :computation_ms
    ])
    |> validate_inclusion(:mode, ["1-5", "2-4", "3-3"])
    |> validate_number(:generation_attempt, greater_than: 0)
    |> validate_number(:solution_count, greater_than: 0)
    |> unique_constraint([:date, :mode], name: :daily_numbers_solution_sets_date_mode_key)
  end
end
