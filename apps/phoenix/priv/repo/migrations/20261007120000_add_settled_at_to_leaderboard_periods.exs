defmodule AdventureTimeApi.Repo.Migrations.AddSettledAtToLeaderboardPeriods do
  use Ecto.Migration

  def change do
    alter table(:leaderboard_periods) do
      add(:settled_at, :utc_datetime_usec)
    end
  end
end
