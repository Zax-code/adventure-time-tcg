defmodule AdventureTimeApi.Repo.Migrations.AddElapsedMsToDailyNumbersAttempts do
  use Ecto.Migration

  def change do
    alter table(:daily_numbers_daily_attempts) do
      add(:elapsed_ms, :integer, null: false, default: 0)
    end

    create(
      constraint(
        :daily_numbers_daily_attempts,
        :daily_numbers_daily_attempts_elapsed_ms_nonnegative,
        check: "elapsed_ms >= 0"
      )
    )
  end
end
