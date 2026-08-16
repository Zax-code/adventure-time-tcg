defmodule AdventureTimeApi.AccessAssessment.Assessment do
  use Ecto.Schema

  import Ecto.Changeset

  alias AdventureTimeApi.AccessAssessment.Evidence.{
    Contribution,
    IpIntelligence,
    NetworkFacts,
    PlayIntegrity
  }

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @states [:assessing, :complete, :partial, :unavailable, :test_lab]
  @profiles [:android, :ios, :web, :unknown]
  @bands [:stronger, :mixed, :concerning]

  schema "access_request_assessments" do
    field(:state, Ecto.Enum, values: @states)
    field(:evidence_revision, :integer, default: 1)
    field(:scoring_model_version, :string, default: "access-request-v1")
    field(:platform_profile, Ecto.Enum, values: @profiles)
    field(:trustworthiness_confidence, :integer)
    field(:evidence_coverage, :integer)
    field(:band, Ecto.Enum, values: @bands)
    field(:canonical_ip, AdventureTimeApi.NetworkAddress.Type)
    field(:masked_ip_address, :string)
    field(:identity_provider_pseudonym, :string)
    field(:installation_provider_pseudonym, :string)
    field(:installation_id_well_formed, :boolean)
    field(:origin_host_consistent, :boolean)
    field(:browser_request_shape, :boolean)
    field(:pseudonym_version, :string)
    field(:missing_reasons, {:array, :string}, default: [])
    field(:hard_failure_reasons, {:array, :string}, default: [])
    field(:assessed_at, :utc_datetime)
    field(:ip_enriched_at, :utc_datetime)
    field(:integrity_assessed_at, :utc_datetime)
    field(:exact_ip_retained_until, :utc_datetime)
    field(:detailed_evidence_retained_until, :utc_datetime)
    field(:summary_retained_until, :utc_datetime)
    field(:lock_version, :integer, default: 1)

    belongs_to(:email_access_request, AdventureTimeApi.Accounts.EmailAccessRequest)

    embeds_one(:network_facts, NetworkFacts, on_replace: :update)
    embeds_one(:ip_intelligence_evidence, IpIntelligence, on_replace: :update)
    embeds_one(:play_integrity_evidence, PlayIntegrity, on_replace: :update)
    embeds_many(:contributions, Contribution, on_replace: :delete)

    timestamps(type: :utc_datetime)
  end

  def create_changeset(assessment, access_request_id, attrs) do
    assessment
    |> changeset(attrs)
    |> put_change(:email_access_request_id, access_request_id)
  end

  def changeset(assessment, attrs) do
    assessment
    |> cast(attrs, [
      :state,
      :evidence_revision,
      :scoring_model_version,
      :platform_profile,
      :trustworthiness_confidence,
      :evidence_coverage,
      :band,
      :canonical_ip,
      :masked_ip_address,
      :identity_provider_pseudonym,
      :installation_provider_pseudonym,
      :installation_id_well_formed,
      :origin_host_consistent,
      :browser_request_shape,
      :pseudonym_version,
      :missing_reasons,
      :hard_failure_reasons,
      :assessed_at,
      :ip_enriched_at,
      :integrity_assessed_at,
      :exact_ip_retained_until,
      :detailed_evidence_retained_until,
      :summary_retained_until
    ])
    |> cast_embed(:network_facts)
    |> cast_embed(:ip_intelligence_evidence)
    |> cast_embed(:play_integrity_evidence)
    |> cast_embed(:contributions)
    |> validate_required([
      :state,
      :evidence_revision,
      :platform_profile
    ])
    |> validate_number(:evidence_revision, greater_than: 0)
    |> validate_number(:trustworthiness_confidence,
      greater_than_or_equal_to: 0,
      less_than_or_equal_to: 100
    )
    |> validate_number(:evidence_coverage,
      greater_than_or_equal_to: 0,
      less_than_or_equal_to: 100
    )
    |> optimistic_lock(:lock_version)
    |> unique_constraint(:email_access_request_id,
      name: :access_request_assessments_request_key
    )
  end
end
