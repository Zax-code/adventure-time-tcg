defmodule AdventureTimeApi.Health.StepSnapshot do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "step_snapshots" do
    field(:source, Ecto.Enum, values: [:device_health, :fitbit])
    field(:step_count, :integer)
    field(:recorded_for, :date)

    belongs_to(:user, AdventureTimeApi.Accounts.User)

    timestamps(type: :utc_datetime)
  end

  def changeset(snapshot, attrs) do
    snapshot
    |> cast(attrs, [:user_id, :source, :step_count, :recorded_for])
    |> validate_required([:user_id, :source, :step_count, :recorded_for])
    |> validate_number(:step_count, greater_than_or_equal_to: 0)
    |> foreign_key_constraint(:user_id)
    |> unique_constraint([:user_id, :source, :recorded_for],
      name: :step_snapshots_user_id_source_recorded_for_key
    )
  end
end
