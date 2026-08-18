defmodule AdventureTimeApi.Repo.Migrations.CreateDailyNumbersSolutionHunt do
  use Ecto.Migration

  def change do
    create table(:daily_numbers_solution_sets, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:date, :date, null: false)
      add(:mode, :string, null: false)
      add(:target, :integer, null: false)
      add(:numbers, {:array, :integer}, null: false)
      add(:solution_count, :integer, null: false)
      add(:computation_ms, :integer, null: false)

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(
      unique_index(:daily_numbers_solution_sets, [:date, :mode],
        name: :daily_numbers_solution_sets_date_mode_key
      )
    )

    create(
      constraint(:daily_numbers_solution_sets, :daily_numbers_solution_sets_mode_valid,
        check: "mode IN ('1-5', '2-4', '3-3')"
      )
    )

    create(
      constraint(:daily_numbers_solution_sets, :daily_numbers_solution_sets_count_positive,
        check: "solution_count > 0"
      )
    )

    create table(:daily_numbers_solutions, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(
        :solution_set_id,
        references(:daily_numbers_solution_sets, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:canonical_key, :text, null: false)
      add(:expression, :map, null: false)

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(
      unique_index(:daily_numbers_solutions, [:solution_set_id, :canonical_key],
        name: :daily_numbers_solutions_set_key
      )
    )

    create table(:daily_numbers_user_solutions, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)

      add(
        :solution_set_id,
        references(:daily_numbers_solution_sets, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:canonical_key, :text, null: false)
      add(:submitted_steps, {:array, :map}, null: false, default: [])
      add(:found_at, :utc_datetime, null: false)
    end

    create(
      unique_index(
        :daily_numbers_user_solutions,
        [:user_id, :solution_set_id, :canonical_key],
        name: :daily_numbers_user_solutions_user_set_key
      )
    )

    create(
      index(:daily_numbers_user_solutions, [:user_id, :solution_set_id],
        name: :daily_numbers_user_solutions_progress_idx
      )
    )
  end
end
