defmodule AdventureTimeApi.Pvp do
  @moduledoc """
  PvP boundary: loadouts, match lifecycle, battle simulation.
  """

  import Ecto.Query

  alias AdventureTimeApi.Accounts.User
  alias AdventureTimeApi.Catalog.{Card, CardType, Rarity}
  alias AdventureTimeApi.Inventory.OwnedCard
  alias AdventureTimeApi.Notifications

  alias AdventureTimeApi.Pvp.{
    AbilityDef,
    BattleEngine,
    CardAbility,
    Loadout,
    Match,
    MatchEvent,
    MatchSnapshot
  }

  alias AdventureTimeApi.Repo
  alias AdventureTimeApi.Workers.ExpirePendingInviteWorker

  # ── Loadouts ───────────────────────────────────────────────────────────────

  def list_loadouts(user_id) do
    loadouts =
      Loadout
      |> where([l], l.owner_id == ^user_id)
      |> order_by([l], asc: l.inserted_at)
      |> Repo.all()

    {:ok, serialize_loadouts(loadouts, user_id)}
  end

  def create_loadout(user_id, name, card_ids) do
    with :ok <- validate_loadout(user_id, card_ids) do
      %Loadout{}
      |> Loadout.changeset(%{owner_id: user_id, name: name, card_ids: card_ids})
      |> Repo.insert()
      |> case do
        {:ok, loadout} -> {:ok, serialize_loadout(loadout, user_id)}
        {:error, changeset} -> {:error, changeset}
      end
    end
  end

  def update_loadout(user_id, loadout_id, name, card_ids) do
    with %Loadout{} = loadout <- Repo.get(Loadout, loadout_id),
         :ok <- verify_loadout_owner(loadout, user_id),
         :ok <- validate_loadout(user_id, card_ids) do
      loadout
      |> Loadout.changeset(%{name: name, card_ids: card_ids})
      |> Repo.update()
      |> case do
        {:ok, updated} -> {:ok, serialize_loadout(updated, user_id)}
        {:error, changeset} -> {:error, changeset}
      end
    else
      nil -> {:error, :not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  def delete_loadout(user_id, loadout_id) do
    with %Loadout{} = loadout <- Repo.get(Loadout, loadout_id),
         :ok <- verify_loadout_owner(loadout, user_id) do
      Repo.delete(loadout)
      {:ok, %{success: true}}
    else
      nil -> {:error, :not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  defp serialize_loadout(loadout, user_id) do
    %{card_map: card_map, owned_set: owned_set} = build_loadout_support([loadout], user_id)

    serialize_loadout(loadout, card_map, owned_set)
  end

  defp serialize_loadout(loadout, card_map, owned_set) do
    %{
      id: loadout.id,
      ownerId: loadout.owner_id,
      name: loadout.name,
      cardIds: loadout.card_ids,
      cards: Enum.map(loadout.card_ids, &Map.get(card_map, &1)) |> Enum.reject(&is_nil/1),
      invalidCardIds: Enum.reject(loadout.card_ids, &MapSet.member?(owned_set, &1)),
      createdAt: iso8601(loadout.inserted_at),
      updatedAt: iso8601(loadout.updated_at)
    }
  end

  defp verify_loadout_owner(loadout, user_id) do
    if loadout.owner_id == user_id, do: :ok, else: {:error, :not_found}
  end

  # ── Invite & Match Lifecycle ───────────────────────────────────────────────

  def list_invites(user_id) do
    expire_due_pending_invites(user_id)

    invites =
      Match
      |> where(
        [m],
        (m.inviter_id == ^user_id or m.invitee_id == ^user_id) and m.status == "pending"
      )
      |> order_by([m], desc: m.inserted_at)
      |> Repo.all()

    {:ok, serialize_matches(invites)}
  end

  def create_invite(inviter_id, invitee_email, card_ids) do
    with %User{} = invitee <- Repo.get_by(User, email: String.downcase(invitee_email)),
         :ok <- guard_not_self(inviter_id, invitee.id),
         :ok <- validate_loadout(inviter_id, card_ids),
         :ok <- guard_no_active_interaction(inviter_id, invitee.id) do
      expires_at = invite_expires_at()

      %Match{}
      |> Match.changeset(%{
        inviter_id: inviter_id,
        invitee_id: invitee.id,
        status: "pending",
        inviter_card_ids: card_ids,
        seed: Ecto.UUID.generate(),
        expires_at: expires_at
      })
      |> Repo.insert()
      |> case do
        {:ok, match} ->
          schedule_invite_expiry!(match.id, expires_at)

          dispatch_notification(fn ->
            _ = Notifications.send_pvp_invite(invitee.id, user_display_name(inviter_id))
          end)

          {:ok, %{success: true}}

        {:error, changeset} ->
          {:error, changeset}
      end
    else
      nil -> {:error, :invitee_not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  def cancel_invite(user_id, match_id) do
    with %Match{} = match <- Repo.get(Match, match_id),
         match <- maybe_expire_match_if_due(match),
         :ok <- verify_participant(match, user_id),
         :ok <- guard_status(match, "pending") do
      match
      |> Match.changeset(%{status: "declined"})
      |> Repo.update()
      |> case do
        {:ok, _match} -> {:ok, %{success: true}}
        {:error, changeset} -> {:error, changeset}
      end
    else
      nil -> {:error, :not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  def list_matches(user_id) do
    matches =
      Match
      |> where(
        [m],
        (m.inviter_id == ^user_id or m.invitee_id == ^user_id) and m.status == "in_progress"
      )
      |> order_by([m], desc: m.updated_at)
      |> Repo.all()

    {:ok, serialize_matches(matches)}
  end

  def list_history(user_id) do
    expire_due_pending_invites(user_id)

    matches =
      Match
      |> where(
        [m],
        (m.inviter_id == ^user_id or m.invitee_id == ^user_id) and
          m.status in ["completed", "declined", "expired"]
      )
      |> order_by([m], desc: m.updated_at)
      |> Repo.all()

    completed_matches = Enum.filter(matches, &(&1.status == "completed"))
    wins = Enum.count(completed_matches, &(&1.winner_id == user_id))
    losses = Enum.count(completed_matches, &(&1.winner_id && &1.winner_id != user_id))
    display_names = user_display_map(matches)

    serialized_matches =
      Enum.map(matches, fn match ->
        match
        |> serialize_match(display_names)
        |> maybe_put_replay_flag(match)
      end)

    {:ok,
     %{
       matches: serialized_matches,
       totalCount: length(completed_matches),
       currentUserId: user_id,
       stats: %{
         wins: wins,
         losses: losses,
         winRate: if(wins + losses > 0, do: round(wins / (wins + losses) * 100), else: 0)
       }
     }}
  end

  def get_match(user_id, match_id) do
    with %Match{} = match <- Repo.get(Match, match_id),
         match <- maybe_expire_match_if_due(match),
         :ok <- verify_participant(match, user_id),
         {:ok, battle_state} <- build_battle_state_for_view(match, user_id) do
      {:ok, %{match: serialize_match(match), battleState: battle_state}}
    else
      nil -> {:error, :not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  def get_history_detail(user_id, match_id) do
    with %Match{} = match <- Repo.get(Match, match_id),
         match <- maybe_expire_match_if_due(match),
         :ok <- verify_participant(match, user_id),
         true <- match.status in ["completed", "declined", "expired"],
         {:ok, battle_state} <- build_battle_state_for_view(match, user_id) do
      {:ok,
       %{
         match: serialize_match(match),
         battleState: battle_state,
         replay: build_replay_payload(match)
       }}
    else
      nil -> {:error, :not_found}
      false -> {:error, :not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  def accept_match(user_id, match_id, card_ids) do
    with %Match{} = match <- Repo.get(Match, match_id),
         match <- maybe_expire_match_if_due(match),
         :ok <- guard_invitee(match, user_id),
         :ok <- guard_status(match, "pending"),
         :ok <- validate_loadout(user_id, card_ids) do
      inviter = Repo.get!(User, match.inviter_id)
      invitee = Repo.get!(User, user_id)

      inviter_cards = fetch_cards_for_loadout(match.inviter_card_ids)
      invitee_cards = fetch_cards_for_loadout(card_ids)

      inviter_data = %{
        user_id: match.inviter_id,
        display_name: inviter.display_name || inviter.email,
        cards: inviter_cards
      }

      invitee_data = %{
        user_id: user_id,
        display_name: invitee.display_name || invitee.email,
        cards: invitee_cards
      }

      {raw_state, seed} =
        BattleEngine.create_battle_state(match.id, inviter_data, invitee_data)

      all_card_ids = match.inviter_card_ids ++ card_ids
      {ability_assignments, ability_defs_map} = fetch_ability_data_for_cards(all_card_ids)

      initial_state =
        raw_state
        |> Map.put("abilityDefinitions", ability_defs_map)
        |> inject_unit_abilities(ability_assignments)
        |> BattleEngine.initialize_passives()

      now = DateTime.utc_now() |> DateTime.truncate(:second)

      Repo.transaction(fn ->
        updated_match =
          match
          |> Match.changeset(%{
            status: "in_progress",
            invitee_card_ids: card_ids,
            seed: seed,
            initial_state: initial_state,
            current_turn: 1,
            turn_started_at: now,
            expires_at: nil
          })
          |> Repo.update!()

        write_snapshot!(updated_match.id, 0, initial_state)

        %{match: updated_match, battle_state: BattleEngine.build_view(initial_state, user_id)}
      end)
      |> case do
        {:ok, %{match: updated_match, battle_state: battle_state}} ->
          maybe_notify_current_player(updated_match, battle_state, user_id)
          {:ok, %{match: serialize_match(updated_match), battleState: battle_state}}

        {:error, %Ecto.Changeset{} = changeset} ->
          {:error, changeset}

        {:error, reason} ->
          {:error, reason}
      end
    else
      nil -> {:error, :not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  def decline_match(user_id, match_id) do
    with %Match{} = match <- Repo.get(Match, match_id),
         match <- maybe_expire_match_if_due(match),
         :ok <- guard_invitee(match, user_id),
         :ok <- guard_status(match, "pending") do
      match
      |> Match.changeset(%{status: "declined"})
      |> Repo.update()
      |> case do
        {:ok, _} -> {:ok, %{success: true}}
        {:error, changeset} -> {:error, changeset}
      end
    else
      nil -> {:error, :not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  def concede_match(user_id, match_id) do
    with %Match{} = match <- Repo.get(Match, match_id),
         :ok <- verify_participant(match, user_id),
         :ok <- guard_status(match, "in_progress"),
         {:ok, state} <- reconstruct_state(match.id) do
      {new_state, _events} = BattleEngine.simulate_concede(state, user_id)

      winner_id = new_state["winnerId"]

      Repo.transaction(fn ->
        seq =
          append_match_event!(match.id, "match_conceded", new_state, %{
            "playerId" => user_id,
            "winnerId" => winner_id
          })

        maybe_write_snapshot(match.id, seq, new_state, :match_conceded)

        match
        |> Match.changeset(%{
          status: "completed",
          winner_id: winner_id,
          current_turn: new_state["turn"]
        })
        |> Repo.update!()

        %{success: true}
      end)
      |> case do
        {:ok, result} -> {:ok, result}
        {:error, %Ecto.Changeset{} = changeset} -> {:error, changeset}
        {:error, reason} -> {:error, reason}
      end
    else
      nil -> {:error, :not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  def perform_action(user_id, match_id, action) do
    with %Match{} = match <- Repo.get(Match, match_id),
         :ok <- verify_participant(match, user_id),
         :ok <- guard_status(match, "in_progress"),
         {:ok, state} <- reconstruct_state(match.id),
         :ok <- guard_your_turn(state, user_id) do
      case BattleEngine.simulate_action(state, user_id, action) do
        {:error, reason} ->
          {:error, reason}

        {:ok, new_state, events} ->
          now = DateTime.utc_now() |> DateTime.truncate(:second)

          {status, winner_id, turn_started_at} =
            if new_state["phase"] == "ended" do
              {"completed", new_state["winnerId"], match.turn_started_at}
            else
              {"in_progress", nil, now}
            end

          Repo.transaction(fn ->
            seq =
              append_match_event!(match.id, "action_performed", new_state, %{
                "playerId" => user_id,
                "action" => action
              })

            maybe_write_snapshot(match.id, seq, new_state, :action_performed)

            updated_match =
              match
              |> Match.changeset(%{
                status: status,
                winner_id: winner_id,
                current_turn: new_state["turn"],
                turn_started_at: turn_started_at
              })
              |> Repo.update!()

            %{
              match: updated_match,
              battle_state: BattleEngine.build_view(new_state, user_id),
              events: events
            }
          end)
          |> case do
            {:ok, %{match: updated_match, battle_state: battle_state, events: persisted_events}} ->
              maybe_notify_current_player(updated_match, battle_state, user_id)

              {:ok,
               %{
                 match: serialize_match(updated_match),
                 battleState: battle_state,
                 events: persisted_events
               }}

            {:error, %Ecto.Changeset{} = changeset} ->
              {:error, changeset}

            {:error, reason} ->
              {:error, reason}
          end
      end
    else
      nil -> {:error, :not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  def end_turn(user_id, match_id, swap_opt) do
    with %Match{} = match <- Repo.get(Match, match_id),
         :ok <- verify_participant(match, user_id),
         :ok <- guard_status(match, "in_progress"),
         {:ok, state} <- reconstruct_state(match.id),
         :ok <- guard_your_turn(state, user_id) do
      {new_state, events} = BattleEngine.simulate_end_turn(state, swap_opt)
      now = DateTime.utc_now() |> DateTime.truncate(:second)

      {status, winner_id} =
        case BattleEngine.check_game_over(new_state) do
          {:over, wid} -> {"completed", wid}
          :ongoing -> {"in_progress", nil}
        end

      Repo.transaction(fn ->
        seq =
          append_match_event!(match.id, "turn_ended", new_state, %{
            "playerId" => user_id,
            "swap" => swap_opt
          })

        maybe_write_snapshot(match.id, seq, new_state, :turn_ended)

        updated_match =
          match
          |> Match.changeset(%{
            status: status,
            winner_id: winner_id,
            current_turn: new_state["turn"],
            turn_started_at: now
          })
          |> Repo.update!()

        %{
          match: updated_match,
          battle_state: BattleEngine.build_view(new_state, user_id),
          events: events
        }
      end)
      |> case do
        {:ok, %{match: updated_match, battle_state: battle_state, events: persisted_events}} ->
          maybe_notify_current_player(updated_match, battle_state, user_id)

          {:ok,
           %{
             match: serialize_match(updated_match),
             battleState: battle_state,
             events: persisted_events
           }}

        {:error, %Ecto.Changeset{} = changeset} ->
          {:error, changeset}

        {:error, reason} ->
          {:error, reason}
      end
    else
      nil -> {:error, :not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  def list_spectatable do
    matches =
      Match
      |> where([m], m.status == "in_progress")
      |> order_by([m], desc: m.updated_at)
      |> Repo.all()

    {:ok, serialize_matches(matches)}
  end

  def get_spectate(match_id) do
    expire_due_pending_invites(nil)

    case Repo.get(Match, match_id) do
      nil ->
        {:error, :not_found}

      %Match{} = match ->
        case build_battle_state_for_spectate(match) do
          {:ok, battle_state} ->
            {:ok, %{match: serialize_match(match), battleState: battle_state}}

          {:error, reason} ->
            {:error, reason}
        end
    end
  end

  def reconstruct_state(match_id) do
    case latest_snapshot_for_match(match_id) do
      nil ->
        {:error, :battle_state_unavailable}

      %MatchSnapshot{} = snapshot ->
        state =
          match_id
          |> events_after_seq(snapshot.seq_at)
          |> Enum.reduce_while(snapshot.state, fn event, acc_state ->
            case replay_match_event(acc_state, event) do
              {:ok, next_state} -> {:cont, next_state}
              {:error, reason} -> {:halt, {:error, reason}}
            end
          end)

        case state do
          {:error, reason} -> {:error, reason}
          final_state -> {:ok, normalize_reconstructed_state(final_state)}
        end
    end
  end

  # ── active_card_ids_for_user/1 (used by Inventory recycle guard) ──────────

  def active_card_ids_for_user(user_id) do
    inviter_ids =
      Match
      |> where([m], m.inviter_id == ^user_id and m.status == "in_progress")
      |> select([m], m.inviter_card_ids)
      |> Repo.all()
      |> List.flatten()

    invitee_ids =
      Match
      |> where([m], m.invitee_id == ^user_id and m.status == "in_progress")
      |> select([m], m.invitee_card_ids)
      |> Repo.all()
      |> List.flatten()
      |> Enum.reject(&is_nil/1)

    Enum.uniq(inviter_ids ++ invitee_ids)
  end

  # ── Admin: Ability CRUD ────────────────────────────────────────────────────

  def list_ability_defs do
    AbilityDef
    |> order_by([a], asc: a.key)
    |> Repo.all()
    |> Enum.map(&serialize_ability_def/1)
  end

  def list_admin_abilities_data do
    abilities = list_ability_defs()

    card_abilities =
      CardAbility
      |> order_by([ca], asc: ca.card_id)
      |> Repo.all()
      |> Enum.map(&serialize_admin_card_ability/1)

    cards =
      Card
      |> order_by([c], asc: c.name)
      |> Repo.all()
      |> Enum.map(fn card ->
        %{
          id: card.id,
          name: card.name,
          character: card.character,
          type: CardType.canonicalize!(card.type)
        }
      end)

    %{abilities: abilities, cardAbilities: card_abilities, cards: cards}
  end

  def create_ability_def(attrs) do
    %AbilityDef{}
    |> AbilityDef.changeset(attrs)
    |> Repo.insert()
    |> case do
      {:ok, ability} -> {:ok, serialize_ability_def(ability)}
      {:error, changeset} -> {:error, changeset}
    end
  end

  def update_ability_def(id, attrs) do
    case Repo.get(AbilityDef, id) do
      nil ->
        {:error, :not_found}

      %AbilityDef{} = ability ->
        ability
        |> AbilityDef.changeset(attrs)
        |> Repo.update()
        |> case do
          {:ok, updated} -> {:ok, serialize_ability_def(updated)}
          {:error, changeset} -> {:error, changeset}
        end
    end
  end

  def delete_ability_def(id) do
    case Repo.get(AbilityDef, id) do
      nil -> {:error, :not_found}
      %AbilityDef{} = ability -> Repo.delete(ability) && {:ok, %{success: true}}
    end
  end

  def assign_card_ability(card_id, attrs) do
    row =
      case Repo.get_by(CardAbility, card_id: card_id) do
        nil -> %CardAbility{card_id: card_id}
        existing -> existing
      end

    row
    |> CardAbility.changeset(attrs)
    |> Repo.insert_or_update()
    |> case do
      {:ok, ca} ->
        ca = Repo.preload(ca, [:passive, :skill, :ultimate], force: true)
        {:ok, serialize_admin_card_ability(ca)}

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  def remove_card_ability(card_id) do
    case Repo.get_by(CardAbility, card_id: card_id) do
      nil -> {:error, :not_found}
      %CardAbility{} = ca -> Repo.delete(ca) && {:ok, %{success: true}}
    end
  end

  def expire_match_invite(match_id) do
    Repo.transaction(fn ->
      case Repo.one(from(m in Match, where: m.id == ^match_id, lock: "FOR UPDATE")) do
        nil ->
          Repo.rollback(:not_found)

        %Match{} = match ->
          cond do
            match.status != "pending" ->
              :noop

            pending_match_expired?(match) ->
              match
              |> Match.changeset(%{status: "expired"})
              |> Repo.update!()

              :expired

            true ->
              :noop
          end
      end
    end)
    |> case do
      {:ok, result} -> {:ok, result}
      {:error, :not_found} -> {:error, :not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  # ── Private Helpers ────────────────────────────────────────────────────────

  defp serialize_match(match) do
    serialize_match(match, user_display_map([match]))
  end

  defp serialize_match(match, display_names) do
    invitee_loadout = match.invitee_card_ids || []

    %{
      id: match.id,
      inviterId: match.inviter_id,
      inviteeId: match.invitee_id,
      inviterName: Map.get(display_names, match.inviter_id),
      inviteeName: Map.get(display_names, match.invitee_id),
      status: api_match_status(match.status),
      inviterLoadout: match.inviter_card_ids,
      inviteeLoadout: invitee_loadout,
      winnerId: match.winner_id,
      expiresAt: if(match.expires_at, do: iso8601(match.expires_at), else: nil),
      createdAt: iso8601(match.inserted_at),
      updatedAt: iso8601(match.updated_at)
    }
    |> maybe_put_current_turn(match.current_turn)
  end

  defp maybe_put_current_turn(payload, turn) when is_integer(turn) and turn > 0,
    do: Map.put(payload, :currentTurn, turn)

  defp maybe_put_current_turn(payload, _turn), do: payload

  defp api_match_status("pending"), do: "PENDING"
  defp api_match_status("in_progress"), do: "IN_PROGRESS"
  defp api_match_status("completed"), do: "COMPLETED"
  defp api_match_status("declined"), do: "DECLINED"
  defp api_match_status("expired"), do: "EXPIRED"
  defp api_match_status(status), do: status

  defp serialize_loadouts(loadouts, user_id) do
    %{card_map: card_map, owned_set: owned_set} = build_loadout_support(loadouts, user_id)

    Enum.map(loadouts, &serialize_loadout(&1, card_map, owned_set))
  end

  defp build_loadout_support(loadouts, user_id) do
    card_ids =
      loadouts
      |> Enum.flat_map(& &1.card_ids)
      |> Enum.uniq()

    owned_set =
      OwnedCard
      |> where([o], o.user_id == ^user_id and o.card_id in ^card_ids and o.quantity > 0)
      |> select([o], o.card_id)
      |> Repo.all()
      |> MapSet.new()

    card_map =
      Card
      |> where([c], c.id in ^card_ids)
      |> preload(:rarity)
      |> Repo.all()
      |> Map.new(fn card -> {card.id, to_card_payload(card)} end)

    %{card_map: card_map, owned_set: owned_set}
  end

  defp serialize_matches(matches) do
    display_names = user_display_map(matches)
    Enum.map(matches, &serialize_match(&1, display_names))
  end

  defp maybe_put_replay_flag(payload, %Match{status: "completed", initial_state: initial_state})
       when is_map(initial_state) do
    Map.put(payload, :hasReplayData, true)
  end

  defp maybe_put_replay_flag(payload, _match), do: payload

  defp user_display_map(matches) do
    user_ids =
      matches
      |> Enum.flat_map(&[&1.inviter_id, &1.invitee_id])
      |> Enum.uniq()

    User
    |> where([u], u.id in ^user_ids)
    |> select([u], {u.id, u.display_name, u.email})
    |> Repo.all()
    |> Map.new(fn {id, display_name, email} -> {id, display_name || email} end)
  end

  defp to_card_payload(card) do
    %{
      id: card.id,
      name: card.name,
      character: card.character,
      description: card.description,
      hp: card.hp,
      attack: card.attack,
      defense: card.defense,
      speed: card.speed,
      type: CardType.canonicalize!(card.type),
      rarity: %{
        id: card.rarity.id,
        name: card.rarity.name,
        dropRate: card.rarity.drop_rate,
        color: card.rarity.color
      },
      imageAssetId: card.image_asset_id
    }
  end

  defp build_battle_state_for_view(%Match{status: status}, _user_id)
       when status in ["pending", "declined", "expired"] do
    {:ok, nil}
  end

  defp build_battle_state_for_view(match, user_id) do
    with {:ok, state} <- reconstruct_state(match.id) do
      {:ok, BattleEngine.build_view(state, user_id)}
    end
  end

  defp build_battle_state_for_spectate(%Match{status: status}) when status == "pending" do
    {:ok, nil}
  end

  defp build_battle_state_for_spectate(%Match{status: status}) when status == "expired" do
    {:ok, nil}
  end

  defp build_battle_state_for_spectate(match) do
    with {:ok, state} <- reconstruct_state(match.id) do
      {:ok, BattleEngine.build_spectator_view(state)}
    end
  end

  defp build_replay_payload(%Match{status: "completed"} = match) do
    with %{} = initial_state <- match.initial_state,
         {:ok, final_state} <- reconstruct_state(match.id) do
      %{
        log: Map.get(final_state, "log", []),
        initialState: initial_state,
        finalState: final_state,
        seed: match.seed,
        totalTurns: Map.get(final_state, "turn")
      }
    else
      _ -> nil
    end
  end

  defp build_replay_payload(_match), do: nil

  defp latest_snapshot_for_match(match_id) do
    MatchSnapshot
    |> where([s], s.match_id == ^match_id)
    |> order_by([s], desc: s.seq_at, desc: s.inserted_at)
    |> limit(1)
    |> Repo.one()
  end

  defp events_after_seq(match_id, seq) do
    MatchEvent
    |> where([e], e.match_id == ^match_id and e.seq > ^seq)
    |> order_by([e], asc: e.seq, asc: e.inserted_at)
    |> Repo.all()
  end

  defp replay_match_event(state, %MatchEvent{type: "action_performed", payload: payload}) do
    case BattleEngine.simulate_action(state, payload["playerId"], payload["action"] || %{}) do
      {:ok, next_state, _events} -> {:ok, next_state}
      {:error, reason} -> {:error, reason}
    end
  end

  defp replay_match_event(state, %MatchEvent{type: "turn_ended", payload: payload}) do
    {next_state, _events} = BattleEngine.simulate_end_turn(state, payload["swap"])
    {:ok, next_state}
  end

  defp replay_match_event(state, %MatchEvent{type: "match_conceded", payload: payload}) do
    {next_state, _events} = BattleEngine.simulate_concede(state, payload["playerId"])
    {:ok, next_state}
  end

  defp replay_match_event(_state, %MatchEvent{type: type}) do
    {:error, {:unsupported_match_event, type}}
  end

  defp append_match_event!(match_id, type, state, payload) do
    seq = next_match_seq(match_id)

    Repo.insert!(
      MatchEvent.changeset(%MatchEvent{}, %{
        match_id: match_id,
        seq: seq,
        turn: state["turn"] || 0,
        type: type,
        payload: payload
      })
    )

    seq
  end

  defp next_match_seq(match_id) do
    MatchEvent
    |> where([e], e.match_id == ^match_id)
    |> select([e], max(e.seq))
    |> Repo.one()
    |> case do
      nil -> 1
      seq -> seq + 1
    end
  end

  defp write_snapshot!(match_id, seq_at, state) do
    Repo.insert!(
      MatchSnapshot.changeset(%MatchSnapshot{}, %{
        match_id: match_id,
        seq_at: seq_at,
        turn_at: state["turn"] || 0,
        state: state
      })
    )
  end

  defp maybe_write_snapshot(match_id, seq, state, event_type) do
    if should_snapshot?(state, event_type) do
      write_snapshot!(match_id, seq, state)
    else
      :ok
    end
  end

  defp should_snapshot?(state, event_type) do
    cond do
      state["phase"] == "ended" -> true
      event_type == :turn_ended -> rem(state["turn"] || 0, 10) == 0
      true -> false
    end
  end

  defp iso8601(%DateTime{} = value), do: DateTime.to_iso8601(value)
  defp iso8601(%NaiveDateTime{} = value), do: NaiveDateTime.to_iso8601(value)

  defp verify_participant(match, user_id) do
    if match.inviter_id == user_id or match.invitee_id == user_id do
      :ok
    else
      {:error, :forbidden}
    end
  end

  defp guard_invitee(match, user_id) do
    if match.invitee_id == user_id, do: :ok, else: {:error, :forbidden}
  end

  defp guard_status(match, expected) do
    if match.status == expected, do: :ok, else: {:error, {:wrong_status, match.status}}
  end

  defp guard_your_turn(state, user_id) do
    if state["currentPlayerId"] == user_id, do: :ok, else: {:error, :not_your_turn}
  end

  defp guard_not_self(user_id, invitee_id) do
    if user_id == invitee_id, do: {:error, :cannot_invite_self}, else: :ok
  end

  defp guard_no_active_interaction(user_a, user_b) do
    expire_due_pending_invites_for_pair(user_a, user_b)

    now = DateTime.utc_now() |> DateTime.truncate(:second)

    has_active =
      Match
      |> where(
        [m],
        (m.status == "in_progress" or
           (m.status == "pending" and (is_nil(m.expires_at) or m.expires_at > ^now))) and
          ((m.inviter_id == ^user_a and m.invitee_id == ^user_b) or
             (m.inviter_id == ^user_b and m.invitee_id == ^user_a))
      )
      |> Repo.exists?()

    if has_active, do: {:error, :active_interaction_exists}, else: :ok
  end

  defp invite_expires_at do
    hours =
      Application.get_env(:adventure_time_api, __MODULE__, [])
      |> Keyword.get(:invite_ttl_hours, 24)

    DateTime.add(DateTime.utc_now() |> DateTime.truncate(:second), hours * 60 * 60, :second)
  end

  defp schedule_invite_expiry!(match_id, expires_at) do
    %{"match_id" => match_id}
    |> ExpirePendingInviteWorker.new(scheduled_at: expires_at)
    |> Oban.insert!()
  end

  defp maybe_notify_current_player(
         %Match{status: "in_progress"} = match,
         battle_state,
         acting_user_id
       ) do
    current_player_id = battle_state["currentPlayerId"]

    if is_binary(current_player_id) and current_player_id != acting_user_id do
      dispatch_notification(fn ->
        opponent_name =
          if current_player_id == match.inviter_id do
            user_display_name(match.invitee_id)
          else
            user_display_name(match.inviter_id)
          end

        _ = Notifications.send_pvp_turn(current_player_id, opponent_name)
      end)
    end
  end

  defp maybe_notify_current_player(_match, _battle_state, _acting_user_id), do: :ok

  defp dispatch_notification(fun) when is_function(fun, 0) do
    if sandbox_repo?() do
      fun.()
      :ok
    else
      Task.start(fun)
      :ok
    end
  end

  defp sandbox_repo? do
    Application.get_env(:adventure_time_api, AdventureTimeApi.Repo, [])
    |> Keyword.get(:pool) == Ecto.Adapters.SQL.Sandbox
  end

  defp user_display_name(user_id) do
    case Repo.get(User, user_id) do
      %User{} = user -> user.display_name || user.email
      nil -> "Someone"
    end
  end

  defp expire_due_pending_invites(nil) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    from(m in Match,
      where: m.status == "pending" and not is_nil(m.expires_at) and m.expires_at <= ^now
    )
    |> Repo.update_all(set: [status: "expired", updated_at: now])

    :ok
  end

  defp expire_due_pending_invites(user_id) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    from(m in Match,
      where:
        (m.inviter_id == ^user_id or m.invitee_id == ^user_id) and m.status == "pending" and
          not is_nil(m.expires_at) and m.expires_at <= ^now
    )
    |> Repo.update_all(set: [status: "expired", updated_at: now])

    :ok
  end

  defp expire_due_pending_invites_for_pair(user_a, user_b) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    from(m in Match,
      where:
        m.status == "pending" and not is_nil(m.expires_at) and m.expires_at <= ^now and
          ((m.inviter_id == ^user_a and m.invitee_id == ^user_b) or
             (m.inviter_id == ^user_b and m.invitee_id == ^user_a))
    )
    |> Repo.update_all(set: [status: "expired", updated_at: now])

    :ok
  end

  defp maybe_expire_match_if_due(%Match{} = match) do
    if pending_match_expired?(match) do
      case expire_match_invite(match.id) do
        {:ok, _} -> Repo.get!(Match, match.id)
        {:error, _} -> match
      end
    else
      match
    end
  end

  defp pending_match_expired?(%Match{status: "pending", expires_at: %DateTime{} = expires_at}) do
    DateTime.compare(expires_at, DateTime.utc_now() |> DateTime.truncate(:second)) != :gt
  end

  defp pending_match_expired?(_match), do: false

  defp validate_loadout(user_id, card_ids) do
    cond do
      length(card_ids) != 6 ->
        {:error, :loadout_wrong_size}

      length(card_ids) != length(Enum.uniq(card_ids)) ->
        {:error, :loadout_duplicate_cards}

      true ->
        owned_count =
          OwnedCard
          |> where([o], o.user_id == ^user_id and o.card_id in ^card_ids and o.quantity > 0)
          |> Repo.aggregate(:count, :id)

        if owned_count < 6 do
          {:error, :cards_not_owned}
        else
          cards =
            Card
            |> where([c], c.id in ^card_ids)
            |> preload(:rarity)
            |> Repo.all()

          check_rarity_caps(cards)
        end
    end
  end

  defp check_rarity_caps(cards) do
    legendary_count = Enum.count(cards, &(&1.rarity && &1.rarity.name == "Legendary"))
    epic_count = Enum.count(cards, &(&1.rarity && &1.rarity.name == "Epic"))

    cond do
      legendary_count > 1 -> {:error, :too_many_legendaries}
      epic_count > 2 -> {:error, :too_many_epics}
      true -> :ok
    end
  end

  defp fetch_ability_data_for_cards(card_ids) do
    rows =
      CardAbility
      |> where([ca], ca.card_id in ^card_ids)
      |> preload([:passive, :skill, :ultimate])
      |> Repo.all()

    assignments =
      Map.new(rows, fn ca ->
        {ca.card_id,
         %{
           passive_keys: ca.passive |> List.wrap() |> Enum.map(& &1.key),
           skill_key: ca.skill && ca.skill.key,
           ultimate_key: ca.ultimate && ca.ultimate.key
         }}
      end)

    defs =
      Enum.reduce(rows, %{}, fn ca, acc ->
        acc
        |> maybe_add_ability_def(ca.passive)
        |> maybe_add_ability_def(ca.skill)
        |> maybe_add_ability_def(ca.ultimate)
      end)

    {assignments, defs}
  end

  defp maybe_add_ability_def(acc, nil), do: acc

  defp maybe_add_ability_def(acc, %AbilityDef{} = ability) do
    Map.put_new(acc, ability.key, ability_def_to_state_map(ability))
  end

  # String-keyed map for embedding in JSONB battle state
  defp ability_def_to_state_map(ability) do
    %{
      "key" => ability.key,
      "name" => ability.name,
      "nameFr" => ability.name_fr,
      "description" => ability.description,
      "descriptionFr" => ability.description_fr,
      "type" => ability.type,
      "cost" => ability.cost,
      "cooldown" => ability.cooldown,
      "oncePerMatch" => ability.once_per_match,
      "payload" => ability.payload
    }
  end

  defp inject_unit_abilities(state, assignments) do
    Map.update!(state, "players", fn players ->
      Enum.map(players, fn player ->
        player
        |> Map.update!("units", fn units ->
          Enum.map(units, &inject_unit_ability(&1, assignments))
        end)
        |> Map.update!("bench", fn bench ->
          Enum.map(bench, &inject_unit_ability(&1, assignments))
        end)
      end)
    end)
  end

  defp inject_unit_ability(unit, assignments) do
    card_id = unit["cardId"]

    case Map.get(assignments, card_id) do
      nil ->
        unit

      %{passive_keys: passive_keys, skill_key: skill_key, ultimate_key: ultimate_key} ->
        unit
        |> Map.put("passives", passive_keys || [])
        |> Map.put("passiveTriggered", %{})
        |> Map.put("skill", skill_key)
        |> Map.put("ultimate", ultimate_key)
    end
  end

  # Atom-keyed map for API responses
  defp serialize_ability_def(ability) do
    %{
      id: ability.id,
      key: ability.key,
      name: ability.name,
      nameFr: ability.name_fr,
      description: ability.description,
      descriptionFr: ability.description_fr,
      type: ability.type,
      cost: ability.cost,
      cooldown: ability.cooldown,
      oncePerMatch: ability.once_per_match,
      payload: ability.payload,
      createdAt: iso8601(ability.inserted_at),
      updatedAt: iso8601(ability.updated_at)
    }
  end

  defp serialize_admin_card_ability(ca) do
    %{
      id: ca.id,
      cardId: ca.card_id,
      passiveId: ca.passive_id,
      skillId: ca.skill_id,
      ultimateId: ca.ultimate_id
    }
  end

  defp fetch_cards_for_loadout(card_ids) do
    cards_by_id =
      Card
      |> where([c], c.id in ^card_ids)
      |> join(:left, [c], r in Rarity, on: r.id == c.rarity_id)
      |> select([c, r], {c, r})
      |> Repo.all()
      |> Map.new(fn {card, rarity} ->
        {card.id,
         %{
           "id" => card.id,
           "name" => card.name,
           "character" => card.character,
           "type" => CardType.canonicalize!(card.type),
           "hp" => card.hp,
           "attack" => card.attack,
           "defense" => card.defense,
           "speed" => card.speed,
           "rarity_name" => if(rarity, do: rarity.name, else: "Common")
         }}
      end)

    card_ids
    |> Enum.map(&Map.get(cards_by_id, &1))
    |> Enum.reject(&is_nil/1)
  end

  defp normalize_reconstructed_state(state) do
    Map.update!(state, "players", fn players ->
      Enum.map(players, fn player ->
        player
        |> Map.update!("units", &Enum.map(&1, fn unit -> normalize_unit_type(unit) end))
        |> Map.update!("bench", &Enum.map(&1, fn unit -> normalize_unit_type(unit) end))
      end)
    end)
  end

  defp normalize_unit_type(unit) do
    Map.update!(unit, "type", &CardType.canonicalize!/1)
  end
end
