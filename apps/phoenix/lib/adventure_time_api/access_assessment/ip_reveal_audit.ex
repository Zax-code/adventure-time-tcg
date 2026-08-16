defmodule AdventureTimeApi.AccessAssessment.IpRevealAudit do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "access_request_ip_reveal_audits" do
    field(:request_id, :string)

    belongs_to(:email_access_request, AdventureTimeApi.Accounts.EmailAccessRequest)
    belongs_to(:actor, AdventureTimeApi.Accounts.User)

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(audit, attrs) do
    audit
    |> cast(attrs, [:email_access_request_id, :actor_id, :request_id])
    |> validate_required([:email_access_request_id, :actor_id])
  end
end
