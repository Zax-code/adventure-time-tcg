defmodule AdventureTimeApiWeb.AdminControllerTest do
  use AdventureTimeApiWeb.ConnCase, async: false

  alias AdventureTimeApi.Accounts.{
    EmailAccessRequest,
    EmailCredential,
    EmailVerificationCode,
    User
  }

  alias AdventureTimeApi.Catalog.{Card, CardBackVisual, ImageAsset, Pack, Rarity}
  alias AdventureTimeApi.Health.StepSnapshot
  alias AdventureTimeApi.Inventory.OwnedCard
  alias AdventureTimeApi.Pvp.{AbilityDef, CardAbility, Loadout, Match, MatchEvent, MatchSnapshot}
  alias AdventureTimeApi.Quests
  alias AdventureTimeApi.Quests.{DailyQuest, SpeedCalculusDailyRun, WordleDailyAttempt}
  alias AdventureTimeApi.Social.CardGift
  alias AdventureTimeApi.Repo

  setup do
    original_config = Application.get_env(:adventure_time_api, AdventureTimeApi.Media)

    on_exit(fn ->
      Application.put_env(:adventure_time_api, AdventureTimeApi.Media, original_config)
    end)

    :ok
  end

  test "GET /admin/users requires admin access", %{conn: conn} do
    user =
      create_user_with_password("user@example.com", "password123", "User",
        verified?: true,
        access_status: :approved,
        role: :user
      )

    access_token = login_access_token(user.email, "password123")

    conn =
      conn
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> get(~p"/admin/users")

    assert json_response(conn, 403) == %{
             "error" => "Admin access required",
             "code" => "ADMIN_REQUIRED"
           }
  end

  test "GET /admin/email-requests is superadmin only", %{conn: conn} do
    admin =
      create_user_with_password("admin@example.com", "password123", "Admin",
        verified?: true,
        access_status: :approved,
        role: :admin
      )

    Repo.insert!(
      EmailAccessRequest.changeset(%EmailAccessRequest{}, %{
        email: "pending@example.com",
        status: :pending
      })
    )

    access_token = login_access_token(admin.email, "password123")

    conn =
      conn
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> get(~p"/admin/email-requests")

    assert json_response(conn, 403) == %{
             "error" => "Super admin access required",
             "code" => "SUPER_ADMIN_REQUIRED"
           }
  end

  test "admin can list cards and ability envelope", %{conn: conn} do
    admin =
      create_user_with_password("catalog-admin@example.com", "password123", "Catalog Admin",
        verified?: true,
        access_status: :approved,
        role: :admin
      )

    rarity =
      Repo.insert!(
        Rarity.changeset(%Rarity{}, %{
          name: unique_name("Common"),
          drop_rate: 60.0,
          color: "#9CA3AF"
        })
      )

    card =
      Repo.insert!(
        Card.changeset(%Card{}, %{
          name: unique_name("Admin Card"),
          character: "Finn",
          description: "Test card",
          hp: 20,
          attack: 8,
          defense: 5,
          speed: 42,
          type: "Hero",
          rarity_id: rarity.id,
          is_featured: true
        })
      )

    ability =
      Repo.insert!(
        AbilityDef.changeset(%AbilityDef{}, %{
          key: unique_name("admin.skill"),
          name: "Admin Skill",
          description: "Does admin things.",
          type: "SKILL",
          cost: 1,
          cooldown: 2,
          once_per_match: false,
          payload: %{"damageMul" => 1.2}
        })
      )

    Repo.insert!(CardAbility.changeset(%CardAbility{}, %{card_id: card.id, skill_id: ability.id}))

    access_token = login_access_token(admin.email, "password123")

    cards_conn =
      conn
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> get(~p"/admin/cards")

    assert %{"cards" => [payload]} = json_response(cards_conn, 200)
    assert payload["id"] == card.id
    assert payload["rarityId"] == rarity.id
    assert payload["rarityName"] == rarity.name
    assert payload["isFeatured"] == true

    abilities_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> get(~p"/admin/abilities")

    abilities_response = json_response(abilities_conn, 200)
    assert is_list(abilities_response["abilities"])

    assert [%{"cardId" => card_id, "skillId" => skill_id}] = abilities_response["cardAbilities"]
    assert card_id == card.id
    assert skill_id == ability.id

    assert Enum.any?(
             abilities_response["cards"],
             &(&1["id"] == card.id and &1["rarityName"] == rarity.name)
           )
  end

  test "admin can create, update, delete, assign, and remove abilities", _context do
    admin =
      create_user_with_password("ability-admin@example.com", "password123", "Ability Admin",
        verified?: true,
        access_status: :approved,
        role: :admin
      )

    rarity =
      Repo.insert!(
        Rarity.changeset(%Rarity{}, %{
          name: "Legendary",
          drop_rate: 10.0,
          color: "#3B82F6"
        })
      )

    card =
      Repo.insert!(
        Card.changeset(%Card{}, %{
          name: unique_name("Ability Card"),
          character: "BMO",
          description: "Ability target",
          hp: 25,
          attack: 9,
          defense: 6,
          speed: 55,
          type: "Tech",
          rarity_id: rarity.id
        })
      )

    access_token = login_access_token(admin.email, "password123")

    create_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> post(~p"/admin/abilities", %{
        "key" => unique_name("admin.passive"),
        "name" => "Aura",
        "description" => "Passive aura.",
        "type" => "PASSIVE",
        "cost" => 0,
        "cooldown" => nil,
        "oncePerMatch" => false,
        "payload" => %{"statBonus" => %{"attack" => 0.1}}
      })

    passive = json_response(create_conn, 201)["ability"]
    assert passive["type"] == "PASSIVE"

    skill =
      Repo.insert!(
        AbilityDef.changeset(%AbilityDef{}, %{
          key: unique_name("admin.skill"),
          name: "Skill",
          description: "Skill attack.",
          type: "SKILL",
          cost: 1,
          cooldown: 2,
          once_per_match: false,
          payload: %{"damageMul" => 1.2}
        })
      )

    ultimate =
      Repo.insert!(
        AbilityDef.changeset(%AbilityDef{}, %{
          key: unique_name("admin.ultimate"),
          name: "Ultimate",
          description: "Ultimate heal.",
          type: "ULTIMATE",
          cost: 0,
          cooldown: nil,
          once_per_match: true,
          payload: %{"healPctOfMaxHp" => 0.25}
        })
      )

    update_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> patch(~p"/admin/abilities/#{passive["id"]}", %{
        "name" => "Aura+",
        "descriptionFr" => "Aura passive.",
        "payload" => %{"statBonus" => %{"attack" => 0.15}}
      })

    updated = json_response(update_conn, 200)["ability"]
    assert updated["name"] == "Aura+"
    assert updated["descriptionFr"] == "Aura passive."

    assign_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> post(~p"/admin/abilities/assign", %{
        "cardId" => card.id,
        "passiveId" => passive["id"],
        "skillId" => skill.id,
        "ultimateId" => ultimate.id
      })

    assigned = json_response(assign_conn, 200)["cardAbility"]

    assert assigned == %{
             "id" => assigned["id"],
             "cardId" => card.id,
             "passiveId" => passive["id"],
             "skillId" => skill.id,
             "ultimateId" => ultimate.id
           }

    reassign_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> post(~p"/admin/abilities/assign", %{
        "cardId" => card.id,
        "passiveId" => passive["id"],
        "skillId" => nil,
        "ultimateId" => ultimate.id
      })

    reassigned = json_response(reassign_conn, 200)["cardAbility"]
    assert reassigned["id"] == assigned["id"]
    assert reassigned["skillId"] == nil

    remove_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> delete(~p"/admin/abilities/assign/#{card.id}")

    assert json_response(remove_conn, 200) == %{"success" => true}

    delete_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> delete(~p"/admin/abilities/#{passive["id"]}")

    assert json_response(delete_conn, 200) == %{"success" => true}
    assert Repo.get(AbilityDef, passive["id"]) == nil
  end

  test "admin ability routes require admin and validate payloads", %{conn: conn} do
    user =
      create_user_with_password("ability-user@example.com", "password123", "Ability User",
        verified?: true,
        access_status: :approved,
        role: :user
      )

    access_token = login_access_token(user.email, "password123")

    forbidden_conn =
      conn
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> post(~p"/admin/abilities", %{
        "key" => unique_name("forbidden.ability"),
        "name" => "Forbidden",
        "description" => "Nope",
        "type" => "SKILL",
        "payload" => %{}
      })

    assert json_response(forbidden_conn, 403) == %{
             "error" => "Admin access required",
             "code" => "ADMIN_REQUIRED"
           }

    admin =
      create_user_with_password(
        "ability-validator@example.com",
        "password123",
        "Ability Validator",
        verified?: true,
        access_status: :approved,
        role: :admin
      )

    admin_token = login_access_token(admin.email, "password123")

    invalid_create_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{admin_token}")
      |> post(~p"/admin/abilities", %{
        "key" => unique_name("invalid.ability"),
        "name" => "Broken",
        "description" => "Broken payload",
        "type" => "NOT_REAL",
        "payload" => %{}
      })

    invalid_create = json_response(invalid_create_conn, 400)
    assert invalid_create["error"] == "Invalid ability"
    assert invalid_create["details"]["type"] == ["is invalid"]

    create_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{admin_token}")
      |> post(~p"/admin/abilities", %{
        "key" => unique_name("freeze.ability"),
        "name" => "Freeze Ability",
        "description" => "Applies Freeze and Stunned.",
        "type" => "SKILL",
        "cost" => 2,
        "payload" => %{
          "applyStatuses" => [
            %{"name" => "Freeze", "duration" => 2},
            %{"name" => "Stunned", "duration" => 3},
            %{"name" => "Silence", "duration" => 2}
          ]
        }
      })

    created_ability = json_response(create_conn, 201)["ability"]
    [freeze, stunned, silence] = created_ability["payload"]["applyStatuses"]
    assert freeze["duration"] == -1
    assert stunned["duration"] == -1
    assert silence["duration"] == 2

    update_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{admin_token}")
      |> patch(~p"/admin/abilities/#{created_ability["id"]}", %{
        "payload" => %{
          "conditional" => [
            %{
              "when" => %{"targetHas" => "Burn"},
              "addApplyStatuses" => [%{"name" => "Stunned", "duration" => 4}]
            }
          ]
        }
      })

    updated_ability = json_response(update_conn, 200)["ability"]

    assert get_in(updated_ability, [
             "payload",
             "conditional",
             Access.at(0),
             "addApplyStatuses",
             Access.at(0),
             "duration"
           ]) == -1

    missing_update_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{admin_token}")
      |> patch(~p"/admin/abilities/#{Ecto.UUID.generate()}", %{"name" => "Ghost"})

    assert json_response(missing_update_conn, 404) == %{"error" => "Ability not found"}

    missing_card_id_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{admin_token}")
      |> post(~p"/admin/abilities/assign", %{"skillId" => Ecto.UUID.generate()})

    assert json_response(missing_card_id_conn, 400) == %{"error" => "cardId is required"}

    invalid_assign_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{admin_token}")
      |> post(~p"/admin/abilities/assign", %{
        "cardId" => Ecto.UUID.generate(),
        "skillId" => Ecto.UUID.generate()
      })

    invalid_assign = json_response(invalid_assign_conn, 400)
    assert invalid_assign["error"] == "Invalid assignment"

    non_legendary_rarity =
      Repo.insert!(
        Rarity.changeset(%Rarity{}, %{
          name: unique_name("Non Legendary"),
          drop_rate: 10.0,
          color: "#3B82F6"
        })
      )

    non_legendary_card =
      Repo.insert!(
        Card.changeset(%Card{}, %{
          name: unique_name("Non Legendary Passive Card"),
          character: "Finn",
          description: "Should not accept a passive.",
          hp: 30,
          attack: 10,
          defense: 8,
          speed: 50,
          type: "Hero",
          rarity_id: non_legendary_rarity.id
        })
      )

    passive =
      Repo.insert!(
        AbilityDef.changeset(%AbilityDef{}, %{
          key: unique_name("invalid.passive"),
          name: "Invalid Passive",
          description: "Passive assignment should fail.",
          type: "PASSIVE",
          cost: 0,
          cooldown: nil,
          once_per_match: false,
          payload: %{"trigger" => "onActionStart"}
        })
      )

    non_legendary_passive_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{admin_token}")
      |> post(~p"/admin/abilities/assign", %{
        "cardId" => non_legendary_card.id,
        "passiveId" => passive.id
      })

    non_legendary_passive = json_response(non_legendary_passive_conn, 400)
    assert non_legendary_passive["error"] == "Invalid assignment"

    assert non_legendary_passive["details"]["passive_id"] == [
             "can only be assigned to Legendary cards"
           ]

    missing_remove_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{admin_token}")
      |> delete(~p"/admin/abilities/assign/#{Ecto.UUID.generate()}")

    assert json_response(missing_remove_conn, 404) == %{"error" => "Assignment not found"}
  end

  test "admin can list, create, and patch packs", _context do
    admin =
      create_user_with_password("packs-admin@example.com", "password123", "Packs Admin",
        verified?: true,
        access_status: :approved,
        role: :admin
      )

    pack_art_asset =
      Repo.insert!(
        ImageAsset.changeset(%ImageAsset{}, %{
          kind: :catalog,
          mime_type: "image/png",
          object_key: "catalog/pack-art"
        })
      )

    active_pack =
      Repo.insert!(
        Pack.changeset(%Pack{}, %{
          name: unique_name("Active Pack"),
          description: "Current stock.",
          card_count: 5,
          cost: 100,
          color: "#F59E0B",
          is_active: true,
          guaranteed_rarity: "Rare",
          pack_art_asset_id: pack_art_asset.id
        })
      )

    inactive_pack =
      Repo.insert!(
        Pack.changeset(%Pack{}, %{
          name: unique_name("Inactive Pack"),
          description: "Hidden stock.",
          card_count: 4,
          cost: 80,
          color: "#6B7280",
          is_active: false,
          guaranteed_rarity: nil
        })
      )

    access_token = login_access_token(admin.email, "password123")

    list_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> get(~p"/admin/packs")

    assert %{"packs" => packs} = json_response(list_conn, 200)
    assert Enum.any?(packs, &(&1["id"] == active_pack.id and &1["isActive"] == true))
    assert Enum.any?(packs, &(&1["id"] == inactive_pack.id and &1["isActive"] == false))
    assert Enum.all?(packs, &(not Map.has_key?(&1, "imageUrl")))

    assert Enum.any?(
             packs,
             &(&1["id"] == active_pack.id and &1["packArtAssetId"] == pack_art_asset.id)
           )

    create_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> post(~p"/admin/packs", %{
        "name" => unique_name("Created Pack"),
        "description" => "Freshly stocked.",
        "cardCount" => 6,
        "cost" => 150,
        "color" => "#22C55E",
        "isActive" => true,
        "guaranteedRarity" => "Epic",
        "packArtAssetId" => pack_art_asset.id
      })

    created = json_response(create_conn, 201)
    assert created["cardCount"] == 6
    assert created["cost"] == 150
    assert created["color"] == "#22C55E"
    assert created["isActive"] == true
    assert created["guaranteedRarity"] == "Epic"
    assert created["packArtAssetId"] == pack_art_asset.id
    refute Map.has_key?(created, "imageUrl")

    patch_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> patch(~p"/admin/packs/#{active_pack.id}", %{
        "cost" => 125,
        "isActive" => false,
        "guaranteedRarity" => "",
        "packArtAssetId" => ""
      })

    patched = json_response(patch_conn, 200)
    assert patched["id"] == active_pack.id
    assert patched["cost"] == 125
    assert patched["isActive"] == false
    assert is_nil(patched["guaranteedRarity"])
    assert is_nil(patched["packArtAssetId"])
  end

  test "admin pack routes require admin and validate payloads", %{conn: conn} do
    user =
      create_user_with_password("pack-user@example.com", "password123", "Pack User",
        verified?: true,
        access_status: :approved,
        role: :user
      )

    access_token = login_access_token(user.email, "password123")

    forbidden_conn =
      conn
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> get(~p"/admin/packs")

    assert json_response(forbidden_conn, 403) == %{
             "error" => "Admin access required",
             "code" => "ADMIN_REQUIRED"
           }

    admin =
      create_user_with_password("pack-validator@example.com", "password123", "Pack Validator",
        verified?: true,
        access_status: :approved,
        role: :admin
      )

    admin_token = login_access_token(admin.email, "password123")

    profile_asset =
      Repo.insert!(
        ImageAsset.changeset(%ImageAsset{}, %{
          kind: :profile,
          mime_type: "image/png",
          object_key: "profile/not-allowed"
        })
      )

    invalid_create_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{admin_token}")
      |> post(~p"/admin/packs", %{
        "name" => unique_name("Broken Pack"),
        "description" => "Missing count.",
        "cardCount" => 0,
        "cost" => -5,
        "color" => "#EF4444",
        "packArtAssetId" => profile_asset.id
      })

    invalid_create = json_response(invalid_create_conn, 400)
    assert invalid_create["error"] == "Invalid pack"
    assert invalid_create["details"]["card_count"] == ["must be greater than 0"]
    assert invalid_create["details"]["cost"] == ["must be greater than or equal to 0"]

    assert invalid_create["details"]["pack_art_asset_id"] == [
             "must reference a catalog image asset"
           ]

    missing_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{admin_token}")
      |> patch(~p"/admin/packs/#{Ecto.UUID.generate()}", %{"cost" => 50})

    assert json_response(missing_conn, 404) == %{"error" => "Pack not found"}
  end

  test "admin can list, assign, and clear card back visuals", _context do
    admin =
      create_user_with_password("card-backs-admin@example.com", "password123", "Card Backs Admin",
        verified?: true,
        access_status: :approved,
        role: :admin
      )

    back_asset =
      Repo.insert!(
        ImageAsset.changeset(%ImageAsset{}, %{
          kind: :catalog,
          mime_type: "image/png",
          object_key: "catalog/card-back"
        })
      )

    access_token = login_access_token(admin.email, "password123")

    list_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> get(~p"/admin/card-back-visuals")

    assert %{"cardBackVisuals" => visuals} = json_response(list_conn, 200)
    assert length(visuals) == 15
    assert Enum.any?(visuals, &(&1["themeName"] == "candy" and &1["rarityName"] == "Common"))

    put_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> put(~p"/admin/card-back-visuals", %{
        "themeName" => "ice",
        "rarityName" => "Epic",
        "imageAssetId" => back_asset.id
      })

    assigned = json_response(put_conn, 200)
    assert assigned["themeName"] == "ice"
    assert assigned["rarityName"] == "Epic"
    assert assigned["imageAssetId"] == back_asset.id

    assert %CardBackVisual{image_asset_id: image_asset_id} =
             Repo.get_by!(CardBackVisual, theme_name: "ice", rarity_name: "Epic")

    assert image_asset_id == back_asset.id

    clear_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> put(~p"/admin/card-back-visuals", %{
        "themeName" => "ice",
        "rarityName" => "Epic",
        "imageAssetId" => nil
      })

    cleared = json_response(clear_conn, 200)
    assert cleared["imageAssetId"] == nil
    refute Repo.get_by(CardBackVisual, theme_name: "ice", rarity_name: "Epic")
  end

  test "admin card back visuals require admin and validate catalog assets", %{conn: conn} do
    user =
      create_user_with_password("card-backs-user@example.com", "password123", "Card Backs User",
        verified?: true,
        access_status: :approved,
        role: :user
      )

    access_token = login_access_token(user.email, "password123")

    forbidden_conn =
      conn
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> get(~p"/admin/card-back-visuals")

    assert json_response(forbidden_conn, 403) == %{
             "error" => "Admin access required",
             "code" => "ADMIN_REQUIRED"
           }

    admin =
      create_user_with_password(
        "card-backs-validator@example.com",
        "password123",
        "Card Backs Validator",
        verified?: true,
        access_status: :approved,
        role: :admin
      )

    admin_token = login_access_token(admin.email, "password123")

    profile_asset =
      Repo.insert!(
        ImageAsset.changeset(%ImageAsset{}, %{
          kind: :profile,
          mime_type: "image/png",
          object_key: "profile/not-allowed"
        })
      )

    invalid_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{admin_token}")
      |> put(~p"/admin/card-back-visuals", %{
        "themeName" => "candy",
        "rarityName" => "Rare",
        "imageAssetId" => profile_asset.id
      })

    invalid = json_response(invalid_conn, 400)
    assert invalid["error"] == "Invalid card back visual"
    assert invalid["details"]["image_asset_id"] == ["must reference a catalog image asset"]
  end

  test "admin can create, update, patch, and fetch cards", _context do
    admin =
      create_user_with_password("cards-admin@example.com", "password123", "Cards Admin",
        verified?: true,
        access_status: :approved,
        role: :admin
      )

    rarity =
      Repo.insert!(
        Rarity.changeset(%Rarity{}, %{
          name: unique_name("Rare"),
          drop_rate: 10.0,
          color: "#3B82F6"
        })
      )

    access_token = login_access_token(admin.email, "password123")

    create_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> post(~p"/admin/cards", %{
        "name" => unique_name("Created Card"),
        "character" => "Jake",
        "description" => "Created in test",
        "hp" => 25,
        "attack" => 9,
        "defense" => 6,
        "speed" => 50,
        "type" => "Hero",
        "rarityId" => rarity.id
      })

    created = json_response(create_conn, 201)
    card_id = created["id"]
    assert created["rarityId"] == rarity.id
    assert created["isArchived"] == false
    assert created["isFeatured"] == false

    get_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> get(~p"/admin/cards/#{card_id}")

    assert json_response(get_conn, 200)["id"] == card_id

    put_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> put(~p"/admin/cards/#{card_id}", %{
        "name" => "Updated Card",
        "character" => "BMO",
        "description" => "Updated in test",
        "hp" => 30,
        "attack" => 11,
        "defense" => 8,
        "speed" => 61,
        "type" => "Tech",
        "rarityId" => rarity.id,
        "isFeatured" => true,
        "isArchived" => false
      })

    updated = json_response(put_conn, 200)
    assert updated["name"] == "Updated Card"
    assert updated["character"] == "BMO"
    assert updated["isFeatured"] == true

    patch_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> patch(~p"/admin/cards/#{card_id}", %{"isArchived" => true})

    patched = json_response(patch_conn, 200)
    assert patched["isArchived"] == true
    assert patched["isFeatured"] == false
  end

  test "admin can upload card image", _context do
    admin =
      create_user_with_password("upload-admin@example.com", "password123", "Upload Admin",
        verified?: true,
        access_status: :approved,
        role: :admin
      )

    rarity =
      Repo.insert!(
        Rarity.changeset(%Rarity{}, %{
          name: unique_name("Upload Rare"),
          drop_rate: 5.0,
          color: "#10B981"
        })
      )

    card =
      Repo.insert!(
        Card.changeset(%Card{}, %{
          name: unique_name("Upload Card"),
          character: "Marceline",
          description: "Image upload target",
          hp: 19,
          attack: 10,
          defense: 4,
          speed: 57,
          type: "Undead",
          rarity_id: rarity.id
        })
      )

    bypass = Bypass.open()

    Application.put_env(:adventure_time_api, AdventureTimeApi.Media,
      base_url: "http://127.0.0.1:#{bypass.port}",
      bucket: "private-images",
      access_key: "minio",
      secret_key: "secret"
    )

    Bypass.expect_once(bypass, fn conn ->
      assert conn.method == "PUT"
      assert String.starts_with?(conn.request_path, "/private-images/card/#{card.id}/")
      {:ok, body, conn} = Plug.Conn.read_body(conn)
      assert body == "PNGDATA"
      Plug.Conn.resp(conn, 200, "")
    end)

    upload_path =
      Path.join(System.tmp_dir!(), "admin-card-upload-#{System.unique_integer([:positive])}.png")

    File.write!(upload_path, "PNGDATA")

    upload = %Plug.Upload{
      path: upload_path,
      filename: "upload-test.png",
      content_type: "image/png"
    }

    access_token = login_access_token(admin.email, "password123")

    upload_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> post(~p"/admin/cards/#{card.id}/image", %{"file" => upload})

    response = json_response(upload_conn, 200)
    assert is_binary(response["assetId"])

    updated_card = Repo.get!(Card, card.id)
    assert updated_card.image_asset_id == response["assetId"]
    assert Repo.get!(ImageAsset, response["assetId"]).kind == :card
  end

  test "admin can list and upload catalog image assets", _context do
    admin =
      create_user_with_password("asset-admin@example.com", "password123", "Asset Admin",
        verified?: true,
        access_status: :approved,
        role: :admin
      )

    existing_asset =
      Repo.insert!(
        ImageAsset.changeset(%ImageAsset{}, %{
          kind: :catalog,
          mime_type: "image/svg+xml",
          object_key: "catalog/existing-asset",
          placeholder_svg: "<svg>existing</svg>"
        })
      )

    access_token = login_access_token(admin.email, "password123")

    list_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> get(~p"/admin/image-assets")

    assert %{"imageAssets" => assets} = json_response(list_conn, 200)

    assert Enum.any?(
             assets,
             &(&1["id"] == existing_asset.id and
                 &1["previewUrl"] == "/media/catalog/#{existing_asset.id}")
           )

    bypass = Bypass.open()

    Application.put_env(:adventure_time_api, AdventureTimeApi.Media,
      base_url: "http://127.0.0.1:#{bypass.port}",
      bucket: "private-images",
      access_key: "minio",
      secret_key: "secret"
    )

    Bypass.expect_once(bypass, fn conn ->
      assert conn.method == "PUT"
      assert String.starts_with?(conn.request_path, "/private-images/catalog/")
      {:ok, body, conn} = Plug.Conn.read_body(conn)
      assert body == "CATALOGDATA"
      Plug.Conn.resp(conn, 200, "")
    end)

    upload_path =
      Path.join(
        System.tmp_dir!(),
        "admin-catalog-upload-#{System.unique_integer([:positive])}.png"
      )

    File.write!(upload_path, "CATALOGDATA")

    upload = %Plug.Upload{
      path: upload_path,
      filename: "catalog-test.png",
      content_type: "image/png"
    }

    upload_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> post(~p"/admin/image-assets", %{"file" => upload})

    created = json_response(upload_conn, 201)
    assert created["kind"] == "catalog"
    assert created["mimeType"] == "image/png"
    assert created["previewUrl"] == "/media/catalog/#{created["id"]}"
    assert is_binary(created["insertedAt"])
    assert Repo.get!(ImageAsset, created["id"]).kind == :catalog
  end

  test "admin image assets require admin and validate uploads", %{conn: conn} do
    user =
      create_user_with_password("asset-user@example.com", "password123", "Asset User",
        verified?: true,
        access_status: :approved,
        role: :user
      )

    access_token = login_access_token(user.email, "password123")

    forbidden_conn =
      conn
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> get(~p"/admin/image-assets")

    assert json_response(forbidden_conn, 403) == %{
             "error" => "Admin access required",
             "code" => "ADMIN_REQUIRED"
           }

    admin =
      create_user_with_password("asset-validator@example.com", "password123", "Asset Validator",
        verified?: true,
        access_status: :approved,
        role: :admin
      )

    admin_token = login_access_token(admin.email, "password123")

    missing_file_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{admin_token}")
      |> post(~p"/admin/image-assets", %{})

    assert json_response(missing_file_conn, 400) == %{"error" => "No file uploaded"}

    upload_path =
      Path.join(
        System.tmp_dir!(),
        "admin-catalog-invalid-#{System.unique_integer([:positive])}.txt"
      )

    File.write!(upload_path, "NOT-AN-IMAGE")

    invalid_upload = %Plug.Upload{
      path: upload_path,
      filename: "bad.txt",
      content_type: "text/plain"
    }

    invalid_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{admin_token}")
      |> post(~p"/admin/image-assets", %{"file" => invalid_upload})

    assert json_response(invalid_conn, 400) == %{
             "error" => "Unsupported image type. Allowed: PNG, JPEG, WEBP, SVG"
           }
  end

  test "admin can inspect user detail but cannot mutate users", _context do
    admin =
      create_user_with_password("viewer-admin@example.com", "password123", "Viewer Admin",
        verified?: true,
        access_status: :approved,
        role: :admin
      )

    user =
      create_user_with_password("player@example.com", "password123", "Player One",
        verified?: true,
        access_status: :approved,
        role: :user
      )

    date = Quests.current_reset_date()

    Quests.materialize_daily_quests(user.id, date)

    Repo.insert!(
      StepSnapshot.changeset(%StepSnapshot{}, %{
        user_id: user.id,
        source: :device_health,
        step_count: 7_654,
        recorded_for: date
      })
    )

    Quests.sync_steps_quest(user.id, date)

    Repo.insert!(
      WordleDailyAttempt.changeset(%WordleDailyAttempt{}, %{
        user_id: user.id,
        date: date,
        locale: "fr",
        attempt: 1,
        guess: "amour",
        evaluation: ["present", "absent", "absent", "absent", "absent"],
        solved: false
      })
    )

    Repo.insert!(
      SpeedCalculusDailyRun.changeset(%SpeedCalculusDailyRun{}, %{
        user_id: user.id,
        date: date,
        run_number: 1,
        seed: "seed-1",
        answers: [1, 2, 3],
        status: "completed",
        score: 2,
        reward: 20,
        started_at: DateTime.utc_now() |> DateTime.truncate(:second),
        play_deadline_at: DateTime.utc_now() |> DateTime.truncate(:second),
        finished_at: DateTime.utc_now() |> DateTime.truncate(:second)
      })
    )

    access_token = login_access_token(admin.email, "password123")

    detail_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> get(~p"/admin/users/#{user.id}")

    detail = json_response(detail_conn, 200)
    assert detail["email"] == user.email
    assert detail["todayDate"] == Date.to_iso8601(date)
    assert length(detail["dailyQuests"]) == 5

    assert detail["viewerPermissions"] == %{
             "canManageCoins" => false,
             "canManageAdminRights" => false,
             "canResetDailyQuests" => false,
             "canDeleteUser" => false
           }

    assert Enum.any?(detail["dailyQuests"], fn quest ->
             quest["type"] == "steps_10k" and quest["progress"] == 7654
           end)

    coins_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> patch(~p"/admin/users/#{user.id}/coins", %{"delta" => 100})

    assert json_response(coins_conn, 403) == %{
             "error" => "Super admin access required",
             "code" => "SUPER_ADMIN_REQUIRED"
           }

    role_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> patch(~p"/admin/users/#{user.id}/role", %{"role" => "admin"})

    assert json_response(role_conn, 403) == %{
             "error" => "Super admin access required",
             "code" => "SUPER_ADMIN_REQUIRED"
           }

    reset_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> post(~p"/admin/users/#{user.id}/reset-daily-quests", %{"mode" => "all"})

    assert json_response(reset_conn, 403) == %{
             "error" => "Super admin access required",
             "code" => "SUPER_ADMIN_REQUIRED"
           }

    delete_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> delete(~p"/admin/users/#{user.id}")

    assert json_response(delete_conn, 403) == %{
             "error" => "Super admin access required",
             "code" => "SUPER_ADMIN_REQUIRED"
           }
  end

  test "superadmin can adjust coins and reset daily quests", _context do
    super_admin =
      create_user_with_password("coins-boss@example.com", "password123", "Coins Boss",
        verified?: true,
        access_status: :approved,
        role: :super_admin
      )

    user =
      create_user_with_password("quest-target@example.com", "password123", "Quest Target",
        verified?: true,
        access_status: :approved,
        role: :user
      )

    date = Quests.current_reset_date()
    Quests.materialize_daily_quests(user.id, date)

    Repo.insert!(
      WordleDailyAttempt.changeset(%WordleDailyAttempt{}, %{
        user_id: user.id,
        date: date,
        locale: "fr",
        attempt: 1,
        guess: "amour",
        evaluation: ["present", "absent", "absent", "absent", "absent"],
        solved: false
      })
    )

    access_token = login_access_token(super_admin.email, "password123")

    coins_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> patch(~p"/admin/users/#{user.id}/coins", %{"delta" => -250})

    assert json_response(coins_conn, 200) == %{"id" => user.id, "coins" => 0}

    reset_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> post(~p"/admin/users/#{user.id}/reset-daily-quests", %{
        "mode" => "single",
        "questType" => "wordle_daily"
      })

    assert json_response(reset_conn, 200) == %{
             "success" => true,
             "questType" => "wordle_daily",
             "resetDate" => Date.to_iso8601(date),
             "resetMode" => "single",
             "resetByName" => super_admin.display_name
           }

    assert Repo.aggregate(WordleDailyAttempt, :count, :id) == 0

    wordle_quest =
      DailyQuest
      |> Repo.get_by!(user_id: user.id, date: date, quest_type: "wordle_daily")

    assert wordle_quest.reset_by_user_id == super_admin.id
  end

  test "superadmin delete hard-cascades user history", _context do
    super_admin =
      create_user_with_password("delete-boss@example.com", "password123", "Delete Boss",
        verified?: true,
        access_status: :approved,
        role: :super_admin
      )

    user =
      create_user_with_password("delete-me@example.com", "password123", "Delete Me",
        verified?: true,
        access_status: :approved,
        role: :user
      )

    opponent =
      create_user_with_password("opponent@example.com", "password123", "Opponent",
        verified?: true,
        access_status: :approved,
        role: :user
      )

    date = Quests.current_reset_date()
    Quests.materialize_daily_quests(user.id, date)

    avatar_asset =
      Repo.insert!(
        ImageAsset.changeset(%ImageAsset{}, %{
          kind: :profile,
          mime_type: "image/png",
          object_key: "profile/#{user.id}/avatar"
        })
      )

    user
    |> Ecto.Changeset.change(avatar_asset_id: avatar_asset.id)
    |> Repo.update!()

    rarity =
      Repo.insert!(
        Rarity.changeset(%Rarity{}, %{
          name: unique_name("Delete Rare"),
          drop_rate: 5.0,
          color: "#111827"
        })
      )

    card =
      Repo.insert!(
        Card.changeset(%Card{}, %{
          name: unique_name("Delete Card"),
          character: "Finn",
          description: "Delete coverage",
          hp: 20,
          attack: 5,
          defense: 4,
          speed: 40,
          type: "Hero",
          rarity_id: rarity.id
        })
      )

    Repo.insert!(owned_card_changeset(user.id, card.id))
    Repo.insert!(card_gift_changeset(super_admin.id, user.id, card.id))

    Repo.insert!(
      StepSnapshot.changeset(%StepSnapshot{}, %{
        user_id: user.id,
        source: :device_health,
        step_count: 123,
        recorded_for: date
      })
    )

    Repo.insert!(
      WordleDailyAttempt.changeset(%WordleDailyAttempt{}, %{
        user_id: user.id,
        date: date,
        locale: "fr",
        attempt: 1,
        guess: "amour",
        evaluation: ["absent", "absent", "absent", "absent", "absent"],
        solved: false
      })
    )

    Repo.insert!(
      SpeedCalculusDailyRun.changeset(%SpeedCalculusDailyRun{}, %{
        user_id: user.id,
        date: date,
        run_number: 1,
        seed: "seed-delete",
        answers: [1],
        status: "completed",
        score: 1,
        reward: 10,
        started_at: DateTime.utc_now() |> DateTime.truncate(:second),
        play_deadline_at: DateTime.utc_now() |> DateTime.truncate(:second),
        finished_at: DateTime.utc_now() |> DateTime.truncate(:second)
      })
    )

    Repo.insert!(%Loadout{
      owner_id: user.id,
      name: "Delete Loadout",
      card_ids: ["1", "2", "3", "4", "5", "6"]
    })

    match =
      Repo.insert!(
        Match.changeset(%Match{}, %{
          inviter_id: user.id,
          invitee_id: opponent.id,
          status: "pending",
          inviter_card_ids: [card.id],
          invitee_card_ids: [card.id],
          current_turn: 0
        })
      )

    Repo.insert!(
      MatchEvent.changeset(%MatchEvent{}, %{
        match_id: match.id,
        seq: 0,
        turn: 0,
        type: "invite_created",
        payload: %{}
      })
    )

    Repo.insert!(
      MatchSnapshot.changeset(%MatchSnapshot{}, %{
        match_id: match.id,
        seq_at: 0,
        turn_at: 0,
        state: %{}
      })
    )

    Repo.insert!(
      EmailAccessRequest.changeset(%EmailAccessRequest{}, %{email: user.email, status: :approved})
    )

    Repo.insert!(
      EmailVerificationCode.changeset(%EmailVerificationCode{}, %{
        email: user.email,
        code_hash: "hash",
        purpose: :signup,
        expires_at: DateTime.utc_now() |> DateTime.truncate(:second),
        attempt_count: 0
      })
    )

    access_token = login_access_token(super_admin.email, "password123")

    delete_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> delete(~p"/admin/users/#{user.id}")

    assert json_response(delete_conn, 200) == %{"success" => true, "deletedUserId" => user.id}
    assert Repo.get(User, user.id) == nil
    assert Repo.get(ImageAsset, avatar_asset.id) == nil
    assert Repo.aggregate(DailyQuest, :count, :id) == 0
    assert Repo.aggregate(WordleDailyAttempt, :count, :id) == 0
    assert Repo.aggregate(SpeedCalculusDailyRun, :count, :id) == 0
    assert Repo.aggregate(StepSnapshot, :count, :id) == 0
    assert Repo.aggregate(OwnedCard, :count, :id) == 0
    assert Repo.aggregate(CardGift, :count, :id) == 0
    assert Repo.aggregate(Loadout, :count, :id) == 0
    assert Repo.aggregate(Match, :count, :id) == 0
    assert Repo.aggregate(MatchEvent, :count, :id) == 0
    assert Repo.aggregate(MatchSnapshot, :count, :id) == 0
    assert Repo.aggregate(EmailAccessRequest, :count, :id) == 0
    assert Repo.aggregate(EmailVerificationCode, :count, :id) == 0
    assert Repo.aggregate(EmailCredential, :count, :id) == 2
  end

  test "superadmin cannot delete self", _context do
    super_admin =
      create_user_with_password("self-delete@example.com", "password123", "Self Delete",
        verified?: true,
        access_status: :approved,
        role: :super_admin
      )

    access_token = login_access_token(super_admin.email, "password123")

    conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> delete(~p"/admin/users/#{super_admin.id}")

    assert json_response(conn, 400) == %{"error" => "Cannot delete yourself"}
  end

  test "superadmin can approve email requests and promote users", _context do
    super_admin =
      create_user_with_password("boss@example.com", "password123", "Boss",
        verified?: true,
        access_status: :approved,
        role: :super_admin
      )

    pending_user =
      create_user_with_password("pending@example.com", "password123", "Pending",
        verified?: true,
        access_status: :pending,
        role: :user
      )

    request =
      Repo.insert!(
        EmailAccessRequest.changeset(%EmailAccessRequest{}, %{
          email: pending_user.email,
          status: :pending
        })
      )

    access_token = login_access_token(super_admin.email, "password123")

    list_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> get(~p"/admin/email-requests")

    assert %{"requests" => [%{"email" => "pending@example.com"}]} = json_response(list_conn, 200)

    review_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> patch(~p"/admin/email-requests/#{request.id}", %{"status" => "approved"})

    assert json_response(review_conn, 200) == %{"id" => request.id, "status" => "approved"}
    assert Repo.get!(User, pending_user.id).access_status == :approved

    role_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> patch(~p"/admin/users/#{pending_user.id}/role", %{"role" => "admin"})

    assert %{"email" => "pending@example.com", "role" => "admin", "isAdmin" => true} =
             json_response(role_conn, 200)
  end

  test "superadmin email request list keeps approved requests without accounts", _context do
    super_admin =
      create_user_with_password("requests-boss@example.com", "password123", "Requests Boss",
        verified?: true,
        access_status: :approved,
        role: :super_admin
      )

    Repo.insert!(
      EmailAccessRequest.changeset(%EmailAccessRequest{}, %{
        email: "pending2@example.com",
        status: :pending
      })
    )

    Repo.insert!(
      EmailAccessRequest.changeset(%EmailAccessRequest{}, %{
        email: "approved-no-account@example.com",
        status: :approved
      })
    )

    create_user_with_password(
      "approved-with-account@example.com",
      "password123",
      "Approved Account",
      verified?: true,
      access_status: :approved,
      role: :user
    )

    Repo.insert!(
      EmailAccessRequest.changeset(%EmailAccessRequest{}, %{
        email: "approved-with-account@example.com",
        status: :approved
      })
    )

    access_token = login_access_token(super_admin.email, "password123")

    conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> get(~p"/admin/email-requests")

    assert %{"requests" => requests} = json_response(conn, 200)

    assert Enum.any?(
             requests,
             &(&1["email"] == "pending2@example.com" and &1["status"] == "pending")
           )

    assert Enum.any?(requests, fn request ->
             request["email"] == "approved-no-account@example.com" and
               request["status"] == "approved" and
               request["hasAccount"] == false
           end)

    refute Enum.any?(requests, &(&1["email"] == "approved-with-account@example.com"))
  end

  test "superadmin approval creates account with requested locale when no user exists",
       _context do
    super_admin =
      create_user_with_password("requests-locale-boss@example.com", "password123", "Locale Boss",
        verified?: true,
        access_status: :approved,
        role: :super_admin
      )

    request =
      Repo.insert!(
        EmailAccessRequest.changeset(%EmailAccessRequest{}, %{
          email: "new-locale@example.com",
          requested_locale: :fr,
          status: :pending
        })
      )

    access_token = login_access_token(super_admin.email, "password123")

    conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> patch(~p"/admin/email-requests/#{request.id}", %{"status" => "approved"})

    assert json_response(conn, 200) == %{"id" => request.id, "status" => "approved"}
    assert Repo.get_by!(User, email: "new-locale@example.com").preferred_language == :fr
  end

  defp create_user_with_password(email, password, display_name, opts) do
    role = Keyword.get(opts, :role, :user)
    access_status = Keyword.get(opts, :access_status, :pending)
    verified? = Keyword.get(opts, :verified?, false)

    user =
      Repo.insert!(
        User.registration_changeset(%User{}, %{email: email, display_name: display_name})
        |> User.access_changeset(%{role: role, access_status: access_status})
      )

    Repo.insert!(
      EmailCredential.changeset(%EmailCredential{}, %{
        password_hash: Bcrypt.hash_pwd_salt(password),
        email_verified_at:
          if(verified?, do: DateTime.utc_now() |> DateTime.truncate(:second), else: nil)
      })
      |> Ecto.Changeset.put_change(:user_id, user.id)
    )

    user
  end

  defp login_access_token(email, password) do
    build_conn()
    |> post(~p"/auth/login", %{email: email, password: password})
    |> json_response(200)
    |> get_in(["tokens", "accessToken"])
  end

  defp owned_card_changeset(user_id, card_id) do
    OwnedCard.changeset(%OwnedCard{}, %{
      quantity: 1,
      obtained_at: DateTime.utc_now() |> DateTime.truncate(:second)
    })
    |> Ecto.Changeset.put_change(:user_id, user_id)
    |> Ecto.Changeset.put_change(:card_id, card_id)
  end

  defp card_gift_changeset(from_user_id, to_user_id, card_id) do
    CardGift.changeset(%CardGift{}, %{quantity: 1, message: "bye", status: :pending})
    |> Ecto.Changeset.put_change(:from_user_id, from_user_id)
    |> Ecto.Changeset.put_change(:to_user_id, to_user_id)
    |> Ecto.Changeset.put_change(:card_id, card_id)
  end

  defp unique_name(prefix), do: "#{prefix}-#{System.unique_integer([:positive])}"
end
