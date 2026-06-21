defmodule AdventureTimeApi.Pvp.BattleEngineCoreTest do
  use ExUnit.Case, async: true

  alias AdventureTimeApi.Pvp.BattleEngine

  defp make_unit(overrides \\ %{}) do
    Map.merge(
      %{
        "instanceId" => "u1",
        "cardId" => "card1",
        "name" => "Test Unit",
        "character" => "Test Unit",
        "type" => "Hero",
        "rarity" => "Common",
        "hp" => 100,
        "maxHp" => 100,
        "attack" => 50,
        "defense" => 30,
        "speed" => 40,
        "statuses" => [],
        "cooldowns" => %{},
        "usedUltimate" => false,
        "knockedOut" => false,
        "position" => 1,
        "passives" => [],
        "passiveTriggered" => %{},
        "skill" => nil,
        "ultimate" => nil
      },
      overrides
    )
  end

  defp make_card(overrides) do
    Map.merge(
      %{
        "id" => "card1",
        "name" => "Test Card",
        "character" => "Test Card",
        "type" => "Hero",
        "hp" => 100,
        "attack" => 50,
        "defense" => 30,
        "speed" => 40,
        "rarity_name" => "Common"
      },
      overrides
    )
  end

  defp make_state(opts \\ []) do
    p1_units = Keyword.get(opts, :p1_units, [make_unit(%{"instanceId" => "p1u1"})])
    p2_units = Keyword.get(opts, :p2_units, [make_unit(%{"instanceId" => "p2u1"})])
    p1_bench = Keyword.get(opts, :p1_bench, [])
    p2_bench = Keyword.get(opts, :p2_bench, [])

    %{
      "id" => "match1",
      "seed" => Keyword.get(opts, :seed, "testseed"),
      "rngIndex" => Keyword.get(opts, :rng_index, 0),
      "turn" => Keyword.get(opts, :turn, 1),
      "phase" => "active",
      "currentPlayerId" => Keyword.get(opts, :current_player_id, "player1"),
      "winnerId" => nil,
      "players" => [
        %{
          "userId" => "player1",
          "displayName" => "P1",
          "energy" => Keyword.get(opts, :p1_energy, 3),
          "initiative" => 40,
          "hasUsedFreeBasic" => false,
          "units" => p1_units,
          "bench" => p1_bench
        },
        %{
          "userId" => "player2",
          "displayName" => "P2",
          "energy" => Keyword.get(opts, :p2_energy, 3),
          "initiative" => 40,
          "hasUsedFreeBasic" => false,
          "units" => p2_units,
          "bench" => p2_bench
        }
      ],
      "log" => [],
      "actionsThisTurn" => [],
      "abilityDefinitions" => %{}
    }
  end

  defp get_unit(state, instance_id) do
    state["players"]
    |> Enum.flat_map(fn player -> player["units"] ++ player["bench"] end)
    |> Enum.find(&(&1["instanceId"] == instance_id))
  end

  defp get_player(state, user_id) do
    Enum.find(state["players"], &(&1["userId"] == user_id))
  end

  defp put_ability(state, ability_def) do
    put_in(state, ["abilityDefinitions", ability_def["key"]], ability_def)
  end

  defp assign_slot(state, user_id, instance_id, slot, ability_key) do
    update_in(state, ["players"], fn players ->
      Enum.map(players, fn player ->
        if player["userId"] == user_id do
          units =
            Enum.map(player["units"], fn unit ->
              if unit["instanceId"] == instance_id do
                Map.put(unit, slot, ability_key)
              else
                unit
              end
            end)

          Map.put(player, "units", units)
        else
          player
        end
      end)
    end)
  end

  test "create_battle_state chooses higher initiative player and applies rarity bonuses" do
    inviter_cards = [
      %{
        "id" => "inv-1",
        "name" => "Finn",
        "character" => "Finn",
        "type" => "Hero",
        "hp" => 100,
        "attack" => 50,
        "defense" => 20,
        "speed" => 60,
        "rarity_name" => "Legendary"
      },
      %{
        "id" => "inv-2",
        "name" => "Jake",
        "character" => "Jake",
        "type" => "Hero",
        "hp" => 90,
        "attack" => 40,
        "defense" => 20,
        "speed" => 55,
        "rarity_name" => "Common"
      },
      %{
        "id" => "inv-3",
        "name" => "BMO",
        "character" => "BMO",
        "type" => "Tech",
        "hp" => 80,
        "attack" => 35,
        "defense" => 30,
        "speed" => 45,
        "rarity_name" => "Common"
      },
      %{
        "id" => "inv-4",
        "name" => "Bench Hero",
        "character" => "Bench Hero",
        "type" => "Hero",
        "hp" => 70,
        "attack" => 25,
        "defense" => 25,
        "speed" => 30,
        "rarity_name" => "Common"
      }
    ]

    invitee_cards =
      Enum.map(1..4, fn idx ->
        %{
          "id" => "opp-#{idx}",
          "name" => "Opponent #{idx}",
          "character" => "Opponent #{idx}",
          "type" => "Ice",
          "hp" => 90,
          "attack" => 35,
          "defense" => 25,
          "speed" => 25,
          "rarity_name" => "Common"
        }
      end)

    {state, _seed} =
      BattleEngine.create_battle_state(
        "match-init",
        %{user_id: "player1", display_name: "Inviter", cards: inviter_cards},
        %{user_id: "player2", display_name: "Invitee", cards: invitee_cards}
      )

    assert state["currentPlayerId"] == "player1"
    assert length(Enum.at(state["players"], 0)["units"]) == 3
    assert length(Enum.at(state["players"], 0)["bench"]) == 1

    boosted = get_unit(state, "inv-1-player1-1")
    bench = get_unit(state, "inv-4-player1-4")

    assert boosted["maxHp"] == 105
    assert boosted["attack"] == 51
    assert boosted["position"] == 1
    assert bench["position"] == nil
  end

  test "create_battle_state exposes initiative tie roll in match start payload" do
    inviter_cards = [make_card(%{"id" => "inv-1"})]
    invitee_cards = [make_card(%{"id" => "opp-1"})]

    {state, _seed} =
      BattleEngine.create_battle_state(
        "match-init",
        %{user_id: "player1", display_name: "Inviter", cards: inviter_cards},
        %{user_id: "player2", display_name: "Invitee", cards: invitee_cards}
      )

    payload = state["log"] |> hd() |> Map.fetch!("payload")

    assert payload["initiativeTieChance"] == 0.5
    assert is_number(payload["initiativeTieRoll"])
    assert payload["initiativeTieWinnerId"] == payload["firstMoverId"]
  end

  test "basic attack reflects type advantage and disadvantage in damage events" do
    advantage_state =
      make_state(
        p1_units: [make_unit(%{"instanceId" => "p1u1", "type" => "Hero"})],
        p2_units: [make_unit(%{"instanceId" => "p2u1", "type" => "Undead"})]
      )

    neutral_state =
      make_state(
        p1_units: [make_unit(%{"instanceId" => "p1u1", "type" => "Hero"})],
        p2_units: [make_unit(%{"instanceId" => "p2u1", "type" => "Tech"})]
      )

    disadvantage_state =
      make_state(
        p1_units: [make_unit(%{"instanceId" => "p1u1", "type" => "Hero"})],
        p2_units: [make_unit(%{"instanceId" => "p2u1", "type" => "Ice"})]
      )

    {:ok, _, adv_events} =
      BattleEngine.simulate_action(advantage_state, "player1", %{
        "kind" => "basic",
        "actorInstanceId" => "p1u1",
        "targetInstanceId" => "p2u1"
      })

    {:ok, _, neutral_events} =
      BattleEngine.simulate_action(neutral_state, "player1", %{
        "kind" => "basic",
        "actorInstanceId" => "p1u1",
        "targetInstanceId" => "p2u1"
      })

    {:ok, _, disadv_events} =
      BattleEngine.simulate_action(disadvantage_state, "player1", %{
        "kind" => "basic",
        "actorInstanceId" => "p1u1",
        "targetInstanceId" => "p2u1"
      })

    adv_damage = Enum.find(adv_events, &(&1["type"] == "damage"))["payload"]
    neutral_damage = Enum.find(neutral_events, &(&1["type"] == "damage"))["payload"]
    disadv_damage = Enum.find(disadv_events, &(&1["type"] == "damage"))["payload"]

    assert adv_damage["typeMultiplier"] == 1.25
    assert neutral_damage["typeMultiplier"] == 1.0
    assert disadv_damage["typeMultiplier"] == 0.8
    assert adv_damage["damage"] > neutral_damage["damage"]
    assert neutral_damage["damage"] > disadv_damage["damage"]
  end

  test "basic attack emits deterministic crit and miss events for known rng indexes" do
    crit_state = make_state(rng_index: 24)
    miss_state = make_state(rng_index: 30)

    {:ok, _, crit_events} =
      BattleEngine.simulate_action(crit_state, "player1", %{
        "kind" => "basic",
        "actorInstanceId" => "p1u1",
        "targetInstanceId" => "p2u1"
      })

    {:ok, _, miss_events} =
      BattleEngine.simulate_action(miss_state, "player1", %{
        "kind" => "basic",
        "actorInstanceId" => "p1u1",
        "targetInstanceId" => "p2u1"
      })

    crit_damage = Enum.find(crit_events, &(&1["type"] == "damage"))["payload"]
    miss_damage = Enum.find(miss_events, &(&1["type"] == "damage"))["payload"]

    assert Enum.any?(crit_events, &(&1["type"] == "crit"))
    assert crit_damage["isCrit"] == true
    assert crit_damage["isMiss"] == false
    assert is_number(crit_damage["missRoll"])
    assert is_number(crit_damage["missChance"])
    assert is_number(crit_damage["critRoll"])
    assert is_number(crit_damage["critChance"])
    assert miss_damage["isMiss"] == true
    assert miss_damage["damage"] == 0
    assert is_number(miss_damage["missRoll"])
    assert is_number(miss_damage["missChance"])
    assert is_nil(miss_damage["critRoll"])
    assert is_number(miss_damage["critChance"])
  end

  test "skill spends energy, sets cooldown, and ultimate marks usedUltimate" do
    skill = %{
      "key" => "test.skill",
      "type" => "SKILL",
      "cost" => 1,
      "cooldown" => 2,
      "oncePerMatch" => false,
      "payload" => %{"damageMul" => 1.0}
    }

    ultimate = %{
      "key" => "test.ultimate",
      "type" => "ULTIMATE",
      "cost" => 0,
      "cooldown" => nil,
      "oncePerMatch" => true,
      "payload" => %{"healPctOfMaxHp" => 0.2}
    }

    state =
      make_state()
      |> put_ability(skill)
      |> put_ability(ultimate)
      |> assign_slot("player1", "p1u1", "skill", "test.skill")
      |> assign_slot("player1", "p1u1", "ultimate", "test.ultimate")

    {:ok, after_skill, _} =
      BattleEngine.simulate_action(state, "player1", %{
        "kind" => "skill",
        "actorInstanceId" => "p1u1",
        "targetInstanceId" => "p2u1"
      })

    assert get_player(after_skill, "player1")["energy"] == 2
    assert get_unit(after_skill, "p1u1")["cooldowns"] == %{"test.skill" => 2}

    assert BattleEngine.simulate_action(after_skill, "player1", %{
             "kind" => "skill",
             "actorInstanceId" => "p1u1",
             "targetInstanceId" => "p2u1"
           }) ==
             {:error, :ability_on_cooldown}

    {:ok, after_ultimate, _} =
      BattleEngine.simulate_action(state, "player1", %{
        "kind" => "ultimate",
        "actorInstanceId" => "p1u1",
        "targetInstanceId" => "p2u1"
      })

    assert get_unit(after_ultimate, "p1u1")["usedUltimate"] == true

    assert BattleEngine.simulate_action(after_ultimate, "player1", %{
             "kind" => "ultimate",
             "actorInstanceId" => "p1u1",
             "targetInstanceId" => "p2u1"
           }) ==
             {:error, :ultimate_already_used}
  end

  test "cooldowns tick down when the owning player's turn starts again" do
    skill = %{
      "key" => "test.skill",
      "type" => "SKILL",
      "cost" => 1,
      "cooldown" => 2,
      "oncePerMatch" => false,
      "payload" => %{"damageMul" => 1.0}
    }

    state =
      make_state()
      |> put_ability(skill)
      |> assign_slot("player1", "p1u1", "skill", "test.skill")

    {:ok, after_skill, skill_events} =
      BattleEngine.simulate_action(state, "player1", %{
        "kind" => "skill",
        "actorInstanceId" => "p1u1",
        "targetInstanceId" => "p2u1"
      })

    damage_event = Enum.find(skill_events, &(&1["type"] == "damage"))
    assert damage_event["payload"]["actorId"] == "p1u1"
    assert damage_event["payload"]["targetId"] == "p2u1"
    assert is_integer(damage_event["payload"]["amount"])

    {after_p1_end, p1_end_events} = BattleEngine.simulate_end_turn(after_skill)
    assert get_unit(after_p1_end, "p1u1")["cooldowns"] == %{"test.skill" => 2}
    assert Enum.any?(p1_end_events, &(&1["type"] == "energyGrant"))

    {after_p2_end, p2_end_events} = BattleEngine.simulate_end_turn(after_p1_end)
    assert get_unit(after_p2_end, "p1u1")["cooldowns"] == %{"test.skill" => 1}

    assert Enum.any?(p2_end_events, fn event ->
             event["type"] == "cooldownTick" and
               event["payload"]["targetId"] == "p1u1" and
               event["payload"]["abilityKey"] == "test.skill" and
               event["payload"]["remaining"] == 1
           end)

    {after_p1_end_again, _} = BattleEngine.simulate_end_turn(after_p2_end)
    {after_p2_end_again, final_events} = BattleEngine.simulate_end_turn(after_p1_end_again)
    assert get_unit(after_p2_end_again, "p1u1")["cooldowns"] == %{}

    assert Enum.any?(final_events, fn event ->
             event["type"] == "cooldownTick" and
               event["payload"]["targetId"] == "p1u1" and
               event["payload"]["abilityKey"] == "test.skill" and
               event["payload"]["remaining"] == 0
           end)
  end

  test "returns not_enough_energy when a skill costs more than current energy" do
    expensive_skill = %{
      "key" => "test.expensive",
      "type" => "SKILL",
      "cost" => 4,
      "cooldown" => nil,
      "oncePerMatch" => false,
      "payload" => %{"damageMul" => 1.0}
    }

    state =
      make_state(p1_energy: 1)
      |> put_ability(expensive_skill)
      |> assign_slot("player1", "p1u1", "skill", "test.expensive")

    assert BattleEngine.simulate_action(state, "player1", %{
             "kind" => "skill",
             "actorInstanceId" => "p1u1",
             "targetInstanceId" => "p2u1"
           }) == {:error, :not_enough_energy}
  end

  test "fatal damage ends the match and records winner" do
    state =
      make_state(
        p1_units: [make_unit(%{"instanceId" => "p1u1", "attack" => 500})],
        p2_units: [
          make_unit(%{"instanceId" => "p2u1", "hp" => 10, "maxHp" => 10, "defense" => 0})
        ]
      )

    {:ok, new_state, events} =
      BattleEngine.simulate_action(state, "player1", %{
        "kind" => "basic",
        "actorInstanceId" => "p1u1",
        "targetInstanceId" => "p2u1"
      })

    assert new_state["phase"] == "ended"
    assert new_state["winnerId"] == "player1"
    assert get_unit(new_state, "p2u1")["knockedOut"] == true
    assert Enum.any?(events, &(&1["type"] == "ko"))
    assert Enum.any?(new_state["log"], &(&1["type"] == "gameOver"))
  end

  test "end turn swap promotes a bench unit and applies SummoningSickness" do
    state =
      make_state(
        p1_units: [
          make_unit(%{"instanceId" => "p1u1", "position" => 1}),
          make_unit(%{"instanceId" => "p1u2", "position" => 2}),
          make_unit(%{"instanceId" => "p1u3", "position" => 3})
        ],
        p1_bench: [make_unit(%{"instanceId" => "p1b1", "position" => nil})]
      )

    {new_state, events} =
      BattleEngine.simulate_end_turn(state, %{
        "activeInstanceId" => "p1u1",
        "benchInstanceId" => "p1b1"
      })

    incoming = get_unit(new_state, "p1b1")
    outgoing = get_unit(new_state, "p1u1")

    assert incoming["position"] == 1
    assert outgoing["position"] == nil
    assert Enum.any?(incoming["statuses"], &(&1["name"] == "SummoningSickness"))
    assert new_state["currentPlayerId"] == "player2"
    assert new_state["turn"] == 2

    assert Enum.any?(events, fn event ->
             event["type"] == "swap" and
               event["payload"]["playerId"] == "player1" and
               event["payload"]["activeOut"] == "p1u1" and
               event["payload"]["benchIn"] == "p1b1"
           end)

    assert Enum.any?(events, fn event ->
             event["type"] == "energyGrant" and
               event["payload"]["playerId"] == "player2"
           end)

    assert Enum.any?(events, &(&1["type"] == "turnEnd"))
    assert Enum.any?(events, &(&1["type"] == "turnStart"))
  end
end
