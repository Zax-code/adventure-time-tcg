defmodule AdventureTimeApi.Repo.Migrations.AddManualPauseToSpeedCalculusRuns do
  use Ecto.Migration

  def up do
    alter table(:speed_calculus_daily_runs) do
      add(:play_deadline_at, :utc_datetime)
      add(:manual_paused_at, :utc_datetime)
    end

    execute("""
    UPDATE speed_calculus_daily_runs
    SET play_deadline_at = started_at + interval '35 seconds'
    WHERE play_deadline_at IS NULL
    """)

    alter table(:speed_calculus_daily_runs) do
      modify(:play_deadline_at, :utc_datetime, null: false)
    end
  end

  def down do
    alter table(:speed_calculus_daily_runs) do
      remove(:manual_paused_at)
      remove(:play_deadline_at)
    end
  end
end
