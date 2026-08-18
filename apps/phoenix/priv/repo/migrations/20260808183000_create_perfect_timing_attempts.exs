defmodule AdventureTimeApi.Repo.Migrations.CreatePerfectTimingAttempts do
  use Ecto.Migration

  def change do
    create table(:perfect_timing_attempts, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)
      add(:date, :date, null: false)
      add(:attempt_number, :integer, null: false)
      add(:target_ms, :integer, null: false)
      add(:status, :string, null: false, default: "started")
      add(:stop_reason, :string)
      add(:elapsed_ms, :integer)
      add(:deviation_ms, :integer)
      add(:direction, :string)
      add(:tier, :string)
      add(:reward, :integer, null: false, default: 0)
      add(:started_at, :utc_datetime_usec, null: false)
      add(:completed_at, :utc_datetime_usec)

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create(
      unique_index(:perfect_timing_attempts, [:user_id, :date, :attempt_number],
        name: :perfect_timing_attempts_user_date_number_key
      )
    )

    create(
      index(:perfect_timing_attempts, [:user_id, :date],
        name: :perfect_timing_attempts_user_date_idx
      )
    )

    create(
      unique_index(:perfect_timing_attempts, [:user_id, :date],
        where: "status IN ('started', 'result')",
        name: :perfect_timing_attempts_one_open_result_key
      )
    )

    create(
      constraint(:perfect_timing_attempts, :perfect_timing_attempts_number_range,
        check: "attempt_number >= 1 AND attempt_number <= 3"
      )
    )

    create(
      constraint(:perfect_timing_attempts, :perfect_timing_attempts_target_range,
        check: "target_ms >= 3000 AND target_ms <= 10000 AND target_ms % 100 = 0"
      )
    )

    create(
      constraint(:perfect_timing_attempts, :perfect_timing_attempts_status_valid,
        check: "status IN ('started', 'result', 'discarded', 'kept', 'auto_finalized', 'failed')"
      )
    )

    create(
      constraint(:perfect_timing_attempts, :perfect_timing_attempts_stop_reason_valid,
        check:
          "stop_reason IS NULL OR stop_reason IN ('manual', 'navigation', 'background', 'server_recovery')"
      )
    )

    create(
      constraint(:perfect_timing_attempts, :perfect_timing_attempts_result_values_valid,
        check:
          "(status = 'started' AND stop_reason IS NULL AND elapsed_ms IS NULL AND deviation_ms IS NULL AND direction IS NULL AND tier IS NULL AND completed_at IS NULL) OR " <>
            "(status <> 'started' AND stop_reason IS NOT NULL AND elapsed_ms >= 0 AND deviation_ms >= 0 AND direction IN ('early', 'late', 'exact') AND tier IN ('perfect', 'amazing', 'great', 'close', 'miss') AND completed_at IS NOT NULL)"
      )
    )

    create(
      constraint(:perfect_timing_attempts, :perfect_timing_attempts_reward_range,
        check: "reward >= 0 AND reward <= 100"
      )
    )
  end
end
