defmodule AdventureTimeApi.Repo.Migrations.EnableLeaderboardDetailPrizes do
  use Ecto.Migration

  def up do
    execute("""
    UPDATE leaderboard_boards
    SET prizes_enabled = true, updated_at = now()
    WHERE key IN (
      'daily-numbers/1-5',
      'daily-numbers/2-4',
      'daily-numbers/3-3',
      'wordle/fr',
      'wordle/en'
    )
    """)
  end

  def down do
    execute("""
    UPDATE leaderboard_boards
    SET prizes_enabled = false, updated_at = now()
    WHERE key IN (
      'daily-numbers/1-5',
      'daily-numbers/2-4',
      'daily-numbers/3-3',
      'wordle/fr',
      'wordle/en'
    )
    """)
  end
end
