defmodule AdventureTimeApi.Repo.Migrations.CreateDailyNumbersArchiveAttempts do
  use Ecto.Migration

  def change do
    create table(:daily_numbers_archive_attempts, primary_key: false) do
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
      add(:elapsed_ms, :integer, null: false, default: 0)

      timestamps(type: :utc_datetime)
    end

    create(
      unique_index(:daily_numbers_archive_attempts, [:user_id, :date, :mode],
        name: :daily_numbers_archive_attempts_user_id_date_mode_key
      )
    )

    create(
      index(:daily_numbers_archive_attempts, [:user_id, :date],
        name: :daily_numbers_archive_attempts_user_id_date_idx
      )
    )

    create(
      constraint(:daily_numbers_archive_attempts, :daily_numbers_archive_attempts_mode_valid,
        check: "mode IN ('1-5', '2-4', '3-3')"
      )
    )

    create(
      constraint(
        :daily_numbers_archive_attempts,
        :daily_numbers_archive_attempts_distance_nonnegative,
        check: "distance >= 0"
      )
    )

    create(
      constraint(
        :daily_numbers_archive_attempts,
        :daily_numbers_archive_attempts_score_nonnegative,
        check: "score >= 0"
      )
    )

    create(
      constraint(
        :daily_numbers_archive_attempts,
        :daily_numbers_archive_attempts_final_value_positive,
        check: "final_value > 0"
      )
    )

    create(
      constraint(
        :daily_numbers_archive_attempts,
        :daily_numbers_archive_attempts_elapsed_ms_nonnegative,
        check: "elapsed_ms >= 0"
      )
    )
  end
end
