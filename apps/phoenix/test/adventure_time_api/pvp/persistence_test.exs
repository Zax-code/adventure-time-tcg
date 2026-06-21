defmodule AdventureTimeApi.Pvp.PersistenceTest do
  use AdventureTimeApi.DataCase, async: true

  alias AdventureTimeApi.Accounts.{EmailCredential, User}
  alias AdventureTimeApi.Catalog.{Card, Rarity}
  alias AdventureTimeApi.Inventory.OwnedCard
  alias AdventureTimeApi.Pvp
  alias AdventureTimeApi.Pvp.{AbilityDef, CardAbility, Match, MatchEvent, MatchSnapshot}
  alias AdventureTimeApi.Repo

  test "accept, action, end turn, and concede persist via snapshots and events" do
    inviter = create_user_with_password("persist-inviter@example.com", "password123", "Inviter")
    invitee = create_user_with_password("persist-invitee@example.com", "password123", "Invitee")
    card_ids = create_shared_loadout_cards([inviter, invitee])

    assert {:ok, %{success: true}} = Pvp.create_invite(inviter.id, invitee.email, card_ids)

    match =
      Repo.one!(
        from(m in Match, where: m.inviter_id == ^inviter.id and m.invitee_id == ^invitee.id)
      )

    assert {:ok, %{match: accepted_match, battleState: accept_state}} =
             Pvp.accept_match(invitee.id, match.id, card_ids)

    assert accepted_match.status == "IN_PROGRESS"
    assert is_binary(accepted_match.turnExpiresAt)

    snapshot = Repo.one!(from(s in MatchSnapshot, where: s.match_id == ^match.id))
    assert snapshot.seq_at == 0
    assert snapshot.turn_at == 1
    assert Repo.aggregate(from(e in MatchEvent, where: e.match_id == ^match.id), :count, :id) == 0

    acting_user_id = accept_state["currentPlayerId"]
    acting_player = Enum.find(accept_state["players"], &(&1["userId"] == acting_user_id))
    target_player = Enum.find(accept_state["players"], &(&1["userId"] != acting_user_id))
    actor = List.first(acting_player["units"])
    target = List.first(target_player["units"])

    assert {:ok, %{battleState: action_state}} =
             Pvp.perform_action(acting_user_id, match.id, %{
               "kind" => "basic",
               "actorInstanceId" => actor["instanceId"],
               "targetInstanceId" => target["instanceId"]
             })

    action_event = Repo.one!(from(e in MatchEvent, where: e.match_id == ^match.id and e.seq == 1))
    assert action_event.type == "action_performed"
    assert action_event.payload["playerId"] == acting_user_id

    assert {:ok, reconstructed_after_action} = Pvp.reconstruct_state(match.id)

    assert find_unit(reconstructed_after_action, target["instanceId"])["hp"] ==
             find_unit(action_state, target["instanceId"])["hp"]

    assert {:ok, %{battleState: end_turn_state}} = Pvp.end_turn(acting_user_id, match.id, nil)

    assert {:ok, %{match: next_turn_match}} = Pvp.get_match(acting_user_id, match.id)
    assert next_turn_match.status == "IN_PROGRESS"
    assert is_binary(next_turn_match.turnExpiresAt)

    end_turn_event =
      Repo.one!(from(e in MatchEvent, where: e.match_id == ^match.id and e.seq == 2))

    assert end_turn_event.type == "turn_ended"
    assert end_turn_state["turn"] == 2

    next_player_id = end_turn_state["currentPlayerId"]

    assert {:ok, %{success: true}} = Pvp.concede_match(next_player_id, match.id)

    concede_event =
      Repo.one!(from(e in MatchEvent, where: e.match_id == ^match.id and e.seq == 3))

    assert concede_event.type == "match_conceded"

    terminal_snapshot =
      Repo.one!(
        from(s in MatchSnapshot,
          where: s.match_id == ^match.id,
          order_by: [desc: s.seq_at],
          limit: 1
        )
      )

    assert terminal_snapshot.seq_at == 3
    assert terminal_snapshot.state["phase"] == "ended"

    assert {:ok, reconstructed_final} = Pvp.reconstruct_state(match.id)
    assert reconstructed_final["phase"] == "ended"
    assert reconstructed_final["winnerId"] == acting_user_id

    assert {:ok, %{match: conceded_history_match}} =
             Pvp.get_history_detail(next_player_id, match.id)

    assert conceded_history_match.completionReason == "CONCEDE"

    assert {:ok, loser_history} = Pvp.list_history(next_player_id)
    assert loser_history.stats.wins == 0
    assert loser_history.stats.losses == 1
    assert loser_history.stats.draws == 0

    assert {:ok, winner_history} = Pvp.list_history(acting_user_id)
    assert winner_history.stats.wins == 1
    assert winner_history.stats.losses == 0
    assert winner_history.stats.draws == 0
  end

  test "in-progress match times out after 24 hours and current player loses" do
    inviter = create_user_with_password("timeout-inviter@example.com", "password123", "Inviter")
    invitee = create_user_with_password("timeout-invitee@example.com", "password123", "Invitee")
    card_ids = create_shared_loadout_cards([inviter, invitee])

    assert {:ok, %{success: true}} = Pvp.create_invite(inviter.id, invitee.email, card_ids)

    match =
      Repo.one!(
        from(m in Match, where: m.inviter_id == ^inviter.id and m.invitee_id == ^invitee.id)
      )

    assert {:ok, %{battleState: accept_state}} = Pvp.accept_match(invitee.id, match.id, card_ids)

    timed_out_user_id = accept_state["currentPlayerId"]
    winner_id = if timed_out_user_id == inviter.id, do: invitee.id, else: inviter.id
    stale_started_at = DateTime.add(DateTime.utc_now() |> DateTime.truncate(:second), -25, :hour)

    Match
    |> Repo.get!(match.id)
    |> Match.changeset(%{turn_started_at: stale_started_at})
    |> Repo.update!()

    assert {:ok, %{match: timed_out_match, battleState: battle_state}} =
             Pvp.get_match(timed_out_user_id, match.id)

    assert timed_out_match.status == "COMPLETED"
    assert timed_out_match.winnerId == winner_id
    assert timed_out_match.completionReason == "TIMEOUT"
    assert battle_state["phase"] == "ended"
    assert battle_state["winnerId"] == winner_id

    timeout_event =
      Repo.one!(
        from(e in MatchEvent, where: e.match_id == ^match.id and e.type == "match_timed_out")
      )

    assert timeout_event.payload["playerId"] == timed_out_user_id
    assert timeout_event.payload["winnerId"] == winner_id

    assert {:ok, reconstructed_final} = Pvp.reconstruct_state(match.id)
    assert reconstructed_final["phase"] == "ended"
    assert reconstructed_final["winnerId"] == winner_id

    assert Enum.any?(reconstructed_final["log"], fn event ->
             event["type"] == "gameOver" and event["payload"]["result"] == "timeout"
           end)

    assert {:ok, %{match: loser_history_match, replay: loser_replay}} =
             Pvp.get_history_detail(timed_out_user_id, match.id)

    assert loser_history_match.status == "COMPLETED"
    assert loser_history_match.winnerId == winner_id
    assert loser_history_match.completionReason == "TIMEOUT"
    assert loser_replay.initialState["id"] == match.id
    assert loser_replay.finalState["phase"] == "ended"
    assert loser_replay.finalState["winnerId"] == winner_id
    assert Enum.any?(loser_replay.log, &(&1["type"] == "timeout"))

    assert {:ok, loser_history} = Pvp.list_history(timed_out_user_id)
    assert loser_history.stats.wins == 0
    assert loser_history.stats.losses == 1
    assert loser_history.stats.draws == 0

    assert {:ok, winner_history} = Pvp.list_history(winner_id)
    assert winner_history.stats.wins == 1
    assert winner_history.stats.losses == 0
    assert winner_history.stats.draws == 0
  end

  test "match schema no longer exposes legacy state field" do
    refute :state in Match.__schema__(:fields)
  end

  test "only Legendary cards receive assigned passives in battle state" do
    inviter = create_user_with_password("passive-inviter@example.com", "password123", "Inviter")
    invitee = create_user_with_password("passive-invitee@example.com", "password123", "Invitee")

    %{card_ids: card_ids, legendary_id: legendary_id, epic_id: epic_id, passive_key: passive_key} =
      create_shared_rarity_passive_loadout([inviter, invitee])

    assert {:ok, %{success: true}} = Pvp.create_invite(inviter.id, invitee.email, card_ids)

    match =
      Repo.one!(
        from(m in Match, where: m.inviter_id == ^inviter.id and m.invitee_id == ^invitee.id)
      )

    assert {:ok, %{battleState: battle_state}} = Pvp.accept_match(invitee.id, match.id, card_ids)

    legendary_unit = find_unit_by_card_id(battle_state, legendary_id)
    epic_unit = find_unit_by_card_id(battle_state, epic_id)

    assert legendary_unit["passives"] == [passive_key]
    assert epic_unit["passives"] == []
  end

  defp create_shared_loadout_cards(users) do
    rarity =
      Repo.insert!(
        Rarity.changeset(%Rarity{}, %{
          name: unique_email("Common"),
          drop_rate: 60.0,
          color: "#9CA3AF"
        })
      )

    card_ids =
      Enum.map(1..6, fn idx ->
        Repo.insert!(
          Card.changeset(%Card{}, %{
            name: unique_email("Persist Card #{idx}"),
            character: "Persist Card #{idx}",
            description: "Persistence test card #{idx}",
            hp: 20 + idx,
            attack: 8 + idx,
            defense: 5 + idx,
            speed: 40 + idx,
            type: "Hero",
            rarity_id: rarity.id
          })
        ).id
      end)

    Enum.each(users, fn user ->
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

  defp create_shared_rarity_passive_loadout(users) do
    legendary = insert_rarity!("Legendary")
    epic = insert_rarity!("Epic")
    common = insert_rarity!("Common")

    passive =
      Repo.insert!(
        AbilityDef.changeset(%AbilityDef{}, %{
          key: "test.legendary_passive.#{System.unique_integer([:positive])}",
          name: "Legendary Passive",
          description: "Only Legendary cards should receive this.",
          type: "PASSIVE",
          cost: 0,
          cooldown: nil,
          once_per_match: false,
          payload: %{"trigger" => "onActionStart"}
        })
      )

    cards =
      [
        insert_card!("Legendary Passive Card", legendary),
        insert_card!("Epic Passive Card", epic)
      ] ++ Enum.map(1..4, &insert_card!("Common Passive Card #{&1}", common))

    cards
    |> Enum.take(2)
    |> Enum.each(fn card ->
      Repo.insert!(
        CardAbility.changeset(%CardAbility{}, %{
          card_id: card.id,
          passive_id: passive.id
        })
      )
    end)

    Enum.each(users, fn user ->
      Enum.each(cards, fn card ->
        Repo.insert!(
          OwnedCard.changeset(%OwnedCard{}, %{
            quantity: 1,
            obtained_at: DateTime.utc_now() |> DateTime.truncate(:second)
          })
          |> Ecto.Changeset.put_change(:user_id, user.id)
          |> Ecto.Changeset.put_change(:card_id, card.id)
        )
      end)
    end)

    %{
      card_ids: Enum.map(cards, & &1.id),
      legendary_id: List.first(cards).id,
      epic_id: cards |> Enum.at(1) |> Map.fetch!(:id),
      passive_key: passive.key
    }
  end

  defp insert_rarity!(name) do
    Repo.insert!(
      Rarity.changeset(%Rarity{}, %{
        name: name,
        drop_rate: 10.0,
        color: "#9CA3AF"
      })
    )
  end

  defp insert_card!(name, rarity) do
    unique = unique_email(name)

    Repo.insert!(
      Card.changeset(%Card{}, %{
        name: unique,
        character: unique,
        description: "#{name} test card",
        hp: 40,
        attack: 12,
        defense: 8,
        speed: 45,
        type: "Hero",
        rarity_id: rarity.id
      })
    )
  end

  defp find_unit(state, instance_id) do
    state["players"]
    |> Enum.flat_map(fn player -> player["units"] ++ player["bench"] end)
    |> Enum.find(&(&1["instanceId"] == instance_id))
  end

  defp find_unit_by_card_id(state, card_id) do
    state["players"]
    |> Enum.flat_map(fn player -> player["units"] ++ player["bench"] end)
    |> Enum.find(&(&1["cardId"] == card_id))
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

  defp unique_email(prefix) do
    "#{prefix}-#{System.unique_integer([:positive])}"
  end
end
