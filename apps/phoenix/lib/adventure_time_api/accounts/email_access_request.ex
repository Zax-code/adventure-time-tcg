defmodule AdventureTimeApi.Accounts.EmailAccessRequest do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @locales [:en, :fr]
  @statuses [:pending, :approved, :rejected]

  schema "email_access_requests" do
    field(:email, :string)
    field(:requested_locale, Ecto.Enum, values: @locales, default: :en)
    field(:status, Ecto.Enum, values: @statuses, default: :pending)
    field(:reviewed_by, :string)
    field(:reviewed_at, :utc_datetime)
    field(:provider, :string)
    field(:provider_subject_hash, :string)
    field(:google_name, :string)
    field(:google_picture_url, :string)
    field(:last_request_id, :string)
    field(:last_ip_address, :string)
    field(:last_user_agent, :string)
    field(:last_accept_language, :string)
    field(:last_client_platform, :string)
    field(:last_client_app_version, :string)
    field(:last_client_build_number, :string)
    field(:last_installation_id_hash, :string)
    field(:last_attestation_status, :string)
    field(:last_seen_at, :utc_datetime)
    field(:attempt_count, :integer, default: 0)

    has_one(:assessment, AdventureTimeApi.AccessAssessment.Assessment)

    timestamps(type: :utc_datetime)
  end

  def changeset(email_access_request, attrs) do
    email_access_request
    |> cast(attrs, [
      :email,
      :requested_locale,
      :status,
      :reviewed_by,
      :reviewed_at,
      :provider,
      :provider_subject_hash,
      :google_name,
      :google_picture_url,
      :last_request_id,
      :last_ip_address,
      :last_user_agent,
      :last_accept_language,
      :last_client_platform,
      :last_client_app_version,
      :last_client_build_number,
      :last_installation_id_hash,
      :last_attestation_status,
      :last_seen_at,
      :attempt_count
    ])
    |> validate_required([:email, :status])
    |> update_change(:email, &String.downcase/1)
    |> validate_format(:email, ~r/^[^\s]+@[^\s]+$/)
    |> unique_constraint(:email, name: :email_access_requests_email_key)
  end
end
