defmodule AdventureTimeApi.Accounts.EmailVerificationCode do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @purposes [:signup]

  schema "email_verification_codes" do
    field(:email, :string)
    field(:code_hash, :string)
    field(:purpose, Ecto.Enum, values: @purposes, default: :signup)
    field(:expires_at, :utc_datetime)
    field(:used_at, :utc_datetime)
    field(:attempt_count, :integer, default: 0)

    timestamps(type: :utc_datetime)
  end

  def changeset(email_verification_code, attrs) do
    email_verification_code
    |> cast(attrs, [:email, :code_hash, :purpose, :expires_at, :used_at, :attempt_count])
    |> validate_required([:email, :code_hash, :purpose, :expires_at, :attempt_count])
    |> update_change(:email, &String.downcase/1)
    |> validate_format(:email, ~r/^[^\s]+@[^\s]+$/)
    |> validate_number(:attempt_count, greater_than_or_equal_to: 0)
  end
end
