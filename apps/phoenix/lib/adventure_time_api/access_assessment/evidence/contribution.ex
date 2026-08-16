defmodule AdventureTimeApi.AccessAssessment.Evidence.Contribution do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key false

  embedded_schema do
    field(:key, Ecto.Enum,
      values: [:play_integrity, :identity, :continuity, :client, :ip_intelligence]
    )

    field(:weight, :integer)
    field(:value, :integer)
    field(:effect_from_neutral, :float)
    field(:reason_codes, {:array, :string}, default: [])
    field(:explanations, {:array, :string}, default: [])
    field(:observed_at, :utc_datetime)
    field(:hard_failure, :boolean, default: false)
    field(:model_version, :string)
  end

  def changeset(contribution, attrs) do
    contribution
    |> cast(attrs, __schema__(:fields))
    |> validate_required([:key, :weight, :value, :model_version])
    |> validate_number(:weight, greater_than: 0, less_than_or_equal_to: 100)
    |> validate_number(:value, greater_than_or_equal_to: 0, less_than_or_equal_to: 100)
  end
end
