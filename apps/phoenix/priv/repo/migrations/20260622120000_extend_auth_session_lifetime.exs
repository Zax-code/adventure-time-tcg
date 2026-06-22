defmodule AdventureTimeApi.Repo.Migrations.ExtendAuthSessionLifetime do
  use Ecto.Migration

  def up do
    execute("""
    UPDATE auth_sessions
    SET expires_at = inserted_at + INTERVAL '180 days'
    WHERE revoked_at IS NULL
      AND expires_at < inserted_at + INTERVAL '180 days'
    """)
  end

  def down do
    execute("""
    UPDATE auth_sessions
    SET expires_at = inserted_at + INTERVAL '30 days'
    WHERE revoked_at IS NULL
      AND expires_at > inserted_at + INTERVAL '30 days'
    """)
  end
end
