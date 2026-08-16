defmodule AdventureTimeApi.AccessAssessment.Evidence.PlayIntegrity do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key false

  embedded_schema do
    field(:app_recognition, Ecto.Enum,
      values: [:play_recognized, :unrecognized_version, :unevaluated]
    )

    field(:licensing, Ecto.Enum, values: [:licensed, :unlicensed, :unevaluated])
    field(:device_verdicts, {:array, :string}, default: [])
    field(:package_name_verified, :boolean)
    field(:certificate_verified, :boolean)
    field(:version_verified, :boolean)
    field(:request_hash_verified, :boolean)
    field(:token_timestamp, :utc_datetime)
    field(:verified_at, :utc_datetime)
  end

  def changeset(evidence, attrs) do
    evidence
    |> cast(attrs, __schema__(:fields))
    |> validate_required([:app_recognition, :licensing, :verified_at])
  end
end
