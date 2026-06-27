defmodule AdventureTimeApi.Repo.Migrations.AddPackOpeningsAndRebalanceEconomy do
  use Ecto.Migration

  def change do
    create table(:pack_openings, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)
      add(:pack_id, references(:packs, type: :binary_id, on_delete: :restrict), null: false)
      add(:pack_name, :string, null: false)
      add(:opened_at, :utc_datetime, null: false)

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(index(:pack_openings, [:user_id], name: :pack_openings_user_id_idx))
    create(index(:pack_openings, [:pack_id], name: :pack_openings_pack_id_idx))
    create(index(:pack_openings, [:opened_at], name: :pack_openings_opened_at_idx))

    create(
      index(:pack_openings, [:user_id, :pack_id, :opened_at],
        name: :pack_openings_user_pack_opened_at_idx
      )
    )

    execute("""
    UPDATE packs
    SET card_count = CASE name
        WHEN 'Basic Pack' THEN 2
        WHEN 'Standard Pack' THEN 5
        WHEN 'Premium Pack' THEN 5
        WHEN 'Epic Pack' THEN 6
        WHEN 'Legendary Pack' THEN 7
        ELSE card_count
      END,
      cost = CASE name
        WHEN 'Basic Pack' THEN 150
        WHEN 'Standard Pack' THEN 400
        WHEN 'Premium Pack' THEN 900
        WHEN 'Epic Pack' THEN 2200
        WHEN 'Legendary Pack' THEN 4500
        ELSE cost
      END,
      guaranteed_rarity = CASE name
        WHEN 'Basic Pack' THEN NULL
        WHEN 'Standard Pack' THEN 'Uncommon'
        WHEN 'Premium Pack' THEN 'Rare'
        WHEN 'Epic Pack' THEN 'Epic'
        WHEN 'Legendary Pack' THEN 'Legendary'
        ELSE guaranteed_rarity
      END,
      description = CASE name
        WHEN 'Basic Pack' THEN '2 cards with standard drop rates. The cheapest way to keep opening.'
        WHEN 'Standard Pack' THEN '5 cards with at least 1 guaranteed Uncommon.'
        WHEN 'Premium Pack' THEN '5 cards with 1 guaranteed Rare.'
        WHEN 'Epic Pack' THEN '6 cards with 1 guaranteed Epic.'
        WHEN 'Legendary Pack' THEN '7 cards with at least 1 guaranteed Legendary. Limited to one opening per week.'
        ELSE description
      END
    WHERE name IN ('Basic Pack', 'Standard Pack', 'Premium Pack', 'Epic Pack', 'Legendary Pack')
    """)

    execute("""
    UPDATE daily_quests
    SET reward = CASE quest_type
      WHEN 'steps_10k' THEN 75
      WHEN 'wordle_daily_fr' THEN 35
      WHEN 'wordle_daily_en' THEN 35
      WHEN 'daily_numbers_1_5' THEN 45
      WHEN 'daily_numbers_2_4' THEN 60
      WHEN 'daily_numbers_3_3' THEN 75
      ELSE reward
    END
    WHERE claimed = false
      AND quest_type IN (
        'steps_10k',
        'wordle_daily_fr',
        'wordle_daily_en',
        'daily_numbers_1_5',
        'daily_numbers_2_4',
        'daily_numbers_3_3'
      )
    """)
  end
end
