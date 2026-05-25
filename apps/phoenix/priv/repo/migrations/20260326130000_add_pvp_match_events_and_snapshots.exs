defmodule AdventureTimeApi.Repo.Migrations.AddPvpMatchEventsAndSnapshots do
  use Ecto.Migration

  def change do
    create table(:pvp_match_events, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(:match_id, references(:pvp_matches, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:seq, :integer, null: false)
      add(:turn, :integer, null: false)
      add(:type, :string, null: false)
      add(:payload, :map, null: false)

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(
      unique_index(:pvp_match_events, [:match_id, :seq], name: :pvp_match_events_match_id_seq_idx)
    )

    create(
      index(:pvp_match_events, [:match_id, :turn], name: :pvp_match_events_match_id_turn_idx)
    )

    create(
      index(:pvp_match_events, [:match_id, :inserted_at],
        name: :pvp_match_events_match_id_inserted_at_idx
      )
    )

    create(constraint(:pvp_match_events, :pvp_match_events_seq_nonnegative, check: "seq >= 0"))

    create(constraint(:pvp_match_events, :pvp_match_events_turn_nonnegative, check: "turn >= 0"))

    create table(:pvp_match_snapshots, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(:match_id, references(:pvp_matches, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:seq_at, :integer, null: false)
      add(:turn_at, :integer, null: false)
      add(:state, :map, null: false)

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(
      unique_index(:pvp_match_snapshots, [:match_id, :seq_at],
        name: :pvp_match_snapshots_match_id_seq_at_idx
      )
    )

    create(
      index(:pvp_match_snapshots, [:match_id, :turn_at],
        name: :pvp_match_snapshots_match_id_turn_at_idx
      )
    )

    create(
      index(:pvp_match_snapshots, [:match_id, :inserted_at],
        name: :pvp_match_snapshots_match_id_inserted_at_idx
      )
    )

    create(
      constraint(:pvp_match_snapshots, :pvp_match_snapshots_seq_at_nonnegative,
        check: "seq_at >= 0"
      )
    )

    create(
      constraint(:pvp_match_snapshots, :pvp_match_snapshots_turn_at_nonnegative,
        check: "turn_at >= 0"
      )
    )
  end
end
