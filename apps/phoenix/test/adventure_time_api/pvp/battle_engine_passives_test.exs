defmodule AdventureTimeApi.Pvp.BattleEnginePassivesTest do
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

  defp make_state(opts \\ []) do
    p1_units = Keyword.get(opts, :p1_units, [make_unit(%{"instanceId" => "p1u1"})])
    p2_units = Keyword.get(opts, :p2_units, [make_unit(%{"instanceId" => "p2u1"})])

    %{
      "id" => "match1",
      "seed" => "testseed",
      "rngIndex" => 0,
      "turn" => 1,
      "phase" => "active",
      "currentPlayerId" => Keyword.get(opts, :current_player_id, "player1"),
      "winnerId" => nil,
      "players" => [
        %{
          "userId" => "player1",
          "displayName" => "P1",
          "energy" => 5,
          "initiative" => 40,
          "hasUsedFreeBasic" => false,
          "units" => p1_units,
          "bench" => []
        },
        %{
          "userId" => "player2",
          "displayName" => "P2",
          "energy" => 5,
          "initiative" => 40,
          "hasUsedFreeBasic" => false,
          "units" => p2_units,
          "bench" => []
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

  defp put_ability(state, key, payload) do
    put_in(state, ["abilityDefinitions", key], %{
      "key" => key,
      "type" => "PASSIVE",
      "cost" => 0,
      "cooldown" => nil,
      "oncePerMatch" => false,
      "payload" => payload
    })
  end

  defp assign_passive(state, user_id, instance_id, passive_key) do
    update_in(state, ["players"], fn players ->
      Enum.map(players, fn player ->
        if player["userId"] == user_id do
          units =
            Enum.map(player["units"], fn unit ->
              if unit["instanceId"] == instance_id do
                unit
                |> Map.put("passives", [passive_key])
                |> Map.put("passiveTriggered", %{})
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

  test "onBattleInit statBonus permanently boosts stats" do
    state =
      make_state()
      |> put_ability("passive.bonus", %{
        "trigger" => "onBattleInit",
        "statBonus" => %{"hp" => 0.2, "attack" => 0.1}
      })
      |> assign_passive("player1", "p1u1", "passive.bonus")

    new_state = BattleEngine.initialize_passives(state)
    unit = get_unit(new_state, "p1u1")

    assert unit["maxHp"] == 120
    assert unit["hp"] == 120
    assert unit["attack"] == 55
    assert Enum.any?(new_state["log"], &(&1["type"] == "passiveTrigger"))
  end

  test "onActionStart once passive triggers only once" do
    state =
      make_state(
        p1_units: [
          make_unit(%{"instanceId" => "p1u1", "hp" => 40, "maxHp" => 100})
        ]
      )
      |> put_ability("passive.battle_ready", %{
        "trigger" => "onActionStart",
        "once" => true,
        "healPctOfMaxHp" => 0.2
      })
      |> assign_passive("player1", "p1u1", "passive.battle_ready")

    {:ok, state1, _} =
      BattleEngine.simulate_action(state, "player1", %{
        "kind" => "basic",
        "actorInstanceId" => "p1u1",
        "targetInstanceId" => "p2u1"
      })

    {:ok, state2, _} =
      BattleEngine.simulate_action(state1, "player1", %{
        "kind" => "basic",
        "actorInstanceId" => "p1u1",
        "targetInstanceId" => "p2u1"
      })

    assert get_unit(state1, "p1u1")["hp"] == 60
    assert get_unit(state2, "p1u1")["hp"] == 60
    assert get_unit(state2, "p1u1")["passiveTriggered"]["passive.battle_ready"] == true
  end

  test "onBelowHp threshold passive fires after damage" do
    state =
      make_state(
        p2_units: [
          make_unit(%{"instanceId" => "p2u1", "hp" => 70, "maxHp" => 100, "defense" => 0})
        ]
      )
      |> put_ability("passive.last_stand", %{
        "trigger" => "onBelowHp",
        "thresholdPct" => 0.8,
        "healPctOfMaxHp" => 0.25
      })
      |> assign_passive("player2", "p2u1", "passive.last_stand")

    {:ok, new_state, _} =
      BattleEngine.simulate_action(state, "player1", %{
        "kind" => "basic",
        "actorInstanceId" => "p1u1",
        "targetInstanceId" => "p2u1"
      })

    assert get_unit(new_state, "p2u1")["hp"] > 0

    assert Enum.any?(new_state["log"], fn event ->
             event["type"] == "passiveTrigger" and
               event["payload"]["passiveKey"] == "passive.last_stand"
           end)
  end

  test "onAllyFatalDamage passive revives ally before ko" do
    state =
      make_state(
        p1_units: [make_unit(%{"instanceId" => "p1u1", "attack" => 200, "defense" => 0})],
        p2_units: [
          make_unit(%{"instanceId" => "p2u1", "hp" => 20, "maxHp" => 100, "defense" => 0}),
          make_unit(%{"instanceId" => "p2u2", "hp" => 100, "maxHp" => 100, "position" => 2})
        ]
      )
      |> put_ability("passive.guardian", %{
        "trigger" => "onAllyFatalDamage",
        "once" => true,
        "revivePct" => 0.3
      })
      |> assign_passive("player2", "p2u2", "passive.guardian")

    {:ok, new_state, _} =
      BattleEngine.simulate_action(state, "player1", %{
        "kind" => "basic",
        "actorInstanceId" => "p1u1",
        "targetInstanceId" => "p2u1"
      })

    assert get_unit(new_state, "p2u1")["hp"] == 30
    refute get_unit(new_state, "p2u1")["knockedOut"]
    assert get_unit(new_state, "p2u2")["passiveTriggered"]["passive.guardian"] == true
  end

  test "onStartTurn passive fires after end turn handoff" do
    state =
      make_state(
        current_player_id: "player1",
        p2_units: [make_unit(%{"instanceId" => "p2u1", "hp" => 50, "maxHp" => 100})]
      )
      |> put_ability("passive.second_wind", %{
        "trigger" => "onStartTurn",
        "healPctOfMaxHp" => 0.2
      })
      |> assign_passive("player2", "p2u1", "passive.second_wind")

    {new_state, _events} = BattleEngine.simulate_end_turn(state)

    assert new_state["currentPlayerId"] == "player2"
    assert get_unit(new_state, "p2u1")["hp"] == 70
  end

  test "onStatusApplied passive reacts when a status is applied" do
    state =
      make_state(p2_units: [make_unit(%{"instanceId" => "p2u1", "hp" => 60, "maxHp" => 100})])
      |> put_ability("passive.clean_recovery", %{
        "trigger" => "onStatusApplied",
        "healPctOfMaxHp" => 0.1
      })
      |> put_in(["abilityDefinitions", "skill.burn"], %{
        "key" => "skill.burn",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{
          "applyStatuses" => [%{"name" => "Burn", "duration" => 2}]
        }
      })
      |> assign_passive("player2", "p2u1", "passive.clean_recovery")
      |> update_in(["players"], fn players ->
        Enum.map(players, fn player ->
          if player["userId"] == "player1" do
            Map.update!(player, "units", fn units ->
              Enum.map(units, fn unit -> Map.put(unit, "skill", "skill.burn") end)
            end)
          else
            player
          end
        end)
      end)

    {:ok, new_state, _} =
      BattleEngine.simulate_action(state, "player1", %{
        "kind" => "skill",
        "actorInstanceId" => "p1u1",
        "targetInstanceId" => "p2u1"
      })

    assert get_unit(new_state, "p2u1")["hp"] == 70
    assert Enum.any?(get_unit(new_state, "p2u1")["statuses"], &(&1["name"] == "Burn"))
  end
end
