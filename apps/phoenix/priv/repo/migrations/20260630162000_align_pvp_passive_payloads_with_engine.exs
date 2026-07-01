defmodule AdventureTimeApi.Repo.Migrations.AlignPvpPassivePayloadsWithEngine do
  use Ecto.Migration

  def up do
    execute("""
    UPDATE ability_defs
    SET payload = jsonb_set(payload, '{trigger}', '"onBattleInit"'::jsonb, false),
        updated_at = now()
    WHERE key = 'finnjake.brotherBond'
    """)

    execute("""
    UPDATE ability_defs
    SET payload = jsonb_set(payload, '{target}', '"self"'::jsonb, false),
        updated_at = now()
    WHERE key = 'keeoth.bloodBond'
    """)

    execute("""
    UPDATE ability_defs
    SET payload = jsonb_set(
          jsonb_set(payload, '{stealBuffCount}', '1'::jsonb, true),
          '{target}', '"enemy"'::jsonb, false
        ),
        updated_at = now()
    WHERE key = 'magicman.jerkMagic'
    """)

    execute("""
    UPDATE ability_defs
    SET payload = jsonb_set(payload, '{target}', '"target"'::jsonb, false),
        updated_at = now()
    WHERE key = 'marshall.nightmareKing'
    """)
  end

  def down do
    execute("""
    UPDATE ability_defs
    SET payload = jsonb_set(payload, '{trigger}', '"onBattleStart"'::jsonb, false),
        updated_at = now()
    WHERE key = 'finnjake.brotherBond'
    """)

    execute("""
    UPDATE ability_defs
    SET payload = jsonb_set(payload, '{target}', '"ally"'::jsonb, false),
        updated_at = now()
    WHERE key = 'keeoth.bloodBond'
    """)

    execute("""
    UPDATE ability_defs
    SET payload = jsonb_set(payload #- '{stealBuffCount}', '{target}', '"self"'::jsonb, false),
        updated_at = now()
    WHERE key = 'magicman.jerkMagic'
    """)

    execute("""
    UPDATE ability_defs
    SET payload = jsonb_set(payload, '{target}', '"self"'::jsonb, false),
        updated_at = now()
    WHERE key = 'marshall.nightmareKing'
    """)
  end
end
