defmodule AdventureTimeApi.Pvp.BattleEngine do
  @moduledoc """
  Pure battle engine for PvP combat. No DB access — takes data in, returns data out.

  v4 scope: full status effects system (all 22 types), stat modifiers, action guards,
  per-turn DoT/heal ticks, Shield absorption, Thorns/Counter retaliation, Cover/Taunt targeting.
  Full ability payload dispatch: damageMul, hits, ignoreDefensePct, burnBonusMul,
  executeDamageMul+executeThreshold, healPctOfDamage, healPctOfMaxHpOnExecute, splashPct,
  healPctOfMaxHp, applyStatuses+applyStatusChance, applyStatusesToAttacker,
  shieldTarget+shieldPctOfMaxHp, randomDebuffs/randomStatuses, healLowestAllyPctOfMaxHp,
  revivePct, cleanse, stealBuffCount, swapHpPercentages, reduceCooldowns, preventDeath.
  Copy action and passive triggers implemented.
  """

  import Bitwise

  alias AdventureTimeApi.Catalog.CardType

  # ── RNG (mulberry32 — exact port of TypeScript SeededRng) ──────────────────

  @mask32 0xFFFFFFFF

  defp hash_seed_to_int(seed) do
    seed
    |> String.to_charlist()
    |> Enum.reduce(0, fn char, h ->
      # Java-style: (31 * h + char) | 0, but we use band to stay 32-bit signed
      # Math.imul(31, h) is just 31 * h truncated to 32-bit
      band(31 * h + char, @mask32)
    end)
  end

  # mulberry32 step
  defp mulberry32_step(a) do
    a1 = band(a + 0x6D2B79F5, @mask32)
    t0 = bxor(a1, a1 >>> 15)
    t1 = band(t0 * bor(1, a1), @mask32)
    t2 = band(t1 + band(t1 * bor(61, t1), @mask32), @mask32)
    result = bxor(t2, t2 >>> 14) >>> 0
    {result / 4_294_967_296.0, a1}
  end

  # Advance seed n steps, return final state
  defp rng_advance(seed, 0), do: seed

  defp rng_advance(seed, n) do
    {_, next} = mulberry32_step(seed)
    rng_advance(next, n - 1)
  end

  # Build RNG state from string seed + optional start index
  defp make_rng(seed_str, start_index \\ 0) do
    int_seed = hash_seed_to_int(seed_str)
    {rng_advance(int_seed, start_index), start_index}
  end

  # Get next float [0, 1) from RNG, returns {value, {new_state, new_index}}
  defp rng_next({state, index}) do
    {value, new_state} = mulberry32_step(state)
    {value, {new_state, index + 1}}
  end

  defp rng_next_bool({state, index}, probability \\ 0.5) do
    {value, rng} = rng_next({state, index})
    {value < probability, rng}
  end

  # ── Speed ─────────────────────────────────────────────────────────────────

  @speed_overrides %{
    "Finn" => 55,
    "Jake" => 45,
    "Princess Bubblegum" => 40,
    "Bubblegum" => 40,
    "Ice King" => 38,
    "Flame Princess" => 50,
    "Flame King" => 50,
    "The Lich" => 48,
    "Lich" => 48,
    "Huntress Wizard" => 52,
    "Prismo" => 46,
    "BMO" => 35,
    "Gumball Guardian" => 30,
    "Guardian" => 30,
    "Marceline" => 52,
    "Marshall Lee" => 52
  }

  defp derive_speed(attack, defense) do
    derived = round((attack + defense) / 4 + 30)
    min(80, max(20, derived))
  end

  defp get_card_speed(name, character, attack, defense, db_speed) do
    if db_speed && db_speed > 0 do
      db_speed
    else
      override =
        @speed_overrides
        |> Enum.find(fn {key, _} ->
          String.contains?(name, key) || String.contains?(character, key)
        end)

      case override do
        {_, speed} -> speed
        nil -> derive_speed(attack, defense)
      end
    end
  end

  defp calculate_initiative(speeds) when speeds == [], do: 0

  defp calculate_initiative(speeds) do
    round(Enum.sum(speeds) / length(speeds))
  end

  # ── Rarity Bonuses ────────────────────────────────────────────────────────

  @rarity_bonuses %{
    "Common" => %{hp: 0.00, attack: 0.00},
    "Uncommon" => %{hp: 0.02, attack: 0.00},
    "Rare" => %{hp: 0.02, attack: 0.01},
    "Epic" => %{hp: 0.04, attack: 0.02},
    "Legendary" => %{hp: 0.05, attack: 0.03}
  }

  defp apply_rarity_bonuses(hp, attack, defense, rarity) do
    mods = Map.get(@rarity_bonuses, rarity, @rarity_bonuses["Common"])

    %{
      hp: floor(hp * (1 + mods.hp)),
      attack: floor(attack * (1 + mods.attack)),
      defense: defense
    }
  end

  # ── Status Definitions ────────────────────────────────────────────────────
  # is_buff / is_debuff: for cap enforcement (max 3 each per unit)
  # ticks: true = duration decrements at start of owning player's turn; false = event-consumed
  # stackable: false | :magnitude (Shield) | :count (Poison)

  @status_defs %{
    "Burn" => %{is_buff: false, is_debuff: true, ticks: true, stackable: false},
    "Shield" => %{is_buff: true, is_debuff: false, ticks: false, stackable: :magnitude},
    "GuardUp" => %{is_buff: true, is_debuff: false, ticks: true, stackable: false},
    "Regeneration" => %{is_buff: true, is_debuff: false, ticks: true, stackable: false},
    "Regen" => %{is_buff: true, is_debuff: false, ticks: true, stackable: false},
    "Vulnerable" => %{is_buff: false, is_debuff: true, ticks: true, stackable: false},
    "Weakened" => %{is_buff: false, is_debuff: true, ticks: true, stackable: false},
    "Haste" => %{is_buff: true, is_debuff: false, ticks: true, stackable: false},
    "Taunt" => %{is_buff: false, is_debuff: false, ticks: true, stackable: false},
    "Silence" => %{is_buff: false, is_debuff: true, ticks: true, stackable: false},
    "SummoningSickness" => %{is_buff: false, is_debuff: false, ticks: true, stackable: false},
    "Stunned" => %{is_buff: false, is_debuff: true, ticks: false, stackable: false},
    "Cover" => %{is_buff: true, is_debuff: false, ticks: false, stackable: false},
    "Poison" => %{is_buff: false, is_debuff: true, ticks: true, stackable: :count},
    "Thorns" => %{is_buff: true, is_debuff: false, ticks: true, stackable: false},
    "Stealth" => %{is_buff: true, is_debuff: false, ticks: true, stackable: false},
    "Empower" => %{is_buff: true, is_debuff: false, ticks: false, stackable: false},
    "Counter" => %{is_buff: true, is_debuff: false, ticks: true, stackable: false},
    "Mark" => %{is_buff: false, is_debuff: true, ticks: true, stackable: false},
    "Barrier" => %{is_buff: true, is_debuff: false, ticks: true, stackable: false},
    "Doom" => %{is_buff: false, is_debuff: true, ticks: true, stackable: false},
    "Freeze" => %{is_buff: false, is_debuff: true, ticks: false, stackable: false}
  }

  # ── Type Chart ────────────────────────────────────────────────────────────
  # Ported from typeChart.ts — 1.25 effective, 0.8 not very effective
  @type_chart %{
    "Hero" => %{"Undead" => 1.25, "Ice" => 0.8},
    "Tech" => %{"Fire" => 1.25, "Cosmic" => 0.8},
    "Royalty" => %{"Demon" => 1.25, "Magic" => 0.8},
    "Candy" => %{"Hero" => 1.25, "Tech" => 0.8},
    "Undead" => %{"Magic" => 1.25, "Hero" => 0.8},
    "Ice" => %{"Fire" => 1.25, "Undead" => 0.8},
    "Fire" => %{"Ice" => 1.25, "Tech" => 0.8},
    "Magic" => %{"Royalty" => 1.25, "Undead" => 0.8},
    "Demon" => %{"Hero" => 1.25, "Royalty" => 0.8},
    "Cosmic" => %{"Demon" => 1.25, "Candy" => 0.8}
  }

  defp type_multiplier(attacker_type, target_type) do
    @type_chart
    |> Map.get(attacker_type, %{})
    |> Map.get(target_type, 1.0)
  end

  # ── Status Effects ────────────────────────────────────────────────────────

  defp has_status(unit, name), do: Enum.any?(unit["statuses"] || [], &(&1["name"] == name))

  defp get_status(unit, name), do: Enum.find(unit["statuses"] || [], &(&1["name"] == name))

  defp status_is_buff?(name) do
    case Map.get(@status_defs, name) do
      %{is_buff: true} -> true
      _ -> false
    end
  end

  defp status_is_debuff?(name) do
    case Map.get(@status_defs, name) do
      %{is_debuff: true} -> true
      _ -> false
    end
  end

  # Apply a status to a unit. Returns {state, [events]}.
  # opts: [magnitude: integer | nil, source_instance_id: string | nil]
  defp apply_status(state, unit_id, name, duration, opts \\ []) do
    magnitude = Keyword.get(opts, :magnitude)
    source_id = Keyword.get(opts, :source_instance_id)
    trigger_passives = Keyword.get(opts, :trigger_passives, true)

    case find_unit_across_players(state, unit_id) do
      {:error, _} ->
        {state, []}

      {:ok, unit} ->
        case Map.get(@status_defs, name) do
          nil ->
            {state, []}

          def_ ->
            if def_.is_debuff and has_status(unit, "Barrier") do
              # Barrier absorbs the debuff
              barrier_event =
                new_event(state, "statusExpire", %{
                  "targetId" => unit_id,
                  "unitId" => unit_id,
                  "statusName" => "Barrier",
                  "status" => "Barrier",
                  "consumed" => true
                })

              state =
                update_unit(state, unit_id, fn u ->
                  remove_status_from_unit(u, "Barrier")
                end)

              state = append_log(state, [barrier_event])

              state =
                if trigger_passives do
                  check_passives(state, "onStatusApplied", %{
                    "unitId" => unit_id,
                    "status" => name,
                    "sourceInstanceId" => source_id
                  })
                else
                  state
                end

              {[barrier_event], state}
              |> then(fn {events, new_state} -> {new_state, events} end)
            else
              do_apply_status(
                state,
                unit_id,
                unit,
                name,
                duration,
                magnitude,
                source_id,
                trigger_passives,
                def_
              )
            end
        end
    end
  end

  defp do_apply_status(
         state,
         unit_id,
         unit,
         name,
         duration,
         magnitude,
         source_id,
         trigger_passives,
         def_
       ) do
    existing = get_status(unit, name)
    current_turn = state["turn"]

    cond do
      # Shield: stack magnitude
      existing != nil and def_.stackable == :magnitude ->
        new_mag = (existing["magnitude"] || 0) + (magnitude || 0)

        event =
          new_event(state, "statusApply", %{
            "targetId" => unit_id,
            "unitId" => unit_id,
            "statusName" => name,
            "status" => name,
            "magnitude" => new_mag,
            "stacked" => true
          })

        state =
          update_unit(state, unit_id, fn u ->
            new_statuses =
              Enum.map(u["statuses"] || [], fn s ->
                if s["name"] == name, do: Map.put(s, "magnitude", new_mag), else: s
              end)

            Map.put(u, "statuses", new_statuses)
          end)

        state = append_log(state, [event])

        state =
          maybe_trigger_status_applied_passives(state, trigger_passives, unit_id, name, source_id)

        {state, [event]}

      # Poison: stack count
      existing != nil and def_.stackable == :count ->
        new_count = (existing["magnitude"] || 1) + 1
        new_dur = max(existing["duration"] || duration, duration)

        event =
          new_event(state, "statusApply", %{
            "targetId" => unit_id,
            "unitId" => unit_id,
            "statusName" => name,
            "status" => name,
            "stacks" => new_count,
            "stacked" => true
          })

        state =
          update_unit(state, unit_id, fn u ->
            new_statuses =
              Enum.map(u["statuses"] || [], fn s ->
                if s["name"] == name,
                  do:
                    s
                    |> Map.put("magnitude", new_count)
                    |> Map.put("duration", new_dur)
                    |> Map.put("appliedAt", current_turn),
                  else: s
              end)

            Map.put(u, "statuses", new_statuses)
          end)

        state = append_log(state, [event])

        state =
          maybe_trigger_status_applied_passives(state, trigger_passives, unit_id, name, source_id)

        {state, [event]}

      # Non-stackable but already exists: refresh duration
      existing != nil ->
        new_dur = max(existing["duration"] || duration, duration)

        event =
          new_event(state, "statusApply", %{
            "targetId" => unit_id,
            "unitId" => unit_id,
            "statusName" => name,
            "status" => name,
            "duration" => new_dur,
            "refreshed" => true
          })

        state =
          update_unit(state, unit_id, fn u ->
            new_statuses =
              Enum.map(u["statuses"] || [], fn s ->
                if s["name"] == name,
                  do: s |> Map.put("duration", new_dur) |> Map.put("appliedAt", current_turn),
                  else: s
              end)

            Map.put(u, "statuses", new_statuses)
          end)

        state = append_log(state, [event])

        state =
          maybe_trigger_status_applied_passives(state, trigger_passives, unit_id, name, source_id)

        {state, [event]}

      # New status: enforce 3-buff / 3-debuff cap, then insert
      true ->
        {state, evict_events} = maybe_evict_for_cap(state, unit_id, unit, def_)

        new_entry = %{
          "name" => name,
          "duration" => duration,
          "magnitude" => magnitude,
          "sourceInstanceId" => source_id,
          "appliedAt" => current_turn
        }

        apply_event =
          new_event(state, "statusApply", %{
            "targetId" => unit_id,
            "unitId" => unit_id,
            "statusName" => name,
            "status" => name,
            "duration" => duration,
            "magnitude" => magnitude
          })

        state =
          update_unit(state, unit_id, fn u ->
            Map.update!(u, "statuses", &(&1 ++ [new_entry]))
          end)

        all_events = evict_events ++ [apply_event]
        state = append_log(state, all_events)

        state =
          maybe_trigger_status_applied_passives(state, trigger_passives, unit_id, name, source_id)

        {state, all_events}
    end
  end

  defp maybe_trigger_status_applied_passives(state, false, _unit_id, _name, _source_id), do: state

  defp maybe_trigger_status_applied_passives(state, true, unit_id, name, source_id) do
    check_passives(state, "onStatusApplied", %{
      "unitId" => unit_id,
      "status" => name,
      "sourceInstanceId" => source_id
    })
  end

  defp maybe_evict_for_cap(state, unit_id, unit, def_) do
    statuses = unit["statuses"] || []

    {category_pred, cap} =
      cond do
        def_.is_buff -> {&status_is_buff?(&1["name"]), 3}
        def_.is_debuff -> {&status_is_debuff?(&1["name"]), 3}
        true -> {nil, 999}
      end

    if category_pred do
      category_statuses = Enum.filter(statuses, category_pred)

      if length(category_statuses) >= cap do
        oldest = Enum.min_by(category_statuses, &(&1["appliedAt"] || 0))

        evict_event =
          new_event(state, "statusExpire", %{
            "targetId" => unit_id,
            "unitId" => unit_id,
            "statusName" => oldest["name"],
            "status" => oldest["name"],
            "replaced" => true
          })

        state =
          update_unit(state, unit_id, fn u ->
            remove_status_from_unit(u, oldest["name"])
          end)

        {state, [evict_event]}
      else
        {state, []}
      end
    else
      {state, []}
    end
  end

  defp remove_status_from_unit(unit, name) do
    Map.update!(unit, "statuses", fn statuses ->
      Enum.reject(statuses, &(&1["name"] == name))
    end)
  end

  defp remove_status(state, unit_id, name) do
    event =
      new_event(state, "statusExpire", %{
        "targetId" => unit_id,
        "unitId" => unit_id,
        "statusName" => name,
        "status" => name
      })

    state = update_unit(state, unit_id, fn u -> remove_status_from_unit(u, name) end)
    {append_log(state, [event]), event}
  end

  # Tick statuses for all active units of a given player.
  # Called at the start of that player's turn (in simulate_end_turn for other_player_id).
  defp tick_statuses(state, player_id) do
    events_before = length(state["log"])

    {:ok, player} = find_player(state, player_id)

    state =
      Enum.reduce(player["units"], state, fn unit, acc_state ->
        if unit["knockedOut"] or unit["hp"] <= 0 do
          acc_state
        else
          tick_unit_statuses(acc_state, unit["instanceId"])
        end
      end)

    new_events = Enum.drop(state["log"], events_before)
    {state, new_events}
  end

  defp tick_unit_statuses(state, unit_id) do
    {:ok, unit} = find_unit_across_players(state, unit_id)
    statuses = unit["statuses"] || []

    # Accumulate net damage and healing
    {state, net_damage, net_heal} =
      Enum.reduce(statuses, {state, 0, 0}, fn status, {acc_state, dmg, heal} ->
        name = status["name"]

        case name do
          "Burn" ->
            tick_dmg = floor(unit["maxHp"] * 0.10)

            evt =
              new_event(acc_state, "statusTick", %{
                "targetId" => unit_id,
                "unitId" => unit_id,
                "statusName" => "Burn",
                "status" => "Burn",
                "amount" => tick_dmg,
                "damage" => tick_dmg
              })

            {append_log(acc_state, [evt]), dmg + tick_dmg, heal}

          "Poison" ->
            stacks = status["magnitude"] || 1
            tick_dmg = floor(unit["maxHp"] * 0.05 * stacks)

            evt =
              new_event(acc_state, "statusTick", %{
                "targetId" => unit_id,
                "unitId" => unit_id,
                "statusName" => "Poison",
                "status" => "Poison",
                "amount" => tick_dmg,
                "damage" => tick_dmg,
                "stacks" => stacks
              })

            {append_log(acc_state, [evt]), dmg + tick_dmg, heal}

          n when n in ["Regeneration", "Regen"] ->
            tick_heal = floor(unit["maxHp"] * 0.08)

            evt =
              new_event(acc_state, "statusTick", %{
                "targetId" => unit_id,
                "unitId" => unit_id,
                "statusName" => n,
                "status" => n,
                "amount" => tick_heal,
                "healing" => tick_heal
              })

            {append_log(acc_state, [evt]), dmg, heal + tick_heal}

          "Doom" ->
            # Fires when duration reaches 0 (checked before decrement)
            if (status["duration"] || 1) <= 1 do
              threshold = status["magnitude"] || 0.30
              {:ok, u} = find_unit_across_players(acc_state, unit_id)
              hp_pct = if u["maxHp"] > 0, do: u["hp"] / u["maxHp"], else: 0

              if hp_pct <= threshold do
                # Execute: kill unit
                evt =
                  new_event(acc_state, "statusTick", %{
                    "targetId" => unit_id,
                    "unitId" => unit_id,
                    "statusName" => "Doom",
                    "status" => "Doom",
                    "execute" => true
                  })

                {append_log(acc_state, [evt]), dmg + u["hp"], heal}
              else
                tick_dmg = floor(u["maxHp"] * threshold)

                evt =
                  new_event(acc_state, "statusTick", %{
                    "targetId" => unit_id,
                    "unitId" => unit_id,
                    "statusName" => "Doom",
                    "status" => "Doom",
                    "amount" => tick_dmg,
                    "damage" => tick_dmg
                  })

                {append_log(acc_state, [evt]), dmg + tick_dmg, heal}
              end
            else
              {acc_state, dmg, heal}
            end

          _ ->
            {acc_state, dmg, heal}
        end
      end)

    # Apply net damage and healing
    {:ok, unit_after_effects} = find_unit_across_players(state, unit_id)
    hp_before = unit_after_effects["hp"]
    hp_after = min(unit_after_effects["maxHp"], max(0, hp_before - net_damage + net_heal))

    state =
      if net_damage > 0 or net_heal > 0 do
        update_unit(state, unit_id, fn u -> Map.put(u, "hp", hp_after) end)
      else
        state
      end

    # KO from DoT?
    state =
      if hp_after <= 0 and hp_before > 0 do
        ko_evt = new_event(state, "ko", %{"unitId" => unit_id, "killerId" => "status"})

        state =
          update_unit(state, unit_id, fn u ->
            u |> Map.put("knockedOut", true) |> Map.put("position", nil)
          end)

        append_log(state, [ko_evt])
      else
        state
      end

    # Decrement and expire ticking statuses
    {:ok, unit_now} = find_unit_across_players(state, unit_id)

    Enum.reduce(unit_now["statuses"] || [], state, fn status, acc_state ->
      def_ = Map.get(@status_defs, status["name"], %{ticks: false})

      if def_.ticks do
        new_dur = (status["duration"] || 1) - 1

        if new_dur <= 0 do
          expire_evt =
            new_event(acc_state, "statusExpire", %{
              "targetId" => unit_id,
              "unitId" => unit_id,
              "statusName" => status["name"],
              "status" => status["name"]
            })

          acc_state =
            update_unit(acc_state, unit_id, fn u -> remove_status_from_unit(u, status["name"]) end)

          append_log(acc_state, [expire_evt])
        else
          update_unit(acc_state, unit_id, fn u ->
            new_statuses =
              Enum.map(u["statuses"] || [], fn s ->
                if s["name"] == status["name"], do: Map.put(s, "duration", new_dur), else: s
              end)

            Map.put(u, "statuses", new_statuses)
          end)
        end
      else
        acc_state
      end
    end)
  end

  # Stat modifiers based on active statuses
  defp get_attack_multiplier(unit) do
    mul = 1.0
    mul = if has_status(unit, "Weakened"), do: mul * 0.75, else: mul
    mul = if has_status(unit, "Empower"), do: mul * 1.25, else: mul
    mul
  end

  defp get_defense_multiplier(unit) do
    if has_status(unit, "GuardUp"), do: 1.25, else: 1.0
  end

  defp get_incoming_damage_multiplier(unit) do
    mul = 1.0
    mul = if has_status(unit, "Vulnerable"), do: mul * 1.25, else: mul
    mul = if has_status(unit, "Freeze"), do: mul * 1.20, else: mul
    mul = if has_status(unit, "Mark"), do: mul * 1.15, else: mul
    mul
  end

  defp get_speed_value(unit) do
    base = unit["speed"] || 1
    if has_status(unit, "Haste"), do: floor(base * 1.2), else: base
  end

  # Shield absorption: returns {absorbed_amount, updated_unit}
  defp consume_shield(unit, damage) do
    case get_status(unit, "Shield") do
      nil ->
        {0, unit}

      shield ->
        mag = shield["magnitude"] || 0
        absorbed = min(mag, damage)
        remaining = mag - absorbed

        updated =
          if remaining <= 0 do
            remove_status_from_unit(unit, "Shield")
          else
            new_statuses =
              Enum.map(unit["statuses"] || [], fn s ->
                if s["name"] == "Shield", do: Map.put(s, "magnitude", remaining), else: s
              end)

            Map.put(unit, "statuses", new_statuses)
          end

        {absorbed, updated}
    end
  end

  defp apply_hp_change(unit, hp_after) do
    is_ko = hp_after <= 0

    unit
    |> Map.put("hp", hp_after)
    |> Map.put("knockedOut", is_ko)
    |> (fn u -> if is_ko, do: Map.put(u, "position", nil), else: u end).()
  end

  defp apply_shield_absorption(state, target_id, raw_damage) do
    if raw_damage > 0 do
      {:ok, unit} = find_unit_across_players(state, target_id)
      {absorbed, updated_unit} = consume_shield(unit, raw_damage)

      if absorbed > 0 do
        shield_evt =
          new_event(state, "shieldAbsorb", %{
            "targetId" => target_id,
            "unitId" => target_id,
            "amount" => absorbed,
            "absorbed" => absorbed
          })

        state =
          state
          |> update_unit(target_id, fn _ -> updated_unit end)
          |> append_log([shield_evt])

        {raw_damage - absorbed, state}
      else
        {raw_damage, state}
      end
    else
      {0, state}
    end
  end

  defp active_units_with_players(state) do
    Enum.flat_map(state["players"], fn player ->
      Enum.map(player["units"], fn unit -> {player, unit} end)
    end)
  end

  defp alive_active_units_with_players(state) do
    Enum.filter(active_units_with_players(state), fn {_player, unit} ->
      unit["hp"] > 0 and not unit["knockedOut"]
    end)
  end

  defp get_unit_player(state, instance_id) do
    Enum.find(state["players"], fn player ->
      Enum.any?(player["units"] ++ player["bench"], &(&1["instanceId"] == instance_id))
    end)
  end

  defp get_unit_passives(unit), do: Map.get(unit, "passives", []) || []
  defp get_unit_passive_triggered(unit), do: Map.get(unit, "passiveTriggered", %{}) || %{}

  defp passive_target_id(trigger, context, unit_id) do
    case trigger do
      "onDamageDealt" -> context["targetId"]
      "onDamageTaken" -> context["attackerId"]
      "onBelowHp" -> context["unitId"] || unit_id
      "onHealAlly" -> context["targetId"] || unit_id
      "onStatusApplied" -> context["unitId"] || unit_id
      "onActionStart" -> context["targetId"]
      _ -> nil
    end
  end

  defp passive_applies_to_unit?(trigger, player, unit, context) do
    case trigger do
      "onDamageDealt" ->
        context["attackerId"] == unit["instanceId"]

      "onDamageTaken" ->
        context["targetId"] == unit["instanceId"]

      "onBelowHp" ->
        context["unitId"] == unit["instanceId"]

      "onHealAlly" ->
        context["healerId"] == unit["instanceId"]

      "onStatusApplied" ->
        context["unitId"] == unit["instanceId"]

      "onActionStart" ->
        context["actorId"] == unit["instanceId"]

      "onStartTurn" ->
        context["playerId"] == player["userId"]

      "onEndTurn" ->
        context["playerId"] == player["userId"]

      "onBattleInit" ->
        true

      "onAnyKo" ->
        true

      "onAllyKo" ->
        context["koedPlayerId"] == player["userId"] and
          context["koedUnitId"] != unit["instanceId"]

      "onEnemyKo" ->
        context["koedPlayerId"] != player["userId"]

      _ ->
        true
    end
  end

  defp passive_threshold_met?(unit, payload) do
    threshold = payload["thresholdPct"] || payload["belowHpThreshold"]

    cond do
      is_nil(threshold) -> false
      unit["maxHp"] in [nil, 0] -> false
      true -> unit["hp"] / unit["maxHp"] <= threshold
    end
  end

  defp mark_passive_triggered(state, unit_id, passive_key) do
    update_unit(state, unit_id, fn unit ->
      Map.put(
        unit,
        "passiveTriggered",
        Map.put(get_unit_passive_triggered(unit), passive_key, true)
      )
    end)
  end

  defp maybe_roll_passive_chance(state, nil), do: {true, state}

  defp maybe_roll_passive_chance(state, chance) do
    rng = make_rng(state["seed"], state["rngIndex"])
    {passed?, {_, new_rng_index}} = rng_next_bool(rng, chance)
    {passed?, Map.put(state, "rngIndex", new_rng_index)}
  end

  defp apply_passive_stat_bonus(state, unit_id, stat_bonus) when is_map(stat_bonus) do
    update_unit(state, unit_id, fn unit ->
      hp_bonus = Map.get(stat_bonus, "hp", 0)
      atk_bonus = Map.get(stat_bonus, "attack", 0)
      def_bonus = Map.get(stat_bonus, "defense", 0)
      speed_bonus = Map.get(stat_bonus, "speed", 0)

      max_hp = unit["maxHp"] || 0
      attack = unit["attack"] || 0
      defense = unit["defense"] || 0
      speed = unit["speed"] || 0

      new_max_hp = max(1, floor(max_hp * (1 + hp_bonus)))
      hp_delta = new_max_hp - max_hp

      unit
      |> Map.put("maxHp", new_max_hp)
      |> Map.update!("hp", &max(1, &1 + hp_delta))
      |> Map.put("attack", max(1, floor(attack * (1 + atk_bonus))))
      |> Map.put("defense", max(0, floor(defense * (1 + def_bonus))))
      |> Map.put("speed", max(1, floor(speed * (1 + speed_bonus))))
    end)
  end

  defp apply_passive_stat_bonus(state, _unit_id, _stat_bonus), do: state

  defp maybe_execute_passive(state, player, unit, passive_key, passive_def, trigger, context) do
    payload = passive_def["payload"] || %{}
    once? = payload["once"] == true

    cond do
      payload["trigger"] != trigger ->
        state

      not passive_applies_to_unit?(trigger, player, unit, context) ->
        state

      trigger == "onBelowHp" and not passive_threshold_met?(unit, payload) ->
        state

      once? and Map.get(get_unit_passive_triggered(unit), passive_key) == true ->
        state

      true ->
        {passed?, state} = maybe_roll_passive_chance(state, payload["chance"])

        if not passed? do
          state
        else
          state =
            if trigger == "onBattleInit" and is_map(payload["statBonus"]) do
              apply_passive_stat_bonus(state, unit["instanceId"], payload["statBonus"])
            else
              state
            end

          target_id = passive_target_id(trigger, context, unit["instanceId"])

          state =
            dispatch_ability_payload(
              state,
              player["userId"],
              unit["instanceId"],
              target_id,
              %{"payload" => Map.delete(payload, "statBonus")}
            )

          state =
            append_log(state, [
              new_event(state, "passiveTrigger", %{
                "unitId" => unit["instanceId"],
                "passiveKey" => passive_key,
                "trigger" => trigger
              })
            ])

          if once?,
            do: mark_passive_triggered(state, unit["instanceId"], passive_key),
            else: state
        end
    end
  end

  defp check_passives(state, trigger, context \\ %{}) do
    Enum.reduce(alive_active_units_with_players(state), state, fn {player, unit}, acc_state ->
      current_unit =
        case find_unit_across_players(acc_state, unit["instanceId"]) do
          {:ok, refreshed_unit} -> refreshed_unit
          {:error, _} -> unit
        end

      Enum.reduce(get_unit_passives(current_unit), acc_state, fn passive_key, acc_state2 ->
        latest_unit =
          case find_unit_across_players(acc_state2, current_unit["instanceId"]) do
            {:ok, refreshed_unit} -> refreshed_unit
            {:error, _} -> current_unit
          end

        passive_def = get_in(acc_state2, ["abilityDefinitions", passive_key])

        if is_map(passive_def) do
          maybe_execute_passive(
            acc_state2,
            player,
            latest_unit,
            passive_key,
            passive_def,
            trigger,
            context
          )
        else
          acc_state2
        end
      end)
    end)
  end

  defp get_passive_damage_reduction_pct(state, target) do
    reductions =
      get_unit_passives(target)
      |> Enum.reduce(0.0, fn passive_key, acc ->
        case get_in(state, ["abilityDefinitions", passive_key, "payload"]) do
          %{"trigger" => "onDamageTaken", "damageReduction" => reduction}
          when is_number(reduction) ->
            acc + reduction

          _ ->
            acc
        end
      end)

    min(0.2, max(0.0, reductions))
  end

  defp trigger_ko_passives(state, koed_unit_id) do
    case find_unit_across_players(state, koed_unit_id) do
      {:ok, _koed_unit} ->
        koed_player = get_unit_player(state, koed_unit_id)

        if koed_player do
          context = %{"koedUnitId" => koed_unit_id, "koedPlayerId" => koed_player["userId"]}

          state
          |> check_passives("onAnyKo", context)
          |> check_passives("onAllyKo", context)
          |> check_passives("onEnemyKo", context)
        else
          state
        end

      {:error, _} ->
        state
    end
  end

  defp maybe_prevent_fatal_damage(state, target_id, attacker_id) do
    with {:ok, target} <- find_unit_across_players(state, target_id),
         target_player when not is_nil(target_player) <- get_unit_player(state, target_id) do
      active_allies =
        Enum.filter(target_player["units"], fn unit ->
          unit["instanceId"] != target_id and unit["hp"] > 0 and not unit["knockedOut"]
        end)

      Enum.reduce_while(active_allies, {state, nil}, fn ally, {acc_state, _} ->
        Enum.reduce_while(get_unit_passives(ally), {acc_state, nil}, fn passive_key,
                                                                        {acc_state2, _} ->
          payload = get_in(acc_state2, ["abilityDefinitions", passive_key, "payload"]) || %{}
          once? = payload["once"] == true

          cond do
            payload["trigger"] != "onAllyFatalDamage" ->
              {:cont, {acc_state2, nil}}

            not (payload["preventDeath"] == true or is_number(payload["revivePct"])) ->
              {:cont, {acc_state2, nil}}

            once? and Map.get(get_unit_passive_triggered(ally), passive_key) == true ->
              {:cont, {acc_state2, nil}}

            true ->
              {passed?, acc_state2} = maybe_roll_passive_chance(acc_state2, payload["chance"])

              if not passed? do
                {:cont, {acc_state2, nil}}
              else
                restored_hp =
                  if is_number(payload["revivePct"]) do
                    max(1, floor((target["maxHp"] || 1) * payload["revivePct"]))
                  else
                    1
                  end

                prevention_event =
                  new_event(acc_state2, "preventDeath", %{
                    "targetId" => target_id,
                    "unitId" => target_id,
                    "attackerId" => attacker_id,
                    "hpAfter" => restored_hp,
                    "passiveKey" => passive_key,
                    "sourceUnitId" => ally["instanceId"]
                  })

                acc_state2 =
                  acc_state2
                  |> update_unit(target_id, fn unit ->
                    unit
                    |> Map.put("hp", restored_hp)
                    |> Map.put("knockedOut", false)
                  end)
                  |> append_log([
                    prevention_event,
                    new_event(acc_state2, "passiveTrigger", %{
                      "unitId" => ally["instanceId"],
                      "passiveKey" => passive_key,
                      "trigger" => "onAllyFatalDamage"
                    })
                  ])

                acc_state2 =
                  if once?,
                    do: mark_passive_triggered(acc_state2, ally["instanceId"], passive_key),
                    else: acc_state2

                {:halt, {acc_state2, restored_hp}}
              end
          end
        end)
        |> case do
          {acc_state2, nil} -> {:cont, {acc_state2, nil}}
          {acc_state2, restored_hp} -> {:halt, {acc_state2, restored_hp}}
        end
      end)
    else
      _ -> {state, nil}
    end
  end

  defp trigger_post_damage_passives(state, attacker_id, target_id, damage, ability_type) do
    state
    |> check_passives("onDamageDealt", %{
      "attackerId" => attacker_id,
      "targetId" => target_id,
      "damage" => damage,
      "abilityType" => ability_type
    })
    |> check_passives("onDamageTaken", %{
      "attackerId" => attacker_id,
      "targetId" => target_id,
      "damage" => damage,
      "abilityType" => ability_type
    })
    |> check_passives("onBelowHp", %{"unitId" => target_id})
  end

  # Apply a list of status specs from an ability payload
  defp apply_status_list(state, _unit_id, nil), do: state
  defp apply_status_list(state, _unit_id, []), do: state

  defp apply_status_list(state, unit_id, specs) when is_list(specs) do
    Enum.reduce(specs, state, fn spec, acc ->
      name = spec["name"]
      duration = spec["duration"] || 1
      magnitude = spec["magnitude"]
      source = spec["sourceInstanceId"]

      {new_state, _events} =
        apply_status(acc, unit_id, name, duration,
          magnitude: magnitude,
          source_instance_id: source
        )

      new_state
    end)
  end

  defp apply_status_list(state, _unit_id, _), do: state

  # Apply a list of status specs, each gated by an optional chance roll
  defp apply_status_list_with_chance(state, unit_id, specs, nil) do
    apply_status_list(state, unit_id, specs)
  end

  defp apply_status_list_with_chance(state, unit_id, specs, chance) when is_list(specs) do
    Enum.reduce(specs, state, fn spec, acc_state ->
      rng = make_rng(acc_state["seed"], acc_state["rngIndex"])
      {should_apply, {_, new_rng_index}} = rng_next_bool(rng, chance)
      acc_state = Map.put(acc_state, "rngIndex", new_rng_index)

      if should_apply do
        name = spec["name"]
        duration = spec["duration"] || 1
        magnitude = spec["magnitude"]
        source = spec["sourceInstanceId"]

        {new_state, _} =
          apply_status(acc_state, unit_id, name, duration,
            magnitude: magnitude,
            source_instance_id: source
          )

        new_state
      else
        acc_state
      end
    end)
  end

  defp apply_status_list_with_chance(state, _unit_id, _specs, _chance), do: state

  # Pick one random status from specs and apply it
  defp apply_random_status(state, _unit_id, specs) when specs == [], do: state
  defp apply_random_status(state, _unit_id, nil), do: state

  defp apply_random_status(state, unit_id, specs) when is_list(specs) do
    rng = make_rng(state["seed"], state["rngIndex"])
    {val, {_, new_rng_index}} = rng_next(rng)
    state = Map.put(state, "rngIndex", new_rng_index)

    index = min(floor(val * length(specs)), length(specs) - 1)
    spec = Enum.at(specs, index)

    name = spec["name"]
    duration = spec["duration"] || 1
    magnitude = spec["magnitude"]
    {new_state, _} = apply_status(state, unit_id, name, duration, magnitude: magnitude)
    new_state
  end

  defp apply_random_status(state, _unit_id, _specs), do: state

  # Heal the lowest-HP-percentage ally of the actor
  defp apply_heal_lowest_ally(state, actor_id, heal_pct) do
    actor_player =
      Enum.find(state["players"], fn p ->
        all = p["units"] ++ p["bench"]
        Enum.any?(all, &(&1["instanceId"] == actor_id))
      end)

    if actor_player do
      alive_units =
        Enum.filter(actor_player["units"], fn u -> not u["knockedOut"] and u["hp"] > 0 end)

      if alive_units != [] do
        lowest = Enum.min_by(alive_units, fn u -> u["hp"] / max(1, u["maxHp"]) end)

        do_heal_unit(
          state,
          lowest["instanceId"],
          lowest["hp"],
          lowest["maxHp"],
          floor(lowest["maxHp"] * heal_pct),
          healer_id: actor_id
        )
      else
        state
      end
    else
      state
    end
  end

  # Revive first KO'd ally at revive_pct of maxHp
  defp apply_revive_ally(state, actor_id, revive_pct) do
    actor_player =
      Enum.find(state["players"], fn p ->
        all = p["units"] ++ p["bench"]
        Enum.any?(all, &(&1["instanceId"] == actor_id))
      end)

    if actor_player do
      all_units = actor_player["units"] ++ actor_player["bench"]
      ko_unit = Enum.find(all_units, fn u -> u["knockedOut"] or u["hp"] <= 0 end)

      if ko_unit do
        revive_hp = max(1, floor(ko_unit["maxHp"] * revive_pct))

        revive_evt =
          new_event(state, "revive", %{
            "targetId" => ko_unit["instanceId"],
            "unitId" => ko_unit["instanceId"],
            "hp" => revive_hp
          })

        state
        |> update_unit(ko_unit["instanceId"], fn u ->
          u
          |> Map.put("hp", revive_hp)
          |> Map.put("knockedOut", false)
        end)
        |> append_log([revive_evt])
      else
        state
      end
    else
      state
    end
  end

  # Remove debuffs from target_id. Priority: Doom first, then oldest by appliedAt.
  defp apply_cleanse(state, target_id, cleanse_spec) do
    count = Map.get(cleanse_spec, "count", 1)

    case find_unit_across_players(state, target_id) do
      {:error, _} ->
        state

      {:ok, target} ->
        debuffs = Enum.filter(target["statuses"] || [], fn s -> status_is_debuff?(s["name"]) end)

        sorted =
          Enum.sort_by(debuffs, fn s ->
            doom_priority = if s["name"] == "Doom", do: 0, else: 1
            {doom_priority, s["appliedAt"] || 0}
          end)

        to_remove = Enum.take(sorted, count)

        Enum.reduce(to_remove, state, fn status, acc_state ->
          expire_evt =
            new_event(acc_state, "statusExpire", %{
              "targetId" => target_id,
              "unitId" => target_id,
              "statusName" => status["name"],
              "status" => status["name"],
              "consumed" => true
            })

          acc_state
          |> update_unit(target_id, fn u -> remove_status_from_unit(u, status["name"]) end)
          |> append_log([expire_evt])
        end)
    end
  end

  # Steal N buffs from target_id and apply them to actor_id
  defp apply_steal_buffs(state, actor_id, target_id, count) do
    case find_unit_across_players(state, target_id) do
      {:error, _} ->
        state

      {:ok, target} ->
        buffs = Enum.filter(target["statuses"] || [], fn s -> status_is_buff?(s["name"]) end)
        sorted = Enum.sort_by(buffs, fn s -> s["appliedAt"] || 0 end)
        to_steal = Enum.take(sorted, count)

        Enum.reduce(to_steal, state, fn buff, acc_state ->
          steal_evt =
            new_event(acc_state, "statusSteal", %{
              "fromId" => target_id,
              "toId" => actor_id,
              "statusName" => buff["name"],
              "status" => buff["name"]
            })

          acc_state2 =
            update_unit(acc_state, target_id, fn u -> remove_status_from_unit(u, buff["name"]) end)

          {acc_state3, _} =
            apply_status(acc_state2, actor_id, buff["name"], buff["duration"] || 1,
              magnitude: buff["magnitude"]
            )

          append_log(acc_state3, [steal_evt])
        end)
    end
  end

  # Swap HP percentages between actor and target (floors at 1)
  defp apply_swap_hp_percentages(state, actor_id, target_id) do
    with {:ok, actor} <- find_unit_across_players(state, actor_id),
         {:ok, target} <- find_unit_across_players(state, target_id) do
      actor_pct = actor["hp"] / max(1, actor["maxHp"])
      target_pct = target["hp"] / max(1, target["maxHp"])

      new_actor_hp = max(1, floor(actor["maxHp"] * target_pct))
      new_target_hp = max(1, floor(target["maxHp"] * actor_pct))

      swap_evt =
        new_event(state, "swapHp", %{
          "actorId" => actor_id,
          "targetId" => target_id,
          "actorHpBefore" => actor["hp"],
          "actorHpAfter" => new_actor_hp,
          "targetHpBefore" => target["hp"],
          "targetHpAfter" => new_target_hp
        })

      state
      |> update_unit(actor_id, fn u -> Map.put(u, "hp", new_actor_hp) end)
      |> update_unit(target_id, fn u -> Map.put(u, "hp", new_target_hp) end)
      |> append_log([swap_evt])
    else
      _ -> state
    end
  end

  # Reduce actor's ability cooldowns by amount; drop any that reach 0
  defp apply_reduce_cooldowns(state, actor_id, amount) do
    update_unit(state, actor_id, fn u ->
      new_cooldowns =
        (u["cooldowns"] || %{})
        |> Enum.map(fn {k, v} -> {k, max(0, v - amount)} end)
        |> Enum.reject(fn {_, v} -> v == 0 end)
        |> Map.new()

      Map.put(u, "cooldowns", new_cooldowns)
    end)
  end

  # Handle shieldTarget + shieldPctOfMaxHp payload
  defp apply_shield_ability(state, actor_id, shield_target, shield_pct) do
    case find_unit_across_players(state, actor_id) do
      {:error, _} ->
        state

      {:ok, actor} ->
        magnitude = floor(actor["maxHp"] * shield_pct)

        target_ids =
          case shield_target do
            "self" ->
              [actor_id]

            "allAllies" ->
              actor_player =
                Enum.find(state["players"], fn p ->
                  all = p["units"] ++ p["bench"]
                  Enum.any?(all, &(&1["instanceId"] == actor_id))
                end)

              if actor_player do
                Enum.map(actor_player["units"], & &1["instanceId"])
              else
                []
              end

            _ ->
              []
          end

        Enum.reduce(target_ids, state, fn tid, acc ->
          {new_state, _} = apply_status(acc, tid, "Shield", -1, magnitude: magnitude)
          new_state
        end)
    end
  end

  # Action guards

  defp guard_summoning_sickness(unit) do
    if has_status(unit, "SummoningSickness"),
      do: {:error, :summoning_sickness},
      else: :ok
  end

  defp guard_silence(unit, kind) do
    if kind in ["skill", "ultimate"] and has_status(unit, "Silence"),
      do: {:error, :silenced},
      else: :ok
  end

  defp guard_stealth_target(state, actor_id, target_id) do
    case find_unit_across_players(state, target_id) do
      {:error, _} ->
        :ok

      {:ok, target} ->
        if has_status(target, "Stealth") do
          # Check if actor is an enemy of target
          case validate_target_is_enemy(state, actor_id, target_id) do
            :ok -> {:error, :target_in_stealth}
            _ -> :ok
          end
        else
          :ok
        end
    end
  end

  # Returns effective target_id, overriding with taunted enemy unit if applicable
  defp resolve_taunt_target(state, actor_id, requested_target_id) do
    enemy_player =
      Enum.find(state["players"], fn p ->
        actor_p =
          Enum.find(state["players"], fn p2 ->
            all = p2["units"] ++ p2["bench"]
            Enum.any?(all, &(&1["instanceId"] == actor_id))
          end)

        actor_p != nil and p["userId"] != actor_p["userId"]
      end)

    if enemy_player do
      taunter =
        Enum.find(enemy_player["units"], fn u ->
          !u["knockedOut"] and u["hp"] > 0 and has_status(u, "Taunt")
        end)

      if taunter, do: taunter["instanceId"], else: requested_target_id
    else
      requested_target_id
    end
  end

  # Freeze: if actor has Freeze, skip action (consume Freeze). Returns {:skip, state} | :proceed
  defp maybe_consume_freeze(state, unit_id) do
    case find_unit_across_players(state, unit_id) do
      {:ok, unit} when not is_nil(unit) ->
        if has_status(unit, "Freeze") do
          freeze_event =
            new_event(state, "statusExpire", %{
              "unitId" => unit_id,
              "status" => "Freeze",
              "consumed" => true
            })

          state =
            update_unit(state, unit_id, fn u -> remove_status_from_unit(u, "Freeze") end)

          {:skip, append_log(state, [freeze_event])}
        else
          {:proceed, state}
        end

      _ ->
        {:proceed, state}
    end
  end

  # Stun: if actor has Stun, consume it and return extra energy cost
  defp maybe_consume_stun(state, unit_id) do
    case find_unit_across_players(state, unit_id) do
      {:ok, unit} when not is_nil(unit) ->
        if has_status(unit, "Stunned") do
          stun_event =
            new_event(state, "statusExpire", %{
              "unitId" => unit_id,
              "status" => "Stunned",
              "consumed" => true
            })

          state =
            update_unit(state, unit_id, fn u -> remove_status_from_unit(u, "Stunned") end)

          {1, append_log(state, [stun_event])}
        else
          {0, state}
        end

      _ ->
        {0, state}
    end
  end

  # ── Damage Calculation ────────────────────────────────────────────────────

  # Mirrors backup calculateDamage with speed-based miss/crit.
  # opts: [ignore_defense_pct: float, burn_bonus_mul: float]
  defp calculate_damage(attacker, target, rng, opts \\ []) do
    base_crit_chance = 0.1
    crit_multiplier = 1.5
    base_damage_scalar = 0.6
    base_miss_chance = 0.05
    speed_to_miss = 0.004
    speed_to_crit = 0.002

    ignore_defense_pct = Keyword.get(opts, :ignore_defense_pct, 0.0)
    burn_bonus_mul = Keyword.get(opts, :burn_bonus_mul, 0.0)

    attacker_speed = max(1, get_speed_value(attacker))
    target_speed = max(1, get_speed_value(target))
    speed_delta = target_speed - attacker_speed

    miss_chance = max(0.02, min(0.45, base_miss_chance + speed_delta * speed_to_miss))
    hit_chance = 1 - miss_chance

    crit_chance =
      max(0.0, min(0.35, (base_crit_chance - speed_delta * speed_to_crit) * hit_chance))

    atk = floor(attacker["attack"] * get_attack_multiplier(attacker))
    def_ = floor(target["defense"] * get_defense_multiplier(target) * (1 - ignore_defense_pct))
    denom = max(1, atk + def_)
    base_damage = max(1, floor(atk * atk * base_damage_scalar / denom))
    type_mul = type_multiplier(attacker["type"], target["type"])

    {is_miss, rng1} = rng_next_bool(rng, miss_chance)
    {is_crit, rng2} = if is_miss, do: {false, rng1}, else: rng_next_bool(rng1, crit_chance)

    crit_mul = if is_crit, do: crit_multiplier, else: 1.0

    raw_damage =
      if is_miss do
        0
      else
        max(1, floor(base_damage * type_mul * crit_mul))
      end

    final_damage =
      if is_miss do
        0
      else
        max(1, floor(raw_damage * get_incoming_damage_multiplier(target)))
      end

    # Burn bonus multiplier: extra damage vs Burning targets
    final_damage =
      if burn_bonus_mul > 0 and has_status(target, "Burn") and not is_miss do
        floor(final_damage * (1 + burn_bonus_mul))
      else
        final_damage
      end

    {%{
       final_damage: final_damage,
       is_miss: is_miss,
       is_crit: is_crit,
       type_multiplier: type_mul,
       base_damage: base_damage
     }, rng2}
  end

  # ── Unit Building ─────────────────────────────────────────────────────────

  defp build_unit(card, position, user_id, index) do
    rarity = Map.get(card, "rarity_name", "Common")
    stats = apply_rarity_bonuses(card["hp"], card["attack"], card["defense"], rarity)

    speed =
      get_card_speed(
        card["name"],
        card["character"],
        card["attack"],
        card["defense"],
        card["speed"]
      )

    instance_id = "#{card["id"]}-#{user_id}-#{index}"

    %{
      "instanceId" => instance_id,
      "cardId" => card["id"],
      "name" => card["name"],
      "character" => Map.get(card, "character", card["name"]),
      "type" => card |> Map.get("type", "Hero") |> CardType.canonicalize!(),
      "rarity" => rarity,
      "hp" => stats.hp,
      "maxHp" => stats.hp,
      "attack" => stats.attack,
      "defense" => stats.defense,
      "speed" => speed,
      "statuses" => [],
      "cooldowns" => %{},
      "usedUltimate" => false,
      "position" => position,
      "knockedOut" => false,
      "passives" => [],
      "passiveTriggered" => %{},
      "skill" => nil,
      "ultimate" => nil
    }
  end

  # ── State Creation ────────────────────────────────────────────────────────

  @doc """
  Create initial battle state from match metadata and card data.

  inviter_data/invitee_data: %{user_id, display_name, cards: [card_map, ...]}
  Each card_map must have: id, name, character, type, hp, attack, defense, speed, rarity_name
  """
  def create_battle_state(match_id, inviter_data, invitee_data) do
    seed = Ecto.UUID.generate()
    rng = make_rng(seed)

    inviter_units =
      inviter_data.cards
      |> Enum.take(3)
      |> Enum.with_index(1)
      |> Enum.map(fn {card, pos} -> build_unit(card, pos, inviter_data.user_id, pos) end)

    inviter_bench =
      inviter_data.cards
      |> Enum.drop(3)
      |> Enum.take(3)
      |> Enum.with_index(4)
      |> Enum.map(fn {card, idx} -> build_unit(card, nil, inviter_data.user_id, idx) end)

    invitee_units =
      invitee_data.cards
      |> Enum.take(3)
      |> Enum.with_index(1)
      |> Enum.map(fn {card, pos} -> build_unit(card, pos, invitee_data.user_id, pos) end)

    invitee_bench =
      invitee_data.cards
      |> Enum.drop(3)
      |> Enum.take(3)
      |> Enum.with_index(4)
      |> Enum.map(fn {card, idx} -> build_unit(card, nil, invitee_data.user_id, idx) end)

    inviter_initiative = calculate_initiative(Enum.map(inviter_units, & &1["speed"]))
    invitee_initiative = calculate_initiative(Enum.map(invitee_units, & &1["speed"]))

    {inviter_goes_first, rng2} =
      cond do
        inviter_initiative > invitee_initiative ->
          {true, rng}

        invitee_initiative > inviter_initiative ->
          {false, rng}

        true ->
          {coin, r} = rng_next_bool(rng)
          {coin, r}
      end

    {_, rng_index} = rng2
    first_player_id = if inviter_goes_first, do: inviter_data.user_id, else: invitee_data.user_id

    state = %{
      "id" => match_id,
      "seed" => seed,
      "rngIndex" => rng_index,
      "turn" => 1,
      "phase" => "active",
      "currentPlayerId" => first_player_id,
      "winnerId" => nil,
      "players" => [
        %{
          "userId" => inviter_data.user_id,
          "displayName" => inviter_data.display_name,
          "energy" => 1,
          "initiative" => inviter_initiative,
          "hasUsedFreeBasic" => false,
          "units" => inviter_units,
          "bench" => inviter_bench
        },
        %{
          "userId" => invitee_data.user_id,
          "displayName" => invitee_data.display_name,
          "energy" => 1,
          "initiative" => invitee_initiative,
          "hasUsedFreeBasic" => false,
          "units" => invitee_units,
          "bench" => invitee_bench
        }
      ],
      "log" => [
        %{
          "seq" => 0,
          "turn" => 0,
          "type" => "matchStart",
          "payload" => %{
            "player1Id" => inviter_data.user_id,
            "player2Id" => invitee_data.user_id,
            "firstMoverId" => first_player_id,
            "seed" => seed
          }
        }
      ],
      "actionsThisTurn" => []
    }

    {state, seed}
  end

  def initialize_passives(state) do
    check_passives(state, "onBattleInit", %{})
  end

  # ── Action Simulation ─────────────────────────────────────────────────────

  @doc """
  Simulate a single player action.
  Returns {:ok, new_state, events} or {:error, reason}.
  """
  def simulate_action(state, acting_user_id, action) do
    kind = Map.get(action, "kind", Map.get(action, :kind))
    actor_id = Map.get(action, "actorInstanceId", Map.get(action, :actor_instance_id))

    # Pre-checks that require an actor (skip for pass/copy)
    guard_result =
      if kind in ["basic", "skill", "ultimate"] and not is_nil(actor_id) do
        case find_unit_across_players(state, actor_id) do
          {:ok, actor} ->
            with :ok <- guard_summoning_sickness(actor),
                 :ok <- guard_silence(actor, kind) do
              :ok
            end

          {:error, _} ->
            :ok
        end
      else
        :ok
      end

    case guard_result do
      {:error, reason} ->
        {:error, reason}

      :ok ->
        # Freeze check: skip action if frozen
        {freeze_result, state} =
          if kind in ["basic", "skill", "ultimate"] and not is_nil(actor_id) do
            maybe_consume_freeze(state, actor_id)
          else
            {:proceed, state}
          end

        if freeze_result == :skip do
          freeze_events = Enum.drop(state["log"], length(state["log"]) - 1)
          {:ok, state, freeze_events}
        else
          state =
            if not is_nil(actor_id) do
              check_passives(state, "onActionStart", %{
                "actorId" => actor_id,
                "targetId" =>
                  Map.get(action, "targetInstanceId", Map.get(action, :target_instance_id)),
                "kind" => kind
              })
            else
              state
            end

          cond do
            kind == "copy" ->
              simulate_copy_action(state, acting_user_id, action)

            kind == "pass" ->
              events = [new_event(state, "pass", %{"playerId" => acting_user_id})]
              new_state = append_log(state, events)
              {:ok, new_state, events}

            kind == "basic" ->
              simulate_basic_attack(state, acting_user_id, action)

            kind == "skill" ->
              do_skill_or_ultimate(state, acting_user_id, action, "SKILL")

            kind == "ultimate" ->
              do_skill_or_ultimate(state, acting_user_id, action, "ULTIMATE")

            true ->
              {:error, :unknown_action}
          end
        end
    end
  end

  defp do_skill_or_ultimate(state, acting_user_id, action, type_filter) do
    actor_id = Map.get(action, "actorInstanceId", Map.get(action, :actor_instance_id))
    target_id = Map.get(action, "targetInstanceId", Map.get(action, :target_instance_id))

    # Consume Stun before energy validation (costs +1 energy)
    {stun_extra, state} = maybe_consume_stun(state, actor_id)

    with {:ok, acting_player} <- find_player(state, acting_user_id),
         {:ok, actor} <- find_unit_across_players(state, actor_id),
         :ok <- validate_unit_belongs_to_player(state, actor_id, acting_user_id),
         :ok <- validate_unit_alive(actor, "actor") do
      ability_key =
        case type_filter do
          "SKILL" -> actor["skill"]
          "ULTIMATE" -> actor["ultimate"]
        end

      if is_nil(ability_key) do
        {:error, :no_ability_assigned}
      else
        ability_defs = Map.get(state, "abilityDefinitions", %{})
        ability_def = Map.get(ability_defs, ability_key)

        if is_nil(ability_def) do
          {:error, :ability_not_found}
        else
          with :ok <- validate_ability_cooldown(actor, ability_key),
               :ok <- validate_once_per_match(actor, ability_def, type_filter),
               :ok <- validate_energy(acting_player, ability_def, stun_extra) do
            dispatch_ability(state, acting_user_id, actor_id, target_id, ability_def)
          end
        end
      end
    end
  end

  defp validate_ability_cooldown(actor, ability_key) do
    cooldown = Map.get(actor["cooldowns"] || %{}, ability_key, 0)
    if cooldown > 0, do: {:error, :ability_on_cooldown}, else: :ok
  end

  defp validate_once_per_match(actor, ability_def, type_filter) do
    if ability_def["oncePerMatch"] do
      used = if type_filter == "ULTIMATE", do: actor["usedUltimate"], else: false
      if used, do: {:error, :ultimate_already_used}, else: :ok
    else
      :ok
    end
  end

  defp validate_energy(player, ability_def, extra_cost \\ 0) do
    cost = (ability_def["cost"] || 0) + extra_cost
    if player["energy"] >= cost, do: :ok, else: {:error, :not_enough_energy}
  end

  defp dispatch_ability(state, acting_user_id, actor_id, target_id, ability_def) do
    initial_log_length = length(state["log"])
    cost = ability_def["cost"] || 0
    cooldown_turns = ability_def["cooldown"]
    ability_key = ability_def["key"]
    is_ultimate = ability_def["type"] == "ULTIMATE"

    # Deduct energy from acting player
    state =
      update_player(state, acting_user_id, fn p ->
        Map.update!(p, "energy", &(&1 - cost))
      end)

    ability_start_evt =
      new_event(state, "abilityStart", %{
        "actorId" => actor_id,
        "abilityKey" => ability_key,
        "targetId" => target_id
      })

    state = append_log(state, [ability_start_evt])

    # Apply all payload effects via the shared pipeline
    state = dispatch_ability_payload(state, acting_user_id, actor_id, target_id, ability_def)

    # Set cooldown on actor
    state =
      if cooldown_turns && cooldown_turns > 0 do
        update_unit(state, actor_id, fn u ->
          Map.update!(u, "cooldowns", &Map.put(&1, ability_key, cooldown_turns))
        end)
      else
        state
      end

    # Set usedUltimate flag
    state =
      if is_ultimate do
        update_unit(state, actor_id, fn u -> Map.put(u, "usedUltimate", true) end)
      else
        state
      end

    # Check game over
    state = maybe_end_game(state)

    events = Enum.drop(state["log"], initial_log_length)
    {:ok, state, events}
  end

  # Pure payload effect pipeline — no energy deduction, no cooldown/usedUltimate tracking.
  # Called by dispatch_ability and simulate_copy_action.
  defp dispatch_ability_payload(state, _acting_user_id, actor_id, target_id, ability_def) do
    payload = ability_def["payload"] || %{}

    # Block 1 — damage (full payload-aware: hits, ignoreDefensePct, burnBonusMul, execute, etc.)
    state =
      if Map.has_key?(payload, "damageMul") and not is_nil(target_id) do
        apply_damage_effects(state, actor_id, target_id, payload)
      else
        state
      end

    # Block 2 — heal self by pct of maxHp
    state =
      if Map.has_key?(payload, "healPctOfMaxHp") do
        apply_ability_heal(state, actor_id, payload["healPctOfMaxHp"])
      else
        state
      end

    # Block 3 — applyStatuses with optional chance gate
    state =
      if Map.has_key?(payload, "applyStatuses") and not is_nil(target_id) do
        apply_status_list_with_chance(
          state,
          target_id,
          payload["applyStatuses"],
          Map.get(payload, "applyStatusChance")
        )
      else
        state
      end

    # Block 4 — applyStatusesToAttacker
    state =
      if Map.has_key?(payload, "applyStatusesToAttacker") do
        apply_status_list(state, actor_id, payload["applyStatusesToAttacker"])
      else
        state
      end

    # Block 5 — shieldTarget + shieldPctOfMaxHp
    state =
      if Map.has_key?(payload, "shieldTarget") and Map.has_key?(payload, "shieldPctOfMaxHp") do
        apply_shield_ability(
          state,
          actor_id,
          payload["shieldTarget"],
          payload["shieldPctOfMaxHp"]
        )
      else
        state
      end

    # Block 6 — randomDebuffs / randomStatuses
    state =
      cond do
        Map.has_key?(payload, "randomDebuffs") and not is_nil(target_id) ->
          apply_random_status(state, target_id, payload["randomDebuffs"])

        Map.has_key?(payload, "randomStatuses") and not is_nil(target_id) ->
          apply_random_status(state, target_id, payload["randomStatuses"])

        true ->
          state
      end

    # Block 7 — healLowestAllyPctOfMaxHp
    state =
      if Map.has_key?(payload, "healLowestAllyPctOfMaxHp") do
        apply_heal_lowest_ally(state, actor_id, payload["healLowestAllyPctOfMaxHp"])
      else
        state
      end

    # Block 8 — revivePct: revive first KO'd ally
    state =
      if Map.has_key?(payload, "revivePct") do
        apply_revive_ally(state, actor_id, payload["revivePct"])
      else
        state
      end

    # Block 9 — cleanse: remove debuffs from target
    state =
      if Map.has_key?(payload, "cleanse") and not is_nil(target_id) do
        apply_cleanse(state, target_id, payload["cleanse"])
      else
        state
      end

    # Block 10 — stealBuffCount: steal N buffs from target
    state =
      if Map.has_key?(payload, "stealBuffCount") and not is_nil(target_id) do
        apply_steal_buffs(state, actor_id, target_id, payload["stealBuffCount"])
      else
        state
      end

    # Block 11 — swapHpPercentages
    state =
      if Map.get(payload, "swapHpPercentages") == true and not is_nil(target_id) do
        apply_swap_hp_percentages(state, actor_id, target_id)
      else
        state
      end

    # Block 12 — reduceCooldowns: decrement actor cooldowns by N turns
    state =
      if Map.has_key?(payload, "reduceCooldowns") do
        apply_reduce_cooldowns(state, actor_id, payload["reduceCooldowns"])
      else
        state
      end

    # Block 13 — preventDeath flag: mark actor unit to survive next fatal hit
    state =
      if Map.get(payload, "preventDeath") == true do
        update_unit(state, actor_id, fn u -> Map.put(u, "preventDeath", true) end)
      else
        state
      end

    state
  end

  # Full payload-aware damage dispatcher. Handles: hits, ignoreDefensePct, burnBonusMul,
  # executeDamageMul+executeThreshold, healPctOfDamage, healPctOfMaxHpOnExecute,
  # splashPct, preventDeath intercept.
  defp apply_damage_effects(state, actor_id, target_id, payload) do
    damage_mul = Map.get(payload, "damageMul", 1.0)
    hits = max(1, Map.get(payload, "hits", 1))
    ignore_defense_pct = Map.get(payload, "ignoreDefensePct", 0.0)
    burn_bonus_mul = Map.get(payload, "burnBonusMul", 0.0)
    execute_threshold = Map.get(payload, "executeThreshold")
    execute_damage_mul = Map.get(payload, "executeDamageMul", 2.0)
    heal_pct_of_damage = Map.get(payload, "healPctOfDamage")
    heal_on_execute_pct = Map.get(payload, "healPctOfMaxHpOnExecute")
    splash_pct = Map.get(payload, "splashPct")

    rng = make_rng(state["seed"], state["rngIndex"])

    # Multi-hit loop
    {state, total_damage, did_execute, _rng} =
      Enum.reduce(1..hits, {state, 0, false, rng}, fn _i,
                                                      {acc_state, total_dmg, did_exec, cur_rng} ->
        with {:ok, actor} <- find_unit_across_players(acc_state, actor_id),
             {:ok, target} <- find_unit_across_players(acc_state, target_id),
             true <- not target["knockedOut"] and target["hp"] > 0 do
          # Execute check
          {effective_mul, exec_fired} =
            if not is_nil(execute_threshold) and target["maxHp"] > 0 and
                 target["hp"] / target["maxHp"] <= execute_threshold do
              {execute_damage_mul, true}
            else
              {damage_mul, false}
            end

          {dmg_ctx, rng2} =
            calculate_damage(actor, target, cur_rng,
              ignore_defense_pct: ignore_defense_pct,
              burn_bonus_mul: burn_bonus_mul
            )

          {_, new_rng_index} = rng2

          raw_damage =
            if dmg_ctx.is_miss, do: 0, else: max(1, floor(dmg_ctx.final_damage * effective_mul))

          reduction_pct = get_passive_damage_reduction_pct(acc_state, target)

          raw_damage =
            if raw_damage > 0 do
              max(0, floor(raw_damage * (1 - reduction_pct)))
            else
              0
            end

          # Shield absorption
          {effective_damage, acc_state} =
            apply_shield_absorption(acc_state, target_id, raw_damage)

          hp_before = target["hp"]
          hp_after_raw = max(0, hp_before - effective_damage)

          # preventDeath intercept: surviving a fatal hit
          {hp_after, prevent_death_consumed, acc_state2} =
            if hp_after_raw <= 0 and Map.get(target, "preventDeath") == true do
              pd_evt =
                new_event(acc_state, "preventDeath", %{
                  "targetId" => target_id,
                  "unitId" => target_id
                })

              acc2 =
                acc_state
                |> update_unit(target_id, fn u -> Map.put(u, "preventDeath", false) end)
                |> append_log([pd_evt])

              {1, true, acc2}
            else
              {hp_after_raw, false, acc_state}
            end

          {acc_state2, hp_after} =
            if hp_after <= 0 and not prevent_death_consumed do
              case maybe_prevent_fatal_damage(acc_state2, target_id, actor_id) do
                {new_state, restored_hp} when is_integer(restored_hp) -> {new_state, restored_hp}
                {new_state, _} -> {new_state, hp_after}
              end
            else
              {acc_state2, hp_after}
            end

          is_ko = hp_after <= 0 and not prevent_death_consumed

          acc_state3 = acc_state2

          damage_evt =
            new_event(acc_state3, "damage", %{
              "actorId" => actor_id,
              "attackerId" => actor_id,
              "targetId" => target_id,
              "amount" => effective_damage,
              "damage" => effective_damage,
              "hpBefore" => hp_before,
              "hpAfter" => hp_after,
              "isMiss" => dmg_ctx.is_miss,
              "isCrit" => dmg_ctx.is_crit,
              "typeMultiplier" => dmg_ctx.type_multiplier,
              "damageReductionPct" => reduction_pct
            })

          acc_state4 =
            acc_state3
            |> update_unit(target_id, &apply_hp_change(&1, hp_after))
            |> Map.put("rngIndex", new_rng_index)
            |> append_log([damage_evt])

          acc_state5 =
            if is_ko do
              ko_evt =
                new_event(acc_state4, "ko", %{
                  "targetId" => target_id,
                  "unitId" => target_id,
                  "killerId" => actor_id
                })

              acc_state4
              |> append_log([ko_evt])
              |> trigger_ko_passives(target_id)
            else
              acc_state4
            end

          acc_state5 =
            if effective_damage > 0 do
              trigger_post_damage_passives(
                acc_state5,
                actor_id,
                target_id,
                effective_damage,
                "ability"
              )
            else
              acc_state5
            end

          {acc_state5, total_dmg + effective_damage, did_exec or exec_fired, rng2}
        else
          _ -> {acc_state, total_dmg, did_exec, cur_rng}
        end
      end)

    # Post-loop: lifesteal
    state =
      if heal_pct_of_damage && total_damage > 0 do
        apply_ability_heal_amount(
          state,
          actor_id,
          floor(total_damage * heal_pct_of_damage),
          healer_id: actor_id
        )
      else
        state
      end

    # Post-loop: heal on execute
    state =
      if heal_on_execute_pct && did_execute do
        apply_ability_heal(state, actor_id, heal_on_execute_pct)
      else
        state
      end

    # Post-loop: splash AoE damage to other enemy active units
    state =
      if splash_pct do
        actor_player =
          Enum.find(state["players"], fn p ->
            all = p["units"] ++ p["bench"]
            Enum.any?(all, &(&1["instanceId"] == actor_id))
          end)

        enemy_player =
          Enum.find(state["players"], fn p ->
            actor_player != nil and p["userId"] != actor_player["userId"]
          end)

        if enemy_player do
          splash_targets =
            Enum.filter(enemy_player["units"], fn u ->
              u["instanceId"] != target_id and not u["knockedOut"] and u["hp"] > 0
            end)

          {state, _} =
            Enum.reduce(splash_targets, {state, make_rng(state["seed"], state["rngIndex"])}, fn
              splash_target, {acc_state, cur_rng} ->
                case find_unit_across_players(acc_state, actor_id) do
                  {:ok, actor_now} ->
                    {dmg_ctx, rng2} = calculate_damage(actor_now, splash_target, cur_rng)
                    {_, new_rng_index} = rng2

                    splash_damage =
                      if dmg_ctx.is_miss,
                        do: 0,
                        else: max(1, floor(dmg_ctx.final_damage * damage_mul * splash_pct))

                    reduction_pct = get_passive_damage_reduction_pct(acc_state, splash_target)

                    splash_damage =
                      if splash_damage > 0 do
                        max(0, floor(splash_damage * (1 - reduction_pct)))
                      else
                        0
                      end

                    if splash_damage > 0 do
                      hp_before = splash_target["hp"]
                      hp_after_raw = max(0, hp_before - splash_damage)

                      {acc_state, hp_after} =
                        if hp_after_raw <= 0 do
                          case maybe_prevent_fatal_damage(
                                 acc_state,
                                 splash_target["instanceId"],
                                 actor_id
                               ) do
                            {new_state, restored_hp} when is_integer(restored_hp) ->
                              {new_state, restored_hp}

                            {new_state, _} ->
                              {new_state, hp_after_raw}
                          end
                        else
                          {acc_state, hp_after_raw}
                        end

                      is_ko = hp_after <= 0

                      splash_evt =
                        new_event(acc_state, "damage", %{
                          "actorId" => actor_id,
                          "attackerId" => actor_id,
                          "targetId" => splash_target["instanceId"],
                          "amount" => splash_damage,
                          "damage" => splash_damage,
                          "hpBefore" => hp_before,
                          "hpAfter" => hp_after,
                          "isMiss" => dmg_ctx.is_miss,
                          "isCrit" => dmg_ctx.is_crit,
                          "typeMultiplier" => dmg_ctx.type_multiplier,
                          "damageReductionPct" => reduction_pct,
                          "splash" => true
                        })

                      acc_state2 =
                        acc_state
                        |> update_unit(
                          splash_target["instanceId"],
                          &apply_hp_change(&1, hp_after)
                        )
                        |> Map.put("rngIndex", new_rng_index)
                        |> append_log([splash_evt])

                      acc_state3 =
                        if is_ko do
                          ko_evt =
                            new_event(acc_state2, "ko", %{
                              "targetId" => splash_target["instanceId"],
                              "unitId" => splash_target["instanceId"],
                              "killerId" => actor_id
                            })

                          acc_state2
                          |> append_log([ko_evt])
                          |> trigger_ko_passives(splash_target["instanceId"])
                        else
                          acc_state2
                        end

                      acc_state3 =
                        trigger_post_damage_passives(
                          acc_state3,
                          actor_id,
                          splash_target["instanceId"],
                          splash_damage,
                          "ability"
                        )

                      {acc_state3, rng2}
                    else
                      {Map.put(acc_state, "rngIndex", new_rng_index), rng2}
                    end

                  _ ->
                    {acc_state, cur_rng}
                end
            end)

          state
        else
          state
        end
      else
        state
      end

    state
  end

  defp apply_ability_heal(state, actor_id, heal_pct) do
    {:ok, actor} = find_unit_across_players(state, actor_id)

    do_heal_unit(
      state,
      actor_id,
      actor["hp"],
      actor["maxHp"],
      floor(actor["maxHp"] * heal_pct),
      healer_id: actor_id
    )
  end

  defp apply_ability_heal_amount(state, unit_id, amount, opts \\ []) do
    {:ok, unit} = find_unit_across_players(state, unit_id)
    do_heal_unit(state, unit_id, unit["hp"], unit["maxHp"], amount, opts)
  end

  defp do_heal_unit(state, unit_id, hp_before, max_hp, amount, opts \\ []) do
    hp_after = min(max_hp, hp_before + amount)
    actual = hp_after - hp_before
    healer_id = Keyword.get(opts, :healer_id)

    if actual <= 0 do
      state
    else
      evt =
        new_event(state, "heal", %{
          "targetId" => unit_id,
          "unitId" => unit_id,
          "amount" => actual,
          "hpBefore" => hp_before,
          "hpAfter" => hp_after
        })

      state =
        state
        |> update_unit(unit_id, fn u -> Map.put(u, "hp", hp_after) end)
        |> append_log([evt])

      if healer_id do
        check_passives(state, "onHealAlly", %{
          "healerId" => healer_id,
          "targetId" => unit_id,
          "amount" => actual
        })
      else
        state
      end
    end
  end

  defp simulate_copy_action(state, acting_user_id, action) do
    actor_id = Map.get(action, "actorInstanceId", Map.get(action, :actor_instance_id))
    source_id = Map.get(action, "sourceInstanceId", Map.get(action, :source_instance_id))
    target_id = Map.get(action, "targetInstanceId", Map.get(action, :target_instance_id))
    copy_type = Map.get(action, "copyType", Map.get(action, :copy_type, "skill"))

    initial_log_length = length(state["log"])

    # Consume Stun
    {stun_extra, state} = maybe_consume_stun(state, actor_id)

    with {:ok, acting_player} <- find_player(state, acting_user_id),
         {:ok, actor} <- find_unit_across_players(state, actor_id),
         :ok <- validate_unit_belongs_to_player(state, actor_id, acting_user_id),
         :ok <- validate_unit_alive(actor, "actor"),
         {:ok, source_unit} <- find_unit_across_players(state, source_id),
         :ok <- validate_unit_alive(source_unit, "source") do
      # Resolve which ability key to copy from source
      copied_key =
        case copy_type do
          "ultimate" -> source_unit["ultimate"]
          _ -> source_unit["skill"]
        end

      if is_nil(copied_key) do
        {:error, :source_has_no_ability}
      else
        ability_defs = Map.get(state, "abilityDefinitions", %{})
        copied_def = Map.get(ability_defs, copied_key)

        if is_nil(copied_def) do
          {:error, :copied_ability_not_found}
        else
          # Actor's own copy ability key (for cooldown tracking)
          copy_ability_key = actor["skill"]

          with :ok <- validate_ability_cooldown(actor, copy_ability_key || ""),
               :ok <- validate_energy(acting_player, copied_def, stun_extra) do
            cost = (copied_def["cost"] || 0) + stun_extra
            is_ultimate = copy_type == "ultimate"

            # Deduct energy
            state =
              update_player(state, acting_user_id, fn p ->
                Map.update!(p, "energy", &(&1 - cost))
              end)

            # abilityStart event records both keys for client transparency
            ability_start_evt =
              new_event(state, "abilityStart", %{
                "actorId" => actor_id,
                "abilityKey" => copied_key,
                "copyKey" => copy_ability_key,
                "copiedKey" => copied_key,
                "targetId" => target_id
              })

            state = append_log(state, [ability_start_evt])

            # Dispatch the copied ability's payload
            state =
              dispatch_ability_payload(state, acting_user_id, actor_id, target_id, copied_def)

            # Set cooldown on the copy ability slot (not the copied ability's key)
            copy_def = if copy_ability_key, do: Map.get(ability_defs, copy_ability_key), else: nil
            cooldown_turns = if copy_def, do: copy_def["cooldown"], else: nil

            state =
              if cooldown_turns && cooldown_turns > 0 && copy_ability_key do
                update_unit(state, actor_id, fn u ->
                  Map.update!(u, "cooldowns", &Map.put(&1, copy_ability_key, cooldown_turns))
                end)
              else
                state
              end

            # usedUltimate if copy ability slot is ULTIMATE
            state =
              if is_ultimate do
                update_unit(state, actor_id, fn u -> Map.put(u, "usedUltimate", true) end)
              else
                state
              end

            # Game-over check
            state = maybe_end_game(state)

            events = Enum.drop(state["log"], initial_log_length)
            {:ok, state, events}
          end
        end
      end
    end
  end

  defp simulate_basic_attack(state, acting_user_id, action) do
    actor_id = Map.get(action, "actorInstanceId", Map.get(action, :actor_instance_id))

    requested_target_id =
      Map.get(action, "targetInstanceId", Map.get(action, :target_instance_id))

    # Consume Stun: costs +1 energy for basic attacks
    {stun_extra, state} = maybe_consume_stun(state, actor_id)

    # Taunt override + Stealth guard
    target_id = resolve_taunt_target(state, actor_id, requested_target_id)

    with {:ok, acting_player} <- find_player(state, acting_user_id),
         {:ok, actor} <- find_unit_across_players(state, actor_id),
         :ok <- validate_unit_belongs_to_player(state, actor_id, acting_user_id),
         {:ok, req_target} <- find_unit_across_players(state, target_id),
         :ok <- validate_target_is_enemy(state, actor_id, target_id),
         :ok <- validate_unit_alive(actor, "actor"),
         :ok <- validate_unit_alive(req_target, "target"),
         :ok <- guard_stealth_target(state, actor_id, target_id),
         :ok <- validate_basic_energy(acting_player, stun_extra) do
      # Cover redirect: check if target is covered by an ally
      effective_target_id =
        case find_unit_across_players(state, target_id) do
          {:ok, t} ->
            case get_status(t, "Cover") do
              %{"sourceInstanceId" => src_id} when not is_nil(src_id) ->
                case find_unit_across_players(state, src_id) do
                  {:ok, src} ->
                    if src["hp"] > 0 and not src["knockedOut"], do: src_id, else: target_id

                  _ ->
                    target_id
                end

              _ ->
                target_id
            end

          _ ->
            target_id
        end

      {:ok, actor} = find_unit_across_players(state, actor_id)
      {:ok, eff_target} = find_unit_across_players(state, effective_target_id)

      rng = make_rng(state["seed"], state["rngIndex"])
      {dmg_ctx, rng2} = calculate_damage(actor, eff_target, rng)
      {_, new_rng_index} = rng2

      log_base = length(state["log"])

      # Cover redirect event
      state =
        if effective_target_id != target_id do
          evt =
            new_event(state, "coverRedirect", %{
              "targetId" => target_id,
              "originalTargetId" => target_id,
              "redirectedToId" => effective_target_id
            })

          append_log(state, [evt])
        else
          state
        end

      # Miss event
      state =
        if dmg_ctx.is_miss do
          evt =
            new_event(state, "damage", %{
              "actorId" => actor_id,
              "attackerId" => actor_id,
              "targetId" => effective_target_id,
              "amount" => 0,
              "damage" => 0,
              "hpBefore" => eff_target["hp"],
              "hpAfter" => eff_target["hp"],
              "isMiss" => true,
              "isCrit" => false,
              "typeMultiplier" => dmg_ctx.type_multiplier
            })

          append_log(state, [evt])
        else
          state
        end

      state =
        if !dmg_ctx.is_miss do
          # Crit event
          state =
            if dmg_ctx.is_crit do
              evt =
                new_event(state, "crit", %{
                  "actorId" => actor_id,
                  "attackerId" => actor_id,
                  "targetId" => effective_target_id
                })

              append_log(state, [evt])
            else
              state
            end

          # Shield absorption
          raw_damage = dmg_ctx.final_damage
          reduction_pct = get_passive_damage_reduction_pct(state, eff_target)

          raw_damage =
            if raw_damage > 0 do
              max(0, floor(raw_damage * (1 - reduction_pct)))
            else
              0
            end

          {effective_damage, state} =
            apply_shield_absorption(state, effective_target_id, raw_damage)

          # Apply damage
          {:ok, target_before_dmg} = find_unit_across_players(state, effective_target_id)
          hp_before = target_before_dmg["hp"]
          hp_after_raw = max(0, hp_before - effective_damage)

          {state, hp_after} =
            if hp_after_raw <= 0 do
              case maybe_prevent_fatal_damage(state, effective_target_id, actor_id) do
                {new_state, restored_hp} when is_integer(restored_hp) -> {new_state, restored_hp}
                {new_state, _} -> {new_state, hp_after_raw}
              end
            else
              {state, hp_after_raw}
            end

          is_ko = hp_after <= 0

          damage_evt =
            new_event(state, "damage", %{
              "actorId" => actor_id,
              "attackerId" => actor_id,
              "targetId" => effective_target_id,
              "amount" => effective_damage,
              "damage" => effective_damage,
              "hpBefore" => hp_before,
              "hpAfter" => hp_after,
              "isMiss" => false,
              "isCrit" => dmg_ctx.is_crit,
              "typeMultiplier" => dmg_ctx.type_multiplier,
              "damageReductionPct" => reduction_pct
            })

          state =
            state
            |> update_unit(effective_target_id, &apply_hp_change(&1, hp_after))
            |> append_log([damage_evt])

          state =
            if is_ko do
              ko_evt =
                new_event(state, "ko", %{
                  "targetId" => effective_target_id,
                  "unitId" => effective_target_id,
                  "killerId" => actor_id
                })

              state
              |> append_log([ko_evt])
              |> trigger_ko_passives(effective_target_id)
            else
              state
            end

          state =
            if effective_damage > 0 do
              trigger_post_damage_passives(
                state,
                actor_id,
                effective_target_id,
                effective_damage,
                "basic"
              )
            else
              state
            end

          # Empower: consume after attack
          state =
            if has_status(actor, "Empower") do
              emp_evt =
                new_event(state, "statusExpire", %{
                  "targetId" => actor_id,
                  "unitId" => actor_id,
                  "statusName" => "Empower",
                  "status" => "Empower",
                  "consumed" => true
                })

              state =
                update_unit(state, actor_id, fn u -> remove_status_from_unit(u, "Empower") end)

              append_log(state, [emp_evt])
            else
              state
            end

          # Thorns: 15% of effective_damage back to attacker
          {:ok, target_after_dmg} = find_unit_across_players(state, effective_target_id)

          state =
            if !is_ko and has_status(target_after_dmg, "Thorns") and effective_damage > 0 do
              thorns_dmg = max(1, floor(effective_damage * 0.15))
              {:ok, att} = find_unit_across_players(state, actor_id)
              att_hp_before = att["hp"]
              att_hp_after = max(0, att_hp_before - thorns_dmg)
              att_ko = att_hp_after <= 0

              thorns_evt =
                new_event(state, "thorns", %{
                  "sourceId" => effective_target_id,
                  "targetId" => actor_id,
                  "amount" => thorns_dmg,
                  "damage" => thorns_dmg,
                  "hpBefore" => att_hp_before,
                  "hpAfter" => att_hp_after
                })

              state = update_unit(state, actor_id, &apply_hp_change(&1, att_hp_after))
              state = append_log(state, [thorns_evt])

              state =
                trigger_post_damage_passives(
                  state,
                  effective_target_id,
                  actor_id,
                  thorns_dmg,
                  "status"
                )

              if att_ko do
                ko_evt =
                  new_event(state, "ko", %{
                    "targetId" => actor_id,
                    "unitId" => actor_id,
                    "killerId" => effective_target_id
                  })

                state
                |> append_log([ko_evt])
                |> trigger_ko_passives(actor_id)
              else
                state
              end
            else
              state
            end

          # Counter: retaliate, consume Counter
          {:ok, target_after_thorns} = find_unit_across_players(state, effective_target_id)

          state =
            if !is_ko and has_status(target_after_thorns, "Counter") and effective_damage > 0 do
              {:ok, att2} = find_unit_across_players(state, actor_id)
              counter_dmg = max(1, floor(target_after_thorns["attack"] * 0.5))
              att_hp_before = att2["hp"]
              att_hp_after = max(0, att_hp_before - counter_dmg)
              att_ko = att_hp_after <= 0

              counter_evt =
                new_event(state, "counter", %{
                  "sourceId" => effective_target_id,
                  "targetId" => actor_id,
                  "amount" => counter_dmg,
                  "damage" => counter_dmg,
                  "hpBefore" => att_hp_before,
                  "hpAfter" => att_hp_after
                })

              counter_expire_evt =
                new_event(state, "statusExpire", %{
                  "targetId" => effective_target_id,
                  "unitId" => effective_target_id,
                  "statusName" => "Counter",
                  "status" => "Counter",
                  "consumed" => true
                })

              state = update_unit(state, actor_id, &apply_hp_change(&1, att_hp_after))

              state =
                update_unit(state, effective_target_id, fn u ->
                  remove_status_from_unit(u, "Counter")
                end)

              state = append_log(state, [counter_evt, counter_expire_evt])

              state =
                trigger_post_damage_passives(
                  state,
                  effective_target_id,
                  actor_id,
                  counter_dmg,
                  "status"
                )

              if att_ko do
                ko_evt =
                  new_event(state, "ko", %{
                    "targetId" => actor_id,
                    "unitId" => actor_id,
                    "killerId" => effective_target_id
                  })

                state
                |> append_log([ko_evt])
                |> trigger_ko_passives(actor_id)
              else
                state
              end
            else
              state
            end

          state
        else
          state
        end

      state = Map.put(state, "rngIndex", new_rng_index)

      # Check game over
      new_state = maybe_end_game(state)

      final_events = new_state["log"] |> Enum.drop(log_base)
      {:ok, new_state, final_events}
    end
  end

  defp validate_basic_energy(player, extra_cost) do
    # Basic attacks have no energy cost unless stunned (+1)
    if extra_cost > 0 and player["energy"] < extra_cost do
      {:error, :not_enough_energy}
    else
      :ok
    end
  end

  @doc """
  Simulate end of turn. Optional swap action.
  Returns {new_state, events}.
  """
  def simulate_end_turn(state, swap_opt \\ nil) do
    events_before = length(state["log"])
    current_player_id = state["currentPlayerId"]

    state = check_passives(state, "onEndTurn", %{"playerId" => current_player_id})

    state =
      if swap_opt do
        active_id = Map.get(swap_opt, "activeInstanceId", Map.get(swap_opt, :active_instance_id))
        bench_id = Map.get(swap_opt, "benchInstanceId", Map.get(swap_opt, :bench_instance_id))
        apply_swap(state, current_player_id, active_id, bench_id)
      else
        state
      end

    other_player_id = other_player(state, current_player_id)

    turn_end_event = new_event(state, "turnEnd", %{"playerId" => current_player_id})

    state =
      state
      |> Map.put("currentPlayerId", other_player_id)
      |> Map.update!("turn", &(&1 + 1))
      |> Map.put("actionsThisTurn", [])
      |> append_log([turn_end_event])

    {:ok, next_player} = find_player(state, other_player_id)
    granted_energy = min(5, (next_player["energy"] || 0) + 1)

    state =
      state
      |> update_player(other_player_id, fn p ->
        p
        |> Map.put("energy", granted_energy)
        |> Map.put("hasUsedFreeBasic", false)
      end)
      |> append_log([
        new_event(state, "energyGrant", %{
          "playerId" => other_player_id,
          "amount" => granted_energy
        })
      ])

    {state, _cooldown_events} = tick_player_cooldowns(state, other_player_id)

    # Tick statuses for the player whose turn is starting
    {state, _tick_events} = tick_statuses(state, other_player_id)

    # Check if DoT ended the game
    state = maybe_end_game(state)

    state = check_passives(state, "onStartTurn", %{"playerId" => other_player_id})

    turn_start_event = new_event(state, "turnStart", %{"playerId" => other_player_id})
    state = append_log(state, [turn_start_event])

    new_events = state["log"] |> Enum.drop(events_before)
    {state, new_events}
  end

  @doc """
  Simulate a player conceding the match.
  Returns {new_state, events}.
  """
  def simulate_concede(state, conceding_user_id) do
    events_before = length(state["log"])
    winner_id = other_player(state, conceding_user_id)

    concede_event = new_event(state, "concede", %{"playerId" => conceding_user_id})

    state =
      state
      |> append_log([concede_event])
      |> Map.put("phase", "ended")
      |> Map.put("winnerId", winner_id)

    state = append_log(state, [new_event(state, "gameOver", %{"winnerId" => winner_id})])
    new_events = state["log"] |> Enum.drop(events_before)
    {state, new_events}
  end

  @doc """
  Check if the game is over. Returns {:over, winner_id} or :ongoing.
  """
  def check_game_over(state) do
    [p1, p2] = state["players"]

    p1_alive = Enum.any?(p1["units"] ++ p1["bench"], &(&1["hp"] > 0))
    p2_alive = Enum.any?(p2["units"] ++ p2["bench"], &(&1["hp"] > 0))

    cond do
      !p1_alive && !p2_alive -> {:over, nil}
      !p1_alive -> {:over, p2["userId"]}
      !p2_alive -> {:over, p1["userId"]}
      true -> :ongoing
    end
  end

  defp maybe_end_game(state) do
    case check_game_over(state) do
      {:over, winner_id} ->
        state
        |> Map.put("phase", "ended")
        |> Map.put("winnerId", winner_id)
        |> append_log([new_event(state, "gameOver", %{"winnerId" => winner_id})])

      :ongoing ->
        state
    end
  end

  @doc """
  Build a view of the state for a specific viewer (adds isMyTurn, myUserId).
  """
  def build_view(state, viewer_id) do
    state
    |> normalize_view_types()
    |> Map.put("myUserId", viewer_id)
    |> Map.put("isMyTurn", state["currentPlayerId"] == viewer_id)
  end

  @doc """
  Build a spectator view of the state with the same normalized shape as player views.
  """
  def build_spectator_view(state) do
    state
    |> normalize_view_types()
    |> Map.put("myUserId", nil)
    |> Map.put("isMyTurn", false)
  end

  defp normalize_view_types(state) do
    Map.update!(state, "players", fn players ->
      Enum.map(players, fn player ->
        player
        |> Map.update!("units", fn units ->
          Enum.map(units, fn unit ->
            Map.update!(unit, "type", fn type -> CardType.canonicalize!(type) end)
          end)
        end)
        |> Map.update!("bench", fn bench ->
          Enum.map(bench, fn unit ->
            Map.update!(unit, "type", fn type -> CardType.canonicalize!(type) end)
          end)
        end)
      end)
    end)
  end

  # ── Private Helpers ───────────────────────────────────────────────────────

  defp new_event(state, type, payload) do
    seq = length(state["log"])
    %{"seq" => seq, "turn" => state["turn"], "type" => type, "payload" => payload}
  end

  defp append_log(state, events) do
    Map.update!(state, "log", &(&1 ++ events))
  end

  defp find_player(state, user_id) do
    case Enum.find(state["players"], &(&1["userId"] == user_id)) do
      nil -> {:error, :player_not_found}
      p -> {:ok, p}
    end
  end

  defp find_unit_across_players(state, instance_id) do
    all_units =
      state["players"]
      |> Enum.flat_map(fn p -> p["units"] ++ p["bench"] end)

    case Enum.find(all_units, &(&1["instanceId"] == instance_id)) do
      nil -> {:error, :unit_not_found}
      u -> {:ok, u}
    end
  end

  defp validate_unit_belongs_to_player(state, instance_id, user_id) do
    player = Enum.find(state["players"], &(&1["userId"] == user_id))

    if player do
      all_units = player["units"] ++ player["bench"]

      if Enum.any?(all_units, &(&1["instanceId"] == instance_id)) do
        :ok
      else
        {:error, :unit_not_yours}
      end
    else
      {:error, :player_not_found}
    end
  end

  defp validate_target_is_enemy(state, actor_id, target_id) do
    actor_player =
      Enum.find(state["players"], fn p ->
        all = p["units"] ++ p["bench"]
        Enum.any?(all, &(&1["instanceId"] == actor_id))
      end)

    if actor_player do
      all_actor_units = actor_player["units"] ++ actor_player["bench"]

      if Enum.any?(all_actor_units, &(&1["instanceId"] == target_id)) do
        {:error, :cannot_target_ally}
      else
        :ok
      end
    else
      {:error, :actor_player_not_found}
    end
  end

  defp validate_unit_alive(unit, label) do
    if unit["hp"] > 0 && !unit["knockedOut"] do
      :ok
    else
      {:error, String.to_atom("#{label}_is_ko")}
    end
  end

  defp update_unit(state, instance_id, fun) do
    Map.update!(state, "players", fn players ->
      Enum.map(players, fn player ->
        player
        |> Map.update!("units", fn units ->
          Enum.map(units, fn u ->
            if u["instanceId"] == instance_id, do: fun.(u), else: u
          end)
        end)
        |> Map.update!("bench", fn bench ->
          Enum.map(bench, fn u ->
            if u["instanceId"] == instance_id, do: fun.(u), else: u
          end)
        end)
      end)
    end)
  end

  defp update_player(state, user_id, fun) do
    Map.update!(state, "players", fn players ->
      Enum.map(players, fn p ->
        if p["userId"] == user_id, do: fun.(p), else: p
      end)
    end)
  end

  defp other_player(state, user_id) do
    state["players"]
    |> Enum.find(fn p -> p["userId"] != user_id end)
    |> Map.get("userId")
  end

  defp tick_player_cooldowns(state, user_id) do
    case find_player(state, user_id) do
      {:ok, player} ->
        units = player["units"] ++ player["bench"]

        Enum.reduce(units, {state, []}, fn unit, {acc_state, events} ->
          {updated_state, unit_events} = tick_unit_cooldowns(acc_state, unit)
          {updated_state, events ++ unit_events}
        end)

      {:error, _} ->
        {state, []}
    end
  end

  defp tick_unit_cooldowns(state, unit) do
    {new_cooldowns, events} =
      Enum.reduce(unit["cooldowns"] || %{}, {%{}, []}, fn {key, val}, {acc, events} ->
        new_val = val - 1

        payload = %{
          "targetId" => unit["instanceId"],
          "unitId" => unit["instanceId"],
          "abilityKey" => key,
          "remaining" => max(new_val, 0)
        }

        event = new_event(state, "cooldownTick", payload)

        if new_val > 0 do
          {Map.put(acc, key, new_val), events ++ [event]}
        else
          {acc, events ++ [event]}
        end
      end)

    new_state =
      update_unit(state, unit["instanceId"], fn u -> Map.put(u, "cooldowns", new_cooldowns) end)

    {append_log(new_state, events), events}
  end

  defp apply_swap(state, player_id, active_id, bench_id) do
    state =
      state
      |> Map.update!("players", fn players ->
        Enum.map(players, fn player ->
          all = player["units"] ++ player["bench"]
          active_unit = Enum.find(all, &(&1["instanceId"] == active_id))
          bench_unit = Enum.find(all, &(&1["instanceId"] == bench_id))

          if active_unit && bench_unit do
            position = active_unit["position"]

            # Rebuild: active stays in units (with bench card), bench gets active card
            swapped_units =
              Enum.map(player["units"], fn u ->
                if u["instanceId"] == active_id do
                  Map.put(bench_unit, "position", position)
                else
                  u
                end
              end)

            swapped_bench =
              Enum.map(player["bench"], fn u ->
                if u["instanceId"] == bench_id do
                  Map.put(active_unit, "position", nil)
                else
                  u
                end
              end)

            # Apply SummoningSickness to the incoming bench unit (now active)
            swapped_units =
              Enum.map(swapped_units, fn u ->
                if u["instanceId"] == bench_id do
                  ss_entry = %{
                    "name" => "SummoningSickness",
                    "duration" => 1,
                    "magnitude" => nil,
                    "sourceInstanceId" => nil,
                    "appliedAt" => 0
                  }

                  Map.update!(u, "statuses", &(&1 ++ [ss_entry]))
                else
                  u
                end
              end)

            player
            |> Map.put("units", swapped_units)
            |> Map.put("bench", swapped_bench)
          else
            player
          end
        end)
      end)

    append_log(state, [
      new_event(state, "swap", %{
        "playerId" => player_id,
        "activeOut" => active_id,
        "benchIn" => bench_id
      })
    ])
  end
end
