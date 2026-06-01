defmodule AdventureTimeApi.Repo.Migrations.AddLocaleToWordleDailyAttempts do
  use Ecto.Migration

  def change do
    alter table(:wordle_daily_attempts) do
      add(:locale, :string, null: false, default: "fr")
    end

    drop_if_exists(
      unique_index(:wordle_daily_attempts, [:user_id, :date, :attempt],
        name: :wordle_daily_attempts_user_id_date_attempt_key
      )
    )

    create(
      unique_index(:wordle_daily_attempts, [:user_id, :date, :locale, :attempt],
        name: :wordle_daily_attempts_user_id_date_locale_attempt_key
      )
    )

    create(
      index(:wordle_daily_attempts, [:user_id, :date, :locale],
        name: :wordle_daily_attempts_user_id_date_locale_idx
      )
    )

    create(
      constraint(:wordle_daily_attempts, :wordle_daily_attempts_locale_allowed,
        check: "locale IN ('fr', 'en')"
      )
    )
  end
end
