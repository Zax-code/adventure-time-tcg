defmodule AdventureTimeApi.AccessAssessment.IntegrityChallenge do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "access_request_integrity_challenges" do
    field(:challenge_digest, :binary)
    field(:expected_request_hash, :string)
    field(:evidence_revision, :integer)
    field(:expires_at, :utc_datetime)
    field(:consumed_at, :utc_datetime)

    belongs_to(:email_access_request, AdventureTimeApi.Accounts.EmailAccessRequest)

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(challenge, attrs) do
    challenge
    |> cast(attrs, [
      :email_access_request_id,
      :challenge_digest,
      :expected_request_hash,
      :evidence_revision,
      :expires_at,
      :consumed_at
    ])
    |> validate_required([
      :email_access_request_id,
      :challenge_digest,
      :expected_request_hash,
      :evidence_revision,
      :expires_at
    ])
    |> unique_constraint(:challenge_digest,
      name: :access_request_integrity_challenges_digest_key
    )
  end
end
