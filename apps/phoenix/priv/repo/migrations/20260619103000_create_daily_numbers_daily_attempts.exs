defmodule AdventureTimeApi.Repo.Migrations.CreateDailyNumbersDailyAttempts do
  use Ecto.Migration

  def change do
    create table(:daily_numbers_daily_attempts, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)
      add(:date, :date, null: false)
      add(:mode, :string, null: false)
      add(:submitted_steps, {:array, :map}, null: false, default: [])
      add(:final_value, :integer, null: false)
      add(:distance, :integer, null: false)
      add(:score, :integer, null: false)
      add(:exact, :boolean, null: false, default: false)
      add(:completed, :boolean, null: false, default: false)

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(
      unique_index(:daily_numbers_daily_attempts, [:user_id, :date, :mode],
        name: :daily_numbers_daily_attempts_user_id_date_mode_key
      )
    )

    create(
      index(:daily_numbers_daily_attempts, [:user_id, :date],
        name: :daily_numbers_daily_attempts_user_id_date_idx
      )
    )

    create(
      constraint(:daily_numbers_daily_attempts, :daily_numbers_daily_attempts_mode_valid,
        check: "mode IN ('classic', 'expert')"
      )
    )

    create(
      constraint(
        :daily_numbers_daily_attempts,
        :daily_numbers_daily_attempts_distance_nonnegative,
        check: "distance >= 0"
      )
    )

    create(
      constraint(:daily_numbers_daily_attempts, :daily_numbers_daily_attempts_score_nonnegative,
        check: "score >= 0"
      )
    )

    create(
      constraint(
        :daily_numbers_daily_attempts,
        :daily_numbers_daily_attempts_final_value_positive,
        check: "final_value > 0"
      )
    )
  end
end
