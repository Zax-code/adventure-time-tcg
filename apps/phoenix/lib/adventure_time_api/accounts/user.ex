defmodule AdventureTimeApi.Accounts.User do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @step_sources [:device_health, :fitbit]
  @locales [:en, :fr]
  @roles [:user, :admin, :super_admin]
  @access_statuses [:pending, :approved, :rejected]
  @default_timezone "Europe/Paris"

  schema "users" do
    field(:email, :string)
    field(:display_name, :string)
    field(:coins, :integer, default: 100)
    field(:dust, :integer, default: 0)
    field(:last_daily_claim, :utc_datetime)
    field(:avatar_asset_id, :binary_id)
    field(:role, Ecto.Enum, values: @roles, default: :user)
    field(:access_status, Ecto.Enum, values: @access_statuses, default: :pending)
    field(:preferred_step_source, Ecto.Enum, values: @step_sources, default: :device_health)
    field(:preferred_language, Ecto.Enum, values: @locales, default: :en)
    field(:timezone, :string, default: @default_timezone)
    field(:notify_daily_reset, :boolean, default: true)
    field(:notify_step_goal, :boolean, default: true)
    field(:notify_pvp_invite, :boolean, default: true)
    field(:notify_pvp_turn, :boolean, default: true)
    field(:notify_gift_received, :boolean, default: true)
    field(:pack_epic_spark_counter, :integer, default: 0)
    field(:pack_legendary_spark_counter, :integer, default: 0)

    has_one(:email_credential, AdventureTimeApi.Accounts.EmailCredential)

    timestamps(type: :utc_datetime)
  end

  def registration_changeset(user, attrs) do
    user
    |> cast(attrs, [:email, :display_name, :preferred_language, :timezone])
    |> validate_required([:email])
    |> update_change(:email, &String.downcase/1)
    |> validate_length(:display_name, min: 1, max: 64)
    |> validate_length(:timezone, min: 1, max: 128)
    |> validate_format(:email, ~r/^[^\s]+@[^\s]+$/)
    |> unique_constraint(:email, name: :users_email_key)
  end

  def profile_changeset(user, attrs) do
    user
    |> cast(attrs, [
      :display_name,
      :avatar_asset_id,
      :preferred_step_source,
      :preferred_language,
      :timezone,
      :notify_daily_reset,
      :notify_step_goal,
      :notify_pvp_invite,
      :notify_pvp_turn,
      :notify_gift_received
    ])
    |> validate_length(:display_name, min: 1, max: 64)
    |> validate_length(:timezone, min: 1, max: 128)
  end

  def access_changeset(user, attrs) do
    user
    |> cast(attrs, [:role, :access_status])
    |> validate_required([:role, :access_status])
  end
end
