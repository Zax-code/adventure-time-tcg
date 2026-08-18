defmodule AdventureTimeApi.Repo.Migrations.CreateAccessRequestAssessments do
  use Ecto.Migration

  def change do
    create table(:access_request_assessments, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(
        :email_access_request_id,
        references(:email_access_requests, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:state, :text, null: false)
      add(:evidence_revision, :integer, null: false, default: 1)
      add(:scoring_model_version, :text, null: false, default: "access-request-v1")
      add(:platform_profile, :text, null: false)
      add(:trustworthiness_confidence, :integer)
      add(:evidence_coverage, :integer)
      add(:band, :text)
      add(:canonical_ip, :inet)
      add(:masked_ip_address, :text)
      add(:network_facts, :map)
      add(:ip_intelligence_evidence, :map)
      add(:play_integrity_evidence, :map)
      add(:contributions, {:array, :map}, null: false, default: [])
      add(:missing_reasons, {:array, :text}, null: false, default: [])
      add(:hard_failure_reasons, {:array, :text}, null: false, default: [])
      add(:assessed_at, :utc_datetime)
      add(:ip_enriched_at, :utc_datetime)
      add(:integrity_assessed_at, :utc_datetime)
      add(:exact_ip_retained_until, :utc_datetime)
      add(:detailed_evidence_retained_until, :utc_datetime)
      add(:lock_version, :integer, null: false, default: 1)

      timestamps(type: :utc_datetime)
    end

    create(
      unique_index(:access_request_assessments, [:email_access_request_id],
        name: :access_request_assessments_request_key
      )
    )

    create(
      index(:access_request_assessments, [:state, :updated_at],
        name: :access_request_assessments_state_updated_at_idx
      )
    )

    create(
      constraint(:access_request_assessments, :access_request_assessments_score_range,
        check:
          "trustworthiness_confidence IS NULL OR trustworthiness_confidence BETWEEN 0 AND 100"
      )
    )

    create(
      constraint(:access_request_assessments, :access_request_assessments_coverage_range,
        check: "evidence_coverage IS NULL OR evidence_coverage BETWEEN 0 AND 100"
      )
    )

    create table(:access_request_assessment_snapshots, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(
        :email_access_request_id,
        references(:email_access_requests, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:review_actor_id, references(:users, type: :binary_id, on_delete: :nilify_all))
      add(:review_outcome, :text, null: false)
      add(:state, :text, null: false)
      add(:evidence_revision, :integer, null: false)
      add(:scoring_model_version, :text)
      add(:platform_profile, :text)
      add(:trustworthiness_confidence, :integer)
      add(:evidence_coverage, :integer)
      add(:band, :text)
      add(:network_classifications, :map, null: false, default: %{})
      add(:contributions, {:array, :map}, null: false, default: [])
      add(:reason_codes, {:array, :text}, null: false, default: [])
      add(:assessed_at, :utc_datetime)
      add(:reviewed_at, :utc_datetime, null: false)
      add(:retained_until, :utc_datetime, null: false)

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(
      index(:access_request_assessment_snapshots, [:reviewed_at],
        name: :access_request_assessment_snapshots_reviewed_at_idx
      )
    )

    create table(:access_request_integrity_challenges, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(
        :email_access_request_id,
        references(:email_access_requests, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:challenge_digest, :binary, null: false)
      add(:expected_request_hash, :text, null: false)
      add(:evidence_revision, :integer, null: false)
      add(:expires_at, :utc_datetime, null: false)
      add(:consumed_at, :utc_datetime)

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(
      unique_index(:access_request_integrity_challenges, [:challenge_digest],
        name: :access_request_integrity_challenges_digest_key
      )
    )

    create(
      index(:access_request_integrity_challenges, [:expires_at],
        name: :access_request_integrity_challenges_expires_at_idx
      )
    )

    create table(:access_request_ip_reveal_audits, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(
        :email_access_request_id,
        references(:email_access_requests, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:actor_id, references(:users, type: :binary_id, on_delete: :nilify_all))
      add(:request_id, :text)

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(
      index(:access_request_ip_reveal_audits, [:inserted_at],
        name: :access_request_ip_reveal_audits_inserted_at_idx
      )
    )

    alter table(:auth_attempts) do
      add(
        :email_access_request_id,
        references(:email_access_requests, type: :binary_id, on_delete: :nilify_all)
      )

      add(:canonical_ip, :inet)
    end

    create(
      index(:auth_attempts, [:email_access_request_id, :inserted_at],
        name: :auth_attempts_request_inserted_at_idx
      )
    )

    create(
      index(:auth_attempts, [:canonical_ip, :inserted_at],
        name: :auth_attempts_canonical_ip_inserted_at_idx
      )
    )

    create(
      index(:auth_attempts, [:installation_id_hash, :inserted_at],
        name: :auth_attempts_installation_inserted_at_idx
      )
    )

    execute(
      """
      UPDATE auth_attempts AS attempt
      SET email_access_request_id = request.id
      FROM email_access_requests AS request
      WHERE request.status = 'pending'
        AND attempt.email = request.email
      """,
      """
      UPDATE auth_attempts SET email_access_request_id = NULL
      """
    )

    execute(
      """
      UPDATE auth_attempts
      SET canonical_ip = ip_address::inet
      WHERE ip_address ~ '^([0-9]{1,3}\\.){3}[0-9]{1,3}$'
        AND split_part(ip_address, '.', 1)::integer BETWEEN 0 AND 255
        AND split_part(ip_address, '.', 2)::integer BETWEEN 0 AND 255
        AND split_part(ip_address, '.', 3)::integer BETWEEN 0 AND 255
        AND split_part(ip_address, '.', 4)::integer BETWEEN 0 AND 255
        AND email_access_request_id IS NOT NULL
      """,
      """
      UPDATE auth_attempts SET canonical_ip = NULL
      """
    )
  end
end
