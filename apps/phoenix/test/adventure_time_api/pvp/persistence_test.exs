defmodule AdventureTimeApi.Pvp.PersistenceTest do
  use AdventureTimeApi.DataCase, async: true

  alias AdventureTimeApi.Accounts.{EmailCredential, User}
  alias AdventureTimeApi.Catalog.{Card, Rarity}
  alias AdventureTimeApi.Inventory.OwnedCard
  alias AdventureTimeApi.Pvp
  alias AdventureTimeApi.Pvp.{Match, MatchEvent, MatchSnapshot}
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
  end

  test "match schema no longer exposes legacy state field" do
    refute :state in Match.__schema__(:fields)
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

  defp unique_email(prefix) do
    "#{prefix}-#{System.unique_integer([:positive])}"
  end
end
