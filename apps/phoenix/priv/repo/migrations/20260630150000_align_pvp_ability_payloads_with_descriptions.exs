defmodule AdventureTimeApi.Repo.Migrations.AlignPvpAbilityPayloadsWithDescriptions do
  use Ecto.Migration

  def up do
    execute("""
    UPDATE ability_defs
    SET payload = jsonb_set(payload, '{applyStatuses,0,magnitude}', '3'::jsonb, true),
        updated_at = now()
    WHERE key = 'ash.butterflies'
    """)

    execute("""
    UPDATE ability_defs
    SET payload = jsonb_set(payload, '{applyStatuses,1,duration}', '2'::jsonb, false),
        updated_at = now()
    WHERE key = 'betty.azureSigil'
    """)

    execute("""
    UPDATE ability_defs
    SET payload = jsonb_set(payload, '{applyStatuses,0,duration}', '1'::jsonb, false),
        updated_at = now()
    WHERE key = 'betty.crownboundResolve'
    """)

    execute("""
    UPDATE ability_defs
    SET payload = jsonb_set(
          jsonb_set(payload, '{applyStatuses,0,duration}', '2'::jsonb, false),
          '{applyStatuses,1,duration}', '2'::jsonb, false
        ),
        updated_at = now()
    WHERE key = 'hunson.axeOfDamnation'
    """)

    execute("""
    UPDATE ability_defs
    SET payload = jsonb_set(payload, '{applyStatuses,2,duration}', '2'::jsonb, false),
        updated_at = now()
    WHERE key = 'marceline.nightConcert'
    """)

    execute("""
    UPDATE ability_defs
    SET payload = jsonb_set(payload, '{applyStatuses,0,duration}', '2'::jsonb, false),
        updated_at = now()
    WHERE key = 'orgalorg.bridgeSunder'
    """)

    execute("""
    UPDATE ability_defs
    SET payload = jsonb_set(payload, '{applyStatuses,0,duration}', '1'::jsonb, false),
        updated_at = now()
    WHERE key = 'orgalorg.worldshellRupture'
    """)
  end

  def down do
    execute("""
    UPDATE ability_defs
    SET payload = payload #- '{applyStatuses,0,magnitude}',
        updated_at = now()
    WHERE key = 'ash.butterflies'
    """)

    execute("""
    UPDATE ability_defs
    SET payload = jsonb_set(payload, '{applyStatuses,1,duration}', '1'::jsonb, false),
        updated_at = now()
    WHERE key = 'betty.azureSigil'
    """)

    execute("""
    UPDATE ability_defs
    SET payload = jsonb_set(payload, '{applyStatuses,0,duration}', '2'::jsonb, false),
        updated_at = now()
    WHERE key = 'betty.crownboundResolve'
    """)

    execute("""
    UPDATE ability_defs
    SET payload = jsonb_set(
          jsonb_set(payload, '{applyStatuses,0,duration}', '1'::jsonb, false),
          '{applyStatuses,1,duration}', '1'::jsonb, false
        ),
        updated_at = now()
    WHERE key = 'hunson.axeOfDamnation'
    """)

    execute("""
    UPDATE ability_defs
    SET payload = jsonb_set(payload, '{applyStatuses,2,duration}', '1'::jsonb, false),
        updated_at = now()
    WHERE key = 'marceline.nightConcert'
    """)

    execute("""
    UPDATE ability_defs
    SET payload = jsonb_set(payload, '{applyStatuses,0,duration}', '1'::jsonb, false),
        updated_at = now()
    WHERE key = 'orgalorg.bridgeSunder'
    """)

    execute("""
    UPDATE ability_defs
    SET payload = jsonb_set(payload, '{applyStatuses,0,duration}', '2'::jsonb, false),
        updated_at = now()
    WHERE key = 'orgalorg.worldshellRupture'
    """)
  end
end
