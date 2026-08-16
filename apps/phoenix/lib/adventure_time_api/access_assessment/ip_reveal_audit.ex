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

  def create_changeset(audit, email_access_request_id, actor_id, attrs) do
    audit
    |> cast(attrs, [:request_id])
    |> put_change(:email_access_request_id, email_access_request_id)
    |> put_change(:actor_id, actor_id)
    |> validate_required([:email_access_request_id, :actor_id])
  end
end
