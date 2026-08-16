defmodule AdventureTimeApi.AccessAssessment.Evidence.NetworkFacts do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key false

  embedded_schema do
    field(:test_lab, Ecto.Enum, values: [:matched, :not_matched, :unknown])
    field(:google_network, Ecto.Enum, values: [:matched, :not_matched, :unknown])
    field(:test_lab_matched_cidr, :string)
    field(:google_network_matched_cidr, :string)
    field(:test_lab_range_version, :string)
    field(:google_network_range_version, :string)
    field(:test_lab_range_stale, :boolean)
    field(:google_network_range_stale, :boolean)
  end

  def changeset(facts, attrs) do
    facts
    |> cast(attrs, [
      :test_lab,
      :google_network,
      :test_lab_matched_cidr,
      :google_network_matched_cidr,
      :test_lab_range_version,
      :google_network_range_version,
      :test_lab_range_stale,
      :google_network_range_stale
    ])
    |> validate_required([:test_lab, :google_network])
  end
end
