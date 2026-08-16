defmodule AdventureTimeApi.Repo.Migrations.HardenAccessAssessmentRetention do
  use Ecto.Migration

  def up do
    alter table(:access_request_assessments) do
      modify(:scoring_model_version, :text, null: true, default: "access-request-v1")
      add(:summary_retained_until, :utc_datetime)
      add(:installation_id_well_formed, :boolean)
      add(:origin_host_consistent, :boolean)
      add(:browser_request_shape, :boolean)
    end

    alter table(:access_request_assessment_snapshots) do
      remove(:contributions, {:array, :map}, null: false, default: [])
    end

    execute("""
    UPDATE auth_attempts
    SET canonical_ip = ip_address::inet
    WHERE canonical_ip IS NULL
      AND email_access_request_id IS NOT NULL
      AND pg_input_is_valid(ip_address, 'inet')
    """)
  end

  def down do
    execute("""
    UPDATE auth_attempts
    SET canonical_ip = NULL
    WHERE email_access_request_id IS NOT NULL
      AND family(canonical_ip) = 6
    """)

    alter table(:access_request_assessment_snapshots) do
      add(:contributions, {:array, :map}, null: false, default: [])
    end

    execute("""
    UPDATE access_request_assessments
    SET scoring_model_version = 'access-request-v1'
    WHERE scoring_model_version IS NULL
    """)

    alter table(:access_request_assessments) do
      modify(:scoring_model_version, :text, null: false, default: "access-request-v1")
      remove(:summary_retained_until)
      remove(:installation_id_well_formed)
      remove(:origin_host_consistent)
      remove(:browser_request_shape)
    end
  end
end
