defmodule AdventureTimeApi.Repo.Migrations.CreateLeaderboardFoundation do
  use Ecto.Migration

  def up do
    alter table(:users) do
      add(:public_discriminator, :string,
        default:
          fragment("upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8))")
      )

      add(:public_profile_id, :binary_id, default: fragment("gen_random_uuid()"))
      add(:public_profile_status, :string, null: false, default: "visible")
      add(:leaderboard_eligible, :boolean, null: false, default: true)
      add(:display_name_changed_at, :utc_datetime_usec)
    end

    execute("""
    UPDATE users
    SET public_profile_id = gen_random_uuid(),
        public_discriminator = upper(substring(md5(id::text) from 1 for 8))
    WHERE public_profile_id IS NULL OR public_discriminator IS NULL
    """)

    alter table(:users) do
      modify(:public_discriminator, :string, null: false)
      modify(:public_profile_id, :binary_id, null: false)
    end

    create(unique_index(:users, [:public_discriminator]))
    create(unique_index(:users, [:public_profile_id]))
    create(index(:users, [:leaderboard_eligible, :public_profile_status]))

    create(
      constraint(:users, :users_public_profile_status_valid,
        check: "public_profile_status IN ('visible', 'hidden', 'moderated', 'deleted')"
      )
    )

    create table(:leaderboard_boards, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:key, :string, null: false)
      add(:quest_family, :string, null: false)
      add(:mode, :string, null: false)
      add(:direction, :string, null: false)
      add(:board_kind, :string, null: false)
      add(:derived_members, :map, null: false, default: %{})
      add(:enabled, :boolean, null: false, default: true)
      add(:prizes_enabled, :boolean, null: false, default: false)
      add(:display_order, :integer, null: false)
      add(:raw_result_kind, :string, null: false)
      add(:validation_policy, :map, null: false, default: %{})
      timestamps(type: :utc_datetime_usec)
    end

    create(unique_index(:leaderboard_boards, [:key]))
    create(unique_index(:leaderboard_boards, [:quest_family, :mode]))
    create(index(:leaderboard_boards, [:enabled, :display_order]))

    create(
      constraint(:leaderboard_boards, :leaderboard_boards_direction_valid,
        check: "direction IN ('higher', 'lower', 'points')"
      )
    )

    create(
      constraint(:leaderboard_boards, :leaderboard_boards_kind_valid,
        check: "board_kind IN ('source', 'derived_family')"
      )
    )

    execute("""
    INSERT INTO leaderboard_boards
      (id, key, quest_family, mode, direction, board_kind, derived_members,
       enabled, prizes_enabled, display_order, raw_result_kind, validation_policy,
       inserted_at, updated_at)
    VALUES
      (gen_random_uuid(), 'steps/default', 'steps', 'default', 'higher', 'source', '{}', true, true, 1, 'steps', '{}', now(), now()),
      (gen_random_uuid(), 'daily-numbers/1-5', 'daily_numbers', '1-5', 'lower', 'source', '{}', true, false, 2, 'exact_completion_time', '{}', now(), now()),
      (gen_random_uuid(), 'daily-numbers/2-4', 'daily_numbers', '2-4', 'lower', 'source', '{}', true, false, 3, 'exact_completion_time', '{}', now(), now()),
      (gen_random_uuid(), 'daily-numbers/3-3', 'daily_numbers', '3-3', 'lower', 'source', '{}', true, false, 4, 'exact_completion_time', '{}', now(), now()),
      (gen_random_uuid(), 'daily-numbers/family', 'daily_numbers', 'family', 'points', 'derived_family', '{"members":["daily-numbers/1-5","daily-numbers/2-4","daily-numbers/3-3"]}', true, true, 5, 'member_breakdown', '{}', now(), now()),
      (gen_random_uuid(), 'wordle/fr', 'wordle', 'fr', 'lower', 'source', '{}', true, false, 6, 'wordle_outcome', '{}', now(), now()),
      (gen_random_uuid(), 'wordle/en', 'wordle', 'en', 'lower', 'source', '{}', true, false, 7, 'wordle_outcome', '{}', now(), now()),
      (gen_random_uuid(), 'wordle/family', 'wordle', 'family', 'points', 'derived_family', '{"members":["wordle/fr","wordle/en"]}', true, true, 8, 'member_breakdown', '{}', now(), now()),
      (gen_random_uuid(), 'speed-calculus/ranked', 'speed_calculus', 'ranked', 'higher', 'source', '{}', true, true, 9, 'correct_answers', '{}', now(), now()),
      (gen_random_uuid(), 'perfect-timing/official', 'perfect_timing', 'official', 'lower', 'source', '{}', true, true, 10, 'duration_error_ms', '{}', now(), now())
    """)

    create table(:leaderboard_scoring_versions, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:version, :string, null: false)
      add(:schema_version, :integer, null: false)
      add(:configuration, :map, null: false)
      add(:configuration_hash, :string, null: false)
      add(:effective_week_start, :date, null: false)
      add(:status, :string, null: false, default: "draft")

      add(
        :created_by_user_id,
        references(:users, type: :binary_id, on_delete: :nilify_all)
      )

      add(:activated_at, :utc_datetime_usec)
      timestamps(type: :utc_datetime_usec)
    end

    create(unique_index(:leaderboard_scoring_versions, [:version]))
    create(unique_index(:leaderboard_scoring_versions, [:effective_week_start]))
    create(index(:leaderboard_scoring_versions, [:status, :effective_week_start]))

    create(
      constraint(:leaderboard_scoring_versions, :leaderboard_scoring_versions_status_valid,
        check: "status IN ('draft', 'scheduled', 'active', 'retired')"
      )
    )

    create table(:leaderboard_competition_slots, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)
      add(:competition_week_key, :date, null: false)
      add(:slot_number, :integer, null: false)
      add(:local_date, :date, null: false)
      add(:detected_timezone, :string, null: false)
      add(:effective_timezone, :string, null: false)
      add(:starts_at, :utc_datetime_usec, null: false)
      add(:ends_at, :utc_datetime_usec, null: false)
      add(:status, :string, null: false, default: "scheduled")
      add(:timezone_change_reason, :string)
      add(:metadata, :map, null: false, default: %{})
      timestamps(type: :utc_datetime_usec)
    end

    create(
      unique_index(:leaderboard_competition_slots, [:user_id, :competition_week_key, :slot_number])
    )

    create(
      unique_index(:leaderboard_competition_slots, [:user_id, :competition_week_key, :local_date])
    )

    create(
      unique_index(:leaderboard_competition_slots, [:user_id],
        where: "status = 'open'",
        name: :leaderboard_competition_slots_one_open_per_user
      )
    )

    create(index(:leaderboard_competition_slots, [:status, :ends_at]))

    create(
      constraint(:leaderboard_competition_slots, :leaderboard_competition_slots_number_valid,
        check: "slot_number BETWEEN 1 AND 7"
      )
    )

    create(
      constraint(:leaderboard_competition_slots, :leaderboard_competition_slots_status_valid,
        check: "status IN ('scheduled', 'open', 'closed', 'void')"
      )
    )

    create(
      constraint(:leaderboard_competition_slots, :leaderboard_competition_slots_bounds_valid,
        check: "starts_at < ends_at"
      )
    )

    create table(:ranked_sessions, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)

      add(:board_id, references(:leaderboard_boards, type: :binary_id, on_delete: :restrict),
        null: false
      )

      add(
        :competition_slot_id,
        references(:leaderboard_competition_slots, type: :binary_id, on_delete: :restrict),
        null: false
      )

      add(:competition_date, :date, null: false)
      add(:source_kind, :string)
      add(:source_id, :binary_id)
      add(:session_number, :integer, null: false)
      add(:status, :string, null: false, default: "started")
      add(:server_started_at, :utc_datetime_usec, null: false)
      add(:server_deadline_at, :utc_datetime_usec)
      add(:server_ended_at, :utc_datetime_usec)
      add(:challenge_version, :string)
      add(:nonce_hash, :string, null: false)
      add(:client_metadata, :map, null: false, default: %{})
      add(:integrity_status, :string, null: false, default: "pending")
      add(:integrity_reason_codes, {:array, :string}, null: false, default: [])
      timestamps(type: :utc_datetime_usec)
    end

    create(
      unique_index(:ranked_sessions, [:user_id, :board_id, :competition_date, :session_number])
    )

    create(index(:ranked_sessions, [:status, :server_deadline_at]))
    create(index(:ranked_sessions, [:user_id, :board_id, :competition_date]))

    create(
      unique_index(:ranked_sessions, [:user_id, :board_id],
        where: "status = 'started'",
        name: :ranked_sessions_one_active_per_board
      )
    )

    create(
      constraint(:ranked_sessions, :ranked_sessions_status_valid,
        check: "status IN ('started', 'settled', 'expired', 'cancelled', 'excluded')"
      )
    )

    create(
      constraint(:ranked_sessions, :ranked_sessions_integrity_status_valid,
        check: "integrity_status IN ('pending', 'accepted', 'review', 'rejected')"
      )
    )

    create table(:leaderboard_periods, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:period_type, :string, null: false)
      add(:competition_timezone, :string, null: false, default: "global")
      add(:starts_at, :utc_datetime_usec, null: false)
      add(:ends_at, :utc_datetime_usec, null: false)
      add(:closes_at, :utc_datetime_usec, null: false)
      add(:competition_date, :date)
      add(:week_start, :date)
      add(:status, :string, null: false, default: "scheduled")
      add(:origin, :string, null: false, default: "verified")
      add(:prizes_allowed, :boolean, null: false, default: false)

      add(
        :scoring_version_id,
        references(:leaderboard_scoring_versions, type: :binary_id, on_delete: :restrict),
        null: false
      )

      add(:launch_partial, :boolean, null: false, default: false)
      timestamps(type: :utc_datetime_usec)
    end

    create(unique_index(:leaderboard_periods, [:period_type, :starts_at]))
    create(index(:leaderboard_periods, [:status, :closes_at]))
    create(index(:leaderboard_periods, [:period_type, :competition_date]))
    create(index(:leaderboard_periods, [:period_type, :week_start]))

    create(
      constraint(:leaderboard_periods, :leaderboard_periods_type_valid,
        check: "period_type IN ('day', 'week')"
      )
    )

    create(
      constraint(:leaderboard_periods, :leaderboard_periods_status_valid,
        check: "status IN ('scheduled', 'open', 'closing', 'closed', 'corrected')"
      )
    )

    create(
      constraint(:leaderboard_periods, :leaderboard_periods_origin_valid,
        check: "origin IN ('verified', 'legacy_unverified')"
      )
    )

    create(
      constraint(:leaderboard_periods, :leaderboard_periods_prize_origin_valid,
        check: "origin <> 'legacy_unverified' OR prizes_allowed = false"
      )
    )

    create table(:leaderboard_daily_results, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)

      add(:board_id, references(:leaderboard_boards, type: :binary_id, on_delete: :restrict),
        null: false
      )

      add(
        :competition_slot_id,
        references(:leaderboard_competition_slots, type: :binary_id, on_delete: :restrict),
        null: false
      )

      add(:competition_date, :date, null: false)

      add(
        :ranked_session_id,
        references(:ranked_sessions, type: :binary_id, on_delete: :nilify_all)
      )

      add(:source_kind, :string, null: false)
      add(:source_id, :binary_id, null: false)
      add(:raw_result_schema_version, :integer, null: false, default: 1)
      add(:raw_result, :map, null: false)
      add(:raw_numeric_value, :bigint)
      add(:outcome, :string)
      add(:points_milli, :integer)

      add(
        :scoring_version_id,
        references(:leaderboard_scoring_versions, type: :binary_id, on_delete: :restrict),
        null: false
      )

      add(:result_status, :string, null: false, default: "pending")
      add(:integrity_status, :string, null: false, default: "pending")
      add(:eligibility_status, :string, null: false, default: "eligible")
      add(:active, :boolean, null: false, default: true)
      add(:provisional, :boolean, null: false, default: true)
      add(:submitted_at, :utc_datetime_usec, null: false)
      add(:accepted_at, :utc_datetime_usec)

      add(
        :supersedes_result_id,
        references(:leaderboard_daily_results, type: :binary_id, on_delete: :nilify_all)
      )

      add(:excluded_reason, :string)
      add(:excluded_by_user_id, references(:users, type: :binary_id, on_delete: :nilify_all))
      add(:excluded_at, :utc_datetime_usec)
      timestamps(type: :utc_datetime_usec)
    end

    create(
      unique_index(:leaderboard_daily_results, [:user_id, :board_id, :competition_date],
        where: "active = true",
        name: :leaderboard_daily_results_one_active_result
      )
    )

    create(unique_index(:leaderboard_daily_results, [:source_kind, :source_id, :board_id]))

    create(
      index(:leaderboard_daily_results, [
        :board_id,
        :competition_date,
        :result_status,
        :points_milli
      ])
    )

    create(index(:leaderboard_daily_results, [:scoring_version_id, :integrity_status]))

    create(
      constraint(:leaderboard_daily_results, :leaderboard_daily_results_status_valid,
        check: "result_status IN ('pending', 'accepted', 'rejected', 'excluded', 'snapshotted')"
      )
    )

    create(
      constraint(:leaderboard_daily_results, :leaderboard_daily_results_integrity_valid,
        check: "integrity_status IN ('pending', 'accepted', 'review', 'rejected')"
      )
    )

    create(
      constraint(:leaderboard_daily_results, :leaderboard_daily_results_eligibility_valid,
        check: "eligibility_status IN ('eligible', 'ineligible', 'moderated')"
      )
    )

    create(
      constraint(:leaderboard_daily_results, :leaderboard_daily_results_points_valid,
        check: "points_milli IS NULL OR points_milli BETWEEN 0 AND 1000000"
      )
    )

    create table(:leaderboard_snapshots, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(:period_id, references(:leaderboard_periods, type: :binary_id, on_delete: :restrict),
        null: false
      )

      add(:board_id, references(:leaderboard_boards, type: :binary_id, on_delete: :restrict),
        null: false
      )

      add(:revision, :integer, null: false)
      add(:status, :string, null: false, default: "building")

      add(
        :scoring_version_id,
        references(:leaderboard_scoring_versions, type: :binary_id, on_delete: :restrict),
        null: false
      )

      add(:participant_count, :integer, null: false, default: 0)
      add(:valid_result_count, :integer, null: false, default: 0)
      add(:configuration_hash, :string, null: false)
      add(:source_cutoff, :utc_datetime_usec, null: false)
      add(:finalized_at, :utc_datetime_usec)
      add(:finalized_by, :string)
      add(:correction_reason, :text)

      add(
        :supersedes_snapshot_id,
        references(:leaderboard_snapshots, type: :binary_id, on_delete: :nilify_all)
      )

      add(:current, :boolean, null: false, default: false)
      timestamps(type: :utc_datetime_usec)
    end

    create(unique_index(:leaderboard_snapshots, [:period_id, :board_id, :revision]))

    create(
      unique_index(:leaderboard_snapshots, [:period_id, :board_id],
        where: "current = true",
        name: :leaderboard_snapshots_one_current_revision
      )
    )

    create(index(:leaderboard_snapshots, [:period_id, :board_id, :current]))

    create table(:leaderboard_snapshot_rows, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(
        :snapshot_id,
        references(:leaderboard_snapshots, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:user_id, references(:users, type: :binary_id, on_delete: :nilify_all))
      add(:public_profile_id, :binary_id)
      add(:anonymous_tombstone, :string)
      add(:position, :integer, null: false)
      add(:rank, :integer, null: false)
      add(:tie_group, :integer, null: false)
      add(:points_milli, :integer, null: false)
      add(:raw_result, :map, null: false, default: %{})
      add(:selected_daily_result_ids, {:array, :binary_id}, null: false, default: [])
      add(:selected_points_milli, {:array, :integer}, null: false, default: [])
      add(:medal_tier, :string)
      add(:identity_audit, :map, null: false, default: %{})
      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create(unique_index(:leaderboard_snapshot_rows, [:snapshot_id, :position]))

    create(
      unique_index(:leaderboard_snapshot_rows, [:snapshot_id, :user_id],
        where: "user_id IS NOT NULL"
      )
    )

    create(index(:leaderboard_snapshot_rows, [:snapshot_id, :rank]))
    create(index(:leaderboard_snapshot_rows, [:user_id, :snapshot_id]))

    create(
      constraint(:leaderboard_snapshot_rows, :leaderboard_snapshot_rows_points_valid,
        check: "points_milli BETWEEN 0 AND 1000000"
      )
    )

    create(
      constraint(:leaderboard_snapshot_rows, :leaderboard_snapshot_rows_medal_valid,
        check: "medal_tier IS NULL OR medal_tier IN ('gold', 'silver', 'bronze')"
      )
    )

    create table(:user_achievements, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)
      add(:achievement_key, :string, null: false)

      add(:board_id, references(:leaderboard_boards, type: :binary_id, on_delete: :restrict),
        null: false
      )

      add(
        :snapshot_id,
        references(:leaderboard_snapshots, type: :binary_id, on_delete: :restrict),
        null: false
      )

      add(:tier, :string, null: false)
      add(:status, :string, null: false, default: "active")
      add(:awarded_at, :utc_datetime_usec, null: false)
      add(:reversed_at, :utc_datetime_usec)
      add(:reversal_reason, :text)
      add(:reversed_by_user_id, references(:users, type: :binary_id, on_delete: :nilify_all))

      add(
        :replacement_snapshot_id,
        references(:leaderboard_snapshots, type: :binary_id, on_delete: :nilify_all)
      )

      timestamps(type: :utc_datetime_usec)
    end

    create(unique_index(:user_achievements, [:snapshot_id, :tier, :user_id]))
    create(index(:user_achievements, [:user_id, :status]))

    create table(:leaderboard_reward_wallets, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)
      add(:crown_family, :string, null: false)
      add(:balance, :integer, null: false, default: 0)
      timestamps(type: :utc_datetime_usec)
    end

    create(unique_index(:leaderboard_reward_wallets, [:user_id, :crown_family]))

    create(
      constraint(:leaderboard_reward_wallets, :leaderboard_reward_wallets_balance_valid,
        check: "balance >= 0"
      )
    )

    create table(:leaderboard_reward_grants, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)

      add(
        :snapshot_id,
        references(:leaderboard_snapshots, type: :binary_id, on_delete: :restrict),
        null: false
      )

      add(:board_id, references(:leaderboard_boards, type: :binary_id, on_delete: :restrict),
        null: false
      )

      add(:medal_tier, :string, null: false)
      add(:crown_family, :string, null: false)
      add(:amount, :integer, null: false)
      add(:status, :string, null: false, default: "active")
      add(:idempotency_key, :string, null: false)
      add(:reversed_at, :utc_datetime_usec)
      add(:reversal_reason, :text)
      add(:reversed_by_user_id, references(:users, type: :binary_id, on_delete: :nilify_all))

      add(
        :superseding_grant_id,
        references(:leaderboard_reward_grants, type: :binary_id, on_delete: :nilify_all)
      )

      timestamps(type: :utc_datetime_usec)
    end

    create(unique_index(:leaderboard_reward_grants, [:idempotency_key]))
    create(index(:leaderboard_reward_grants, [:user_id, :crown_family, :status]))

    create(
      constraint(:leaderboard_reward_grants, :leaderboard_reward_grants_amount_valid,
        check: "amount BETWEEN 1 AND 3"
      )
    )

    create table(:leaderboard_snapshot_corrections, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(
        :source_snapshot_id,
        references(:leaderboard_snapshots, type: :binary_id, on_delete: :restrict),
        null: false
      )

      add(:source_revision, :integer, null: false)
      add(:status, :string, null: false, default: "previewed")
      add(:preview_hash, :string, null: false)
      add(:reason, :text, null: false)
      add(:actor_user_id, references(:users, type: :binary_id, on_delete: :restrict), null: false)
      add(:proposed_changes, :map, null: false)
      add(:rank_delta, :map, null: false, default: %{})
      add(:reward_delta, :map, null: false, default: %{})

      add(
        :resulting_snapshot_id,
        references(:leaderboard_snapshots, type: :binary_id, on_delete: :nilify_all)
      )

      add(:error_metadata, :map)
      add(:previewed_at, :utc_datetime_usec, null: false)
      add(:confirmed_at, :utc_datetime_usec)
      add(:applied_at, :utc_datetime_usec)
      timestamps(type: :utc_datetime_usec)
    end

    create(index(:leaderboard_snapshot_corrections, [:source_snapshot_id, :source_revision]))
    create(index(:leaderboard_snapshot_corrections, [:status, :inserted_at]))

    create table(:leaderboard_result_telemetry, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(
        :result_id,
        references(:leaderboard_daily_results, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:board_id, references(:leaderboard_boards, type: :binary_id, on_delete: :restrict),
        null: false
      )

      add(:competition_date, :date, null: false)

      add(
        :scoring_version_id,
        references(:leaderboard_scoring_versions, type: :binary_id, on_delete: :restrict),
        null: false
      )

      add(:normalized_metrics, :map, null: false, default: %{})
      add(:source, :string)
      add(:platform, :string)
      add(:app_version, :string)
      add(:validity_reason_codes, {:array, :string}, null: false, default: [])
      add(:integrity_reason_codes, {:array, :string}, null: false, default: [])
      add(:session_metrics, :map, null: false, default: %{})
      add(:cohort, :map, null: false, default: %{})
      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create(unique_index(:leaderboard_result_telemetry, [:result_id]))
    create(index(:leaderboard_result_telemetry, [:board_id, :competition_date]))
    create(index(:leaderboard_result_telemetry, [:scoring_version_id, :board_id]))

    create table(:display_name_history, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)
      add(:previous_display_name, :string)
      add(:new_display_name, :string)
      add(:previous_normalized_name, :string)
      add(:new_normalized_name, :string)
      add(:changed_at, :utc_datetime_usec, null: false)
      add(:actor_user_id, references(:users, type: :binary_id, on_delete: :nilify_all))
      add(:reason, :string, null: false)
      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create(index(:display_name_history, [:user_id, :changed_at]))
    create(index(:display_name_history, [:new_normalized_name]))
  end

  def down do
    drop(table(:display_name_history))
    drop(table(:leaderboard_result_telemetry))
    drop(table(:leaderboard_snapshot_corrections))
    drop(table(:leaderboard_reward_grants))
    drop(table(:leaderboard_reward_wallets))
    drop(table(:user_achievements))
    drop(table(:leaderboard_snapshot_rows))
    drop(table(:leaderboard_snapshots))
    drop(table(:leaderboard_daily_results))
    drop(table(:leaderboard_periods))
    drop(table(:ranked_sessions))
    drop(table(:leaderboard_competition_slots))
    drop(table(:leaderboard_scoring_versions))
    drop(table(:leaderboard_boards))

    drop_if_exists(index(:users, [:leaderboard_eligible, :public_profile_status]))
    drop_if_exists(index(:users, [:public_profile_id]))
    drop_if_exists(index(:users, [:public_discriminator]))

    alter table(:users) do
      remove(:display_name_changed_at)
      remove(:leaderboard_eligible)
      remove(:public_profile_status)
      remove(:public_profile_id)
      remove(:public_discriminator)
    end
  end
end
