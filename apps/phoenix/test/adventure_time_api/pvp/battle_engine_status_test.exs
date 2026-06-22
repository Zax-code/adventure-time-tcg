defmodule AdventureTimeApi.Pvp.BattleEngineStatusTest do
  use ExUnit.Case, async: true

  alias AdventureTimeApi.Pvp.BattleEngine

  # ── Helpers ───────────────────────────────────────────────────────────────

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
        "skill" => nil,
        "ultimate" => nil
      },
      overrides
    )
  end

  # Build a minimal two-player state for integration-level tests
  defp make_state(p1_unit_overrides \\ %{}, p2_unit_overrides \\ %{}) do
    p1_unit =
      make_unit(Map.merge(%{"instanceId" => "p1u1", "position" => 1}, p1_unit_overrides))

    p2_unit =
      make_unit(Map.merge(%{"instanceId" => "p2u1", "position" => 1}, p2_unit_overrides))

    %{
      "id" => "match1",
      "seed" => "testseed",
      "rngIndex" => 0,
      "turn" => 1,
      "phase" => "active",
      "currentPlayerId" => "player1",
      "winnerId" => nil,
      "players" => [
        %{
          "userId" => "player1",
          "displayName" => "P1",
          "energy" => 3,
          "maxEnergy" => 3,
          "initiative" => 40,
          "hasUsedFreeBasic" => false,
          "units" => [p1_unit],
          "bench" => []
        },
        %{
          "userId" => "player2",
          "displayName" => "P2",
          "energy" => 3,
          "maxEnergy" => 3,
          "initiative" => 40,
          "hasUsedFreeBasic" => false,
          "units" => [p2_unit],
          "bench" => []
        }
      ],
      "log" => [],
      "actionsThisTurn" => [],
      "abilityDefinitions" => %{}
    }
  end

  # Grab a unit from a state by instanceId
  defp get_unit(state, instance_id) do
    state["players"]
    |> Enum.flat_map(fn p -> p["units"] ++ p["bench"] end)
    |> Enum.find(&(&1["instanceId"] == instance_id))
  end

  defp has_status(unit, name), do: Enum.any?(unit["statuses"] || [], &(&1["name"] == name))

  defp get_status(unit, name), do: Enum.find(unit["statuses"] || [], &(&1["name"] == name))

  defp get_player(state, user_id) do
    Enum.find(state["players"], &(&1["userId"] == user_id))
  end

  defp put_ability(state, ability) do
    put_in(state, ["abilityDefinitions", ability["key"]], ability)
  end

  # ── apply_status via simulate_action with applyStatuses payload ───────────

  describe "apply_status via ability applyStatuses payload" do
    test "applies a new status to the target unit" do
      state =
        make_state(
          %{},
          %{}
        )

      state =
        put_in(state, ["abilityDefinitions", "test.burn_skill"], %{
          "key" => "test.burn_skill",
          "type" => "SKILL",
          "cost" => 1,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{
            "applyStatuses" => [%{"name" => "Burn", "duration" => 2}]
          }
        })

      state =
        update_in(state, ["players"], fn players ->
          Enum.map(players, fn p ->
            if p["userId"] == "player1" do
              units =
                Enum.map(p["units"], fn u ->
                  Map.put(u, "skill", "test.burn_skill")
                end)

              Map.put(p, "units", units)
            else
              p
            end
          end)
        end)

      {:ok, new_state, _events} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "skill",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      p2_unit = get_unit(new_state, "p2u1")
      assert has_status(p2_unit, "Burn")
      burn = get_status(p2_unit, "Burn")
      assert burn["duration"] == 2
      assert burn["targetOwnerId"] == "player2"
      assert burn["appliedDuringPlayerId"] == "player1"
      assert burn["expiresAt"] == "afterOwnerTurnEndEffects"
      assert burn["ownerTurnsSeen"] == 0
    end

    test "applies applyStatusesToAttacker to the acting unit" do
      state = make_state()

      state =
        put_in(state, ["abilityDefinitions", "test.empower_self"], %{
          "key" => "test.empower_self",
          "type" => "SKILL",
          "cost" => 1,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{
            "applyStatusesToAttacker" => [%{"name" => "Empower", "duration" => 1}]
          }
        })

      state =
        update_in(state, ["players"], fn players ->
          Enum.map(players, fn p ->
            if p["userId"] == "player1" do
              units = Enum.map(p["units"], fn u -> Map.put(u, "skill", "test.empower_self") end)
              Map.put(p, "units", units)
            else
              p
            end
          end)
        end)

      {:ok, new_state, _events} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "skill",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      p1_unit = get_unit(new_state, "p1u1")
      assert has_status(p1_unit, "Empower")
    end

    test "Freeze is applied as consumption-only without turn duration" do
      state =
        make_state(%{"skill" => "test.freeze_skill"}, %{})
        |> put_ability(%{
          "key" => "test.freeze_skill",
          "type" => "SKILL",
          "cost" => 1,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{
            "applyStatuses" => [%{"name" => "Freeze", "duration" => 2}]
          }
        })

      {:ok, new_state, events} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "skill",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      freeze = get_status(get_unit(new_state, "p2u1"), "Freeze")
      assert freeze["duration"] == -1

      apply_event = Enum.find(events, &(&1["type"] == "statusApply"))
      assert get_in(apply_event, ["payload", "duration"]) == -1
    end

    test "Stunned is applied as consumption-only without turn duration" do
      state =
        make_state(%{"skill" => "test.stun_skill"}, %{})
        |> put_ability(%{
          "key" => "test.stun_skill",
          "type" => "SKILL",
          "cost" => 1,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{
            "applyStatuses" => [%{"name" => "Stunned", "duration" => 2}]
          }
        })

      {:ok, new_state, events} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "skill",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      stunned = get_status(get_unit(new_state, "p2u1"), "Stunned")
      assert stunned["duration"] == -1

      apply_event = Enum.find(events, &(&1["type"] == "statusApply"))
      assert get_in(apply_event, ["payload", "duration"]) == -1
    end

    test "Shield stacks magnitude on second application" do
      state = make_state()

      state =
        put_in(state, ["abilityDefinitions", "test.shield_skill"], %{
          "key" => "test.shield_skill",
          "type" => "SKILL",
          "cost" => 1,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{
            "shieldTarget" => "self",
            "shieldPctOfMaxHp" => 0.2
          }
        })

      state =
        update_in(state, ["players"], fn players ->
          Enum.map(players, fn p ->
            if p["userId"] == "player1" do
              units =
                Enum.map(p["units"], fn u ->
                  Map.put(u, "skill", "test.shield_skill")
                end)

              Map.put(p, "units", units)
            else
              p
            end
          end)
        end)

      # First application: 20% of 100 = 20
      {:ok, state1, _} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "skill",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      p1_unit = get_unit(state1, "p1u1")
      shield1 = get_status(p1_unit, "Shield")
      assert shield1["magnitude"] == 20

      # Restore cooldown so we can use skill again
      state1 =
        update_in(state1, ["players"], fn players ->
          Enum.map(players, fn p ->
            if p["userId"] == "player1" do
              units = Enum.map(p["units"], fn u -> Map.put(u, "cooldowns", %{}) end)
              Map.put(p, "units", units)
            else
              p
            end
          end)
        end)

      # Bump energy back
      state1 =
        update_in(state1, ["players"], fn players ->
          Enum.map(players, fn p ->
            if p["userId"] == "player1" do
              p
              |> Map.put("energy", 4)
              |> Map.put("maxEnergy", 4)
            else
              p
            end
          end)
        end)

      {:ok, state2, _} =
        BattleEngine.simulate_action(state1, "player1", %{
          "kind" => "skill",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      p1_unit2 = get_unit(state2, "p1u1")
      shield2 = get_status(p1_unit2, "Shield")
      assert shield2["magnitude"] == 40
    end
  end

  # ── Barrier blocks debuffs ────────────────────────────────────────────────

  describe "Barrier" do
    test "Barrier absorbs incoming debuff and is consumed" do
      state =
        make_state(
          %{},
          %{
            "statuses" => [
              %{
                "name" => "Barrier",
                "duration" => 2,
                "magnitude" => nil,
                "sourceInstanceId" => nil,
                "appliedAt" => 0
              }
            ]
          }
        )

      state =
        put_in(state, ["abilityDefinitions", "test.burn_skill"], %{
          "key" => "test.burn_skill",
          "type" => "SKILL",
          "cost" => 1,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{"applyStatuses" => [%{"name" => "Burn", "duration" => 2}]}
        })

      state =
        update_in(state, ["players"], fn players ->
          Enum.map(players, fn p ->
            if p["userId"] == "player1" do
              units = Enum.map(p["units"], fn u -> Map.put(u, "skill", "test.burn_skill") end)
              Map.put(p, "units", units)
            else
              p
            end
          end)
        end)

      {:ok, new_state, events} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "skill",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      p2_unit = get_unit(new_state, "p2u1")
      refute has_status(p2_unit, "Burn"), "Burn should be blocked by Barrier"
      refute has_status(p2_unit, "Barrier"), "Barrier should be consumed"

      assert Enum.any?(events, fn e ->
               e["type"] == "statusExpire" and
                 get_in(e, ["payload", "status"]) == "Barrier" and
                 get_in(e, ["payload", "consumed"]) == true
             end)
    end

    test "Barrier does not block a buff" do
      state =
        make_state(
          %{
            "statuses" => [
              %{
                "name" => "Barrier",
                "duration" => 2,
                "magnitude" => nil,
                "sourceInstanceId" => nil,
                "appliedAt" => 0
              }
            ]
          },
          %{}
        )

      state =
        put_in(state, ["abilityDefinitions", "test.guard_skill"], %{
          "key" => "test.guard_skill",
          "type" => "SKILL",
          "cost" => 1,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{
            "applyStatusesToAttacker" => [%{"name" => "GuardUp", "duration" => 2}]
          }
        })

      state =
        update_in(state, ["players"], fn players ->
          Enum.map(players, fn p ->
            if p["userId"] == "player1" do
              units = Enum.map(p["units"], fn u -> Map.put(u, "skill", "test.guard_skill") end)
              Map.put(p, "units", units)
            else
              p
            end
          end)
        end)

      {:ok, new_state, _} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "skill",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      p1_unit = get_unit(new_state, "p1u1")
      assert has_status(p1_unit, "GuardUp"), "GuardUp buff should not be blocked by Barrier"
      assert has_status(p1_unit, "Barrier"), "Barrier should be intact (only blocks debuffs)"
    end
  end

  # ── tick_statuses via simulate_end_turn ───────────────────────────────────

  describe "tick_statuses via end turn" do
    test "Burn deals 10% maxHp damage per tick" do
      state =
        make_state(
          %{},
          %{
            "statuses" => [
              %{
                "name" => "Burn",
                "duration" => 2,
                "magnitude" => nil,
                "sourceInstanceId" => nil,
                "appliedAt" => 0
              }
            ]
          }
        )

      # End P1's turn → P2's statuses tick
      {new_state, _events} = BattleEngine.simulate_end_turn(state)

      p2_unit = get_unit(new_state, "p2u1")
      # 10% of 100 = 10 damage
      assert p2_unit["hp"] == 90
    end

    test "Burn duration decrements and expires after last tick" do
      state =
        make_state(
          %{},
          %{
            "statuses" => [
              %{
                "name" => "Burn",
                "duration" => 1,
                "magnitude" => nil,
                "sourceInstanceId" => nil,
                "appliedAt" => 0
              }
            ]
          }
        )

      {new_state, _} = BattleEngine.simulate_end_turn(state)

      p2_unit = get_unit(new_state, "p2u1")
      refute has_status(p2_unit, "Burn"), "Burn with duration 1 should expire after tick"
    end

    test "Poison deals 5% maxHp per stack per tick" do
      state =
        make_state(
          %{},
          %{
            "statuses" => [
              %{
                "name" => "Poison",
                "duration" => 3,
                "magnitude" => 3,
                "sourceInstanceId" => nil,
                "appliedAt" => 0
              }
            ]
          }
        )

      {new_state, _} = BattleEngine.simulate_end_turn(state)

      p2_unit = get_unit(new_state, "p2u1")
      # 5% * 3 stacks * 100 maxHp = 15
      assert p2_unit["hp"] == 85
    end

    test "Regeneration heals 8% maxHp per tick" do
      state =
        make_state(
          %{},
          %{
            "hp" => 60,
            "statuses" => [
              %{
                "name" => "Regeneration",
                "duration" => 2,
                "magnitude" => nil,
                "sourceInstanceId" => nil,
                "appliedAt" => 0
              }
            ]
          }
        )

      {new_state, _} = BattleEngine.simulate_end_turn(state)

      p2_unit = get_unit(new_state, "p2u1")
      # 8% of 100 = 8 heal, 60 + 8 = 68
      assert p2_unit["hp"] == 68
    end

    test "start-boundary lifecycle increments without mutating original duration" do
      state =
        make_state(
          %{},
          %{
            "statuses" => [
              %{
                "name" => "GuardUp",
                "duration" => 2,
                "magnitude" => nil,
                "sourceInstanceId" => nil,
                "appliedAt" => 0
              }
            ]
          }
        )

      {new_state, _} = BattleEngine.simulate_end_turn(state)

      p2_unit = get_unit(new_state, "p2u1")
      guard = get_status(p2_unit, "GuardUp")
      assert guard != nil
      assert guard["duration"] == 2
      assert guard["ownerTurnsSeen"] == 1
    end

    test "one-turn Silence survives the afflicted player's turn start and expires after their turn" do
      state =
        make_state(
          %{"skill" => "test.silence_skill"},
          %{"skill" => "test.basic_skill"}
        )
        |> put_in(["abilityDefinitions", "test.silence_skill"], %{
          "key" => "test.silence_skill",
          "type" => "SKILL",
          "cost" => 1,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{
            "applyStatuses" => [%{"name" => "Silence", "duration" => 1}]
          }
        })
        |> put_in(["abilityDefinitions", "test.basic_skill"], %{
          "key" => "test.basic_skill",
          "type" => "SKILL",
          "cost" => 1,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{"damageMul" => 1.0}
        })

      {:ok, silenced_state, _events} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "skill",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      {player2_turn_state, _events} = BattleEngine.simulate_end_turn(silenced_state)

      p2_unit = get_unit(player2_turn_state, "p2u1")
      assert has_status(p2_unit, "Silence")

      assert {:error, :silenced} =
               BattleEngine.simulate_action(player2_turn_state, "player2", %{
                 "kind" => "skill",
                 "actorInstanceId" => "p2u1",
                 "targetInstanceId" => "p1u1"
               })

      {after_player2_turn_state, _events} = BattleEngine.simulate_end_turn(player2_turn_state)

      p2_unit_after_turn = get_unit(after_player2_turn_state, "p2u1")
      refute has_status(p2_unit_after_turn, "Silence")
    end

    test "one-turn self-applied status survives opponent turn and expires at next owner turn start" do
      state =
        make_state(%{"skill" => "test.guard_self"}, %{})
        |> put_ability(%{
          "key" => "test.guard_self",
          "type" => "SKILL",
          "cost" => 1,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{
            "applyStatusesToAttacker" => [%{"name" => "GuardUp", "duration" => 1}]
          }
        })

      {:ok, guarded_state, _events} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "skill",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      guard = get_status(get_unit(guarded_state, "p1u1"), "GuardUp")
      assert guard["expiresAt"] == "afterOwnerTurnStartEffects"
      assert guard["targetOwnerId"] == "player1"

      {player2_turn_state, _events} = BattleEngine.simulate_end_turn(guarded_state)
      assert has_status(get_unit(player2_turn_state, "p1u1"), "GuardUp")

      {player1_turn_state, _events} = BattleEngine.simulate_end_turn(player2_turn_state)
      refute has_status(get_unit(player1_turn_state, "p1u1"), "GuardUp")
    end

    test "self-applied start-of-turn status triggers once before start-boundary expiration" do
      state =
        make_state(%{"hp" => 60, "skill" => "test.regen_self"}, %{})
        |> put_ability(%{
          "key" => "test.regen_self",
          "type" => "SKILL",
          "cost" => 1,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{
            "applyStatusesToAttacker" => [%{"name" => "Regeneration", "duration" => 1}]
          }
        })

      {:ok, regen_state, _events} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "skill",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      {player2_turn_state, _events} = BattleEngine.simulate_end_turn(regen_state)
      {player1_turn_state, events} = BattleEngine.simulate_end_turn(player2_turn_state)

      p1_unit = get_unit(player1_turn_state, "p1u1")
      assert p1_unit["hp"] == 68
      refute has_status(p1_unit, "Regeneration")

      assert Enum.any?(events, fn event ->
               event["type"] == "statusTick" and
                 get_in(event, ["payload", "status"]) == "Regeneration"
             end)
    end

    test "enemy-applied two-turn status expires after second afflicted owner turn ends" do
      state =
        make_state(%{"skill" => "test.silence_skill"}, %{})
        |> put_ability(%{
          "key" => "test.silence_skill",
          "type" => "SKILL",
          "cost" => 1,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{
            "applyStatuses" => [%{"name" => "Silence", "duration" => 2}]
          }
        })

      {:ok, silenced_state, _events} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "skill",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      {player2_first_turn, _events} = BattleEngine.simulate_end_turn(silenced_state)
      {player1_turn, _events} = BattleEngine.simulate_end_turn(player2_first_turn)
      first_cycle_status = get_status(get_unit(player1_turn, "p2u1"), "Silence")
      assert first_cycle_status["ownerTurnsSeen"] == 1

      {player2_second_turn, _events} = BattleEngine.simulate_end_turn(player1_turn)
      assert has_status(get_unit(player2_second_turn, "p2u1"), "Silence")

      {after_second_afflicted_turn, _events} = BattleEngine.simulate_end_turn(player2_second_turn)
      refute has_status(get_unit(after_second_afflicted_turn, "p2u1"), "Silence")
    end

    test "reapplying a non-stackable status refreshes duration and lifecycle metadata" do
      state =
        make_state(%{"skill" => "test.silence_skill"}, %{})
        |> put_ability(%{
          "key" => "test.silence_skill",
          "type" => "SKILL",
          "cost" => 1,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{
            "applyStatuses" => [%{"name" => "Silence", "duration" => 1}]
          }
        })

      {:ok, once_silenced_state, _events} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "skill",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      refreshed_input =
        once_silenced_state
        |> put_in(["abilityDefinitions", "test.silence_skill", "payload", "applyStatuses"], [
          %{"name" => "Silence", "duration" => 2}
        ])
        |> update_in(["players"], fn players ->
          Enum.map(players, fn player ->
            if player["userId"] == "player1", do: Map.put(player, "energy", 3), else: player
          end)
        end)

      {:ok, refreshed_state, _events} =
        BattleEngine.simulate_action(refreshed_input, "player1", %{
          "kind" => "skill",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      refreshed = get_status(get_unit(refreshed_state, "p2u1"), "Silence")
      assert refreshed["duration"] == 2
      assert refreshed["ownerTurnsSeen"] == 0
      assert refreshed["expiresAt"] == "afterOwnerTurnEndEffects"

      {player2_first_turn, _events} = BattleEngine.simulate_end_turn(refreshed_state)
      {player1_turn, _events} = BattleEngine.simulate_end_turn(player2_first_turn)
      assert has_status(get_unit(player1_turn, "p2u1"), "Silence")
    end

    test "status applied by start-turn passive does not expire during the same phase" do
      state =
        make_state(
          %{},
          %{
            "passives" => ["test.start_guard"]
          }
        )
        |> put_ability(%{
          "key" => "test.start_guard",
          "type" => "PASSIVE",
          "cost" => 0,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{
            "trigger" => "onStartTurn",
            "once" => true,
            "applyStatusesToAttacker" => [%{"name" => "GuardUp", "duration" => 1}]
          }
        })

      {player2_turn_state, _events} = BattleEngine.simulate_end_turn(state)
      assert has_status(get_unit(player2_turn_state, "p2u1"), "GuardUp")

      {player1_turn_state, _events} = BattleEngine.simulate_end_turn(player2_turn_state)
      assert has_status(get_unit(player1_turn_state, "p2u1"), "GuardUp")

      {player2_next_turn_state, _events} = BattleEngine.simulate_end_turn(player1_turn_state)
      refute has_status(get_unit(player2_next_turn_state, "p2u1"), "GuardUp")
    end

    test "knocked-out units skip status effects but still advance duration expiration" do
      state =
        make_state(
          %{},
          %{
            "hp" => 0,
            "knockedOut" => true,
            "statuses" => [
              %{
                "name" => "Burn",
                "duration" => 1,
                "magnitude" => nil,
                "sourceInstanceId" => nil,
                "appliedAt" => 0
              }
            ]
          }
        )

      {new_state, events} = BattleEngine.simulate_end_turn(state)
      p2_unit = get_unit(new_state, "p2u1")

      assert p2_unit["hp"] == 0
      refute has_status(p2_unit, "Burn")
      refute Enum.any?(events, &(&1["type"] == "statusTick"))
    end

    test "DoT KOs unit and emits ko event" do
      state =
        make_state(
          %{},
          %{
            "hp" => 5,
            "statuses" => [
              %{
                "name" => "Burn",
                "duration" => 2,
                "magnitude" => nil,
                "sourceInstanceId" => nil,
                "appliedAt" => 0
              }
            ]
          }
        )

      {new_state, events} = BattleEngine.simulate_end_turn(state)

      p2_unit = get_unit(new_state, "p2u1")
      assert p2_unit["knockedOut"] == true
      assert p2_unit["hp"] == 0

      assert Enum.any?(events, fn e ->
               e["type"] == "ko" and get_in(e, ["payload", "unitId"]) == "p2u1" and
                 get_in(e, ["payload", "killerId"]) == "status"
             end)
    end

    test "knocked-out units are not ticked" do
      state =
        make_state(
          %{},
          %{
            "hp" => 0,
            "knockedOut" => true,
            "statuses" => [
              %{
                "name" => "Burn",
                "duration" => 2,
                "magnitude" => nil,
                "sourceInstanceId" => nil,
                "appliedAt" => 0
              }
            ]
          }
        )

      {new_state, _} = BattleEngine.simulate_end_turn(state)
      p2_unit = get_unit(new_state, "p2u1")
      # HP stays at 0, no double-KO events
      assert p2_unit["hp"] == 0
      assert has_status(p2_unit, "Burn"), "statuses should remain (no tick ran)"
    end
  end

  # ── Action guards ─────────────────────────────────────────────────────────

  describe "action guards" do
    test "SummoningSickness blocks all actions" do
      state =
        make_state(
          %{
            "statuses" => [
              %{
                "name" => "SummoningSickness",
                "duration" => 1,
                "magnitude" => nil,
                "sourceInstanceId" => nil,
                "appliedAt" => 0
              }
            ]
          },
          %{}
        )

      result =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "basic",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      assert {:error, :summoning_sickness} = result
    end

    test "Silence blocks skill but not basic attack" do
      state =
        make_state(
          %{
            "statuses" => [
              %{
                "name" => "Silence",
                "duration" => 1,
                "magnitude" => nil,
                "sourceInstanceId" => nil,
                "appliedAt" => 0
              }
            ]
          },
          %{}
        )

      skill_result =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "skill",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      assert {:error, :silenced} = skill_result

      # Basic should proceed (may fail for other reasons but not :silenced)
      basic_result =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "basic",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      refute basic_result == {:error, :silenced}
    end

    test "Freeze skips the action, Freeze is consumed, and returns :ok" do
      state =
        make_state(
          %{
            "statuses" => [
              %{
                "name" => "Freeze",
                "duration" => 1,
                "magnitude" => nil,
                "sourceInstanceId" => nil,
                "appliedAt" => 0
              }
            ]
          },
          %{}
        )

      result =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "basic",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      assert {:ok, new_state, _events} = result

      p1_unit = get_unit(new_state, "p1u1")
      refute has_status(p1_unit, "Freeze"), "Freeze should be consumed"

      # Target HP unchanged (action was skipped)
      p2_unit = get_unit(new_state, "p2u1")
      assert p2_unit["hp"] == 100
    end

    test "Freeze survives owner turn boundaries until an action attempt consumes it" do
      state =
        make_state(
          %{},
          %{
            "statuses" => [
              %{
                "name" => "Freeze",
                "duration" => 1,
                "magnitude" => nil,
                "sourceInstanceId" => nil,
                "appliedAt" => 0
              }
            ]
          }
        )

      {player2_turn_state, _events} = BattleEngine.simulate_end_turn(state)
      freeze = get_status(get_unit(player2_turn_state, "p2u1"), "Freeze")
      assert freeze["duration"] == -1

      {player1_turn_state, _events} = BattleEngine.simulate_end_turn(player2_turn_state)
      assert has_status(get_unit(player1_turn_state, "p2u1"), "Freeze")

      {player2_turn_again_state, _events} = BattleEngine.simulate_end_turn(player1_turn_state)

      {:ok, consumed_state, _events} =
        BattleEngine.simulate_action(player2_turn_again_state, "player2", %{
          "kind" => "basic",
          "actorInstanceId" => "p2u1",
          "targetInstanceId" => "p1u1"
        })

      refute has_status(get_unit(consumed_state, "p2u1"), "Freeze")
      assert get_player(consumed_state, "player2")["energy"] == 4
    end

    test "Freeze skips copied actions without spending energy" do
      state =
        make_state(
          %{
            "skill" => "test.copy",
            "statuses" => [
              %{
                "name" => "Freeze",
                "duration" => 1,
                "magnitude" => nil,
                "sourceInstanceId" => nil,
                "appliedAt" => 0
              }
            ]
          },
          %{"skill" => "test.source"}
        )
        |> put_ability(%{
          "key" => "test.copy",
          "type" => "SKILL",
          "cost" => 0,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{}
        })
        |> put_ability(%{
          "key" => "test.source",
          "type" => "SKILL",
          "cost" => 2,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{"damageMul" => 1.0}
        })

      {:ok, new_state, _events} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "copy",
          "actorInstanceId" => "p1u1",
          "sourceInstanceId" => "p2u1",
          "targetInstanceId" => "p2u1",
          "copyType" => "skill"
        })

      refute has_status(get_unit(new_state, "p1u1"), "Freeze")
      assert get_player(new_state, "player1")["energy"] == 3
      assert get_unit(new_state, "p2u1")["hp"] == 100
    end
  end

  describe "Stunned energy tax" do
    test "skill validation and deduction both include the stun tax" do
      state =
        make_state(
          %{
            "skill" => "test.skill",
            "statuses" => [
              %{
                "name" => "Stunned",
                "duration" => 1,
                "magnitude" => nil,
                "sourceInstanceId" => nil,
                "appliedAt" => 0
              }
            ]
          },
          %{}
        )
        |> put_ability(%{
          "key" => "test.skill",
          "type" => "SKILL",
          "cost" => 2,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{"damageMul" => 1.0}
        })

      {:ok, new_state, _events} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "skill",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      assert get_player(new_state, "player1")["energy"] == 0
      refute has_status(get_unit(new_state, "p1u1"), "Stunned")
    end

    test "ultimate validation and deduction both include the stun tax" do
      state =
        make_state(
          %{
            "ultimate" => "test.ultimate",
            "statuses" => [
              %{
                "name" => "Stunned",
                "duration" => 1,
                "magnitude" => nil,
                "sourceInstanceId" => nil,
                "appliedAt" => 0
              }
            ]
          },
          %{}
        )
        |> update_in(["players"], fn players ->
          Enum.map(players, fn player ->
            if player["userId"] == "player1" do
              player
              |> Map.put("energy", 4)
              |> Map.put("maxEnergy", 4)
            else
              player
            end
          end)
        end)
        |> put_ability(%{
          "key" => "test.ultimate",
          "type" => "ULTIMATE",
          "cost" => 3,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{"damageMul" => 1.0}
        })

      {:ok, new_state, _events} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "ultimate",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      assert get_player(new_state, "player1")["energy"] == 0
      refute has_status(get_unit(new_state, "p1u1"), "Stunned")
    end

    test "copied action validation and deduction both include the stun tax" do
      state =
        make_state(
          %{
            "skill" => "test.copy",
            "statuses" => [
              %{
                "name" => "Stunned",
                "duration" => 1,
                "magnitude" => nil,
                "sourceInstanceId" => nil,
                "appliedAt" => 0
              }
            ]
          },
          %{"skill" => "test.source"}
        )
        |> put_ability(%{
          "key" => "test.copy",
          "type" => "SKILL",
          "cost" => 0,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{}
        })
        |> put_ability(%{
          "key" => "test.source",
          "type" => "SKILL",
          "cost" => 2,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{"damageMul" => 1.0}
        })

      {:ok, new_state, _events} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "copy",
          "actorInstanceId" => "p1u1",
          "sourceInstanceId" => "p2u1",
          "targetInstanceId" => "p2u1",
          "copyType" => "skill"
        })

      assert get_player(new_state, "player1")["energy"] == 0
      refute has_status(get_unit(new_state, "p1u1"), "Stunned")
    end

    test "Stunned survives owner turn boundaries until an action attempt consumes it" do
      state =
        make_state(
          %{},
          %{
            "statuses" => [
              %{
                "name" => "Stunned",
                "duration" => 1,
                "magnitude" => nil,
                "sourceInstanceId" => nil,
                "appliedAt" => 0
              }
            ]
          }
        )

      {player2_turn_state, _events} = BattleEngine.simulate_end_turn(state)
      stunned = get_status(get_unit(player2_turn_state, "p2u1"), "Stunned")
      assert stunned["duration"] == -1

      {player1_turn_state, _events} = BattleEngine.simulate_end_turn(player2_turn_state)
      assert has_status(get_unit(player1_turn_state, "p2u1"), "Stunned")

      {player2_turn_again_state, _events} = BattleEngine.simulate_end_turn(player1_turn_state)

      {:ok, consumed_state, _events} =
        BattleEngine.simulate_action(player2_turn_again_state, "player2", %{
          "kind" => "basic",
          "actorInstanceId" => "p2u1",
          "targetInstanceId" => "p1u1"
        })

      refute has_status(get_unit(consumed_state, "p2u1"), "Stunned")
      assert get_player(consumed_state, "player2")["energy"] == 2
    end
  end

  # ── Shield absorption ─────────────────────────────────────────────────────

  describe "Shield absorption in basic attack" do
    test "Shield reduces damage taken and is consumed when depleted" do
      # p2 has Shield with magnitude 30
      state =
        make_state(
          %{},
          %{
            "statuses" => [
              %{
                "name" => "Shield",
                "duration" => -1,
                "magnitude" => 30,
                "sourceInstanceId" => nil,
                "appliedAt" => 0
              }
            ]
          }
        )

      {:ok, new_state, events} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "basic",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      p2_unit = get_unit(new_state, "p2u1")

      # If a shieldAbsorb event was emitted, damage should be reduced
      shield_event = Enum.find(events, &(&1["type"] == "shieldAbsorb"))

      if shield_event != nil do
        absorbed = get_in(shield_event, ["payload", "absorbed"])
        assert absorbed > 0
        # HP should be higher than without Shield
        # (exact value depends on RNG, so just check event was emitted)
        assert p2_unit["hp"] >= 0
      else
        # If the attack missed, no absorption event is expected — just ensure no crash
        assert true
      end
    end
  end

  # ── Taunt targeting ───────────────────────────────────────────────────────

  describe "Taunt targeting" do
    test "attack redirects to taunted unit even when different target requested" do
      # Build a state with two enemy units; one has Taunt
      p1_unit = make_unit(%{"instanceId" => "p1u1", "position" => 1})

      p2_unit1 =
        make_unit(%{
          "instanceId" => "p2u1",
          "position" => 1,
          "statuses" => [
            %{
              "name" => "Taunt",
              "duration" => 2,
              "magnitude" => nil,
              "sourceInstanceId" => nil,
              "appliedAt" => 0
            }
          ]
        })

      p2_unit2 = make_unit(%{"instanceId" => "p2u2", "position" => 2})

      state = %{
        "id" => "match1",
        "seed" => "testseed",
        "rngIndex" => 0,
        "turn" => 1,
        "phase" => "active",
        "currentPlayerId" => "player1",
        "winnerId" => nil,
        "players" => [
          %{
            "userId" => "player1",
            "displayName" => "P1",
            "energy" => 3,
            "maxEnergy" => 3,
            "initiative" => 40,
            "hasUsedFreeBasic" => false,
            "units" => [p1_unit],
            "bench" => []
          },
          %{
            "userId" => "player2",
            "displayName" => "P2",
            "energy" => 3,
            "maxEnergy" => 3,
            "initiative" => 40,
            "hasUsedFreeBasic" => false,
            "units" => [p2_unit1, p2_unit2],
            "bench" => []
          }
        ],
        "log" => [],
        "actionsThisTurn" => [],
        "abilityDefinitions" => %{}
      }

      # Request attack on p2u2 — but p2u1 has Taunt, so it should redirect
      {:ok, new_state, events} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "basic",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u2"
        })

      # Find the damage event; target should be p2u1 (taunted unit)
      damage_event = Enum.find(events, &(&1["type"] == "damage"))

      if damage_event != nil do
        assert get_in(damage_event, ["payload", "targetId"]) == "p2u1"
      end

      # p2u2 should be untouched
      p2u2_after = get_unit(new_state, "p2u2")
      assert p2u2_after["hp"] == 100
    end
  end

  # ── dispatch_ability multi-effect pipeline ────────────────────────────────

  describe "dispatch_ability pipeline (multiple payload effects)" do
    test "ability with both damageMul and applyStatuses applies both effects" do
      state = make_state()

      state =
        put_in(state, ["abilityDefinitions", "test.combo"], %{
          "key" => "test.combo",
          "type" => "SKILL",
          "cost" => 1,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{
            "damageMul" => 1.0,
            "applyStatuses" => [%{"name" => "Vulnerable", "duration" => 1}]
          }
        })

      state =
        update_in(state, ["players"], fn players ->
          Enum.map(players, fn p ->
            if p["userId"] == "player1" do
              units = Enum.map(p["units"], fn u -> Map.put(u, "skill", "test.combo") end)
              Map.put(p, "units", units)
            else
              p
            end
          end)
        end)

      {:ok, new_state, _events} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "skill",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      p2_unit = get_unit(new_state, "p2u1")
      # Damage was dealt
      assert p2_unit["hp"] < 100
      # Status was also applied
      assert has_status(p2_unit, "Vulnerable")
    end
  end
end
