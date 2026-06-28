defmodule AdventureTimeApi.Repo.Migrations.AddAuthAttribution do
  use Ecto.Migration

  def change do
    alter table(:email_access_requests) do
      add(:provider, :text)
      add(:provider_subject_hash, :text)
      add(:google_name, :text)
      add(:google_picture_url, :text)
      add(:last_request_id, :text)
      add(:last_ip_address, :text)
      add(:last_user_agent, :text)
      add(:last_accept_language, :text)
      add(:last_client_platform, :text)
      add(:last_client_app_version, :text)
      add(:last_client_build_number, :text)
      add(:last_installation_id_hash, :text)
      add(:last_attestation_status, :text)
      add(:last_seen_at, :utc_datetime)
      add(:attempt_count, :integer, null: false, default: 0)
    end

    create table(:auth_attempts, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:event_type, :text, null: false)
      add(:provider, :text)
      add(:email, :citext)
      add(:provider_subject_hash, :text)
      add(:google_email_verified, :boolean)
      add(:google_name, :text)
      add(:google_picture_url, :text)
      add(:requested_locale, :text)
      add(:status_code, :integer)
      add(:error_code, :text)
      add(:request_id, :text)
      add(:ip_address, :text)
      add(:user_agent, :text)
      add(:accept_language, :text)
      add(:client_platform, :text)
      add(:client_app_version, :text)
      add(:client_build_number, :text)
      add(:installation_id_hash, :text)
      add(:attestation_status, :text)
      add(:metadata, :map, null: false, default: %{})

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(
      index(:auth_attempts, [:email, :inserted_at], name: :auth_attempts_email_inserted_at_idx)
    )

    create(
      index(:auth_attempts, [:ip_address, :inserted_at], name: :auth_attempts_ip_inserted_at_idx)
    )

    create(
      index(:auth_attempts, [:provider_subject_hash, :inserted_at],
        name: :auth_attempts_provider_subject_inserted_at_idx
      )
    )

    create(
      index(:auth_attempts, [:event_type, :inserted_at],
        name: :auth_attempts_event_inserted_at_idx
      )
    )
  end
end
