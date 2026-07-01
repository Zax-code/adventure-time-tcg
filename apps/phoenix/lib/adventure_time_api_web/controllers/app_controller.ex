defmodule AdventureTimeApiWeb.AppController do
  use AdventureTimeApiWeb, :controller

  alias AdventureTimeApi.Accounts
  alias AdventureTimeApi.Catalog
  alias AdventureTimeApi.Fitbit
  alias AdventureTimeApi.Health
  alias AdventureTimeApi.Inventory
  alias AdventureTimeApi.Quests

  def me(conn, _params) do
    case Accounts.auth_user_for_id(conn.assigns.auth_user.id) do
      {:ok, auth_user} -> json(conn, auth_user)
      {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "User not found"})
    end
  end

  def home(conn, _params) do
    auth_user = conn.assigns.auth_user

    json(conn, %{
      user: auth_user,
      collectionStats: Inventory.collection_stats_for_user(auth_user.id)
    })
  end

  def collection(conn, _params) do
    conn.assigns.auth_user.id
    |> Inventory.collection_for_user()
    |> then(&json(conn, &1))
  end

  def packs(conn, _params) do
    json(conn, %{
      packs: Inventory.list_active_packs_for_user(conn.assigns.auth_user.id),
      cardBackVisuals: Catalog.list_card_back_visuals()
    })
  end

  def open_pack(conn, %{"packId" => pack_id}) do
    case Inventory.open_pack_for_user(conn.assigns.auth_user.id, pack_id) do
      {:ok, response} ->
        json(conn, response)

      {:error, :not_enough_coins} ->
        conn |> put_status(:bad_request) |> json(%{error: "Not enough coins"})

      {:error, :weekly_pack_limit_reached, availability} ->
        conn
        |> put_status(:conflict)
        |> json(%{error: "Weekly pack limit reached", availability: availability})

      {:error, :pack_not_found_or_inactive} ->
        conn |> put_status(:not_found) |> json(%{error: "Pack not found or inactive"})

      {:error, :no_cards_available} ->
        conn |> put_status(:not_found) |> json(%{error: "No cards available"})

      {:error, :user_not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "User not found"})
    end
  end

  def open_pack(conn, _params) do
    conn |> put_status(:bad_request) |> json(%{error: "packId is required"})
  end

  def rarities(conn, _params) do
    json(conn, %{rarities: Catalog.list_rarities()})
  end

  def featured_cards(conn, _params) do
    json(conn, %{cards: Catalog.list_featured_cards()})
  end

  def daily_claim_status(conn, _params) do
    case Quests.daily_claim_status(conn.assigns.auth_user.id) do
      {:ok, response} -> json(conn, response)
      {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "User not found"})
    end
  end

  def daily_claim(conn, _params) do
    case Quests.claim_daily_reward(conn.assigns.auth_user.id) do
      {:ok, response} -> json(conn, response)
      {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "User not found"})
      {:error, :already_claimed, payload} -> conn |> put_status(:conflict) |> json(payload)
    end
  end

  def craft_card(conn, %{"cardId" => card_id, "quantity" => quantity}) do
    qty = parse_quantity(quantity)

    case Inventory.craft_card(conn.assigns.auth_user.id, card_id, qty) do
      {:ok, response} ->
        json(conn, response)

      {:error, :not_enough_dust, required, current} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Not enough dust", required: required, current: current})

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "Card not found"})

      {:error, :invalid_quantity} ->
        conn |> put_status(:bad_request) |> json(%{error: "quantity must be a positive integer"})

      {:error, _reason} ->
        conn |> put_status(:internal_server_error) |> json(%{error: "Failed to craft card"})
    end
  end

  def craft_card(conn, _params) do
    conn |> put_status(:bad_request) |> json(%{error: "cardId and quantity are required"})
  end

  def recycle_card(conn, %{"cardId" => card_id, "quantity" => quantity}) do
    qty = parse_quantity(quantity)

    case Inventory.recycle_card(conn.assigns.auth_user.id, card_id, qty) do
      {:ok, response} ->
        json(conn, response)

      {:error, :not_owned} ->
        conn |> put_status(:not_found) |> json(%{error: "You do not own this card"})

      {:error, {:not_enough_copies, owned}} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Not enough copies to recycle", owned: owned, requested: qty})

      {:error, :card_in_active_match} ->
        conn |> put_status(:bad_request) |> json(%{error: "Card is in an active PvP match"})

      {:error, :invalid_quantity} ->
        conn |> put_status(:bad_request) |> json(%{error: "quantity must be a positive integer"})

      {:error, _reason} ->
        conn |> put_status(:internal_server_error) |> json(%{error: "Failed to recycle card"})
    end
  end

  def recycle_card(conn, _params) do
    conn |> put_status(:bad_request) |> json(%{error: "cardId and quantity are required"})
  end

  def update_display_name(conn, %{"displayName" => name}) do
    case Accounts.update_display_name(conn.assigns.auth_user.id, name) do
      {:ok, user} -> json(conn, user)
      {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "User not found"})
      {:error, :validation, msg} -> conn |> put_status(:bad_request) |> json(%{error: msg})
    end
  end

  def update_display_name(conn, _params) do
    conn |> put_status(:bad_request) |> json(%{error: "displayName is required"})
  end

  def update_language(conn, %{"preferredLanguage" => lang}) do
    case Accounts.update_preferred_language(conn.assigns.auth_user.id, lang) do
      {:ok, user} -> json(conn, user)
      {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "User not found"})
      {:error, :validation, msg} -> conn |> put_status(:bad_request) |> json(%{error: msg})
    end
  end

  def update_language(conn, _params) do
    conn |> put_status(:bad_request) |> json(%{error: "preferredLanguage is required"})
  end

  def update_step_source(conn, %{"preferredStepSource" => source}) do
    case Accounts.update_preferred_step_source(conn.assigns.auth_user.id, source) do
      {:ok, user} -> json(conn, user)
      {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "User not found"})
      {:error, :validation, msg} -> conn |> put_status(:bad_request) |> json(%{error: msg})
    end
  end

  def update_step_source(conn, _params) do
    conn |> put_status(:bad_request) |> json(%{error: "preferredStepSource is required"})
  end

  def update_timezone(conn, %{"timezone" => timezone}) do
    case Accounts.update_timezone(conn.assigns.auth_user.id, timezone) do
      {:ok, user} -> json(conn, user)
      {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "User not found"})
      {:error, :validation, msg} -> conn |> put_status(:bad_request) |> json(%{error: msg})
    end
  end

  def update_timezone(conn, _params) do
    conn |> put_status(:bad_request) |> json(%{error: "timezone is required"})
  end

  def update_notification_preferences(conn, %{"notificationPreferences" => preferences}) do
    case Accounts.update_notification_preferences(conn.assigns.auth_user.id, preferences) do
      {:ok, user} -> json(conn, user)
      {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "User not found"})
      {:error, :validation, msg} -> conn |> put_status(:bad_request) |> json(%{error: msg})
    end
  end

  def update_notification_preferences(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{error: "notificationPreferences is required"})
  end

  def update_password(conn, params) do
    case Accounts.update_password(conn.assigns.auth_user.id, params) do
      {:ok, user} ->
        json(conn, user)

      {:error, :not_found, message} ->
        conn |> put_status(:not_found) |> json(%{error: message})

      {:error, :invalid_current_password, message} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: message, code: "INVALID_CURRENT_PASSWORD"})

      {:error, :validation, message} ->
        conn |> put_status(:bad_request) |> json(%{error: message})
    end
  end

  def delete_account(conn, _params) do
    case Accounts.delete_own_account(conn.assigns.auth_user.id) do
      {:ok, result} ->
        json(conn, result)

      {:error, :not_found, message} ->
        conn |> put_status(:not_found) |> json(%{error: message})

      {:error, :validation, message} ->
        conn |> put_status(:bad_request) |> json(%{error: message})
    end
  end

  def health_steps(conn, _params) do
    user_id = conn.assigns.auth_user.id

    case Accounts.auth_user_for_id(user_id) do
      {:ok, auth_user} ->
        preferred_source = auth_user.preferredStepSource

        if preferred_source == "fitbit" && Fitbit.connected?(user_id) && Fitbit.configured?() do
          _ = Fitbit.sync_steps_for_date(user_id, Quests.current_reset_date_for_user(user_id))
        end

        latest = Health.get_latest_step_snapshot(user_id, preferred_source)

        json(conn, %{
          preferredSource: auth_user.preferredStepSource,
          latest:
            if latest do
              %{
                source: Atom.to_string(latest.source),
                stepCount: latest.step_count,
                recordedFor: Date.to_iso8601(latest.recorded_for),
                updatedAt: DateTime.to_iso8601(latest.updated_at)
              }
            end
        })

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "User not found"})
    end
  end

  def sync_steps(conn, %{
        "source" => source,
        "stepCount" => step_count,
        "recordedFor" => recorded_for
      }) do
    case Health.upsert_step_snapshot(conn.assigns.auth_user.id, source, step_count, recorded_for) do
      {:ok, snapshot} ->
        :ok = Quests.sync_steps_quest(conn.assigns.auth_user.id)

        conn
        |> put_status(:created)
        |> json(%{
          source: Atom.to_string(snapshot.source),
          stepCount: snapshot.step_count,
          recordedFor: Date.to_iso8601(snapshot.recorded_for),
          updatedAt: DateTime.to_iso8601(snapshot.updated_at)
        })

      {:error, :invalid_date} ->
        conn |> put_status(:bad_request) |> json(%{error: "Invalid recordedFor date"})

      {:error, %Ecto.Changeset{} = cs} ->
        msg = cs.errors |> Enum.map(fn {k, {m, _}} -> "#{k} #{m}" end) |> Enum.join(", ")
        conn |> put_status(:bad_request) |> json(%{error: msg})

      {:error, _reason} ->
        conn |> put_status(:internal_server_error) |> json(%{error: "Failed to sync steps"})
    end
  end

  def sync_steps(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{error: "source, stepCount, and recordedFor are required"})
  end

  defp parse_quantity(qty) when is_integer(qty), do: qty

  defp parse_quantity(qty) when is_binary(qty) do
    case Integer.parse(qty) do
      {n, ""} -> n
      :error -> 0
      _ -> 0
    end
  end

  defp parse_quantity(_), do: 0
end
