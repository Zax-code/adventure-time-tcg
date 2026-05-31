defmodule AdventureTimeApi.Repo.Migrations.CreateNotificationDevices do
  use Ecto.Migration

  def change do
    create table(:notification_devices, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)
      add(:installation_id, :string, null: false)
      add(:platform, :string, null: false)
      add(:expo_push_token, :text, null: false)
      add(:last_registered_at, :utc_datetime, null: false)
      add(:last_widget_refresh_push_at, :utc_datetime)

      timestamps(type: :utc_datetime)
    end

    create(index(:notification_devices, [:user_id], name: :notification_devices_user_id_idx))

    create(
      unique_index(:notification_devices, [:installation_id],
        name: :notification_devices_installation_id_key
      )
    )

    create(
      unique_index(:notification_devices, [:expo_push_token],
        name: :notification_devices_expo_push_token_key
      )
    )

    create(
      constraint(:notification_devices, :notification_devices_platform_check,
        check: "platform IN ('ios', 'android')"
      )
    )
  end
end
