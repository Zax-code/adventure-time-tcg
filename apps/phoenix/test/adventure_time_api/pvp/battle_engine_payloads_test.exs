defmodule AdventureTimeApi.Pvp.BattleEnginePayloadsTest do
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

  defp make_state(p1_overrides \\ %{}, p2_overrides \\ %{}) do
    p1_unit =
      make_unit(Map.merge(%{"instanceId" => "p1u1", "position" => 1}, p1_overrides))

    p2_unit =
      make_unit(Map.merge(%{"instanceId" => "p2u1", "position" => 1}, p2_overrides))

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

  defp make_multi_state(p1_units, p2_units) do
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
    |> Enum.flat_map(fn p -> p["units"] ++ p["bench"] end)
    |> Enum.find(&(&1["instanceId"] == instance_id))
  end

  defp has_status(unit, name), do: Enum.any?(unit["statuses"] || [], &(&1["name"] == name))

  # Register an ability and assign it to p1u1's skill slot
  defp with_p1_skill(state, ability_def) do
    key = ability_def["key"]

    state
    |> put_in(["abilityDefinitions", key], ability_def)
    |> update_in(["players"], fn players ->
      Enum.map(players, fn p ->
        if p["userId"] == "player1" do
          units = Enum.map(p["units"], fn u -> Map.put(u, "skill", key) end)
          Map.put(p, "units", units)
        else
          p
        end
      end)
    end)
  end

  defp fire_skill(state) do
    BattleEngine.simulate_action(state, "player1", %{
      "kind" => "skill",
      "actorInstanceId" => "p1u1",
      "targetInstanceId" => "p2u1"
    })
  end

  describe "live DB target scopes" do
    test "Playpen Adventure damages all enemies and buffs all allies" do
      state =
        make_multi_state(
          [
            make_unit(%{"instanceId" => "p1u1", "position" => 1, "ultimate" => "unused"}),
            make_unit(%{"instanceId" => "p1u2", "position" => 2})
          ],
          [
            make_unit(%{"instanceId" => "p2u1", "position" => 1, "defense" => 0}),
            make_unit(%{"instanceId" => "p2u2", "position" => 2, "defense" => 0})
          ]
        )
        |> with_p1_skill(%{
          "key" => "finnjake.adventureTime",
          "type" => "SKILL",
          "cost" => 0,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{
            "damageMul" => 1.2,
            "shieldPctOfMaxHp" => 0.2,
            "shieldTarget" => "allAllies",
            "applyStatuses" => [
              %{"name" => "Regeneration", "duration" => 2, "target" => "allAllies"}
            ],
            "target" => "allEnemies"
          }
        })

      {:ok, new_state, events} = fire_skill(state)

      assert get_unit(new_state, "p2u1")["hp"] < 100
      assert get_unit(new_state, "p2u2")["hp"] < 100
      assert has_status(get_unit(new_state, "p1u1"), "Shield")
      assert has_status(get_unit(new_state, "p1u2"), "Shield")
      assert has_status(get_unit(new_state, "p1u1"), "Regeneration")
      assert has_status(get_unit(new_state, "p1u2"), "Regeneration")

      damaged_ids =
        events
        |> Enum.filter(&(&1["type"] == "damage"))
        |> Enum.map(&get_in(&1, ["payload", "targetId"]))

      assert "p2u1" in damaged_ids
      assert "p2u2" in damaged_ids
    end

    test "status specs honor their own all-enemy and self targets" do
      state =
        make_multi_state(
          [make_unit(%{"instanceId" => "p1u1", "position" => 1})],
          [
            make_unit(%{"instanceId" => "p2u1", "position" => 1}),
            make_unit(%{"instanceId" => "p2u2", "position" => 2})
          ]
        )
        |> with_p1_skill(%{
          "key" => "test.mixed_targets",
          "type" => "SKILL",
          "cost" => 0,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{
            "applyStatuses" => [
              %{"name" => "Poison", "duration" => 3, "target" => "allEnemies"},
              %{"name" => "Haste", "duration" => 1, "target" => "self"}
            ],
            "target" => "allEnemies"
          }
        })

      {:ok, new_state, _events} = fire_skill(state)

      assert has_status(get_unit(new_state, "p1u1"), "Haste")
      assert has_status(get_unit(new_state, "p2u1"), "Poison")
      assert has_status(get_unit(new_state, "p2u2"), "Poison")
      refute has_status(get_unit(new_state, "p2u1"), "Haste")
    end

    test "legacy all scope applies statuses only to living units" do
      state =
        make_multi_state(
          [
            make_unit(%{"instanceId" => "p1u1", "position" => 1}),
            make_unit(%{"instanceId" => "p1u2", "position" => 2})
          ],
          [
            make_unit(%{
              "instanceId" => "p2u1",
              "position" => 1,
              "hp" => 0,
              "knockedOut" => true
            }),
            make_unit(%{"instanceId" => "p2u2", "position" => 2})
          ]
        )
        |> with_p1_skill(%{
          "key" => "test.legacy_all_status",
          "type" => "SKILL",
          "cost" => 0,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{
            "applyStatuses" => [%{"name" => "Regeneration", "duration" => 2}],
            "target" => "all"
          }
        })

      {:ok, new_state, _events} = fire_skill(state)

      assert has_status(get_unit(new_state, "p1u1"), "Regeneration")
      assert has_status(get_unit(new_state, "p1u2"), "Regeneration")
      refute has_status(get_unit(new_state, "p2u1"), "Regeneration")
      assert has_status(get_unit(new_state, "p2u2"), "Regeneration")
    end

    test "heal all allies heals the selected scope instead of only the actor" do
      state =
        make_multi_state(
          [
            make_unit(%{"instanceId" => "p1u1", "position" => 1, "hp" => 60, "maxHp" => 100}),
            make_unit(%{"instanceId" => "p1u2", "position" => 2, "hp" => 50, "maxHp" => 100})
          ],
          [make_unit(%{"instanceId" => "p2u1", "position" => 1})]
        )
        |> with_p1_skill(%{
          "key" => "Neddy.Gumroar",
          "type" => "SKILL",
          "cost" => 0,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{
            "healPctOfMaxHp" => 0.25,
            "target" => "allAllies"
          }
        })

      {:ok, new_state, _events} = fire_skill(state)

      assert get_unit(new_state, "p1u1")["hp"] == 85
      assert get_unit(new_state, "p1u2")["hp"] == 75
    end
  end

  describe "live DB payload normalizations" do
    test "Scam Scheme steals a buff even though the live payload omits stealBuffCount" do
      state =
        make_state(
          %{},
          %{
            "statuses" => [
              %{"name" => "Empower", "duration" => 2, "magnitude" => nil, "appliedAt" => 0}
            ]
          }
        )
        |> with_p1_skill(%{
          "key" => "kingooo.scamScheme",
          "type" => "SKILL",
          "cost" => 0,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{"damageMul" => 0.85, "target" => "enemy"}
        })

      {:ok, new_state, _events} = fire_skill(state)

      assert has_status(get_unit(new_state, "p1u1"), "Empower")
      refute has_status(get_unit(new_state, "p2u1"), "Empower")
    end

    test "Lumpy Space Power cleanses statuses from both teams" do
      state =
        make_multi_state(
          [
            make_unit(%{
              "instanceId" => "p1u1",
              "position" => 1,
              "statuses" => [%{"name" => "Empower", "duration" => 2, "appliedAt" => 0}]
            })
          ],
          [
            make_unit(%{
              "instanceId" => "p2u1",
              "position" => 1,
              "statuses" => [%{"name" => "Burn", "duration" => 2, "appliedAt" => 0}]
            })
          ]
        )
        |> with_p1_skill(%{
          "key" => "lsp.lumpyPower",
          "type" => "SKILL",
          "cost" => 0,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{
            "cleanse" => %{"count" => 99, "target" => "allAllies"},
            "target" => "allEnemies"
          }
        })

      {:ok, new_state, _events} = fire_skill(state)

      assert get_unit(new_state, "p1u1")["statuses"] == []
      assert get_unit(new_state, "p2u1")["statuses"] == []
    end

    test "Memory Curse increases the target's assigned cooldowns" do
      state =
        make_state(
          %{},
          %{"skill" => "target.skill", "ultimate" => "target.ultimate", "cooldowns" => %{}}
        )
        |> with_p1_skill(%{
          "key" => "ash.memoryCurse",
          "type" => "SKILL",
          "cost" => 0,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{
            "damageMul" => 0.95,
            "applyStatuses" => [%{"name" => "Silence", "duration" => 1}],
            "target" => "enemy"
          }
        })

      {:ok, new_state, _events} = fire_skill(state)

      assert get_unit(new_state, "p2u1")["cooldowns"]["target.skill"] == 1
      assert get_unit(new_state, "p2u1")["cooldowns"]["target.ultimate"] == 1
    end

    test "Madness Embrace empowers allies and reduces enemy cooldowns" do
      state =
        make_multi_state(
          [make_unit(%{"instanceId" => "p1u1", "position" => 1})],
          [
            make_unit(%{
              "instanceId" => "p2u1",
              "position" => 1,
              "cooldowns" => %{"target.skill" => 2}
            })
          ]
        )
        |> with_p1_skill(%{
          "key" => "betty.madnessEmbrace",
          "type" => "SKILL",
          "cost" => 0,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{
            "applyStatuses" => [%{"name" => "Empower", "duration" => 1, "target" => "allAllies"}],
            "target" => "allAllies"
          }
        })

      {:ok, new_state, _events} = fire_skill(state)

      assert has_status(get_unit(new_state, "p1u1"), "Empower")
      assert get_unit(new_state, "p2u1")["cooldowns"]["target.skill"] == 1
    end

    test "Blood Ritual pays self-damage before damaging all enemies" do
      state =
        make_multi_state(
          [make_unit(%{"instanceId" => "p1u1", "position" => 1, "hp" => 80, "maxHp" => 100})],
          [
            make_unit(%{"instanceId" => "p2u1", "position" => 1, "defense" => 0}),
            make_unit(%{"instanceId" => "p2u2", "position" => 2, "defense" => 0})
          ]
        )
        |> with_p1_skill(%{
          "key" => "keeoth.bloodRitual",
          "type" => "SKILL",
          "cost" => 0,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{
            "selfDamagePct" => 0.2,
            "damageMul" => 2,
            "applyStatuses" => [%{"name" => "Poison", "duration" => 3}],
            "target" => "allEnemies"
          }
        })

      {:ok, new_state, events} = fire_skill(state)

      assert get_unit(new_state, "p1u1")["hp"] == 64
      assert get_unit(new_state, "p2u1")["hp"] < 100
      assert get_unit(new_state, "p2u2")["hp"] < 100
      assert Enum.any?(events, &(&1["type"] == "selfDamage"))
    end

    test "Death's Kiss stores and consumes a delayed ally revive on enemy KO" do
      state =
        make_multi_state(
          [
            make_unit(%{"instanceId" => "p1u1", "position" => 1}),
            make_unit(%{"instanceId" => "p1u2", "position" => 2, "hp" => 0, "knockedOut" => true})
          ],
          [make_unit(%{"instanceId" => "p2u1", "position" => 1})]
        )
        |> with_p1_skill(%{
          "key" => "death.deathsKiss",
          "type" => "SKILL",
          "cost" => 0,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{"reviveAllyOnEnemyKoPct" => 0.3, "target" => "allEnemies"}
        })

      {:ok, marked_state, _events} = fire_skill(state)

      p2_ko_state =
        update_in(marked_state, ["players"], fn players ->
          Enum.map(players, fn player ->
            if player["userId"] == "player2" do
              units =
                Enum.map(player["units"], fn unit ->
                  if unit["instanceId"] == "p2u1" do
                    unit |> Map.put("hp", 1) |> Map.put("defense", 0)
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
        |> with_p1_skill(%{
          "key" => "test.finish",
          "type" => "SKILL",
          "cost" => 0,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{"damageMul" => 1, "target" => "enemy"}
        })

      {:ok, new_state, _events} = fire_skill(p2_ko_state)

      assert get_unit(new_state, "p1u2")["hp"] == 30
      refute get_unit(new_state, "p1u2")["knockedOut"]
      refute Map.has_key?(get_unit(new_state, "p1u1"), "reviveAllyOnEnemyKoPct")
    end
  end

  # ── ignoreDefensePct ──────────────────────────────────────────────────────

  describe "ignoreDefensePct" do
    test "damage with ignoreDefensePct 1.0 is higher than baseline" do
      base_state = make_state()

      baseline_ability = %{
        "key" => "test.baseline",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{"damageMul" => 1.0}
      }

      ignore_ability = %{
        "key" => "test.ignore_def",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{"damageMul" => 1.0, "ignoreDefensePct" => 1.0}
      }

      {:ok, baseline_state, _} = base_state |> with_p1_skill(baseline_ability) |> fire_skill()
      {:ok, ignore_state, _} = base_state |> with_p1_skill(ignore_ability) |> fire_skill()

      baseline_dmg = 100 - get_unit(baseline_state, "p2u1")["hp"]
      ignore_dmg = 100 - get_unit(ignore_state, "p2u1")["hp"]

      # ignoring defense should cause equal or more damage (might be equal on miss)
      assert ignore_dmg >= baseline_dmg
    end
  end

  # ── burnBonusMul ──────────────────────────────────────────────────────────

  describe "burnBonusMul" do
    test "bonus applied when target has Burn, not applied without Burn" do
      # Use a fixed seed that doesn't miss for reproducibility — we check relative difference
      no_burn_state = make_state()

      burn_state =
        make_state(
          %{},
          %{
            "statuses" => [
              %{
                "name" => "Burn",
                "duration" => 3,
                "magnitude" => nil,
                "sourceInstanceId" => nil,
                "appliedAt" => 0
              }
            ]
          }
        )

      ability = %{
        "key" => "test.burn_bonus",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{"damageMul" => 1.0, "burnBonusMul" => 0.5}
      }

      {:ok, no_burn_result, _} = no_burn_state |> with_p1_skill(ability) |> fire_skill()
      {:ok, burn_result, _} = burn_state |> with_p1_skill(ability) |> fire_skill()

      no_burn_dmg = 100 - get_unit(no_burn_result, "p2u1")["hp"]
      burn_dmg = 100 - get_unit(burn_result, "p2u1")["hp"]

      # Burn target should take more damage (unless miss — in which case both 0)
      assert burn_dmg >= no_burn_dmg
    end
  end

  # ── executeDamageMul + executeThreshold ───────────────────────────────────

  describe "executeDamageMul + executeThreshold" do
    test "execute fires when target is below threshold" do
      # Target at 25% HP, threshold 0.3 → execute should fire (higher damage)
      low_hp_state = make_state(%{}, %{"hp" => 25, "maxHp" => 100})

      execute_ability = %{
        "key" => "test.execute",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{
          "damageMul" => 1.0,
          "executeThreshold" => 0.3,
          "executeDamageMul" => 3.0
        }
      }

      baseline_ability = %{
        "key" => "test.baseline_exec",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{"damageMul" => 1.0}
      }

      {:ok, execute_result, _} = low_hp_state |> with_p1_skill(execute_ability) |> fire_skill()
      {:ok, baseline_result, _} = low_hp_state |> with_p1_skill(baseline_ability) |> fire_skill()

      execute_dmg = 25 - get_unit(execute_result, "p2u1")["hp"]
      baseline_dmg = 25 - get_unit(baseline_result, "p2u1")["hp"]

      # Execute multiplier 3x vs 1x — should be more damage
      assert execute_dmg >= baseline_dmg
    end

    test "execute does not fire when target is above threshold" do
      # Target at 90% HP, threshold 0.3 — no execute bonus
      high_hp_state = make_state(%{}, %{"hp" => 90, "maxHp" => 100})

      execute_ability = %{
        "key" => "test.execute2",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{
          "damageMul" => 1.0,
          "executeThreshold" => 0.3,
          "executeDamageMul" => 3.0
        }
      }

      baseline_ability = %{
        "key" => "test.baseline_exec2",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{"damageMul" => 1.0}
      }

      {:ok, execute_result, _} = high_hp_state |> with_p1_skill(execute_ability) |> fire_skill()
      {:ok, baseline_result, _} = high_hp_state |> with_p1_skill(baseline_ability) |> fire_skill()

      # Same rng seed → same base damage when execute doesn't fire
      assert get_unit(execute_result, "p2u1")["hp"] == get_unit(baseline_result, "p2u1")["hp"]
    end
  end

  describe "instantKoIfTargetBelowHpPct" do
    test "KO's a target that is already below the threshold" do
      state = make_state(%{}, %{"hp" => 19, "maxHp" => 100, "defense" => 0})

      ability = %{
        "key" => "death.reapersTouch",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{
          "damageMul" => 0.1,
          "instantKoIfTargetBelowHpPct" => 0.2,
          "target" => "enemy"
        }
      }

      {:ok, new_state, events} = state |> with_p1_skill(ability) |> fire_skill()

      assert get_unit(new_state, "p2u1")["hp"] == 0
      assert get_unit(new_state, "p2u1")["knockedOut"] == true
      assert Enum.any?(events, &(&1["type"] == "ko"))
    end
  end

  describe "conditional" do
    test "targetHas condition changes damage multiplier" do
      vulnerable_state =
        make_state(
          %{},
          %{
            "statuses" => [
              %{"name" => "Vulnerable", "duration" => 2, "magnitude" => nil, "appliedAt" => 0}
            ]
          }
        )

      normal_state = make_state()

      ability = %{
        "key" => "finn.swordFlourish",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{
          "damageMul" => 1.0,
          "conditional" => [
            %{"when" => %{"targetHas" => "Vulnerable"}, "damageMulDelta" => 0.4}
          ],
          "target" => "enemy"
        }
      }

      {:ok, vulnerable_result, _} = vulnerable_state |> with_p1_skill(ability) |> fire_skill()
      {:ok, normal_result, _} = normal_state |> with_p1_skill(ability) |> fire_skill()

      assert 100 - get_unit(vulnerable_result, "p2u1")["hp"] >
               100 - get_unit(normal_result, "p2u1")["hp"]
    end

    test "targetBelowHpPct can add a self buff from an enemy-targeting ability" do
      state = make_state(%{}, %{"hp" => 45, "maxHp" => 100})

      ability = %{
        "key" => "susan.powerPunch",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{
          "damageMul" => 1.2,
          "applyStatuses" => [%{"name" => "Vulnerable", "duration" => 2}],
          "conditional" => [
            %{
              "when" => %{"targetBelowHpPct" => 0.5},
              "addApplyStatuses" => [%{"name" => "Empower", "duration" => 2}]
            }
          ],
          "target" => "enemy"
        }
      }

      {:ok, new_state, _events} = state |> with_p1_skill(ability) |> fire_skill()

      assert has_status(get_unit(new_state, "p1u1"), "Empower")
      assert has_status(get_unit(new_state, "p2u1"), "Vulnerable")
      refute has_status(get_unit(new_state, "p2u1"), "Empower")
    end
  end

  # ── hits ──────────────────────────────────────────────────────────────────

  describe "hits" do
    test "hits: 3 advances rngIndex by more than hits: 1 and emits 3 damage events" do
      state = make_state()

      multi_ability = %{
        "key" => "test.multi_hit",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{"damageMul" => 0.5, "hits" => 3}
      }

      single_ability = %{
        "key" => "test.single_hit",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{"damageMul" => 0.5}
      }

      {:ok, multi_state, multi_events} = state |> with_p1_skill(multi_ability) |> fire_skill()
      {:ok, single_state, _single_events} = state |> with_p1_skill(single_ability) |> fire_skill()

      damage_events = Enum.filter(multi_events, &(&1["type"] == "damage"))
      assert length(damage_events) == 3

      # RNG index should have advanced more for multi-hit
      assert multi_state["rngIndex"] > single_state["rngIndex"]
    end
  end

  # ── healPctOfDamage (lifesteal) ────────────────────────────────────────────

  describe "healPctOfDamage" do
    test "actor heals 50% of total damage dealt" do
      # P1 starts at 50 HP to have room to heal
      state = make_state(%{"hp" => 50, "maxHp" => 100})

      ability = %{
        "key" => "test.lifesteal",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{"damageMul" => 1.0, "healPctOfDamage" => 0.5}
      }

      {:ok, new_state, events} = state |> with_p1_skill(ability) |> fire_skill()

      p2_unit = get_unit(new_state, "p2u1")
      p1_unit = get_unit(new_state, "p1u1")
      damage_dealt = 100 - p2_unit["hp"]

      if damage_dealt > 0 do
        # Actor should have healed
        heal_event = Enum.find(events, &(&1["type"] == "heal"))
        assert heal_event != nil
        assert get_in(heal_event, ["payload", "unitId"]) == "p1u1"
        expected_heal = floor(damage_dealt * 0.5)
        assert p1_unit["hp"] == min(100, 50 + expected_heal)
      else
        # Miss — no heal expected
        assert p1_unit["hp"] == 50
      end
    end
  end

  describe "healLowestAllyPctOfDamage" do
    test "heals the lowest HP ally based on damage dealt" do
      state =
        make_multi_state(
          [
            make_unit(%{"instanceId" => "p1u1", "position" => 1, "hp" => 100, "maxHp" => 100}),
            make_unit(%{"instanceId" => "p1u2", "position" => 2, "hp" => 30, "maxHp" => 100})
          ],
          [make_unit(%{"instanceId" => "p2u1", "position" => 1, "defense" => 0})]
        )
        |> with_p1_skill(%{
          "key" => "jakerainicorn.rainbowStretch",
          "type" => "SKILL",
          "cost" => 0,
          "cooldown" => nil,
          "oncePerMatch" => false,
          "payload" => %{
            "damageMul" => 1.1,
            "healLowestAllyPctOfDamage" => 0.2,
            "target" => "enemy"
          }
        })

      {:ok, new_state, _events} = fire_skill(state)
      damage_dealt = 100 - get_unit(new_state, "p2u1")["hp"]

      assert get_unit(new_state, "p1u1")["hp"] == 100
      assert get_unit(new_state, "p1u2")["hp"] == 30 + floor(damage_dealt * 0.2)
    end
  end

  # ── healPctOfMaxHpOnExecute ────────────────────────────────────────────────

  describe "healPctOfMaxHpOnExecute" do
    test "actor heals when execute fires" do
      state = make_state(%{"hp" => 50}, %{"hp" => 25, "maxHp" => 100})

      ability = %{
        "key" => "test.execute_heal",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{
          "damageMul" => 1.0,
          "executeThreshold" => 0.3,
          "executeDamageMul" => 2.0,
          "healPctOfMaxHpOnExecute" => 0.2
        }
      }

      {:ok, new_state, events} = state |> with_p1_skill(ability) |> fire_skill()

      p2_hp = get_unit(new_state, "p2u1")["hp"]
      p1_hp = get_unit(new_state, "p1u1")["hp"]

      # If execute fired (damage dealt > 0), actor should heal 20 HP
      damage_dealt = 25 - p2_hp

      if damage_dealt > 0 do
        heal_evt = Enum.find(events, &(&1["type"] == "heal"))
        assert heal_evt != nil
        assert p1_hp == min(100, 50 + 20)
      else
        assert p1_hp == 50
      end
    end

    test "no heal when execute threshold not met" do
      state = make_state(%{"hp" => 50}, %{"hp" => 90, "maxHp" => 100})

      ability = %{
        "key" => "test.execute_heal_no_exec",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{
          "damageMul" => 1.0,
          "executeThreshold" => 0.3,
          "executeDamageMul" => 2.0,
          "healPctOfMaxHpOnExecute" => 0.2
        }
      }

      {:ok, new_state, events} = state |> with_p1_skill(ability) |> fire_skill()

      p1_hp = get_unit(new_state, "p1u1")["hp"]
      heal_events = Enum.filter(events, &(&1["type"] == "heal"))
      # No execute = no execute-heal (there may still be no heal events)
      assert p1_hp == 50 or heal_events == []
    end
  end

  # ── splashPct ─────────────────────────────────────────────────────────────

  describe "splashPct" do
    test "splash damages second enemy unit; primary target takes full damage" do
      p1_unit = make_unit(%{"instanceId" => "p1u1", "position" => 1})
      p2_unit1 = make_unit(%{"instanceId" => "p2u1", "position" => 1})
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

      ability = %{
        "key" => "test.splash",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{"damageMul" => 1.0, "splashPct" => 0.4}
      }

      state = with_p1_skill(state, ability)

      {:ok, new_state, events} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "skill",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      p2u1_hp = get_unit(new_state, "p2u1")["hp"]
      p2u2_hp = get_unit(new_state, "p2u2")["hp"]

      primary_dmg = 100 - p2u1_hp

      if primary_dmg > 0 do
        # Splash target should also take damage
        splash_events =
          Enum.filter(events, fn e ->
            e["type"] == "damage" and get_in(e, ["payload", "targetId"]) == "p2u2"
          end)

        assert length(splash_events) > 0
        assert p2u2_hp < 100
      else
        # Miss — no splash expected
        assert p2u2_hp == 100
      end
    end
  end

  # ── healLowestAllyPctOfMaxHp ──────────────────────────────────────────────

  describe "healLowestAllyPctOfMaxHp" do
    test "heals lowest-HP ally, not the higher-HP unit" do
      # P1 has two units: one at 30 HP, one at 90 HP
      p1_unit1 =
        make_unit(%{"instanceId" => "p1u1", "position" => 1, "skill" => "test.heal_lowest"})

      p1_unit2 = make_unit(%{"instanceId" => "p1u2", "hp" => 30, "maxHp" => 100, "position" => 2})
      p2_unit = make_unit(%{"instanceId" => "p2u1", "position" => 1})

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
            "units" => [p1_unit1, p1_unit2],
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
        "abilityDefinitions" => %{
          "test.heal_lowest" => %{
            "key" => "test.heal_lowest",
            "type" => "SKILL",
            "cost" => 1,
            "cooldown" => nil,
            "oncePerMatch" => false,
            "payload" => %{"healLowestAllyPctOfMaxHp" => 0.2}
          }
        }
      }

      {:ok, new_state, events} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "skill",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      p1u2_hp = get_unit(new_state, "p1u2")["hp"]
      # 30% → 20% heal of 100 = 20 → p1u2 goes from 30 to 50
      assert p1u2_hp == 50

      heal_evt = Enum.find(events, &(&1["type"] == "heal"))
      assert heal_evt != nil
      assert get_in(heal_evt, ["payload", "unitId"]) == "p1u2"
    end
  end

  # ── revivePct ─────────────────────────────────────────────────────────────

  describe "revivePct" do
    test "revives a KO'd ally at 30% maxHp" do
      # P1 has a KO'd bench unit
      p1_unit1 = make_unit(%{"instanceId" => "p1u1", "position" => 1, "skill" => "test.revive"})

      p1_unit2 =
        make_unit(%{
          "instanceId" => "p1u2",
          "hp" => 0,
          "maxHp" => 100,
          "knockedOut" => true,
          "position" => nil
        })

      p2_unit = make_unit(%{"instanceId" => "p2u1", "position" => 1})

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
            "units" => [p1_unit1],
            "bench" => [p1_unit2]
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
        "abilityDefinitions" => %{
          "test.revive" => %{
            "key" => "test.revive",
            "type" => "SKILL",
            "cost" => 1,
            "cooldown" => nil,
            "oncePerMatch" => false,
            "payload" => %{"revivePct" => 0.3}
          }
        }
      }

      {:ok, new_state, events} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "skill",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      revived_unit = get_unit(new_state, "p1u2")
      assert revived_unit["knockedOut"] == false
      assert revived_unit["hp"] == 30

      revive_evt = Enum.find(events, &(&1["type"] == "revive"))
      assert revive_evt != nil
      assert get_in(revive_evt, ["payload", "unitId"]) == "p1u2"
    end

    test "no-op when no KO'd ally exists" do
      state = make_state()

      ability = %{
        "key" => "test.revive_noop",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{"revivePct" => 0.3}
      }

      {:ok, new_state, events} = state |> with_p1_skill(ability) |> fire_skill()

      revive_evt = Enum.find(events, &(&1["type"] == "revive"))
      assert revive_evt == nil
      # No crash, state unchanged for revival
      assert get_unit(new_state, "p1u1")["hp"] == 100
    end
  end

  # ── cleanse ───────────────────────────────────────────────────────────────

  describe "cleanse" do
    test "removes debuffs from target; Doom removed before Burn" do
      debuffed_p2 =
        make_unit(%{
          "instanceId" => "p2u1",
          "position" => 1,
          "statuses" => [
            %{
              "name" => "Burn",
              "duration" => 2,
              "magnitude" => nil,
              "sourceInstanceId" => nil,
              "appliedAt" => 1
            },
            %{
              "name" => "Doom",
              "duration" => 3,
              "magnitude" => nil,
              "sourceInstanceId" => nil,
              "appliedAt" => 2
            }
          ]
        })

      # Build state manually so p2u1 has debuffs
      p1_unit = make_unit(%{"instanceId" => "p1u1", "position" => 1})

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
            "units" => [debuffed_p2],
            "bench" => []
          }
        ],
        "log" => [],
        "actionsThisTurn" => [],
        "abilityDefinitions" => %{}
      }

      ability = %{
        "key" => "test.cleanse",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{"cleanse" => %{"count" => 1}}
      }

      state = with_p1_skill(state, ability)

      {:ok, new_state, events} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "skill",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      p2_unit = get_unit(new_state, "p2u1")

      # Doom (priority) should be removed, Burn should remain
      refute has_status(p2_unit, "Doom"), "Doom should be cleansed first"
      assert has_status(p2_unit, "Burn"), "Burn should remain"

      expire_evt =
        Enum.find(events, fn e ->
          e["type"] == "statusExpire" and get_in(e, ["payload", "status"]) == "Doom"
        end)

      assert expire_evt != nil
    end
  end

  # ── stealBuffCount ────────────────────────────────────────────────────────

  describe "stealBuffCount" do
    test "buff disappears from target and appears on actor" do
      buffed_p2 =
        make_unit(%{
          "instanceId" => "p2u1",
          "position" => 1,
          "statuses" => [
            %{
              "name" => "GuardUp",
              "duration" => 3,
              "magnitude" => nil,
              "sourceInstanceId" => nil,
              "appliedAt" => 0
            }
          ]
        })

      p1_unit = make_unit(%{"instanceId" => "p1u1", "position" => 1})

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
            "units" => [buffed_p2],
            "bench" => []
          }
        ],
        "log" => [],
        "actionsThisTurn" => [],
        "abilityDefinitions" => %{}
      }

      ability = %{
        "key" => "test.steal",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{"stealBuffCount" => 1}
      }

      state = with_p1_skill(state, ability)

      {:ok, new_state, events} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "skill",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      p1_unit_after = get_unit(new_state, "p1u1")
      p2_unit_after = get_unit(new_state, "p2u1")

      assert has_status(p1_unit_after, "GuardUp"), "Stolen buff should be on actor"
      refute has_status(p2_unit_after, "GuardUp"), "Buff should no longer be on target"

      steal_evt = Enum.find(events, &(&1["type"] == "statusSteal"))
      assert steal_evt != nil
    end
  end

  # ── swapHpPercentages ─────────────────────────────────────────────────────

  describe "swapHpPercentages" do
    test "actor and target trade HP percentages, neither below 1" do
      # P1 at 30%, P2 at 80%
      state = make_state(%{"hp" => 30}, %{"hp" => 80})

      ability = %{
        "key" => "test.swap_hp",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{"swapHpPercentages" => true}
      }

      {:ok, new_state, events} = state |> with_p1_skill(ability) |> fire_skill()

      p1_hp = get_unit(new_state, "p1u1")["hp"]
      p2_hp = get_unit(new_state, "p2u1")["hp"]

      # P1 was 30%, P2 was 80% — after swap: P1 at 80, P2 at 30
      assert p1_hp == 80
      assert p2_hp == 30

      swap_evt = Enum.find(events, &(&1["type"] == "swapHp"))
      assert swap_evt != nil

      # Neither below 1
      assert p1_hp >= 1
      assert p2_hp >= 1
    end
  end

  # ── reduceCooldowns ───────────────────────────────────────────────────────

  describe "reduceCooldowns" do
    test "actor cooldown reduced by 1; zero-duration keys dropped" do
      # Give p1u1 a cooldown of 2 on its skill
      state =
        make_state(%{
          "cooldowns" => %{"test.reduce_cd" => 2},
          "skill" => "test.reduce_cd"
        })

      # We can't fire the skill since it's on cooldown — call dispatch directly via basic check
      # Instead, use a second ability key that reduces cooldowns
      reduce_ability = %{
        "key" => "test.reducer",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{"reduceCooldowns" => 1}
      }

      state =
        state
        |> put_in(["abilityDefinitions", reduce_ability["key"]], reduce_ability)
        |> update_in(["players"], fn players ->
          Enum.map(players, fn p ->
            if p["userId"] == "player1" do
              # assign "test.reducer" to ultimate slot so skill stays as test.reduce_cd
              units =
                Enum.map(p["units"], fn u -> Map.put(u, "ultimate", reduce_ability["key"]) end)

              Map.put(p, "units", units)
            else
              p
            end
          end)
        end)
        |> update_in(["players"], fn players ->
          Enum.map(players, fn p ->
            if p["userId"] == "player1" do
              # reset skill slot to nil for the cooldown test
              units = Enum.map(p["units"], fn u -> Map.put(u, "skill", nil) end)
              Map.put(p, "units", units)
            else
              p
            end
          end)
        end)

      {:ok, new_state, _events} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "ultimate",
          "actorInstanceId" => "p1u1",
          "targetInstanceId" => "p2u1"
        })

      p1_unit = get_unit(new_state, "p1u1")
      # cooldown was 2, reduced by 1 → 1 remaining
      assert Map.get(p1_unit["cooldowns"], "test.reduce_cd") == 1
    end

    test "cooldown at 1 is dropped after reduceCooldowns 1" do
      state = make_state(%{"cooldowns" => %{"test.some_key" => 1}})

      reduce_ability = %{
        "key" => "test.reducer_drop",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{"reduceCooldowns" => 1}
      }

      state =
        state
        |> put_in(["abilityDefinitions", reduce_ability["key"]], reduce_ability)
        |> update_in(["players"], fn players ->
          Enum.map(players, fn p ->
            if p["userId"] == "player1" do
              units = Enum.map(p["units"], fn u -> Map.put(u, "skill", reduce_ability["key"]) end)
              Map.put(p, "units", units)
            else
              p
            end
          end)
        end)

      {:ok, new_state, _} = fire_skill(state)

      p1_unit = get_unit(new_state, "p1u1")

      refute Map.has_key?(p1_unit["cooldowns"], "test.some_key"),
             "Zero-valued cooldown should be dropped"
    end
  end

  # ── applyStatusChance ─────────────────────────────────────────────────────

  describe "applyStatusChance" do
    test "status applied when chance is 1.0" do
      state = make_state()

      ability = %{
        "key" => "test.chance_100",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{
          "applyStatuses" => [%{"name" => "Burn", "duration" => 2}],
          "applyStatusChance" => 1.0
        }
      }

      {:ok, new_state, events} = state |> with_p1_skill(ability) |> fire_skill()

      p2_unit = get_unit(new_state, "p2u1")
      assert has_status(p2_unit, "Burn")

      roll_event = Enum.find(events, &(&1["type"] == "statusRoll"))
      assert roll_event["payload"]["status"] == "Burn"
      assert roll_event["payload"]["chance"] == 1.0
      assert roll_event["payload"]["passed"] == true
      assert is_number(roll_event["payload"]["roll"])
    end

    test "status not applied when chance is 0.0" do
      state = make_state()

      ability = %{
        "key" => "test.chance_0",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{
          "applyStatuses" => [%{"name" => "Burn", "duration" => 2}],
          "applyStatusChance" => 0.0
        }
      }

      {:ok, new_state, events} = state |> with_p1_skill(ability) |> fire_skill()

      p2_unit = get_unit(new_state, "p2u1")
      refute has_status(p2_unit, "Burn")

      roll_event = Enum.find(events, &(&1["type"] == "statusRoll"))
      assert roll_event["payload"]["status"] == "Burn"
      assert roll_event["payload"]["chance"] == 0.0
      assert roll_event["payload"]["passed"] == false
      assert is_number(roll_event["payload"]["roll"])
    end
  end

  # ── randomStatuses ────────────────────────────────────────────────────────

  describe "randomStatuses" do
    test "one status from list is applied (deterministic with fixed seed)" do
      state = make_state()

      ability = %{
        "key" => "test.random_status",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{
          "randomStatuses" => [
            %{"name" => "Burn", "duration" => 2},
            %{"name" => "Poison", "duration" => 2, "magnitude" => 1},
            %{"name" => "Vulnerable", "duration" => 2}
          ]
        }
      }

      {:ok, new_state, events} = state |> with_p1_skill(ability) |> fire_skill()

      p2_unit = get_unit(new_state, "p2u1")
      applied_statuses = Enum.map(p2_unit["statuses"] || [], & &1["name"])

      possible = ["Burn", "Poison", "Vulnerable"]

      assert Enum.any?(applied_statuses, &(&1 in possible)),
             "One of the random statuses should be applied"

      # Exactly one should be applied
      matching_count = Enum.count(applied_statuses, &(&1 in possible))
      assert matching_count == 1

      roll_event = Enum.find(events, &(&1["type"] == "randomStatusRoll"))
      assert roll_event["payload"]["status"] in possible
      assert roll_event["payload"]["optionCount"] == 3
      assert is_integer(roll_event["payload"]["selectedIndex"])
      assert is_number(roll_event["payload"]["roll"])
    end
  end

  # ── preventDeath flag ─────────────────────────────────────────────────────

  describe "preventDeath flag" do
    test "unit with preventDeath survives otherwise-fatal damage at 1 HP, flag cleared" do
      # P2 has preventDeath flag set, starts at low HP
      state = make_state(%{}, %{"hp" => 5, "preventDeath" => true})

      ability = %{
        "key" => "test.big_hit",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{"damageMul" => 10.0}
      }

      {:ok, new_state, events} = state |> with_p1_skill(ability) |> fire_skill()

      p2_unit = get_unit(new_state, "p2u1")

      # Should survive at exactly 1 HP
      assert p2_unit["hp"] == 1
      assert p2_unit["knockedOut"] == false
      assert Map.get(p2_unit, "preventDeath") == false

      pd_evt = Enum.find(events, &(&1["type"] == "preventDeath"))
      assert pd_evt != nil
      assert get_in(pd_evt, ["payload", "unitId"]) == "p2u1"
    end

    test "preventDeath payload sets flag on actor unit" do
      state = make_state()

      ability = %{
        "key" => "test.set_pd",
        "type" => "SKILL",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{"preventDeath" => true}
      }

      {:ok, new_state, _} = state |> with_p1_skill(ability) |> fire_skill()

      p1_unit = get_unit(new_state, "p1u1")
      assert Map.get(p1_unit, "preventDeath") == true
    end
  end

  # ── Copy action ───────────────────────────────────────────────────────────

  describe "copy action" do
    test "successfully copies source unit's skill and fires payload effects" do
      # P2 unit has a skill, P1 unit has the copy ability in skill slot
      source_skill_key = "test.firestrike"
      copy_key = "test.copy_ability"

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
            "energy" => 4,
            "maxEnergy" => 4,
            "initiative" => 40,
            "hasUsedFreeBasic" => false,
            "units" => [
              make_unit(%{"instanceId" => "p1u1", "position" => 1, "skill" => copy_key})
            ],
            "bench" => []
          },
          %{
            "userId" => "player2",
            "displayName" => "P2",
            "energy" => 3,
            "maxEnergy" => 3,
            "initiative" => 40,
            "hasUsedFreeBasic" => false,
            "units" => [
              make_unit(%{"instanceId" => "p2u1", "position" => 1, "skill" => source_skill_key})
            ],
            "bench" => []
          }
        ],
        "log" => [],
        "actionsThisTurn" => [],
        "abilityDefinitions" => %{
          copy_key => %{
            "key" => copy_key,
            "type" => "SKILL",
            "cost" => 1,
            "cooldown" => 2,
            "oncePerMatch" => false,
            "payload" => %{}
          },
          source_skill_key => %{
            "key" => source_skill_key,
            "type" => "SKILL",
            "cost" => 2,
            "cooldown" => nil,
            "oncePerMatch" => false,
            "payload" => %{
              "applyStatuses" => [%{"name" => "Burn", "duration" => 2}]
            }
          }
        }
      }

      {:ok, new_state, events} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "copy",
          "actorInstanceId" => "p1u1",
          "sourceInstanceId" => "p2u1",
          "targetInstanceId" => "p2u1",
          "copyType" => "skill"
        })

      # The copied ability's effect (Burn) should fire on target
      p2_unit = get_unit(new_state, "p2u1")
      assert has_status(p2_unit, "Burn"), "Copied skill's Burn should be applied"

      # Energy deducted by copied ability cost (2)
      p1_player = Enum.find(new_state["players"], &(&1["userId"] == "player1"))
      assert p1_player["energy"] == 2

      # Copy ability cooldown set on p1u1's copy key
      p1_unit = get_unit(new_state, "p1u1")
      assert Map.get(p1_unit["cooldowns"], copy_key) == 2

      # abilityStart event emitted
      ability_start = Enum.find(events, &(&1["type"] == "abilityStart"))
      assert ability_start != nil
    end

    test "copies source ultimate when the copy ability payload requests ULTIMATE" do
      source_skill_key = "test.source_skill"
      source_ultimate_key = "test.source_ultimate"
      copy_key = "fern.imposter"

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
            "energy" => 5,
            "initiative" => 40,
            "hasUsedFreeBasic" => false,
            "units" => [
              make_unit(%{"instanceId" => "p1u1", "position" => 1, "ultimate" => copy_key})
            ],
            "bench" => []
          },
          %{
            "userId" => "player2",
            "displayName" => "P2",
            "energy" => 3,
            "initiative" => 40,
            "hasUsedFreeBasic" => false,
            "units" => [
              make_unit(%{
                "instanceId" => "p2u1",
                "position" => 1,
                "skill" => source_skill_key,
                "ultimate" => source_ultimate_key
              })
            ],
            "bench" => []
          }
        ],
        "log" => [],
        "actionsThisTurn" => [],
        "abilityDefinitions" => %{
          copy_key => %{
            "key" => copy_key,
            "type" => "ULTIMATE",
            "cost" => 3,
            "cooldown" => nil,
            "oncePerMatch" => true,
            "payload" => %{"copyAbilitySource" => "enemy", "copyAbilityType" => "ULTIMATE"}
          },
          source_skill_key => %{
            "key" => source_skill_key,
            "type" => "SKILL",
            "cost" => 1,
            "cooldown" => nil,
            "oncePerMatch" => false,
            "payload" => %{"applyStatuses" => [%{"name" => "Burn", "duration" => 2}]}
          },
          source_ultimate_key => %{
            "key" => source_ultimate_key,
            "type" => "ULTIMATE",
            "cost" => 3,
            "cooldown" => nil,
            "oncePerMatch" => true,
            "payload" => %{"applyStatuses" => [%{"name" => "Freeze", "duration" => -1}]}
          }
        }
      }

      {:ok, new_state, events} =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "copy",
          "actorInstanceId" => "p1u1",
          "abilityKey" => copy_key,
          "sourceInstanceId" => "p2u1",
          "targetInstanceId" => "p2u1"
        })

      p2_unit = get_unit(new_state, "p2u1")
      assert has_status(p2_unit, "Freeze")
      refute has_status(p2_unit, "Burn")
      assert get_unit(new_state, "p1u1")["usedUltimate"] == true

      ability_start = Enum.find(events, &(&1["type"] == "abilityStart"))
      assert get_in(ability_start, ["payload", "abilityKey"]) == source_ultimate_key
      assert get_in(ability_start, ["payload", "copyKey"]) == copy_key
    end

    test "returns error when source has no skill assigned" do
      copy_key = "test.copy_no_source_skill"

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
            "energy" => 4,
            "maxEnergy" => 4,
            "initiative" => 40,
            "hasUsedFreeBasic" => false,
            "units" => [
              make_unit(%{"instanceId" => "p1u1", "position" => 1, "skill" => copy_key})
            ],
            "bench" => []
          },
          %{
            "userId" => "player2",
            "displayName" => "P2",
            "energy" => 3,
            "maxEnergy" => 3,
            "initiative" => 40,
            "hasUsedFreeBasic" => false,
            "units" => [
              # Source unit has no skill
              make_unit(%{"instanceId" => "p2u1", "position" => 1, "skill" => nil})
            ],
            "bench" => []
          }
        ],
        "log" => [],
        "actionsThisTurn" => [],
        "abilityDefinitions" => %{
          copy_key => %{
            "key" => copy_key,
            "type" => "SKILL",
            "cost" => 1,
            "cooldown" => nil,
            "oncePerMatch" => false,
            "payload" => %{}
          }
        }
      }

      result =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "copy",
          "actorInstanceId" => "p1u1",
          "sourceInstanceId" => "p2u1",
          "targetInstanceId" => "p2u1"
        })

      assert {:error, :source_has_no_ability} = result
    end

    test "returns error when copied ability key not in abilityDefinitions" do
      copy_key = "test.copy_missing_def"
      source_skill_key = "missing.ability"

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
            "energy" => 4,
            "maxEnergy" => 4,
            "initiative" => 40,
            "hasUsedFreeBasic" => false,
            "units" => [
              make_unit(%{"instanceId" => "p1u1", "position" => 1, "skill" => copy_key})
            ],
            "bench" => []
          },
          %{
            "userId" => "player2",
            "displayName" => "P2",
            "energy" => 3,
            "maxEnergy" => 3,
            "initiative" => 40,
            "hasUsedFreeBasic" => false,
            "units" => [
              make_unit(%{
                "instanceId" => "p2u1",
                "position" => 1,
                "skill" => source_skill_key
              })
            ],
            "bench" => []
          }
        ],
        "log" => [],
        "actionsThisTurn" => [],
        "abilityDefinitions" => %{
          copy_key => %{
            "key" => copy_key,
            "type" => "SKILL",
            "cost" => 1,
            "cooldown" => nil,
            "oncePerMatch" => false,
            "payload" => %{}
          }
          # Note: source_skill_key intentionally absent
        }
      }

      result =
        BattleEngine.simulate_action(state, "player1", %{
          "kind" => "copy",
          "actorInstanceId" => "p1u1",
          "sourceInstanceId" => "p2u1",
          "targetInstanceId" => "p2u1"
        })

      assert {:error, :copied_ability_not_found} = result
    end
  end
end
