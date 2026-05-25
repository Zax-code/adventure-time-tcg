defmodule AdventureTimeApi.Repo.Migrations.AddQuestTables do
  use Ecto.Migration

  def change do
    create table(:daily_quests, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)
      add(:date, :date, null: false)
      add(:quest_type, :string, null: false)
      add(:target, :integer, null: false)
      add(:reward, :integer, null: false, default: 0)
      add(:progress, :integer, null: false, default: 0)
      add(:completed, :boolean, null: false, default: false)
      add(:claimed, :boolean, null: false, default: false)
      add(:completed_at, :utc_datetime)
      add(:claimed_at, :utc_datetime)
      add(:reset_by_user_id, :binary_id)

      timestamps(type: :utc_datetime)
    end

    create(index(:daily_quests, [:user_id], name: :daily_quests_user_id_idx))
    create(index(:daily_quests, [:user_id, :date], name: :daily_quests_user_id_date_idx))

    create(
      unique_index(:daily_quests, [:user_id, :date, :quest_type],
        name: :daily_quests_user_id_date_quest_type_key
      )
    )

    create(constraint(:daily_quests, :daily_quests_progress_nonnegative, check: "progress >= 0"))

    create(constraint(:daily_quests, :daily_quests_reward_nonnegative, check: "reward >= 0"))
    create(constraint(:daily_quests, :daily_quests_target_positive, check: "target > 0"))

    create table(:wordle_dictionary_words, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:locale, :string, null: false)
      add(:word, :string, null: false)
      add(:is_allowed_guess, :boolean, null: false, default: true)
      add(:is_solution_candidate, :boolean, null: false, default: true)

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(
      unique_index(:wordle_dictionary_words, [:locale, :word],
        name: :wordle_dictionary_words_locale_word_key
      )
    )

    create(
      index(:wordle_dictionary_words, [:locale, :is_solution_candidate],
        name: :wordle_dictionary_words_locale_candidate_idx
      )
    )

    create table(:wordle_daily_attempts, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)
      add(:date, :date, null: false)
      add(:attempt, :integer, null: false)
      add(:guess, :string, null: false)
      add(:evaluation, {:array, :string}, null: false)
      add(:solved, :boolean, null: false)

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(
      unique_index(:wordle_daily_attempts, [:user_id, :date, :attempt],
        name: :wordle_daily_attempts_user_id_date_attempt_key
      )
    )

    create(
      index(:wordle_daily_attempts, [:user_id, :date],
        name: :wordle_daily_attempts_user_id_date_idx
      )
    )

    create(
      constraint(:wordle_daily_attempts, :wordle_daily_attempts_attempt_range,
        check: "attempt >= 1 AND attempt <= 6"
      )
    )

    create table(:speed_calculus_daily_runs, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)
      add(:date, :date, null: false)
      add(:run_number, :integer, null: false)
      add(:seed, :string, null: false)
      add(:answers, {:array, :integer}, null: false, default: [])
      add(:status, :string, null: false, default: "in_progress")
      add(:score, :integer)
      add(:reward, :integer)
      add(:started_at, :utc_datetime, null: false)
      add(:finished_at, :utc_datetime)
      add(:pause_expires_at, :utc_datetime)

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(
      unique_index(:speed_calculus_daily_runs, [:user_id, :date, :run_number],
        name: :speed_calculus_daily_runs_user_id_date_run_number_key
      )
    )

    create(
      index(:speed_calculus_daily_runs, [:user_id, :date],
        name: :speed_calculus_daily_runs_user_id_date_idx
      )
    )

    create(
      constraint(:speed_calculus_daily_runs, :speed_calculus_daily_runs_run_number_range,
        check: "run_number >= 1 AND run_number <= 3"
      )
    )

    create(
      constraint(:speed_calculus_daily_runs, :speed_calculus_daily_runs_status_valid,
        check: "status IN ('in_progress', 'completed', 'abandoned')"
      )
    )
  end
end
