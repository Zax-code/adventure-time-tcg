defmodule AdventureTimeApi.Repo.Migrations.AddStepSnapshots do
  use Ecto.Migration

  def change do
    create table(:step_snapshots, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)
      add(:source, :step_source, null: false)
      add(:step_count, :integer, null: false)
      add(:recorded_for, :date, null: false)

      timestamps(type: :utc_datetime)
    end

    create(index(:step_snapshots, [:user_id], name: :step_snapshots_user_id_idx))

    create(
      unique_index(:step_snapshots, [:user_id, :source, :recorded_for],
        name: :step_snapshots_user_id_source_recorded_for_key
      )
    )

    create(
      constraint(:step_snapshots, :step_snapshots_step_count_nonnegative,
        check: "step_count >= 0"
      )
    )
  end
end
