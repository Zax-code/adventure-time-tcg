defmodule AdventureTimeApi.Notifications.Device do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @platforms [:ios, :android]

  schema "notification_devices" do
    field(:installation_id, :string)
    field(:platform, Ecto.Enum, values: @platforms)
    field(:expo_push_token, :string)
    field(:last_registered_at, :utc_datetime)
    field(:last_widget_refresh_push_at, :utc_datetime)

    belongs_to(:user, AdventureTimeApi.Accounts.User)

    timestamps(type: :utc_datetime)
  end

  def changeset(device, attrs) do
    device
    |> cast(attrs, [
      :user_id,
      :installation_id,
      :platform,
      :expo_push_token,
      :last_registered_at,
      :last_widget_refresh_push_at
    ])
    |> validate_required([:user_id, :installation_id, :platform, :expo_push_token])
    |> validate_length(:installation_id, min: 1, max: 128)
    |> validate_length(:expo_push_token, min: 1, max: 512)
    |> foreign_key_constraint(:user_id)
    |> unique_constraint(:installation_id, name: :notification_devices_installation_id_key)
    |> unique_constraint(:expo_push_token, name: :notification_devices_expo_push_token_key)
  end
end
