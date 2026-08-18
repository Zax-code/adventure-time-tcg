defmodule AdventureTimeApi.Repo.Migrations.DeduplicateDailyNumbersSolutionTraces do
  use Ecto.Migration

  def change do
    alter table(:daily_numbers_solution_sets) do
      add(:solution_key_version, :integer, null: false, default: 1)
    end

    create(
      constraint(:daily_numbers_solution_sets, :daily_numbers_solution_sets_key_version_positive,
        check: "solution_key_version > 0"
      )
    )

    alter table(:daily_numbers_solutions) do
      add(:solution_key, :text)
    end

    create(
      unique_index(:daily_numbers_solutions, [:solution_set_id, :solution_key],
        name: :daily_numbers_solutions_set_solution_key
      )
    )

    alter table(:daily_numbers_user_solutions) do
      add(:solution_key, :text)
    end

    create(
      unique_index(
        :daily_numbers_user_solutions,
        [:user_id, :solution_set_id, :solution_key],
        name: :daily_numbers_user_solutions_user_set_solution_key
      )
    )
  end
end
