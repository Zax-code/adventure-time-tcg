defmodule AdventureTimeApi.Fitbit.Account do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "fitbit_accounts" do
    field(:fitbit_user_id, :string)
    field(:access_token, :string)
    field(:refresh_token, :string)
    field(:token_expires_at, :utc_datetime)
    field(:scope, :string)
    field(:subscription_id, :string)

    belongs_to(:user, AdventureTimeApi.Accounts.User)

    timestamps(type: :utc_datetime)
  end

  def changeset(account, attrs) do
    account
    |> cast(attrs, [
      :user_id,
      :fitbit_user_id,
      :access_token,
      :refresh_token,
      :token_expires_at,
      :scope,
      :subscription_id
    ])
    |> validate_required([
      :user_id,
      :fitbit_user_id,
      :access_token,
      :refresh_token,
      :token_expires_at,
      :scope
    ])
    |> foreign_key_constraint(:user_id)
    |> unique_constraint(:user_id, name: :fitbit_accounts_user_id_key)
    |> unique_constraint(:fitbit_user_id, name: :fitbit_accounts_fitbit_user_id_key)
  end
end
