defmodule AdventureTimeApi.Accounts.EmailCredential do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "email_auth_credentials" do
    field(:password_hash, :string)
    field(:email_verified_at, :utc_datetime)

    belongs_to(:user, AdventureTimeApi.Accounts.User)

    timestamps(type: :utc_datetime)
  end

  def changeset(email_credential, attrs) do
    email_credential
    |> cast(attrs, [:password_hash, :email_verified_at])
    |> validate_required([:password_hash])
    |> unique_constraint(:user_id, name: :email_auth_credentials_user_id_key)
  end
end
