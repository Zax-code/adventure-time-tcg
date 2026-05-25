defmodule AdventureTimeApi.Repo.Migrations.AddAbilityTables do
  use Ecto.Migration

  def change do
    create table(:ability_defs, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :key, :string, null: false
      add :name, :string, null: false
      add :name_fr, :string
      add :description, :string, null: false
      add :description_fr, :string
      add :type, :string, null: false
      add :cost, :integer, null: false, default: 0
      add :cooldown, :integer
      add :once_per_match, :boolean, null: false, default: false
      add :payload, :map, null: false

      timestamps()
    end

    create unique_index(:ability_defs, [:key])

    create constraint(:ability_defs, :ability_defs_valid_type,
             check: "type IN ('PASSIVE', 'SKILL', 'ULTIMATE')"
           )

    create table(:card_abilities, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :card_id, references(:cards, type: :binary_id, on_delete: :delete_all), null: false
      add :passive_id, references(:ability_defs, type: :binary_id, on_delete: :nilify_all)
      add :skill_id, references(:ability_defs, type: :binary_id, on_delete: :nilify_all)
      add :ultimate_id, references(:ability_defs, type: :binary_id, on_delete: :nilify_all)

      timestamps()
    end

    create unique_index(:card_abilities, [:card_id])
    create index(:card_abilities, [:skill_id])
    create index(:card_abilities, [:ultimate_id])
  end
end
