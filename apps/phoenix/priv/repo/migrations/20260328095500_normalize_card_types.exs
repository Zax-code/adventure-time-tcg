defmodule AdventureTimeApi.Repo.Migrations.NormalizeCardTypes do
  use Ecto.Migration

  @canonical_types [
    "Hero",
    "Tech",
    "Royalty",
    "Candy",
    "Undead",
    "Ice",
    "Fire",
    "Magic",
    "Demon",
    "Cosmic"
  ]

  def up do
    execute("""
    UPDATE cards
    SET type = CASE
      WHEN lower(type) = 'hero' THEN 'Hero'
      WHEN lower(type) = 'tech' THEN 'Tech'
      WHEN lower(type) = 'royalty' THEN 'Royalty'
      WHEN lower(type) = 'candy' THEN 'Candy'
      WHEN lower(type) = 'undead' THEN 'Undead'
      WHEN lower(type) = 'ice' THEN 'Ice'
      WHEN lower(type) = 'fire' THEN 'Fire'
      WHEN lower(type) = 'magic' THEN 'Magic'
      WHEN lower(type) = 'demon' THEN 'Demon'
      WHEN lower(type) = 'cosmic' THEN 'Cosmic'
      WHEN upper(type) = 'ALLY' THEN 'Hero'
      WHEN upper(type) = 'MAGE' THEN 'Magic'
      WHEN upper(type) = 'ROGUE' THEN 'Undead'
      ELSE 'Hero'
    END
    """)

    create(
      constraint(:cards, :cards_type_allowed,
        check: "type IN ('#{Enum.join(@canonical_types, "', '")}')"
      )
    )
  end

  def down do
    drop(constraint(:cards, :cards_type_allowed))
  end
end
