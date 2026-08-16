defmodule AdventureTimeApi.AccessAssessment.Evidence.IpIntelligence do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key false

  embedded_schema do
    field(:provider, :string)
    field(:settings_version, :string)
    field(:provider_request_id, :string)
    field(:fraud_score, :integer)
    field(:proxy, :boolean)
    field(:vpn, :boolean)
    field(:active_tor, :boolean)
    field(:bot_status, :boolean)
    field(:recent_abuse, :boolean)
    field(:frequent_abuser, :boolean)
    field(:high_risk_attacks, :boolean)
    field(:public_access_point, :boolean)
    field(:hosting, :boolean)
    field(:shared_connection, :boolean)
    field(:asn, :integer)
    field(:organization, :string)
    field(:connection_type, :string)
    field(:country_code, :string)
    field(:looked_up_at, :utc_datetime)
  end

  def changeset(evidence, attrs) do
    evidence
    |> cast(attrs, __schema__(:fields))
    |> validate_required([:provider, :settings_version, :fraud_score, :looked_up_at])
    |> validate_number(:fraud_score, greater_than_or_equal_to: 0, less_than_or_equal_to: 100)
  end
end
