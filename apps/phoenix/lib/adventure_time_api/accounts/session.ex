defmodule AdventureTimeApi.Accounts.Session do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: false}
  @foreign_key_type :binary_id

  schema "auth_sessions" do
    field :refresh_token_hash, :string
    field :user_agent, :string
    field :ip_address, :string
    field :expires_at, :utc_datetime
    field :revoked_at, :utc_datetime

    belongs_to :user, AdventureTimeApi.Accounts.User

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(session, attrs) do
    session
    |> cast(attrs, [:id, :refresh_token_hash, :user_agent, :ip_address, :expires_at, :revoked_at])
    |> validate_required([:id, :refresh_token_hash, :expires_at])
  end
end
