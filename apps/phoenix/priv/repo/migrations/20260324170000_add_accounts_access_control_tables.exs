defmodule AdventureTimeApi.Repo.Migrations.AddAccountsAccessControlTables do
  use Ecto.Migration

  def up do
    execute(
      "CREATE TYPE email_access_request_status AS ENUM ('pending', 'approved', 'rejected')",
      "DROP TYPE email_access_request_status"
    )

    execute(
      "CREATE TYPE email_verification_purpose AS ENUM ('signup')",
      "DROP TYPE email_verification_purpose"
    )

    create table(:email_access_requests, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:email, :citext, null: false)
      add(:status, :email_access_request_status, null: false, default: "pending")
      add(:reviewed_by, :citext)
      add(:reviewed_at, :utc_datetime)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:email_access_requests, [:email], name: :email_access_requests_email_key))
    create(index(:email_access_requests, [:status], name: :email_access_requests_status_idx))

    create table(:email_verification_codes, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:email, :citext, null: false)
      add(:code_hash, :text, null: false)
      add(:purpose, :email_verification_purpose, null: false, default: "signup")
      add(:expires_at, :utc_datetime, null: false)
      add(:used_at, :utc_datetime)
      add(:attempt_count, :integer, null: false, default: 0)

      timestamps(type: :utc_datetime)
    end

    create(
      index(:email_verification_codes, [:email, :purpose],
        name: :email_verification_codes_email_purpose_idx
      )
    )

    create(
      index(:email_verification_codes, [:expires_at],
        name: :email_verification_codes_expires_at_idx
      )
    )
  end

  def down do
    drop(table(:email_verification_codes))
    drop(table(:email_access_requests))
    execute("DROP TYPE email_verification_purpose", "")
    execute("DROP TYPE email_access_request_status", "")
  end
end
