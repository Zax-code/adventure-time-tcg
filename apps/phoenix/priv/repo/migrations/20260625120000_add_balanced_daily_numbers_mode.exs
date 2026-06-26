defmodule AdventureTimeApi.Repo.Migrations.AddBalancedDailyNumbersMode do
  use Ecto.Migration

  def up do
    drop(constraint(:daily_numbers_daily_attempts, :daily_numbers_daily_attempts_mode_valid))

    execute("UPDATE daily_numbers_daily_attempts SET mode = '1-5' WHERE mode = 'classic'")
    execute("UPDATE daily_numbers_daily_attempts SET mode = '3-3' WHERE mode = 'expert'")

    execute(
      "UPDATE daily_quests SET quest_type = 'daily_numbers_1_5' WHERE quest_type = 'daily_numbers_classic'"
    )

    execute(
      "UPDATE daily_quests SET quest_type = 'daily_numbers_3_3' WHERE quest_type = 'daily_numbers_expert'"
    )

    create(
      constraint(:daily_numbers_daily_attempts, :daily_numbers_daily_attempts_mode_valid,
        check: "mode IN ('1-5', '2-4', '3-3')"
      )
    )
  end

  def down do
    drop(constraint(:daily_numbers_daily_attempts, :daily_numbers_daily_attempts_mode_valid))

    execute("DELETE FROM daily_numbers_daily_attempts WHERE mode = '2-4'")
    execute("UPDATE daily_numbers_daily_attempts SET mode = 'classic' WHERE mode = '1-5'")
    execute("UPDATE daily_numbers_daily_attempts SET mode = 'expert' WHERE mode = '3-3'")
    execute("DELETE FROM daily_quests WHERE quest_type = 'daily_numbers_2_4'")

    execute(
      "UPDATE daily_quests SET quest_type = 'daily_numbers_classic' WHERE quest_type = 'daily_numbers_1_5'"
    )

    execute(
      "UPDATE daily_quests SET quest_type = 'daily_numbers_expert' WHERE quest_type = 'daily_numbers_3_3'"
    )

    create(
      constraint(:daily_numbers_daily_attempts, :daily_numbers_daily_attempts_mode_valid,
        check: "mode IN ('classic', 'expert')"
      )
    )
  end
end
