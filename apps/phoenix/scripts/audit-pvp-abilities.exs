defmodule AdventureTimeApi.PvpAbilityAudit do
  @moduledoc false

  import Ecto.Query

  alias AdventureTimeApi.Pvp.AbilityDef
  alias AdventureTimeApi.Repo

  @supported_top_level_payload_keys MapSet.new(~w(
    applyStatusChance
    applyStatuses
    applyStatusesToAttacker
    applyToAllyTypes
    belowHpThreshold
    burnBonusMul
    chance
    cleanse
    conditional
    cooldownTarget
    copyAbilitySource
    copyAbilityType
    damageMul
    damageReduction
    debuffImmunityCount
    executeDamageMul
    executeThreshold
    healLowestAllyPctOfDamage
    healLowestAllyPctOfMaxHp
    healPctOfDamage
    healPctOfMaxHp
    healPctOfMaxHpOnExecute
    healingBonus
    hitCountLimit
    hits
    ignoreDefensePct
    increaseCooldowns
    instantKoIfTargetBelowHpPct
    lifestealPct
    onBasicOnly
    once
    preventDeath
    randomDebuffs
    randomStatuses
    reduceCooldowns
    reflectDamagePct
    requiredAnyAllyTypes
    requiredStatus
    reviveAllyOnEnemyKoPct
    revivePct
    selfDamagePct
    shieldPctOfMaxHp
    shieldTarget
    splashPct
    statBonus
    statBonusDurationMode
    statBonusTarget
    stealBuffCount
    swapHpPercentages
    target
    targetSelector
    thresholdPct
    trigger
  ))

  @supported_triggers MapSet.new(~w(
    onActionStart
    onAllyFatalDamage
    onAllyKo
    onAnyKo
    onBattleInit
    onBelowHp
    onDamageDealt
    onDamageTaken
    onDealDamage
    onEnemyKo
    onHealAlly
    onStartTurn
    onStatusApplied
  ))

  def run do
    abilities =
      AbilityDef
      |> order_by([ability], asc: ability.key)
      |> Repo.all()
      |> Enum.map(&ability_to_map/1)

    unsupported = unsupported_payload_keys(abilities)
    unsupported_triggers = unsupported_triggers(abilities)
    findings = Enum.flat_map(abilities, &description_findings/1)

    IO.puts("# PvP Ability Audit")
    IO.puts("")
    IO.puts("Source: local database table `ability_defs` via Ecto.")
    IO.puts("Seed data is intentionally not read by this script.")
    IO.puts("Abilities checked: #{length(abilities)}")
    IO.puts("")

    print_unsupported_payload_keys(unsupported)
    print_unsupported_triggers(unsupported_triggers)
    print_description_findings(findings)

    if unsupported == [] and unsupported_triggers == [] do
      :ok
    else
      System.halt(1)
    end
  end

  defp ability_to_map(%AbilityDef{} = ability) do
    %{
      key: ability.key,
      name: ability.name,
      description: ability.description || "",
      payload: runtime_payload(ability.key, drop_nil_magnitude_keys(ability.payload || %{}))
    }
  end

  # Mirrors BattleEngine.normalize_live_ability_payload/1 so the audit checks
  # effects as players experience them, while still sourcing rows from the DB.
  defp runtime_payload("ash.memoryCurse", payload) do
    payload
    |> Map.put_new("increaseCooldowns", 1)
    |> Map.put_new("cooldownTarget", "enemy")
  end

  defp runtime_payload("betty.madnessEmbrace", payload) do
    payload
    |> Map.put_new("reduceCooldowns", 1)
    |> Map.put("cooldownTarget", "allEnemies")
  end

  defp runtime_payload("fern.thornyskin", payload) do
    %{
      "trigger" => "onDamageTaken",
      "chance" => Map.get(payload, "chance", 0.5),
      "reflectDamagePct" => 0.15,
      "target" => "enemy"
    }
  end

  defp runtime_payload("fire.infernoRift", payload), do: Map.put_new(payload, "burnBonusMul", 0.3)

  defp runtime_payload("fire.emberCore", payload) do
    payload
    |> Map.put("target", "self")
    |> Map.put("requiredStatus", "Burn")
  end

  defp runtime_payload("flame king.burningwrath", payload) do
    payload
    |> Map.put(
      "applyStatuses",
      payload
      |> Map.get("applyStatuses", [])
      |> Enum.reject(&(&1["name"] == "Empower"))
    )
    |> Map.put("conditional", [
      %{
        "when" => %{"targetHas" => "Burn"},
        "addApplyStatuses" => [%{"name" => "Empower", "duration" => 2, "target" => "self"}]
      }
    ])
  end

  defp runtime_payload("flame king.firekingdom", payload) do
    Map.put(payload, "conditional", [
      %{
        "when" => %{"targetHas" => "Burn"},
        "damageMulDelta" => 0.4,
        "mergePayload" => %{"splashPct" => 1 / 3}
      }
    ])
  end

  defp runtime_payload("jakerainicorn.rainbowStretch", payload) do
    Map.put(payload, "healLowestAllyPctOfDamage", 0.2)
  end

  defp runtime_payload("jakerainicorn.familyUnite", payload) do
    Map.put(payload, "healPctOfMaxHp", 0.25)
  end

  defp runtime_payload("finnjake.brotherBond", payload),
    do: Map.put(payload, "trigger", "onBattleInit")

  defp runtime_payload("keeoth.bloodBond", payload), do: Map.put(payload, "target", "self")

  defp runtime_payload("kingooo.scamScheme", payload),
    do: Map.put_new(payload, "stealBuffCount", 1)

  defp runtime_payload("magicman.jerkMagic", payload) do
    payload
    |> Map.put_new("stealBuffCount", 1)
    |> Map.put("target", "enemy")
  end

  defp runtime_payload("marshall.nightmareKing", payload),
    do: Map.put(payload, "target", "target")

  defp runtime_payload("lsp.lumpyPower", payload) do
    payload
    |> Map.put("target", "allUnits")
    |> Map.put("cleanse", %{"count" => 99, "target" => "allUnits", "includeBuffs" => true})
  end

  defp runtime_payload("pb.scientificRegent", payload) do
    payload
    |> Map.put_new("requiredAnyAllyTypes", ["Tech", "Royalty"])
    |> Map.put_new("statBonusTarget", "allAllies")
  end

  defp runtime_payload(_key, payload), do: drop_nil_magnitude_keys(payload)

  defp drop_nil_magnitude_keys(value) when is_list(value) do
    Enum.map(value, &drop_nil_magnitude_keys/1)
  end

  defp drop_nil_magnitude_keys(value) when is_map(value) do
    value
    |> Enum.flat_map(fn
      {"magnitude", nil} -> []
      {key, nested} -> [{key, drop_nil_magnitude_keys(nested)}]
    end)
    |> Map.new()
  end

  defp drop_nil_magnitude_keys(value), do: value

  defp unsupported_payload_keys(abilities) do
    abilities
    |> Enum.flat_map(fn %{key: ability_key, payload: payload} ->
      payload
      |> Map.keys()
      |> Enum.reject(&MapSet.member?(@supported_top_level_payload_keys, &1))
      |> Enum.map(&{ability_key, &1})
    end)
    |> Enum.sort()
  end

  defp unsupported_triggers(abilities) do
    abilities
    |> Enum.flat_map(fn %{key: ability_key, payload: payload} ->
      case payload["trigger"] do
        trigger when is_binary(trigger) ->
          if MapSet.member?(@supported_triggers, trigger), do: [], else: [{ability_key, trigger}]

        _ ->
          []
      end
    end)
    |> Enum.sort()
  end

  defp description_findings(%{description: description} = ability) do
    status_duration_findings(ability, description) ++
      status_stack_findings(ability, description)
  end

  defp status_duration_findings(%{payload: payload} = ability, description) do
    payload
    |> status_specs()
    |> Enum.flat_map(fn spec ->
      status = spec["name"]
      duration = spec["duration"]
      described_durations = described_turn_durations(description, status)

      cond do
        not is_binary(status) or not is_integer(duration) ->
          []

        described_durations == [] ->
          []

        duration in described_durations ->
          []

        true ->
          [
            finding(
              ability,
              "duration-mismatch",
              "#{status} payload duration #{duration}, description says #{Enum.join(described_durations, " or ")} turns"
            )
          ]
      end
    end)
  end

  defp status_stack_findings(%{payload: payload} = ability, description) do
    payload
    |> status_specs()
    |> Enum.flat_map(fn spec ->
      status = spec["name"]
      magnitude = spec["magnitude"]
      described_stacks = described_stack_count(description, status)

      cond do
        not is_binary(status) ->
          []

        is_nil(described_stacks) ->
          []

        described_stacks == (magnitude || 1) ->
          []

        true ->
          [
            finding(
              ability,
              "stack-mismatch",
              "#{status} payload stacks #{magnitude || 1}, description says #{described_stacks} stacks"
            )
          ]
      end
    end)
  end

  defp status_specs(payload) when is_map(payload) do
    []
    |> Kernel.++(Map.get(payload, "applyStatuses", []))
    |> Kernel.++(Map.get(payload, "applyStatusesToAttacker", []))
    |> Kernel.++(Map.get(payload, "randomDebuffs", []))
    |> Kernel.++(Map.get(payload, "randomStatuses", []))
    |> Kernel.++(conditional_status_specs(payload))
    |> Enum.filter(&is_map/1)
  end

  defp status_specs(_payload), do: []

  defp conditional_status_specs(payload) do
    payload
    |> Map.get("conditional", [])
    |> Enum.flat_map(fn
      %{"addApplyStatuses" => specs} when is_list(specs) -> specs
      _ -> []
    end)
  end

  defp described_turn_durations(description, status) do
    description = description || ""
    status_pattern = Regex.escape(status)

    description
    |> then(&Regex.split(~r/[.;]/, &1))
    |> Enum.flat_map(fn clause ->
      Regex.scan(~r/#{status_pattern}(?<between>.{0,80}?)\bfor\s+(\d+)\s*turns?/i, clause)
    end)
    |> Enum.reject(fn [_match, between, _duration] ->
      Regex.match?(~r/\b(gain|grant|apply|then|self)\b/i, between)
    end)
    |> Enum.map(fn [_match, _between, duration] -> String.to_integer(duration) end)
    |> Enum.uniq()
  end

  defp described_stack_count(description, status) do
    description = description || ""
    status_pattern = Regex.escape(status)

    [
      ~r/#{status_pattern}\s*(?:\(|:)?\s*(\d+)\s*stacks?/i,
      ~r/(\d+)\s*stacks?\s+of\s+#{status_pattern}/i
    ]
    |> Enum.find_value(&capture_int(&1, description))
  end

  defp capture_int(regex, text) do
    case Regex.run(regex, text) do
      [_, value] -> String.to_integer(value)
      _ -> nil
    end
  end

  defp finding(ability, kind, detail) do
    %{
      ability_key: ability.key,
      ability_name: ability.name,
      kind: kind,
      detail: detail,
      description: ability.description
    }
  end

  defp print_unsupported_payload_keys([]) do
    IO.puts("## Unsupported Payload Keys")
    IO.puts("")
    IO.puts("None.")
    IO.puts("")
  end

  defp print_unsupported_payload_keys(unsupported) do
    IO.puts("## Unsupported Payload Keys")
    IO.puts("")

    Enum.each(unsupported, fn {ability_key, payload_key} ->
      IO.puts("- #{ability_key}: #{payload_key}")
    end)

    IO.puts("")
  end

  defp print_unsupported_triggers([]) do
    IO.puts("## Unsupported Passive Triggers")
    IO.puts("")
    IO.puts("None.")
    IO.puts("")
  end

  defp print_unsupported_triggers(unsupported_triggers) do
    IO.puts("## Unsupported Passive Triggers")
    IO.puts("")

    Enum.each(unsupported_triggers, fn {ability_key, trigger} ->
      IO.puts("- #{ability_key}: #{trigger}")
    end)

    IO.puts("")
  end

  defp print_description_findings([]) do
    IO.puts("## Description Findings")
    IO.puts("")
    IO.puts("None.")
    IO.puts("")
  end

  defp print_description_findings(findings) do
    IO.puts("## Description Findings")
    IO.puts("")

    findings
    |> Enum.sort_by(&{&1.ability_key, &1.kind, &1.detail})
    |> Enum.each(fn finding ->
      IO.puts("- #{finding.ability_key} (#{finding.ability_name})")
      IO.puts("  - #{finding.kind}: #{finding.detail}")
      IO.puts("  - description: #{finding.description}")
    end)

    IO.puts("")
  end
end

AdventureTimeApi.PvpAbilityAudit.run()
