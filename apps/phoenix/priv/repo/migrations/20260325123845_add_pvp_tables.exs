defmodule AdventureTimeApi.Repo.Migrations.AddPvpTables do
  use Ecto.Migration

  def change do
    create table(:pvp_loadouts, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :owner_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false
      add :name, :string, null: false
      add :card_ids, {:array, :string}, null: false

      timestamps()
    end

    create index(:pvp_loadouts, [:owner_id])

    create table(:pvp_matches, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :inviter_id, references(:users, type: :binary_id, on_delete: :restrict), null: false
      add :invitee_id, references(:users, type: :binary_id, on_delete: :restrict), null: false
      add :status, :string, null: false, default: "pending"
      add :inviter_card_ids, {:array, :string}, null: false
      add :invitee_card_ids, {:array, :string}
      add :winner_id, :binary_id
      add :seed, :string
      add :state, :map
      add :initial_state, :map
      add :current_turn, :integer, null: false, default: 0
      add :turn_started_at, :utc_datetime

      timestamps()
    end

    create index(:pvp_matches, [:inviter_id])
    create index(:pvp_matches, [:invitee_id])
    create index(:pvp_matches, [:status])

    create constraint(:pvp_matches, :pvp_matches_status_valid,
             check: "status IN ('pending', 'in_progress', 'completed', 'declined')"
           )
  end
end
