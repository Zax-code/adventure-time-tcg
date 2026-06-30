defmodule AdventureTimeApiWeb.PvpController do
  use AdventureTimeApiWeb, :controller

  alias AdventureTimeApi.Pvp
  alias AdventureTimeApiWeb.Plugs.RateLimit

  # GET /pvp/loadouts
  def list_loadouts(conn, _params) do
    user_id = conn.assigns.auth_user.id

    case Pvp.list_loadouts(user_id) do
      {:ok, loadouts} -> json(conn, %{loadouts: loadouts})
    end
  end

  # POST /pvp/loadouts
  def create_loadout(conn, %{"name" => name, "cardIds" => card_ids}) do
    user_id = conn.assigns.auth_user.id

    case Pvp.create_loadout(user_id, name, card_ids) do
      {:ok, loadout} ->
        conn |> put_status(201) |> json(%{loadout: loadout})

      {:error, :loadout_wrong_size} ->
        conn |> put_status(400) |> json(%{error: "Loadout must contain 6 unique cards"})

      {:error, :loadout_duplicate_cards} ->
        conn |> put_status(400) |> json(%{error: "Loadout cannot contain duplicate cards"})

      {:error, :cards_not_owned} ->
        conn |> put_status(400) |> json(%{error: "You don't own all selected cards"})

      {:error, :too_many_legendaries} ->
        conn |> put_status(400) |> json(%{error: "Loadout can include at most 1 Legendary"})

      {:error, :too_many_epics} ->
        conn |> put_status(400) |> json(%{error: "Loadout can include at most 2 Epic cards"})

      {:error, _} ->
        conn |> put_status(400) |> json(%{error: "Invalid loadout"})
    end
  end

  def create_loadout(conn, _params) do
    conn |> put_status(400) |> json(%{error: "name and cardIds are required"})
  end

  # PUT /pvp/loadouts/:id
  def update_loadout(conn, %{"id" => id, "name" => name, "cardIds" => card_ids}) do
    user_id = conn.assigns.auth_user.id

    case Pvp.update_loadout(user_id, id, name, card_ids) do
      {:ok, loadout} ->
        json(conn, %{loadout: loadout})

      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{error: "Loadout not found"})

      {:error, :loadout_wrong_size} ->
        conn |> put_status(400) |> json(%{error: "Loadout must contain 6 unique cards"})

      {:error, :loadout_duplicate_cards} ->
        conn |> put_status(400) |> json(%{error: "Loadout cannot contain duplicate cards"})

      {:error, :cards_not_owned} ->
        conn |> put_status(400) |> json(%{error: "You don't own all selected cards"})

      {:error, :too_many_legendaries} ->
        conn |> put_status(400) |> json(%{error: "Loadout can include at most 1 Legendary"})

      {:error, :too_many_epics} ->
        conn |> put_status(400) |> json(%{error: "Loadout can include at most 2 Epic cards"})

      {:error, _} ->
        conn |> put_status(400) |> json(%{error: "Invalid loadout"})
    end
  end

  def update_loadout(conn, %{"id" => _id}) do
    conn |> put_status(400) |> json(%{error: "name and cardIds are required"})
  end

  # DELETE /pvp/loadouts/:id
  def delete_loadout(conn, %{"id" => id}) do
    user_id = conn.assigns.auth_user.id

    case Pvp.delete_loadout(user_id, id) do
      {:ok, result} ->
        json(conn, result)

      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{error: "Loadout not found"})

      {:error, _} ->
        conn |> put_status(500) |> json(%{error: "Internal error"})
    end
  end

  # GET /pvp/invites
  def list_invites(conn, _params) do
    user_id = conn.assigns.auth_user.id

    case Pvp.list_invites(user_id) do
      {:ok, invites} -> json(conn, %{invites: invites})
    end
  end

  # POST /pvp/invites
  def create_invite(conn, %{"inviteeEmail" => invitee_email, "loadout" => loadout}) do
    user_id = conn.assigns.auth_user.id

    case Pvp.create_invite(user_id, invitee_email, loadout) do
      {:ok, result} ->
        conn |> put_status(201) |> json(result)

      {:error, :invitee_not_found} ->
        conn |> put_status(400) |> json(%{error: "Invitee not found"})

      {:error, :cannot_invite_self} ->
        conn |> put_status(400) |> json(%{error: "Cannot invite yourself"})

      {:error, :loadout_wrong_size} ->
        conn |> put_status(400) |> json(%{error: "Loadout must contain 6 unique cards"})

      {:error, :loadout_duplicate_cards} ->
        conn |> put_status(400) |> json(%{error: "Loadout cannot contain duplicate cards"})

      {:error, :cards_not_owned} ->
        conn |> put_status(400) |> json(%{error: "You don't own all selected cards"})

      {:error, :too_many_legendaries} ->
        conn |> put_status(400) |> json(%{error: "Loadout can include at most 1 Legendary"})

      {:error, :too_many_epics} ->
        conn |> put_status(400) |> json(%{error: "Loadout can include at most 2 Epic cards"})

      {:error, :active_interaction_exists} ->
        conn
        |> put_status(400)
        |> json(%{error: "An active interaction already exists for these players"})

      {:error, _} ->
        conn |> put_status(400) |> json(%{error: "Invalid invite"})
    end
  end

  def create_invite(conn, _params) do
    conn |> put_status(400) |> json(%{error: "inviteeEmail and loadout are required"})
  end

  # DELETE /pvp/invites?matchId=:id
  def delete_invite(conn, %{"matchId" => match_id}) do
    user_id = conn.assigns.auth_user.id

    case Pvp.cancel_invite(user_id, match_id) do
      {:ok, result} ->
        json(conn, result)

      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{error: "Match not found"})

      {:error, :forbidden} ->
        conn |> put_status(403) |> json(%{error: "Forbidden"})

      {:error, {:wrong_status, _status}} ->
        conn |> put_status(400) |> json(%{error: "Cannot cancel a non-pending invite"})

      {:error, _} ->
        conn |> put_status(500) |> json(%{error: "Internal error"})
    end
  end

  def delete_invite(conn, _params) do
    conn |> put_status(400) |> json(%{error: "matchId is required"})
  end

  # GET /pvp/matches
  def list_matches(conn, _params) do
    user_id = conn.assigns.auth_user.id

    case Pvp.list_matches(user_id) do
      {:ok, response} -> json(conn, response)
    end
  end

  # GET /pvp/matches/:id
  def get_match(conn, %{"id" => id}) do
    user_id = conn.assigns.auth_user.id

    case Pvp.get_match(user_id, id) do
      {:ok, detail} ->
        json(conn, detail)

      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{error: "Match not found"})

      {:error, :forbidden} ->
        conn |> put_status(403) |> json(%{error: "Forbidden"})

      {:error, _} ->
        conn |> put_status(500) |> json(%{error: "Internal error"})
    end
  end

  # GET /pvp/history
  def list_history(conn, _params) do
    user_id = conn.assigns.auth_user.id

    case Pvp.list_history(user_id) do
      {:ok, history} -> json(conn, history)
    end
  end

  # GET /pvp/history/:id
  def get_history_detail(conn, %{"id" => id}) do
    user_id = conn.assigns.auth_user.id

    case Pvp.get_history_detail(user_id, id) do
      {:ok, detail} ->
        json(conn, detail)

      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{error: "Match not found"})

      {:error, :forbidden} ->
        conn |> put_status(403) |> json(%{error: "Forbidden"})

      {:error, _} ->
        conn |> put_status(500) |> json(%{error: "Internal error"})
    end
  end

  # POST /pvp/matches/:id/accept
  def accept_match(conn, %{"id" => id} = params) do
    user_id = conn.assigns.auth_user.id
    card_ids = Map.get(params, "loadout", [])

    case Pvp.accept_match(user_id, id, card_ids) do
      {:ok, detail} ->
        json(conn, detail)

      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{error: "Match not found"})

      {:error, :forbidden} ->
        conn |> put_status(403) |> json(%{error: "Only the invitee can accept"})

      {:error, {:wrong_status, "expired"}} ->
        conn
        |> put_status(409)
        |> json(%{error: "Match invite has expired", code: "INVITE_EXPIRED"})

      {:error, {:wrong_status, _}} ->
        conn |> put_status(400) |> json(%{error: "Match is not pending"})

      {:error, :loadout_wrong_size} ->
        conn |> put_status(400) |> json(%{error: "Loadout must contain 6 unique cards"})

      {:error, :loadout_duplicate_cards} ->
        conn |> put_status(400) |> json(%{error: "Loadout cannot contain duplicate cards"})

      {:error, :cards_not_owned} ->
        conn |> put_status(400) |> json(%{error: "You don't own all selected cards"})

      {:error, :too_many_legendaries} ->
        conn |> put_status(400) |> json(%{error: "Loadout can include at most 1 Legendary"})

      {:error, :too_many_epics} ->
        conn |> put_status(400) |> json(%{error: "Loadout can include at most 2 Epic cards"})

      {:error, _} ->
        conn |> put_status(500) |> json(%{error: "Internal error"})
    end
  end

  # POST /pvp/matches/:id/decline
  def decline_match(conn, %{"id" => id}) do
    user_id = conn.assigns.auth_user.id

    case Pvp.decline_match(user_id, id) do
      {:ok, result} ->
        json(conn, result)

      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{error: "Match not found"})

      {:error, :forbidden} ->
        conn |> put_status(403) |> json(%{error: "Forbidden"})

      {:error, {:wrong_status, "expired"}} ->
        conn
        |> put_status(409)
        |> json(%{error: "Match invite has expired", code: "INVITE_EXPIRED"})

      {:error, {:wrong_status, _}} ->
        conn |> put_status(400) |> json(%{error: "Match is not pending"})

      {:error, _} ->
        conn |> put_status(500) |> json(%{error: "Internal error"})
    end
  end

  # POST /pvp/matches/:id/concede
  def concede_match(conn, %{"id" => id}) do
    conn = RateLimit.call(conn, bucket: :pvp_match_write, key_strategy: :auth_user_match)

    if conn.halted do
      conn
    else
      user_id = conn.assigns.auth_user.id

      case Pvp.concede_match(user_id, id) do
        {:ok, result} ->
          json(conn, result)

        {:error, :not_found} ->
          conn |> put_status(404) |> json(%{error: "Match not found"})

        {:error, :forbidden} ->
          conn |> put_status(403) |> json(%{error: "Forbidden"})

        {:error, {:wrong_status, _}} ->
          conn |> put_status(400) |> json(%{error: "Match is not in progress"})

        {:error, _} ->
          conn |> put_status(500) |> json(%{error: "Internal error"})
      end
    end
  end

  # POST /pvp/matches/:id/action
  def perform_action(conn, %{"id" => id} = params) do
    conn = RateLimit.call(conn, bucket: :pvp_match_write, key_strategy: :auth_user_match)

    if conn.halted do
      conn
    else
      user_id = conn.assigns.auth_user.id

      action =
        Map.take(params, [
          "kind",
          "actorInstanceId",
          "targetInstanceId",
          "abilityKey",
          "sourceInstanceId"
        ])

      case Pvp.perform_action(user_id, id, action) do
        {:ok, result} ->
          json(conn, result)

        {:error, :abilities_not_implemented} ->
          conn
          |> put_status(400)
          |> json(%{
            error: "Skill and ultimate abilities are not yet implemented",
            code: "ABILITIES_NOT_IMPLEMENTED"
          })

        {:error, :not_found} ->
          conn |> put_status(404) |> json(%{error: "Match not found"})

        {:error, :forbidden} ->
          conn |> put_status(403) |> json(%{error: "Forbidden"})

        {:error, :not_your_turn} ->
          conn |> put_status(400) |> json(%{error: "Not your turn"})

        {:error, {:wrong_status, _}} ->
          conn |> put_status(400) |> json(%{error: "Match is not in progress"})

        {:error, :unit_not_found} ->
          conn |> put_status(400) |> json(%{error: "Unit not found"})

        {:error, :unit_not_yours} ->
          conn |> put_status(400) |> json(%{error: "That unit does not belong to you"})

        {:error, :cannot_target_ally} ->
          conn |> put_status(400) |> json(%{error: "Cannot target your own unit"})

        {:error, :actor_is_ko} ->
          conn |> put_status(400) |> json(%{error: "Actor is knocked out"})

        {:error, :target_is_ko} ->
          conn |> put_status(400) |> json(%{error: "Target is already knocked out"})

        {:error, _} ->
          conn |> put_status(400) |> json(%{error: "Invalid action"})
      end
    end
  end

  # POST /pvp/matches/:id/end-turn
  def end_turn(conn, %{"id" => id} = params) do
    conn = RateLimit.call(conn, bucket: :pvp_match_write, key_strategy: :auth_user_match)

    if conn.halted do
      conn
    else
      user_id = conn.assigns.auth_user.id
      swap_opt = Map.get(params, "swap")

      case Pvp.end_turn(user_id, id, swap_opt) do
        {:ok, result} ->
          json(conn, result)

        {:error, :not_found} ->
          conn |> put_status(404) |> json(%{error: "Match not found"})

        {:error, :forbidden} ->
          conn |> put_status(403) |> json(%{error: "Forbidden"})

        {:error, :not_your_turn} ->
          conn |> put_status(400) |> json(%{error: "Not your turn"})

        {:error, {:wrong_status, _}} ->
          conn |> put_status(400) |> json(%{error: "Match is not in progress"})

        {:error, _} ->
          conn |> put_status(500) |> json(%{error: "Internal error"})
      end
    end
  end

  # GET /pvp/spectate
  def list_spectatable(conn, _params) do
    case Pvp.list_spectatable() do
      {:ok, matches} -> json(conn, %{matches: matches})
    end
  end

  # GET /pvp/spectate/:id
  def get_spectate(conn, %{"id" => id}) do
    case Pvp.get_spectate(id) do
      {:ok, detail} ->
        json(conn, detail)

      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{error: "Match not found"})

      {:error, _} ->
        conn |> put_status(500) |> json(%{error: "Internal error"})
    end
  end
end
