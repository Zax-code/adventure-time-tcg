defmodule AdventureTimeApiWeb.PvpControllerTest do
  use AdventureTimeApiWeb.ConnCase, async: false

  alias AdventureTimeApi.Accounts.{EmailCredential, User}
  alias AdventureTimeApi.Catalog.{Card, Rarity}
  alias AdventureTimeApi.Inventory.OwnedCard
  alias AdventureTimeApi.Pvp.{AbilityDef, CardAbility, Loadout, Match}
  alias AdventureTimeApi.Repo
  alias AdventureTimeApi.Workers.ExpirePendingInviteWorker

  setup do
    rate_limit_config =
      Application.get_env(:adventure_time_api, AdventureTimeApiWeb.Plugs.RateLimit)

    on_exit(fn ->
      Application.put_env(
        :adventure_time_api,
        AdventureTimeApiWeb.Plugs.RateLimit,
        rate_limit_config
      )
    end)

    :ok
  end

  test "loadout responses include cards and invalid card ids", _context do
    user = create_user_with_password("loadout-user@example.com", "password123", "Loadout User")
    access_token = login_access_token(user.email, "password123")

    rarity =
      Repo.insert!(
        Rarity.changeset(%Rarity{}, %{name: "Common", drop_rate: 60.0, color: "#9CA3AF"})
      )

    card_ids =
      Enum.map(1..6, fn idx ->
        Repo.insert!(
          Card.changeset(%Card{}, %{
            name: "Loadout Card #{idx}",
            character: "Loadout Card #{idx}",
            description: "Loadout test card #{idx}",
            hp: 15 + idx,
            attack: 6 + idx,
            defense: 4 + idx,
            speed: 40 + idx,
            type: "Hero",
            rarity_id: rarity.id
          })
        ).id
      end)

    Enum.each(card_ids, fn card_id ->
      Repo.insert!(
        OwnedCard.changeset(%OwnedCard{}, %{
          quantity: 1,
          obtained_at: DateTime.utc_now() |> DateTime.truncate(:second)
        })
        |> Ecto.Changeset.put_change(:user_id, user.id)
        |> Ecto.Changeset.put_change(:card_id, card_id)
      )
    end)

    create_conn =
      access_token
      |> auth_conn()
      |> post(~p"/pvp/loadouts", %{name: "Starter Six", cardIds: card_ids})

    created = json_response(create_conn, 201)["loadout"]

    assert created["ownerId"] == user.id
    assert created["cardIds"] == card_ids
    assert created["invalidCardIds"] == []
    assert Enum.map(created["cards"], & &1["id"]) == card_ids

    list_conn = access_token |> auth_conn() |> get(~p"/pvp/loadouts")
    listed = json_response(list_conn, 200)["loadouts"]

    assert [%{"name" => "Starter Six", "invalidCardIds" => [], "cards" => cards}] = listed
    assert Enum.map(cards, & &1["id"]) == card_ids
  end

  test "loadout responses tolerate malformed legacy card ids", _context do
    user =
      create_user_with_password(
        "legacy-loadout-user@example.com",
        "password123",
        "Legacy Loadout User"
      )

    access_token = login_access_token(user.email, "password123")

    rarity =
      Repo.insert!(
        Rarity.changeset(%Rarity{}, %{name: "Legacy Common", drop_rate: 60.0, color: "#9CA3AF"})
      )

    owned_card_ids = create_owned_cards(user, rarity, "Legacy Loadout", 5)
    malformed_card_id = "jake-the-dog"
    card_ids = List.insert_at(owned_card_ids, 4, malformed_card_id)

    Repo.insert!(
      Loadout.changeset(%Loadout{}, %{
        owner_id: user.id,
        name: "Legacy Slug",
        card_ids: card_ids
      })
    )

    list_conn = access_token |> auth_conn() |> get(~p"/pvp/loadouts")
    listed = json_response(list_conn, 200)["loadouts"]

    assert [
             %{
               "name" => "Legacy Slug",
               "cardIds" => ^card_ids,
               "invalidCardIds" => [^malformed_card_id],
               "cards" => cards
             }
           ] = listed

    assert Enum.map(cards, & &1["id"]) == owned_card_ids
  end

  test "full PvP flow persists from invite through history", _context do
    inviter = create_user_with_password("pvp-inviter@example.com", "password123", "Inviter")
    invitee = create_user_with_password("pvp-invitee@example.com", "password123", "Invitee")

    inviter_token = login_access_token(inviter.email, "password123")
    invitee_token = login_access_token(invitee.email, "password123")

    rarity =
      Repo.insert!(
        Rarity.changeset(%Rarity{}, %{name: "Common", drop_rate: 60.0, color: "#9CA3AF"})
      )

    card_ids =
      Enum.map(1..6, fn idx ->
        Repo.insert!(
          Card.changeset(%Card{}, %{
            name: "PvP Card #{idx}",
            character: "PvP Card #{idx}",
            description: "PvP test card #{idx}",
            hp: 18 + idx,
            attack: 7 + idx,
            defense: 4 + idx,
            speed: 40 + idx,
            type: "Hero",
            rarity_id: rarity.id
          })
        ).id
      end)

    Enum.each([inviter, invitee], fn user ->
      Enum.each(card_ids, fn card_id ->
        Repo.insert!(
          OwnedCard.changeset(%OwnedCard{}, %{
            quantity: 1,
            obtained_at: DateTime.utc_now() |> DateTime.truncate(:second)
          })
          |> Ecto.Changeset.put_change(:user_id, user.id)
          |> Ecto.Changeset.put_change(:card_id, card_id)
        )
      end)
    end)

    create_invite_conn =
      inviter_token
      |> auth_conn()
      |> post(~p"/pvp/invites", %{inviteeEmail: invitee.email, loadout: card_ids})

    assert json_response(create_invite_conn, 201) == %{"success" => true}

    invites_conn = invitee_token |> auth_conn() |> get(~p"/pvp/invites")
    assert %{"invites" => [invite]} = json_response(invites_conn, 200)
    assert invite["inviterId"] == inviter.id
    assert invite["inviterName"] == "Inviter"
    assert invite["inviteeName"] == "Invitee"
    assert invite["status"] == "PENDING"
    assert invite["inviterLoadout"] == card_ids
    assert invite["inviteeLoadout"] == []

    sent_invites_conn = inviter_token |> auth_conn() |> get(~p"/pvp/invites")
    assert %{"invites" => [sent_invite]} = json_response(sent_invites_conn, 200)
    assert sent_invite["id"] == invite["id"]

    match_id = invite["id"]

    accept_conn =
      invitee_token
      |> auth_conn()
      |> post(~p"/pvp/matches/#{match_id}/accept", %{loadout: card_ids})

    accept_response = json_response(accept_conn, 200)
    match = accept_response["match"]
    battle_state = accept_response["battleState"]

    assert match["id"] == match_id
    assert match["status"] == "IN_PROGRESS"
    assert match["inviterLoadout"] == card_ids
    assert match["inviteeLoadout"] == card_ids
    assert battle_state["phase"] == "active"
    assert battle_state["turn"] == 1
    assert battle_state["myUserId"] == invitee.id
    assert length(battle_state["players"]) == 2
    assert Enum.map(battle_state["players"], & &1["name"]) == ["Inviter", "Invitee"]
    assert Enum.all?(battle_state["players"], &(length(&1["units"]) == 3))
    assert Enum.all?(battle_state["players"], &(length(&1["bench"]) == 3))

    acting_user_id = battle_state["currentPlayerId"]
    acting_token = if acting_user_id == inviter.id, do: inviter_token, else: invitee_token

    acting_player = Enum.find(battle_state["players"], &(&1["userId"] == acting_user_id))
    target_player = Enum.find(battle_state["players"], &(&1["userId"] != acting_user_id))
    actor = List.first(acting_player["units"])
    target = List.first(target_player["units"])
    target_hp_before = target["hp"]

    action_conn =
      acting_token
      |> auth_conn()
      |> post(~p"/pvp/matches/#{match_id}/action", %{
        kind: "basic",
        actorInstanceId: actor["instanceId"],
        targetInstanceId: target["instanceId"]
      })

    action_response = json_response(action_conn, 200)
    action_events = action_response["events"]
    action_state = action_response["battleState"]

    assert action_response["match"]["status"] == "IN_PROGRESS"
    assert is_list(action_events)
    assert length(action_events) > 0
    assert Enum.any?(action_events, &(&1["type"] == "damage"))

    updated_target = find_unit(action_state, target["instanceId"])
    assert updated_target["hp"] <= target_hp_before

    get_match_conn = acting_token |> auth_conn() |> get(~p"/pvp/matches/#{match_id}")
    get_match_response = json_response(get_match_conn, 200)

    assert Enum.map(get_match_response["battleState"]["players"], & &1["name"]) == [
             "Inviter",
             "Invitee"
           ]

    persisted_target = find_unit(get_match_response["battleState"], target["instanceId"])
    assert persisted_target["hp"] == updated_target["hp"]
    assert length(get_match_response["battleState"]["log"]) >= length(action_state["log"])

    end_turn_conn =
      acting_token |> auth_conn() |> post(~p"/pvp/matches/#{match_id}/end-turn", %{})

    end_turn_response = json_response(end_turn_conn, 200)
    end_turn_state = end_turn_response["battleState"]

    assert end_turn_response["match"]["status"] == "IN_PROGRESS"
    assert end_turn_state["turn"] == 2
    assert end_turn_state["currentPlayerId"] != acting_user_id
    assert Enum.any?(end_turn_response["events"], &(&1["type"] == "turnEnd"))
    assert Enum.any?(end_turn_response["events"], &(&1["type"] == "turnStart"))

    other_token = if acting_user_id == inviter.id, do: invitee_token, else: inviter_token
    other_match_conn = other_token |> auth_conn() |> get(~p"/pvp/matches/#{match_id}")
    assert json_response(other_match_conn, 200)["battleState"]["isMyTurn"] == true

    concede_conn =
      other_token
      |> auth_conn()
      |> post(~p"/pvp/matches/#{match_id}/concede", %{})

    assert json_response(concede_conn, 200) == %{"success" => true}

    active_after_concede_conn = other_token |> auth_conn() |> get(~p"/pvp/matches")
    assert json_response(active_after_concede_conn, 200)["matches"] == []

    history_conn = other_token |> auth_conn() |> get(~p"/pvp/history/#{match_id}")
    history_response = json_response(history_conn, 200)

    assert history_response["match"]["status"] == "COMPLETED"
    assert history_response["match"]["winnerId"] == acting_user_id
    assert history_response["battleState"]["phase"] == "ended"
    assert history_response["replay"]["seed"]
    assert is_list(history_response["replay"]["log"])
    assert history_response["replay"]["initialState"]["id"] == match_id
    assert history_response["replay"]["finalState"]["phase"] == "ended"
    assert history_response["replay"]["totalTurns"] >= 1

    loser_id = if acting_user_id == inviter.id, do: invitee.id, else: inviter.id

    history_list_conn = other_token |> auth_conn() |> get(~p"/pvp/history")
    history_list_response = json_response(history_list_conn, 200)

    assert history_list_response["currentUserId"] == loser_id
    assert history_list_response["totalCount"] == 1
    assert history_list_response["stats"]["wins"] + history_list_response["stats"]["losses"] == 1
    assert Enum.at(history_list_response["matches"], 0)["hasReplayData"] == true

    reinvite_conn =
      inviter_token
      |> auth_conn()
      |> post(~p"/pvp/invites", %{inviteeEmail: invitee.email, loadout: card_ids})

    assert json_response(reinvite_conn, 201) == %{"success" => true}
  end

  test "loadouts can be updated and deleted with validation errors", _context do
    user = create_user_with_password("loadout-owner@example.com", "password123", "Owner")
    other_user = create_user_with_password("outsider@example.com", "password123", "Outsider")

    token = login_access_token(user.email, "password123")
    other_token = login_access_token(other_user.email, "password123")

    rarity =
      Repo.insert!(
        Rarity.changeset(%Rarity{}, %{
          name: unique_name("Common"),
          drop_rate: 60.0,
          color: "#9CA3AF"
        })
      )

    card_ids = create_owned_cards(user, rarity, "Loadout Update", 6)
    other_card_ids = create_owned_cards(other_user, rarity, "Outsider", 6)

    create_conn =
      token |> auth_conn() |> post(~p"/pvp/loadouts", %{name: "Editable", cardIds: card_ids})

    loadout_id = json_response(create_conn, 201)["loadout"]["id"]

    updated_ids = Enum.reverse(card_ids)

    update_conn =
      token
      |> auth_conn()
      |> put(~p"/pvp/loadouts/#{loadout_id}", %{name: "Updated", cardIds: updated_ids})

    updated = json_response(update_conn, 200)["loadout"]
    assert updated["name"] == "Updated"
    assert updated["cardIds"] == updated_ids

    invalid_conn =
      token
      |> auth_conn()
      |> put(~p"/pvp/loadouts/#{loadout_id}", %{
        name: "Broken",
        cardIds: List.duplicate(hd(card_ids), 6)
      })

    assert json_response(invalid_conn, 400) == %{
             "error" => "Loadout cannot contain duplicate cards"
           }

    forbidden_conn = other_token |> auth_conn() |> delete(~p"/pvp/loadouts/#{loadout_id}")
    assert json_response(forbidden_conn, 404) == %{"error" => "Loadout not found"}

    delete_conn = token |> auth_conn() |> delete(~p"/pvp/loadouts/#{loadout_id}")
    assert json_response(delete_conn, 200) == %{"success" => true}

    list_conn = token |> auth_conn() |> get(~p"/pvp/loadouts")
    assert json_response(list_conn, 200)["loadouts"] == []

    assert other_card_ids != []
  end

  test "declining an invite moves it to history and enforces invitee ownership", _context do
    %{
      inviter: inviter,
      invitee: invitee,
      inviter_token: inviter_token,
      invitee_token: invitee_token,
      match_id: match_id
    } =
      create_pending_match_fixture("decline")

    forbidden_conn =
      inviter_token |> auth_conn() |> post(~p"/pvp/matches/#{match_id}/decline", %{})

    assert json_response(forbidden_conn, 403) == %{"error" => "Forbidden"}

    decline_conn = invitee_token |> auth_conn() |> post(~p"/pvp/matches/#{match_id}/decline", %{})
    assert json_response(decline_conn, 200) == %{"success" => true}

    history_conn = invitee_token |> auth_conn() |> get(~p"/pvp/history")
    assert %{"matches" => [match]} = json_response(history_conn, 200)
    assert match["id"] == match_id
    assert match["status"] == "DECLINED"

    history_detail_conn = invitee_token |> auth_conn() |> get(~p"/pvp/history/#{match_id}")

    assert %{"match" => detail_match, "battleState" => nil} =
             json_response(history_detail_conn, 200)

    assert detail_match["id"] == match_id

    outsider =
      create_user_with_password("decline-outsider@example.com", "password123", "Outsider")

    outsider_token = login_access_token(outsider.email, "password123")
    forbidden_history_conn = outsider_token |> auth_conn() |> get(~p"/pvp/history/#{match_id}")
    assert json_response(forbidden_history_conn, 403) == %{"error" => "Forbidden"}

    assert inviter.id != invitee.id
  end

  test "sent invites can be canceled by the inviter", _context do
    %{inviter_token: inviter_token, invitee_token: invitee_token, match_id: match_id} =
      create_pending_match_fixture("cancel")

    cancel_conn =
      inviter_token
      |> auth_conn()
      |> delete(~p"/pvp/invites?matchId=#{match_id}")

    assert json_response(cancel_conn, 200) == %{"success" => true}

    invites_conn = inviter_token |> auth_conn() |> get(~p"/pvp/invites")
    assert json_response(invites_conn, 200)["invites"] == []

    received_invites_conn = invitee_token |> auth_conn() |> get(~p"/pvp/invites")
    assert json_response(received_invites_conn, 200)["invites"] == []

    history_conn = invitee_token |> auth_conn() |> get(~p"/pvp/history")
    assert %{"matches" => [match]} = json_response(history_conn, 200)
    assert match["id"] == match_id
    assert match["status"] == "DECLINED"
  end

  test "matches and spectate endpoints expose accepted matches", _context do
    %{inviter_token: inviter_token, invitee_token: invitee_token, match_id: match_id} =
      create_accepted_match_fixture("spectate")

    matches_conn = inviter_token |> auth_conn() |> get(~p"/pvp/matches")
    assert %{"matches" => [match]} = json_response(matches_conn, 200)
    assert match["id"] == match_id
    assert match["status"] == "IN_PROGRESS"

    spectator_conn = inviter_token |> auth_conn() |> get(~p"/pvp/spectate")
    assert %{"matches" => spectate_matches} = json_response(spectator_conn, 200)
    assert Enum.any?(spectate_matches, &(&1["id"] == match_id and &1["status"] == "IN_PROGRESS"))

    spectate_detail_conn = inviter_token |> auth_conn() |> get(~p"/pvp/spectate/#{match_id}")
    spectate_detail = json_response(spectate_detail_conn, 200)
    assert spectate_detail["match"]["id"] == match_id
    assert spectate_detail["battleState"]["myUserId"] == nil
    assert spectate_detail["battleState"]["isMyTurn"] == false
    assert is_list(spectate_detail["battleState"]["players"])

    [first_player | _] = spectate_detail["battleState"]["players"]
    assert Map.has_key?(first_player, "units")
    assert Map.has_key?(first_player, "bench")

    get_match_conn = invitee_token |> auth_conn() |> get(~p"/pvp/matches/#{match_id}")
    assert json_response(get_match_conn, 200)["match"]["id"] == match_id
  end

  test "skill and ultimate action routes execute assigned abilities", _context do
    %{
      acting_token: acting_token,
      match_id: match_id,
      battle_state: battle_state,
      card_ids: card_ids
    } =
      create_accepted_match_fixture("abilities", assign_abilities?: true)

    actor =
      List.first(
        Enum.find(battle_state["players"], &(&1["userId"] == battle_state["currentPlayerId"]))[
          "units"
        ]
      )

    target =
      List.first(
        Enum.find(battle_state["players"], &(&1["userId"] != battle_state["currentPlayerId"]))[
          "units"
        ]
      )

    skill_conn =
      acting_token
      |> auth_conn()
      |> post(~p"/pvp/matches/#{match_id}/action", %{
        kind: "skill",
        actorInstanceId: actor["instanceId"],
        targetInstanceId: target["instanceId"]
      })

    skill_response = json_response(skill_conn, 200)
    skill_actor = find_unit(skill_response["battleState"], actor["instanceId"])

    assert Enum.any?(skill_response["events"], &(&1["type"] == "damage"))
    assert skill_actor["cooldowns"]["test.skill.#{List.first(card_ids)}"] == 2

    ultimate_conn =
      acting_token
      |> auth_conn()
      |> post(~p"/pvp/matches/#{match_id}/action", %{
        kind: "ultimate",
        actorInstanceId: actor["instanceId"],
        targetInstanceId: target["instanceId"]
      })

    ultimate_response = json_response(ultimate_conn, 200)
    ultimate_actor = find_unit(ultimate_response["battleState"], actor["instanceId"])
    assert ultimate_actor["usedUltimate"] == true
    assert ultimate_response["match"]["status"] == "IN_PROGRESS"
  end

  test "action route enforces turn ownership and ally targeting rules", _context do
    %{
      inviter_token: inviter_token,
      invitee_token: invitee_token,
      match_id: match_id,
      battle_state: battle_state
    } =
      create_accepted_match_fixture("errors")

    acting_user_id = battle_state["currentPlayerId"]

    acting_token =
      if acting_user_id == extract_user_id(inviter_token), do: inviter_token, else: invitee_token

    other_token = if acting_token == inviter_token, do: invitee_token, else: inviter_token

    actor =
      List.first(Enum.find(battle_state["players"], &(&1["userId"] == acting_user_id))["units"])

    ally =
      Enum.at(Enum.find(battle_state["players"], &(&1["userId"] == acting_user_id))["units"], 1)

    enemy =
      List.first(Enum.find(battle_state["players"], &(&1["userId"] != acting_user_id))["units"])

    not_your_turn_conn =
      other_token
      |> auth_conn()
      |> post(~p"/pvp/matches/#{match_id}/action", %{
        kind: "basic",
        actorInstanceId: enemy["instanceId"],
        targetInstanceId: actor["instanceId"]
      })

    assert json_response(not_your_turn_conn, 400) == %{"error" => "Not your turn"}

    ally_target_conn =
      acting_token
      |> auth_conn()
      |> post(~p"/pvp/matches/#{match_id}/action", %{
        kind: "basic",
        actorInstanceId: actor["instanceId"],
        targetInstanceId: ally["instanceId"]
      })

    assert json_response(ally_target_conn, 400) == %{"error" => "Cannot target your own unit"}
  end

  test "expired invites move to history and no longer block reinvites", _context do
    %{
      invitee: invitee,
      inviter_token: inviter_token,
      invitee_token: invitee_token,
      match_id: match_id,
      card_ids: card_ids
    } = create_pending_match_fixture("expired")

    match =
      Match
      |> Repo.get!(match_id)
      |> Ecto.Changeset.change(
        expires_at: DateTime.add(DateTime.utc_now() |> DateTime.truncate(:second), -60, :second)
      )
      |> Repo.update!()

    assert :ok = ExpirePendingInviteWorker.perform(%Oban.Job{args: %{"match_id" => match.id}})

    history_conn = invitee_token |> auth_conn() |> get(~p"/pvp/history")
    assert %{"matches" => [history_match]} = json_response(history_conn, 200)
    assert history_match["id"] == match_id
    assert history_match["status"] == "EXPIRED"

    accept_conn =
      invitee_token
      |> auth_conn()
      |> post(~p"/pvp/matches/#{match_id}/accept", %{loadout: card_ids})

    assert json_response(accept_conn, 409) == %{
             "error" => "Match invite has expired",
             "code" => "INVITE_EXPIRED"
           }

    reinvite_conn =
      inviter_token
      |> auth_conn()
      |> post(~p"/pvp/invites", %{inviteeEmail: invitee.email, loadout: card_ids})

    assert json_response(reinvite_conn, 201) == %{"success" => true}
  end

  test "match write routes are rate limited per user and match", _context do
    Application.put_env(:adventure_time_api, AdventureTimeApiWeb.Plugs.RateLimit,
      buckets: %{
        auth_register: %{limit: 10, scale_ms: 60_000},
        auth_login: %{limit: 12, scale_ms: 60_000},
        auth_verify_email: %{limit: 10, scale_ms: 60_000},
        auth_resend_verification: %{limit: 10, scale_ms: 60_000},
        auth_google: %{limit: 10, scale_ms: 60_000},
        auth_refresh: %{limit: 20, scale_ms: 60_000},
        pvp_match_write: %{limit: 2, scale_ms: 60_000}
      }
    )

    %{
      acting_token: acting_token,
      match_id: match_id,
      battle_state: battle_state
    } = create_accepted_match_fixture("rate-limit")

    acting_user_id = battle_state["currentPlayerId"]

    actor =
      List.first(Enum.find(battle_state["players"], &(&1["userId"] == acting_user_id))["units"])

    target =
      List.first(Enum.find(battle_state["players"], &(&1["userId"] != acting_user_id))["units"])

    first_conn =
      acting_token
      |> auth_conn()
      |> post(~p"/pvp/matches/#{match_id}/action", %{
        kind: "basic",
        actorInstanceId: actor["instanceId"],
        targetInstanceId: target["instanceId"]
      })

    assert first_conn.status in [200, 400]

    second_conn =
      acting_token
      |> auth_conn()
      |> post(~p"/pvp/matches/#{match_id}/action", %{
        kind: "basic",
        actorInstanceId: actor["instanceId"],
        targetInstanceId: target["instanceId"]
      })

    assert second_conn.status in [200, 400]

    limited_conn =
      acting_token
      |> auth_conn()
      |> post(~p"/pvp/matches/#{match_id}/action", %{
        kind: "basic",
        actorInstanceId: actor["instanceId"],
        targetInstanceId: target["instanceId"]
      })

    assert json_response(limited_conn, 429) == %{
             "error" => "Too many requests",
             "code" => "RATE_LIMITED"
           }
  end

  defp find_unit(state, instance_id) do
    state["players"]
    |> Enum.flat_map(fn player -> player["units"] ++ player["bench"] end)
    |> Enum.find(&(&1["instanceId"] == instance_id))
  end

  defp create_user_with_password(email, password, display_name) do
    user =
      Repo.insert!(
        User.registration_changeset(%User{}, %{email: email, display_name: display_name})
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

  defp create_pending_match_fixture(tag) do
    inviter =
      create_user_with_password("#{tag}-inviter@example.com", "password123", "#{tag} inviter")

    invitee =
      create_user_with_password("#{tag}-invitee@example.com", "password123", "#{tag} invitee")

    inviter_token = login_access_token(inviter.email, "password123")
    invitee_token = login_access_token(invitee.email, "password123")

    rarity =
      Repo.insert!(
        Rarity.changeset(%Rarity{}, %{
          name: unique_name("Common"),
          drop_rate: 60.0,
          color: "#9CA3AF"
        })
      )

    card_ids = create_shared_cards_and_ownership(inviter, invitee, rarity, tag, 6)

    create_invite_conn =
      inviter_token
      |> auth_conn()
      |> post(~p"/pvp/invites", %{inviteeEmail: invitee.email, loadout: card_ids})

    assert json_response(create_invite_conn, 201) == %{"success" => true}

    invite =
      invitee_token
      |> auth_conn()
      |> get(~p"/pvp/invites")
      |> json_response(200)
      |> get_in(["invites", Access.at(0)])

    %{
      inviter: inviter,
      invitee: invitee,
      inviter_token: inviter_token,
      invitee_token: invitee_token,
      match_id: invite["id"],
      card_ids: card_ids
    }
  end

  defp create_accepted_match_fixture(tag, opts \\ []) do
    %{
      inviter: inviter,
      invitee: invitee,
      inviter_token: inviter_token,
      invitee_token: invitee_token,
      match_id: match_id,
      card_ids: card_ids
    } =
      create_pending_match_fixture(tag)

    if Keyword.get(opts, :assign_abilities?, false) do
      assign_default_test_abilities!(List.first(card_ids))
    end

    accept_conn =
      invitee_token
      |> auth_conn()
      |> post(~p"/pvp/matches/#{match_id}/accept", %{loadout: card_ids})

    accept_response = json_response(accept_conn, 200)
    battle_state = accept_response["battleState"]
    acting_user_id = battle_state["currentPlayerId"]

    acting_token = if acting_user_id == inviter.id, do: inviter_token, else: invitee_token

    %{
      inviter: inviter,
      invitee: invitee,
      inviter_token: inviter_token,
      invitee_token: invitee_token,
      acting_token: acting_token,
      match_id: match_id,
      card_ids: card_ids,
      battle_state: battle_state
    }
  end

  defp create_shared_cards_and_ownership(inviter, invitee, rarity, prefix, count) do
    card_ids =
      Enum.map(1..count, fn idx ->
        Repo.insert!(
          Card.changeset(%Card{}, %{
            name: unique_name("#{prefix} Card #{idx}"),
            character: "#{prefix} Character #{idx}",
            description: "#{prefix} description #{idx}",
            hp: 20 + idx,
            attack: 8 + idx,
            defense: 5 + idx,
            speed: 40 + idx,
            type: "Hero",
            rarity_id: rarity.id
          })
        ).id
      end)

    Enum.each([inviter, invitee], fn user ->
      Enum.each(card_ids, fn card_id ->
        Repo.insert!(
          OwnedCard.changeset(%OwnedCard{}, %{
            quantity: 1,
            obtained_at: DateTime.utc_now() |> DateTime.truncate(:second)
          })
          |> Ecto.Changeset.put_change(:user_id, user.id)
          |> Ecto.Changeset.put_change(:card_id, card_id)
        )
      end)
    end)

    card_ids
  end

  defp create_owned_cards(user, rarity, prefix, count) do
    Enum.map(1..count, fn idx ->
      card_id =
        Repo.insert!(
          Card.changeset(%Card{}, %{
            name: unique_name("#{prefix} Card #{idx}"),
            character: "#{prefix} Character #{idx}",
            description: "#{prefix} description #{idx}",
            hp: 20 + idx,
            attack: 8 + idx,
            defense: 5 + idx,
            speed: 40 + idx,
            type: "Hero",
            rarity_id: rarity.id
          })
        ).id

      Repo.insert!(
        OwnedCard.changeset(%OwnedCard{}, %{
          quantity: 1,
          obtained_at: DateTime.utc_now() |> DateTime.truncate(:second)
        })
        |> Ecto.Changeset.put_change(:user_id, user.id)
        |> Ecto.Changeset.put_change(:card_id, card_id)
      )

      card_id
    end)
  end

  defp assign_default_test_abilities!(card_id) do
    skill =
      Repo.insert!(
        AbilityDef.changeset(%AbilityDef{}, %{
          key: "test.skill.#{card_id}",
          name: "Test Skill",
          description: "Deal damage",
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
          key: "test.ultimate.#{card_id}",
          name: "Test Ultimate",
          description: "Heal self",
          type: "ULTIMATE",
          cost: 0,
          cooldown: nil,
          once_per_match: true,
          payload: %{"healPctOfMaxHp" => 0.2}
        })
      )

    Repo.insert!(
      CardAbility.changeset(%CardAbility{}, %{
        card_id: card_id,
        skill_id: skill.id,
        ultimate_id: ultimate.id
      })
    )
  end

  defp unique_name(prefix), do: "#{prefix}-#{System.unique_integer([:positive])}"

  defp extract_user_id(token) do
    {:ok, claims} = AdventureTimeApi.Auth.verify_access_token(token)
    claims["sub"]
  end
end
