defmodule AdventureTimeApi.AccessAssessment.Snapshot do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "access_request_assessment_snapshots" do
    field(:review_outcome, Ecto.Enum, values: [:approved, :rejected])
    field(:state, Ecto.Enum, values: [:assessing, :complete, :partial, :unavailable, :test_lab])
    field(:evidence_revision, :integer)
    field(:scoring_model_version, :string)
    field(:platform_profile, Ecto.Enum, values: [:android, :ios, :web, :unknown])
    field(:trustworthiness_confidence, :integer)
    field(:evidence_coverage, :integer)
    field(:band, Ecto.Enum, values: [:stronger, :mixed, :concerning])
    field(:network_classifications, :map, default: %{})
    field(:reason_codes, {:array, :string}, default: [])
    field(:assessed_at, :utc_datetime)
    field(:reviewed_at, :utc_datetime)
    field(:retained_until, :utc_datetime)

    belongs_to(:email_access_request, AdventureTimeApi.Accounts.EmailAccessRequest)
    belongs_to(:review_actor, AdventureTimeApi.Accounts.User)

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def create_changeset(snapshot, access_request_id, review_actor_id, attrs) do
    snapshot
    |> changeset(attrs)
    |> put_change(:email_access_request_id, access_request_id)
    |> put_change(:review_actor_id, review_actor_id)
  end

  def changeset(snapshot, attrs) do
    snapshot
    |> cast(attrs, [
      :review_outcome,
      :state,
      :evidence_revision,
      :scoring_model_version,
      :platform_profile,
      :trustworthiness_confidence,
      :evidence_coverage,
      :band,
      :network_classifications,
      :reason_codes,
      :assessed_at,
      :reviewed_at,
      :retained_until
    ])
    |> validate_required([
      :review_outcome,
      :state,
      :evidence_revision,
      :reviewed_at,
      :retained_until
    ])
  end
end
