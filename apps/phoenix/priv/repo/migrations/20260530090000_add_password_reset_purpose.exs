defmodule AdventureTimeApi.Repo.Migrations.AddPasswordResetPurpose do
  use Ecto.Migration

  def up do
    execute(
      "ALTER TYPE email_verification_purpose ADD VALUE IF NOT EXISTS 'password_reset'",
      ""
    )
  end

  def down do
    execute("""
    ALTER TABLE email_verification_codes
      ALTER COLUMN purpose DROP DEFAULT;

    DELETE FROM email_verification_codes
    WHERE purpose::text = 'password_reset';

    CREATE TYPE email_verification_purpose_old AS ENUM ('signup');

    ALTER TABLE email_verification_codes
      ALTER COLUMN purpose TYPE email_verification_purpose_old
      USING purpose::text::email_verification_purpose_old;

    DROP TYPE email_verification_purpose;
    ALTER TYPE email_verification_purpose_old RENAME TO email_verification_purpose;

    ALTER TABLE email_verification_codes
      ALTER COLUMN purpose SET DEFAULT 'signup';
    """)
  end
end
