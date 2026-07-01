defmodule AdventureTimeApiWeb.AppControllerTest do
  use AdventureTimeApiWeb.ConnCase, async: true

  alias AdventureTimeApi.Auth
  alias AdventureTimeApi.Accounts.{AuthProviderIdentity, EmailCredential, Session, User}
  alias AdventureTimeApi.Catalog.{Card, CardBackVisual, ImageAsset, Pack, Rarity}
  alias AdventureTimeApi.Inventory.OwnedCard
  alias AdventureTimeApi.Notifications.Device
  alias AdventureTimeApi.Pvp.Match
  alias AdventureTimeApi.Quests
  alias AdventureTimeApi.Repo

  test "GET /rarities returns mobile rarity payloads", %{conn: conn} do
    user = create_user_with_password("flame@example.com", "firefire")
    access_token = login_access_token(user.email, "firefire")

    Repo.insert!(
      Rarity.changeset(%Rarity{}, %{name: "Common", drop_rate: 60.0, color: "#9CA3AF"})
    )

    conn = conn |> put_req_header("authorization", "Bearer #{access_token}") |> get(~p"/rarities")

    assert %{"rarities" => [rarity]} = json_response(conn, 200)
    assert rarity["name"] == "Common"
    assert rarity["dropRate"] == 60.0
    assert rarity["color"] == "#9CA3AF"
    assert rarity["dustValue"] == 1
    assert rarity["craftCost"] == 5
    assert is_binary(rarity["id"])
  end

  test "PATCH /settings/password creates password auth for a provider-only account", _context do
    user = create_user_without_password("provider-settings@example.com", "Provider Settings")

    Repo.insert!(
      AuthProviderIdentity.changeset(%AuthProviderIdentity{}, %{
        provider: "google",
        provider_subject_hash: String.duplicate("a", 64),
        email: user.email,
        display_name: user.display_name
      })
      |> Ecto.Changeset.put_change(:user_id, user.id)
    )

    access_token = access_token_for_user(user)

    response =
      access_token
      |> auth_conn()
      |> patch(~p"/settings/password", %{"newPassword" => "provider123"})
      |> json_response(200)

    assert response["authMethods"] == %{
             "password" => true,
             "google" => true,
             "apple" => false
           }

    login =
      build_conn()
      |> post(~p"/auth/login", %{email: user.email, password: "provider123"})
      |> json_response(200)

    assert get_in(login, ["user", "id"]) == user.id
  end

  test "PATCH /settings/password changes an existing password", _context do
    user = create_user_with_password("change-settings@example.com", "oldpass123")
    access_token = login_access_token(user.email, "oldpass123")

    response =
      access_token
      |> auth_conn()
      |> patch(~p"/settings/password", %{
        "currentPassword" => "oldpass123",
        "newPassword" => "newpass123"
      })
      |> json_response(200)

    assert response["authMethods"]["password"] == true

    assert json_response(
             post(build_conn(), ~p"/auth/login", %{
               email: user.email,
               password: "oldpass123"
             }),
             401
           ) == %{"error" => "Invalid email or password."}

    assert get_in(
             post(build_conn(), ~p"/auth/login", %{
               email: user.email,
               password: "newpass123"
             })
             |> json_response(200),
             ["user", "id"]
           ) == user.id
  end

  test "PATCH /settings/password rejects incorrect current password", _context do
    user = create_user_with_password("wrong-current@example.com", "oldpass123")
    access_token = login_access_token(user.email, "oldpass123")

    response =
      access_token
      |> auth_conn()
      |> patch(~p"/settings/password", %{
        "currentPassword" => "not-right",
        "newPassword" => "newpass123"
      })
      |> json_response(400)

    assert response == %{
             "error" => "Current password is incorrect.",
             "code" => "INVALID_CURRENT_PASSWORD"
           }

    assert get_in(
             post(build_conn(), ~p"/auth/login", %{
               email: user.email,
               password: "oldpass123"
             })
             |> json_response(200),
             ["user", "id"]
           ) == user.id
  end

  test "GET and POST /daily-claim return mobile daily reward semantics", _context do
    user = create_user_with_password("claim@example.com", "treasure123")
    access_token = login_access_token(user.email, "treasure123")

    status = access_token |> auth_conn() |> get(~p"/daily-claim") |> json_response(200)

    assert status == %{
             "coins" => 100,
             "canClaim" => true,
             "timeUntilNextClaim" => 0,
             "dailyReward" => 50,
             "timezone" => "Europe/Paris"
           }

    claim = access_token |> auth_conn() |> post(~p"/daily-claim", %{}) |> json_response(200)

    assert claim == %{
             "success" => true,
             "coinsAwarded" => 50,
             "newBalance" => 150
           }

    conflict = access_token |> auth_conn() |> post(~p"/daily-claim", %{}) |> json_response(409)

    assert conflict["error"] == "Already claimed today"
    assert conflict["code"] == "DAILY_ALREADY_CLAIMED"
    assert conflict["timezone"] == "Europe/Paris"
    assert conflict["timeUntilNextClaim"] > 0
  end

  test "PATCH /settings/timezone updates the user timezone and daily claim payload", _context do
    user = create_user_with_password("timezone@example.com", "treasure123")
    access_token = login_access_token(user.email, "treasure123")

    updated =
      access_token
      |> auth_conn()
      |> patch(~p"/settings/timezone", %{"timezone" => "America/New_York"})
      |> json_response(200)

    assert updated["timezone"] == "America/New_York"

    status = access_token |> auth_conn() |> get(~p"/daily-claim") |> json_response(200)
    assert status["timezone"] == "America/New_York"
  end

  test "PATCH /settings/notification-preferences updates notification preferences", _context do
    user = create_user_with_password("notify@example.com", "treasure123")
    access_token = login_access_token(user.email, "treasure123")

    response =
      access_token
      |> auth_conn()
      |> patch(~p"/settings/notification-preferences", %{
        "notificationPreferences" => %{
          "dailyReset" => false,
          "stepGoal" => true,
          "pvpInvite" => false,
          "pvpTurn" => true,
          "giftReceived" => false
        }
      })
      |> json_response(200)

    assert response["notificationPreferences"] == %{
             "dailyReset" => false,
             "stepGoal" => true,
             "pvpInvite" => false,
             "pvpTurn" => true,
             "giftReceived" => false
           }

    updated = Repo.get!(User, user.id)
    assert updated.notify_daily_reset == false
    assert updated.notify_step_goal == true
    assert updated.notify_pvp_invite == false
    assert updated.notify_pvp_turn == true
    assert updated.notify_gift_received == false
  end

  test "DELETE /settings/account deletes the signed-in account and auth records", _context do
    user = create_user_with_password("self-delete@example.com", "treasure123")
    access_token = login_access_token(user.email, "treasure123")

    device =
      Repo.insert!(
        Device.changeset(%Device{}, %{
          user_id: user.id,
          installation_id: "self-delete-installation",
          platform: :android,
          expo_push_token: "ExponentPushToken[self-delete]",
          last_registered_at: DateTime.utc_now() |> DateTime.truncate(:second)
        })
      )

    assert Repo.get_by!(EmailCredential, user_id: user.id)
    assert Repo.get_by!(Session, user_id: user.id)

    response =
      access_token
      |> auth_conn()
      |> delete(~p"/settings/account")
      |> json_response(200)

    assert response == %{"success" => true, "deletedUserId" => user.id}
    refute Repo.get(User, user.id)
    refute Repo.get_by(EmailCredential, user_id: user.id)
    refute Repo.get_by(Session, user_id: user.id)
    refute Repo.get(Device, device.id)
  end

  test "POST /health/steps syncs the step quest using the user's timezone", _context do
    user = create_user_with_password("steps-timezone@example.com", "treasure123")
    user = user |> Ecto.Changeset.change(timezone: "America/New_York") |> Repo.update!()
    access_token = login_access_token(user.email, "treasure123")
    recorded_for = Quests.current_reset_date("America/New_York") |> Date.to_iso8601()

    access_token
    |> auth_conn()
    |> post(~p"/health/steps", %{
      "source" => "device_health",
      "stepCount" => 3456,
      "recordedFor" => recorded_for
    })
    |> json_response(201)

    quests = access_token |> auth_conn() |> get(~p"/quests") |> json_response(200)

    step_quest =
      Enum.find(quests["quests"], fn quest ->
        quest["type"] == "steps_10k"
      end)

    assert step_quest["progress"] == 3456
    assert step_quest["completed"] == false
  end

  test "POST /packs/open returns opened cards and new balance", _context do
    user = create_user_with_password("packs@example.com", "rainicorn")
    user = user |> Ecto.Changeset.change(coins: 250) |> Repo.update!()
    access_token = login_access_token(user.email, "rainicorn")

    common =
      Repo.insert!(
        Rarity.changeset(%Rarity{}, %{name: "Common", drop_rate: 60.0, color: "#9CA3AF"})
      )

    rare =
      Repo.insert!(
        Rarity.changeset(%Rarity{}, %{name: "Rare", drop_rate: 10.0, color: "#3B82F6"})
      )

    Repo.insert!(
      Card.changeset(%Card{}, %{
        name: "Finn",
        character: "Finn",
        description: "Hero of Ooo.",
        hp: 18,
        attack: 8,
        defense: 5,
        speed: 52,
        type: "Hero",
        rarity_id: common.id
      })
    )

    rare_card =
      Repo.insert!(
        Card.changeset(%Card{}, %{
          name: "Marceline",
          character: "Marceline",
          description: "Vampire rocker.",
          hp: 15,
          attack: 9,
          defense: 4,
          speed: 58,
          type: "Undead",
          rarity_id: rare.id
        })
      )

    pack =
      Repo.insert!(
        Pack.changeset(%Pack{}, %{
          name: "Hero Pack",
          description: "A simple pack.",
          card_count: 3,
          cost: 100,
          color: "#F59E0B",
          is_active: true,
          guaranteed_rarity: "Rare"
        })
      )

    response =
      access_token
      |> auth_conn()
      |> post(~p"/packs/open", %{packId: pack.id})
      |> json_response(200)

    assert response["newBalance"] == 150
    assert response["pack"]["id"] == pack.id
    assert response["pack"]["guaranteedRarity"] == "Rare"
    assert response["pack"]["availability"]["canOpen"] == true
    assert Map.has_key?(response["pack"], "packArtAssetId")
    assert length(response["cards"]) == 3
    assert Enum.any?(response["cards"], &(&1["id"] == rare_card.id))

    assert Enum.all?(response["cards"], fn card ->
             Map.has_key?(card, "isNewForUser") and Map.has_key?(card, "rarity")
           end)
  end

  test "GET /packs returns pack art ids and card back visual mappings", _context do
    user = create_user_with_password("pack-list@example.com", "rainicorn")
    access_token = login_access_token(user.email, "rainicorn")

    pack_art_asset =
      Repo.insert!(
        ImageAsset.changeset(%ImageAsset{}, %{
          kind: :catalog,
          mime_type: "image/png",
          object_key: "catalog/pack-art"
        })
      )

    back_asset =
      Repo.insert!(
        ImageAsset.changeset(%ImageAsset{}, %{
          kind: :catalog,
          mime_type: "image/png",
          object_key: "catalog/back-art"
        })
      )

    Repo.insert!(
      CardBackVisual.changeset(%CardBackVisual{}, %{
        theme_name: "candy",
        rarity_name: "Rare",
        image_asset_id: back_asset.id
      })
    )

    pack =
      Repo.insert!(
        Pack.changeset(%Pack{}, %{
          name: "Remote Art Pack",
          description: "Shows explicit media ids.",
          card_count: 5,
          cost: 120,
          color: "#F59E0B",
          is_active: true,
          guaranteed_rarity: "Rare",
          pack_art_asset_id: pack_art_asset.id
        })
      )

    response =
      access_token
      |> auth_conn()
      |> get(~p"/packs")
      |> json_response(200)

    assert Enum.any?(
             response["packs"],
             &(&1["id"] == pack.id and &1["packArtAssetId"] == pack_art_asset.id and
                 &1["availability"]["canOpen"] == true)
           )

    assert length(response["cardBackVisuals"]) == 15

    assert Enum.any?(
             response["cardBackVisuals"],
             &(&1["themeName"] == "candy" and
                 &1["rarityName"] == "Rare" and
                 &1["imageAssetId"] == back_asset.id)
           )
  end

  test "POST /packs/open limits guaranteed Legendary packs to one weekly opening", _context do
    user = create_user_with_password("legendary-limit@example.com", "rainicorn")
    user = user |> Ecto.Changeset.change(coins: 10_000) |> Repo.update!()
    access_token = login_access_token(user.email, "rainicorn")

    legendary =
      Repo.insert!(
        Rarity.changeset(%Rarity{}, %{
          name: "Legendary",
          drop_rate: 0.1,
          color: "#F59E0B"
        })
      )

    Repo.insert!(
      Card.changeset(%Card{}, %{
        name: "Billy",
        character: "Billy",
        description: "A legendary hero.",
        hp: 22,
        attack: 11,
        defense: 8,
        speed: 50,
        type: "Hero",
        rarity_id: legendary.id
      })
    )

    pack =
      Repo.insert!(
        Pack.changeset(%Pack{}, %{
          name: "Weekly Legendary Pack",
          description: "A limited pack.",
          card_count: 1,
          cost: 4500,
          color: "#F59E0B",
          is_active: true,
          guaranteed_rarity: "Legendary"
        })
      )

    first_open =
      access_token
      |> auth_conn()
      |> post(~p"/packs/open", %{packId: pack.id})
      |> json_response(200)

    assert first_open["newBalance"] == 5500
    assert first_open["pack"]["availability"]["canOpen"] == false
    assert first_open["pack"]["availability"]["reason"] == "weekly_limit"
    assert first_open["pack"]["availability"]["opensRemaining"] == 0
    assert first_open["pack"]["availability"]["limit"] == 1
    assert is_binary(first_open["pack"]["availability"]["nextAvailableAt"])

    second_open =
      access_token
      |> auth_conn()
      |> post(~p"/packs/open", %{packId: pack.id})
      |> json_response(409)

    assert second_open["error"] == "Weekly pack limit reached"
    assert second_open["availability"]["canOpen"] == false
    assert second_open["availability"]["reason"] == "weekly_limit"

    packs = access_token |> auth_conn() |> get(~p"/packs") |> json_response(200)
    listed_pack = Enum.find(packs["packs"], &(&1["id"] == pack.id))

    assert listed_pack["availability"]["canOpen"] == false
    assert listed_pack["availability"]["reason"] == "weekly_limit"
  end

  test "POST /packs/open returns preserved errors", _context do
    user = create_user_with_password("pack-errors@example.com", "rainicorn")
    access_token = login_access_token(user.email, "rainicorn")

    inactive_pack =
      Repo.insert!(
        Pack.changeset(%Pack{}, %{
          name: "Inactive Pack",
          description: "No longer sold.",
          card_count: 3,
          cost: 100,
          color: "#6B7280",
          is_active: false
        })
      )

    no_cards_error =
      access_token
      |> auth_conn()
      |> post(~p"/packs/open", %{packId: Ecto.UUID.generate()})
      |> json_response(404)

    assert no_cards_error["error"] == "Pack not found or inactive"

    inactive_error =
      access_token
      |> auth_conn()
      |> post(~p"/packs/open", %{packId: inactive_pack.id})
      |> json_response(404)

    assert inactive_error["error"] == "Pack not found or inactive"

    active_pack =
      Repo.insert!(
        Pack.changeset(%Pack{}, %{
          name: "Empty Pack",
          description: "No cards exist.",
          card_count: 3,
          cost: 100,
          color: "#F59E0B",
          is_active: true
        })
      )

    empty_cards_error =
      access_token
      |> auth_conn()
      |> post(~p"/packs/open", %{packId: active_pack.id})
      |> json_response(404)

    assert empty_cards_error["error"] == "No cards available"

    common =
      Repo.insert!(
        Rarity.changeset(%Rarity{}, %{name: "Common", drop_rate: 60.0, color: "#9CA3AF"})
      )

    Repo.insert!(
      Card.changeset(%Card{}, %{
        name: "Jake",
        character: "Jake",
        description: "Stretchy hero.",
        hp: 16,
        attack: 7,
        defense: 6,
        speed: 48,
        type: "Hero",
        rarity_id: common.id
      })
    )

    expensive_pack =
      Repo.insert!(
        Pack.changeset(%Pack{}, %{
          name: "Expensive Pack",
          description: "Costs too much.",
          card_count: 3,
          cost: 200,
          color: "#F59E0B",
          is_active: true
        })
      )

    not_enough_coins =
      access_token
      |> auth_conn()
      |> post(~p"/packs/open", %{packId: expensive_pack.id})
      |> json_response(400)

    assert not_enough_coins["error"] == "Not enough coins"
  end

  test "GET home, collection, packs, and featured cards return shaped responses", _context do
    user = create_user_with_password("lady@example.com", "rainicorn")
    access_token = login_access_token(user.email, "rainicorn")

    rarity =
      Repo.insert!(
        Rarity.changeset(%Rarity{}, %{name: "Rare", drop_rate: 10.0, color: "#3B82F6"})
      )

    card =
      Repo.insert!(
        Card.changeset(%Card{}, %{
          name: "Lady Rainicorn",
          character: "Lady Rainicorn",
          description: "A graceful ally.",
          hp: 14,
          attack: 6,
          defense: 4,
          speed: 55,
          type: "Hero",
          rarity_id: rarity.id,
          is_featured: true
        })
      )

    unowned_card =
      Repo.insert!(
        Card.changeset(%Card{}, %{
          name: "Jake Suit",
          character: "Jake",
          description: "A stretchy defender.",
          hp: 11,
          attack: 4,
          defense: 7,
          speed: 42,
          type: "Hero",
          rarity_id: rarity.id
        })
      )

    Repo.insert!(
      Card.changeset(%Card{}, %{
        name: "Archived Lady",
        character: "Lady Rainicorn",
        description: "An archived variant.",
        hp: 14,
        attack: 6,
        defense: 4,
        speed: 55,
        type: "Hero",
        rarity_id: rarity.id,
        is_archived: true
      })
    )

    Repo.insert!(
      OwnedCard.changeset(%OwnedCard{}, %{
        quantity: 2,
        obtained_at: DateTime.utc_now() |> DateTime.truncate(:second)
      })
      |> Ecto.Changeset.put_change(:user_id, user.id)
      |> Ecto.Changeset.put_change(:card_id, card.id)
    )

    Repo.insert!(
      Pack.changeset(%Pack{}, %{
        name: "Starter Pack",
        description: "A simple pack.",
        card_count: 5,
        cost: 100,
        color: "#F59E0B",
        is_active: true,
        guaranteed_rarity: "Common"
      })
    )

    home = access_token |> auth_conn() |> get(~p"/home") |> json_response(200)
    collection = access_token |> auth_conn() |> get(~p"/collection") |> json_response(200)
    packs = access_token |> auth_conn() |> get(~p"/packs") |> json_response(200)
    featured_cards = access_token |> auth_conn() |> get(~p"/featured-cards") |> json_response(200)

    assert home["user"]["email"] == "lady@example.com"

    assert home["collectionStats"] == %{
             "totalCards" => 2,
             "uniqueOwned" => 1,
             "completionPercentage" => 50
           }

    assert collection["dust"] == 0

    assert collection["stats"] == %{
             "totalCards" => 2,
             "uniqueOwned" => 1,
             "completionPercentage" => 50
           }

    assert 2 == length(collection["cards"])

    collection_entry =
      Enum.find(collection["cards"], fn entry -> entry["cardId"] == card.id end)

    unowned_collection_entry =
      Enum.find(collection["cards"], fn entry -> entry["cardId"] == unowned_card.id end)

    assert collection_entry["quantity"] == 2
    assert collection_entry["card"]["rarity"]["name"] == "Rare"
    assert is_binary(collection_entry["obtainedAt"])

    assert unowned_collection_entry["quantity"] == 0
    assert unowned_collection_entry["obtainedAt"] == nil
    assert unowned_collection_entry["id"] == "catalog:#{unowned_card.id}"
    assert unowned_collection_entry["card"]["name"] == "Jake Suit"

    assert %{"packs" => [pack]} = packs
    assert pack["name"] == "Starter Pack"
    assert pack["description"] == "A simple pack."
    assert pack["cardCount"] == 5
    assert pack["cost"] == 100
    assert pack["color"] == "#F59E0B"
    assert pack["isActive"] == true
    assert pack["guaranteedRarity"] == "Common"
    assert is_binary(pack["id"])

    assert [featured_entry] = featured_cards["cards"]
    assert featured_entry["card"]["name"] == "Lady Rainicorn"
    assert featured_entry["card"]["rarity"]["name"] == "Rare"
  end

  test "POST /collection/craft enforces positive quantities and returns dust semantics",
       _context do
    user = create_user_with_password("craft@example.com", "dusty123")
    user = user |> Ecto.Changeset.change(dust: 120) |> Repo.update!()
    access_token = login_access_token(user.email, "dusty123")

    rarity =
      Repo.insert!(
        Rarity.changeset(%Rarity{}, %{name: "Rare", drop_rate: 10.0, color: "#3B82F6"})
      )

    card =
      Repo.insert!(
        Card.changeset(%Card{}, %{
          name: "Craft Card",
          character: "Craft Card",
          description: "Dust sink.",
          hp: 15,
          attack: 7,
          defense: 5,
          speed: 50,
          type: "Hero",
          rarity_id: rarity.id
        })
      )

    crafted =
      access_token
      |> auth_conn()
      |> post(~p"/collection/craft", %{cardId: card.id, quantity: 1})
      |> json_response(200)

    assert crafted == %{
             "success" => true,
             "cardId" => card.id,
             "quantityCrafted" => 1,
             "dustSpent" => 100,
             "newDustBalance" => 20
           }

    assert Repo.get_by!(OwnedCard, user_id: user.id, card_id: card.id).quantity == 1

    not_enough_dust =
      access_token
      |> auth_conn()
      |> post(~p"/collection/craft", %{cardId: card.id, quantity: 1})
      |> json_response(400)

    assert not_enough_dust == %{
             "error" => "Not enough dust",
             "required" => 100,
             "current" => 20
           }

    missing_card =
      access_token
      |> auth_conn()
      |> post(~p"/collection/craft", %{cardId: Ecto.UUID.generate(), quantity: 1})
      |> json_response(404)

    assert missing_card == %{"error" => "Card not found"}

    missing_params =
      access_token |> auth_conn() |> post(~p"/collection/craft", %{}) |> json_response(400)

    assert missing_params == %{"error" => "cardId and quantity are required"}

    for invalid_quantity <- [0, -1, "abc"] do
      invalid =
        access_token
        |> auth_conn()
        |> post(~p"/collection/craft", %{cardId: card.id, quantity: invalid_quantity})
        |> json_response(400)

      assert invalid == %{"error" => "quantity must be a positive integer"}
    end
  end

  test "POST /collection/recycle preserves quantity and active match guards", _context do
    user = create_user_with_password("recycle@example.com", "dusty123")
    user = user |> Ecto.Changeset.change(dust: 10) |> Repo.update!()
    opponent = create_user_with_password("recycle-opponent@example.com", "dusty123")
    access_token = login_access_token(user.email, "dusty123")

    rarity =
      Repo.insert!(
        Rarity.changeset(%Rarity{}, %{name: "Rare", drop_rate: 10.0, color: "#3B82F6"})
      )

    recyclable_card =
      Repo.insert!(
        Card.changeset(%Card{}, %{
          name: "Recycle Card",
          character: "Recycle Card",
          description: "Turns into dust.",
          hp: 15,
          attack: 7,
          defense: 5,
          speed: 50,
          type: "Hero",
          rarity_id: rarity.id
        })
      )

    active_match_card =
      Repo.insert!(
        Card.changeset(%Card{}, %{
          name: "Active Match Card",
          character: "Active Match Card",
          description: "Busy in PvP.",
          hp: 16,
          attack: 8,
          defense: 6,
          speed: 48,
          type: "Hero",
          rarity_id: rarity.id
        })
      )

    Repo.insert!(owned_card_changeset(user.id, recyclable_card.id, 2))
    Repo.insert!(owned_card_changeset(user.id, active_match_card.id, 1))

    Repo.insert!(
      Match.changeset(%Match{}, %{
        inviter_id: user.id,
        invitee_id: opponent.id,
        status: "in_progress",
        inviter_card_ids: [active_match_card.id],
        invitee_card_ids: [active_match_card.id],
        current_turn: 1
      })
    )

    recycled =
      access_token
      |> auth_conn()
      |> post(~p"/collection/recycle", %{cardId: recyclable_card.id, quantity: 1})
      |> json_response(200)

    assert recycled == %{
             "success" => true,
             "cardId" => recyclable_card.id,
             "quantityRecycled" => 1,
             "dustGained" => 20,
             "newDustBalance" => 30
           }

    assert Repo.get_by!(OwnedCard, user_id: user.id, card_id: recyclable_card.id).quantity == 1

    final_copy =
      access_token
      |> auth_conn()
      |> post(~p"/collection/recycle", %{cardId: recyclable_card.id, quantity: 1})
      |> json_response(200)

    assert final_copy["newDustBalance"] == 50
    assert Repo.get_by(OwnedCard, user_id: user.id, card_id: recyclable_card.id) == nil

    active_guard =
      access_token
      |> auth_conn()
      |> post(~p"/collection/recycle", %{cardId: active_match_card.id, quantity: 1})
      |> json_response(400)

    assert active_guard == %{"error" => "Card is in an active PvP match"}

    not_owned =
      access_token
      |> auth_conn()
      |> post(~p"/collection/recycle", %{cardId: Ecto.UUID.generate(), quantity: 1})
      |> json_response(404)

    assert not_owned == %{"error" => "You do not own this card"}

    too_many =
      access_token
      |> auth_conn()
      |> post(~p"/collection/recycle", %{cardId: active_match_card.id, quantity: 2})
      |> json_response(400)

    assert too_many == %{
             "error" => "Not enough copies to recycle",
             "owned" => 1,
             "requested" => 2
           }

    missing_params =
      access_token |> auth_conn() |> post(~p"/collection/recycle", %{}) |> json_response(400)

    assert missing_params == %{"error" => "cardId and quantity are required"}

    for invalid_quantity <- [0, -1, "abc"] do
      invalid =
        access_token
        |> auth_conn()
        |> post(~p"/collection/recycle", %{
          cardId: active_match_card.id,
          quantity: invalid_quantity
        })
        |> json_response(400)

      assert invalid == %{"error" => "quantity must be a positive integer"}
    end
  end

  defp create_user_with_password(email, password) do
    user =
      Repo.insert!(
        User.registration_changeset(%User{}, %{email: email, display_name: "Tester"})
        |> User.access_changeset(%{role: :user, access_status: :approved})
      )

    Repo.insert!(
      EmailCredential.changeset(%EmailCredential{}, %{
        password_hash: Bcrypt.hash_pwd_salt(password),
        email_verified_at: DateTime.utc_now() |> DateTime.truncate(:second)
      })
      |> Ecto.Changeset.put_change(:user_id, user.id)
    )

    user
  end

  defp create_user_without_password(email, display_name) do
    Repo.insert!(
      User.registration_changeset(%User{}, %{email: email, display_name: display_name})
      |> User.access_changeset(%{role: :user, access_status: :approved})
    )
  end

  defp access_token_for_user(user) do
    {:ok, token} =
      Auth.sign_access_token(%{
        "sub" => user.id,
        "email" => user.email,
        "isAdmin" => false,
        "isSuperAdmin" => false
      })

    token
  end

  defp login_access_token(email, password) do
    build_conn()
    |> post(~p"/auth/login", %{email: email, password: password})
    |> json_response(200)
    |> get_in(["tokens", "accessToken"])
  end

  defp auth_conn(access_token) do
    build_conn()
    |> put_req_header("authorization", "Bearer #{access_token}")
  end

  defp owned_card_changeset(user_id, card_id, quantity) do
    OwnedCard.changeset(%OwnedCard{}, %{
      quantity: quantity,
      obtained_at: DateTime.utc_now() |> DateTime.truncate(:second)
    })
    |> Ecto.Changeset.put_change(:user_id, user_id)
    |> Ecto.Changeset.put_change(:card_id, card_id)
  end
end
