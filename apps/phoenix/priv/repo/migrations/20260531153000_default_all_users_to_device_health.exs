defmodule AdventureTimeApi.Repo.Migrations.DefaultAllUsersToDeviceHealth do
  use Ecto.Migration

  def up do
    execute("""
    UPDATE users
    SET preferred_step_source = 'device_health', updated_at = timezone('utc', now())
    WHERE preferred_step_source <> 'device_health'
    """)
  end

  def down do
    :ok
  end
end
