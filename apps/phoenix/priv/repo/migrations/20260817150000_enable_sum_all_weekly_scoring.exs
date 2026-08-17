defmodule AdventureTimeApi.Repo.Migrations.EnableSumAllWeeklyScoring do
  use Ecto.Migration

  def up do
    drop(constraint(:leaderboard_daily_results, :leaderboard_daily_results_points_valid))
    drop(constraint(:leaderboard_snapshot_rows, :leaderboard_snapshot_rows_points_valid))

    alter table(:leaderboard_daily_results) do
      modify(:points_milli, :bigint)
    end

    alter table(:leaderboard_snapshot_rows) do
      modify(:points_milli, :bigint, null: false)
      modify(:selected_points_milli, {:array, :bigint}, null: false, default: [])
    end

    drop_if_exists(unique_index(:leaderboard_scoring_versions, [:effective_week_start]))

    create(index(:leaderboard_scoring_versions, [:effective_week_start]))
  end

  def down do
    drop(index(:leaderboard_scoring_versions, [:effective_week_start]))

    create(unique_index(:leaderboard_scoring_versions, [:effective_week_start]))

    alter table(:leaderboard_snapshot_rows) do
      modify(:points_milli, :integer, null: false)
      modify(:selected_points_milli, {:array, :integer}, null: false, default: [])
    end

    alter table(:leaderboard_daily_results) do
      modify(:points_milli, :integer)
    end

    create(
      constraint(:leaderboard_daily_results, :leaderboard_daily_results_points_valid,
        check: "points_milli IS NULL OR points_milli BETWEEN 0 AND 1000000"
      )
    )

    create(
      constraint(:leaderboard_snapshot_rows, :leaderboard_snapshot_rows_points_valid,
        check: "points_milli BETWEEN 0 AND 1000000"
      )
    )
  end
end
