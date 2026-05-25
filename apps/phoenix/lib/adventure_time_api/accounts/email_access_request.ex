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

    timestamps(type: :utc_datetime)
  end

  def changeset(email_access_request, attrs) do
    email_access_request
    |> cast(attrs, [:email, :requested_locale, :status, :reviewed_by, :reviewed_at])
    |> validate_required([:email, :status])
    |> update_change(:email, &String.downcase/1)
    |> validate_format(:email, ~r/^[^\s]+@[^\s]+$/)
    |> unique_constraint(:email, name: :email_access_requests_email_key)
  end
end
