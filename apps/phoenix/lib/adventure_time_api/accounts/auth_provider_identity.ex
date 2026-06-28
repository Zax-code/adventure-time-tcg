defmodule AdventureTimeApi.Accounts.AuthProviderIdentity do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "auth_provider_identities" do
    field(:provider, :string)
    field(:provider_subject_hash, :string)
    field(:email, :string)
    field(:display_name, :string)

    belongs_to(:user, AdventureTimeApi.Accounts.User)

    timestamps(type: :utc_datetime)
  end

  def changeset(identity, attrs) do
    identity
    |> cast(attrs, [:provider, :provider_subject_hash, :email, :display_name])
    |> validate_required([:provider, :provider_subject_hash])
    |> update_change(:email, fn
      nil -> nil
      email -> String.downcase(email)
    end)
    |> unique_constraint([:provider, :provider_subject_hash],
      name: :auth_provider_identities_provider_subject_key
    )
  end
end
