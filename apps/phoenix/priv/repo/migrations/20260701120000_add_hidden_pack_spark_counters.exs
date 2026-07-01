defmodule AdventureTimeApi.Repo.Migrations.AddHiddenPackSparkCounters do
  use Ecto.Migration

  def up do
    alter table(:users) do
      add(:pack_epic_spark_counter, :integer, null: false, default: 0)
      add(:pack_legendary_spark_counter, :integer, null: false, default: 0)
    end

    create(
      constraint(:users, :users_pack_epic_spark_counter_nonnegative,
        check: "pack_epic_spark_counter >= 0"
      )
    )

    create(
      constraint(:users, :users_pack_legendary_spark_counter_nonnegative,
        check: "pack_legendary_spark_counter >= 0"
      )
    )

    execute("""
    UPDATE rarities
    SET drop_rate = CASE name
      WHEN 'Common' THEN 52.0
      WHEN 'Uncommon' THEN 28.0
      WHEN 'Rare' THEN 15.0
      WHEN 'Epic' THEN 4.0
      WHEN 'Legendary' THEN 1.0
      ELSE drop_rate
    END
    WHERE name IN ('Common', 'Uncommon', 'Rare', 'Epic', 'Legendary')
    """)
  end

  def down do
    execute("""
    UPDATE rarities
    SET drop_rate = CASE name
      WHEN 'Common' THEN 60.0
      WHEN 'Uncommon' THEN 25.0
      WHEN 'Rare' THEN 10.0
      WHEN 'Epic' THEN 1.0
      WHEN 'Legendary' THEN 0.1
      ELSE drop_rate
    END
    WHERE name IN ('Common', 'Uncommon', 'Rare', 'Epic', 'Legendary')
    """)

    drop(constraint(:users, :users_pack_legendary_spark_counter_nonnegative))
    drop(constraint(:users, :users_pack_epic_spark_counter_nonnegative))

    alter table(:users) do
      remove(:pack_legendary_spark_counter)
      remove(:pack_epic_spark_counter)
    end
  end
end
