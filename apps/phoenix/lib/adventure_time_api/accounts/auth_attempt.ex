defmodule AdventureTimeApi.Accounts.AuthAttempt do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "auth_attempts" do
    field(:event_type, :string)
    field(:provider, :string)
    field(:email, :string)
    field(:provider_subject_hash, :string)
    field(:google_email_verified, :boolean)
    field(:google_name, :string)
    field(:google_picture_url, :string)
    field(:requested_locale, :string)
    field(:status_code, :integer)
    field(:error_code, :string)
    field(:request_id, :string)
    field(:ip_address, :string)
    field(:user_agent, :string)
    field(:accept_language, :string)
    field(:client_platform, :string)
    field(:client_app_version, :string)
    field(:client_build_number, :string)
    field(:installation_id_hash, :string)
    field(:attestation_status, :string)
    field(:metadata, :map, default: %{})

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(auth_attempt, attrs) do
    auth_attempt
    |> cast(attrs, [
      :event_type,
      :provider,
      :email,
      :provider_subject_hash,
      :google_email_verified,
      :google_name,
      :google_picture_url,
      :requested_locale,
      :status_code,
      :error_code,
      :request_id,
      :ip_address,
      :user_agent,
      :accept_language,
      :client_platform,
      :client_app_version,
      :client_build_number,
      :installation_id_hash,
      :attestation_status,
      :metadata
    ])
    |> validate_required([:event_type])
    |> update_change(:email, fn
      nil -> nil
      email -> String.downcase(email)
    end)
  end
end
