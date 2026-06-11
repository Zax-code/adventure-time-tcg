defmodule AdventureTimeApiWeb.AdminController do
  use AdventureTimeApiWeb, :controller

  alias AdventureTimeApi.Accounts
  alias AdventureTimeApi.Accounts.AuthError
  alias AdventureTimeApi.Catalog
  alias AdventureTimeApi.Media
  alias AdventureTimeApi.Pvp

  def users(conn, _params) do
    case Accounts.admin_users(conn.assigns.auth_user) do
      {:ok, response} ->
        json(conn, response)

      {:error, %AuthError{} = error} ->
        conn |> put_status(error.status_code) |> json(%{error: error.message, code: error.code})
    end
  end

  def list_packs(conn, _params) do
    with :ok <- require_admin(conn) do
      json(conn, %{packs: Catalog.list_admin_packs()})
    else
      {:error, %Plug.Conn{} = conn} -> conn
    end
  end

  def create_pack(conn, params) do
    with :ok <- require_admin(conn) do
      case Catalog.create_admin_pack(params) do
        {:ok, pack} ->
          conn |> put_status(201) |> json(pack)

        {:error, changeset} ->
          errors = format_changeset_errors(changeset)
          conn |> put_status(400) |> json(%{error: "Invalid pack", details: errors})
      end
    else
      {:error, %Plug.Conn{} = conn} -> conn
    end
  end

  def patch_pack(conn, %{"id" => pack_id} = params) do
    with :ok <- require_admin(conn) do
      case Catalog.patch_admin_pack(pack_id, params) do
        {:ok, pack} ->
          json(conn, pack)

        {:error, :not_found} ->
          conn |> put_status(404) |> json(%{error: "Pack not found"})

        {:error, changeset} ->
          errors = format_changeset_errors(changeset)
          conn |> put_status(400) |> json(%{error: "Invalid pack", details: errors})
      end
    else
      {:error, %Plug.Conn{} = conn} -> conn
    end
  end

  def list_image_assets(conn, _params) do
    with :ok <- require_admin(conn) do
      json(conn, %{imageAssets: Media.list_catalog_assets()})
    else
      {:error, %Plug.Conn{} = conn} -> conn
    end
  end

  def list_card_back_visuals(conn, _params) do
    with :ok <- require_admin(conn) do
      json(conn, %{cardBackVisuals: Catalog.list_admin_card_back_visuals()})
    else
      {:error, %Plug.Conn{} = conn} -> conn
    end
  end

  def upsert_card_back_visual(conn, params) do
    with :ok <- require_admin(conn) do
      case Catalog.upsert_admin_card_back_visual(params) do
        {:ok, visual} ->
          json(conn, visual)

        {:error, changeset} ->
          errors = format_changeset_errors(changeset)
          conn |> put_status(400) |> json(%{error: "Invalid card back visual", details: errors})
      end
    else
      {:error, %Plug.Conn{} = conn} -> conn
    end
  end

  def create_image_asset(conn, _params) do
    with :ok <- require_admin(conn),
         {:ok, upload} <- fetch_upload(conn),
         binary_data <- File.read!(upload.path) do
      case Media.store_catalog_image(binary_data, upload.content_type) do
        {:ok, asset} ->
          conn |> put_status(201) |> json(asset)

        {:error, :unsupported_mime_type} ->
          conn
          |> put_status(:bad_request)
          |> json(%{error: "Unsupported image type. Allowed: PNG, JPEG, WEBP, SVG"})

        {:error, %Ecto.Changeset{} = changeset} ->
          errors = format_changeset_errors(changeset)
          conn |> put_status(400) |> json(%{error: "Invalid image asset", details: errors})

        {:error, reason} ->
          conn
          |> put_status(:internal_server_error)
          |> json(%{error: "Upload failed: #{inspect(reason)}"})
      end
    else
      {:error, %Plug.Conn{} = conn} ->
        conn

      {:error, :no_upload} ->
        conn |> put_status(:bad_request) |> json(%{error: "No file uploaded"})
    end
  end

  def list_cards(conn, _params) do
    with :ok <- require_admin(conn) do
      json(conn, %{cards: Catalog.list_admin_cards()})
    else
      {:error, %Plug.Conn{} = conn} -> conn
    end
  end

  def get_card(conn, %{"id" => card_id}) do
    with :ok <- require_admin(conn) do
      case Catalog.get_admin_card(card_id) do
        {:ok, card} -> json(conn, card)
        {:error, :not_found} -> conn |> put_status(404) |> json(%{error: "Card not found"})
      end
    else
      {:error, %Plug.Conn{} = conn} -> conn
    end
  end

  def create_card(conn, params) do
    with :ok <- require_admin(conn) do
      case Catalog.create_admin_card(params) do
        {:ok, card} ->
          conn |> put_status(201) |> json(card)

        {:error, changeset} ->
          errors = format_changeset_errors(changeset)
          conn |> put_status(400) |> json(%{error: "Invalid card", details: errors})
      end
    else
      {:error, %Plug.Conn{} = conn} -> conn
    end
  end

  def update_card(conn, %{"id" => card_id} = params) do
    with :ok <- require_admin(conn) do
      case Catalog.update_admin_card(card_id, params) do
        {:ok, card} ->
          json(conn, card)

        {:error, :not_found} ->
          conn |> put_status(404) |> json(%{error: "Card not found"})

        {:error, changeset} ->
          errors = format_changeset_errors(changeset)
          conn |> put_status(400) |> json(%{error: "Invalid card", details: errors})
      end
    else
      {:error, conn} -> conn
    end
  end

  def patch_card(conn, %{"id" => card_id} = params) do
    with :ok <- require_admin(conn) do
      case Catalog.patch_admin_card(card_id, params) do
        {:ok, card} ->
          json(conn, card)

        {:error, :not_found} ->
          conn |> put_status(404) |> json(%{error: "Card not found"})

        {:error, changeset} ->
          errors = format_changeset_errors(changeset)
          conn |> put_status(400) |> json(%{error: "Invalid card", details: errors})
      end
    else
      {:error, conn} -> conn
    end
  end

  def upload_card_image(conn, %{"id" => card_id}) do
    with :ok <- require_admin(conn),
         {:ok, upload} <- fetch_upload(conn),
         binary_data <- File.read!(upload.path) do
      case Catalog.attach_card_image(card_id, binary_data, upload.content_type) do
        {:ok, asset_id} ->
          json(conn, %{assetId: asset_id})

        {:error, :not_found} ->
          conn |> put_status(404) |> json(%{error: "Card not found"})

        {:error, reason} ->
          conn
          |> put_status(:internal_server_error)
          |> json(%{error: "Upload failed: #{inspect(reason)}"})
      end
    else
      {:error, %Plug.Conn{} = conn} ->
        conn

      {:error, :no_upload} ->
        conn |> put_status(:bad_request) |> json(%{error: "No file uploaded"})
    end
  end

  def user_detail(conn, %{"id" => user_id}) do
    case Accounts.admin_user_detail(user_id, conn.assigns.auth_user) do
      {:ok, detail} ->
        json(conn, detail)

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "User not found"})

      {:error, %AuthError{} = error} ->
        conn |> put_status(error.status_code) |> json(%{error: error.message, code: error.code})
    end
  end

  def adjust_user_coins(conn, %{"id" => user_id, "delta" => delta}) do
    case Accounts.adjust_user_coins(user_id, delta, conn.assigns.auth_user) do
      {:ok, response} ->
        json(conn, response)

      {:error, :not_found, message} ->
        conn |> put_status(:not_found) |> json(%{error: message})

      {:error, :validation, message} ->
        conn |> put_status(:bad_request) |> json(%{error: message})

      {:error, %AuthError{} = error} ->
        conn |> put_status(error.status_code) |> json(%{error: error.message, code: error.code})
    end
  end

  def adjust_user_coins(conn, _params) do
    conn |> put_status(:bad_request) |> json(%{error: "delta is required"})
  end

  def update_user_role(conn, %{"id" => user_id} = params) do
    case Accounts.update_user_role(user_id, params, conn.assigns.auth_user) do
      {:ok, user} ->
        json(conn, user)

      {:error, :not_found, message} ->
        conn |> put_status(:not_found) |> json(%{error: message})

      {:error, :validation, message} ->
        conn |> put_status(:bad_request) |> json(%{error: message})

      {:error, %AuthError{} = error} ->
        conn |> put_status(error.status_code) |> json(%{error: error.message, code: error.code})
    end
  end

  def reset_user_daily_quests(conn, %{"id" => user_id} = params) do
    case Accounts.reset_daily_quests_for_admin(user_id, params, conn.assigns.auth_user) do
      {:ok, response} ->
        json(conn, response)

      {:error, :not_found, message} ->
        conn |> put_status(:not_found) |> json(%{error: message})

      {:error, :validation, message} ->
        conn |> put_status(:bad_request) |> json(%{error: message})

      {:error, %AuthError{} = error} ->
        conn |> put_status(error.status_code) |> json(%{error: error.message, code: error.code})
    end
  end

  def delete_user(conn, %{"id" => user_id}) do
    case Accounts.delete_user(user_id, conn.assigns.auth_user) do
      {:ok, response} ->
        json(conn, response)

      {:error, :not_found, message} ->
        conn |> put_status(:not_found) |> json(%{error: message})

      {:error, :validation, message} ->
        conn |> put_status(:bad_request) |> json(%{error: message})

      {:error, %AuthError{} = error} ->
        conn |> put_status(error.status_code) |> json(%{error: error.message, code: error.code})
    end
  end

  def email_requests(conn, _params) do
    case Accounts.list_pending_access_requests(conn.assigns.auth_user) do
      {:ok, response} ->
        json(conn, response)

      {:error, %AuthError{} = error} ->
        conn |> put_status(error.status_code) |> json(%{error: error.message, code: error.code})
    end
  end

  def review_email_request(conn, %{"id" => request_id} = params) do
    case Accounts.review_access_request(request_id, params, conn.assigns.auth_user) do
      {:ok, response} ->
        json(conn, response)

      {:error, :not_found, message} ->
        conn |> put_status(:not_found) |> json(%{error: message})

      {:error, :validation, message} ->
        conn |> put_status(:bad_request) |> json(%{error: message})

      {:error, %AuthError{} = error} ->
        conn |> put_status(error.status_code) |> json(%{error: error.message, code: error.code})
    end
  end

  # ── Ability Admin ──────────────────────────────────────────────────────────

  def list_abilities(conn, _params) do
    with :ok <- require_admin(conn) do
      json(conn, Pvp.list_admin_abilities_data())
    else
      {:error, %Plug.Conn{} = conn} -> conn
    end
  end

  def create_ability(conn, params) do
    with :ok <- require_admin(conn) do
      attrs = %{
        key: params["key"],
        name: params["name"],
        name_fr: params["nameFr"],
        description: params["description"],
        description_fr: params["descriptionFr"],
        type: params["type"],
        cost: params["cost"] || 0,
        cooldown: params["cooldown"],
        once_per_match: params["oncePerMatch"] || false,
        payload: params["payload"] || %{}
      }

      case Pvp.create_ability_def(attrs) do
        {:ok, ability} ->
          conn |> put_status(201) |> json(%{ability: ability})

        {:error, changeset} ->
          errors = format_changeset_errors(changeset)
          conn |> put_status(400) |> json(%{error: "Invalid ability", details: errors})
      end
    else
      {:error, %Plug.Conn{} = conn} -> conn
    end
  end

  def update_ability(conn, %{"id" => id} = params) do
    with :ok <- require_admin(conn) do
      attrs =
        %{}
        |> maybe_put(:key, params["key"])
        |> maybe_put(:name, params["name"])
        |> maybe_put(:name_fr, params["nameFr"])
        |> maybe_put(:description, params["description"])
        |> maybe_put(:description_fr, params["descriptionFr"])
        |> maybe_put(:type, params["type"])
        |> maybe_put(:cost, params["cost"])
        |> maybe_put(:cooldown, params["cooldown"])
        |> maybe_put(:once_per_match, params["oncePerMatch"])
        |> maybe_put(:payload, params["payload"])

      case Pvp.update_ability_def(id, attrs) do
        {:ok, ability} ->
          json(conn, %{ability: ability})

        {:error, :not_found} ->
          conn |> put_status(404) |> json(%{error: "Ability not found"})

        {:error, changeset} ->
          errors = format_changeset_errors(changeset)
          conn |> put_status(400) |> json(%{error: "Invalid ability", details: errors})
      end
    else
      {:error, %Plug.Conn{} = conn} -> conn
    end
  end

  def delete_ability(conn, %{"id" => id}) do
    with :ok <- require_admin(conn) do
      case Pvp.delete_ability_def(id) do
        {:ok, _} -> json(conn, %{success: true})
        {:error, :not_found} -> conn |> put_status(404) |> json(%{error: "Ability not found"})
      end
    else
      {:error, %Plug.Conn{} = conn} -> conn
    end
  end

  def assign_card_ability(conn, %{"cardId" => card_id} = params) do
    with :ok <- require_admin(conn) do
      attrs = %{
        passive_id: params["passiveId"],
        skill_id: params["skillId"],
        ultimate_id: params["ultimateId"]
      }

      case Pvp.assign_card_ability(card_id, attrs) do
        {:ok, assignment} ->
          json(conn, %{cardAbility: assignment})

        {:error, changeset} ->
          errors = format_changeset_errors(changeset)
          conn |> put_status(400) |> json(%{error: "Invalid assignment", details: errors})
      end
    else
      {:error, %Plug.Conn{} = conn} -> conn
    end
  end

  def assign_card_ability(conn, _params) do
    conn |> put_status(400) |> json(%{error: "cardId is required"})
  end

  def remove_card_ability(conn, %{"card_id" => card_id}) do
    with :ok <- require_admin(conn) do
      case Pvp.remove_card_ability(card_id) do
        {:ok, _} -> json(conn, %{success: true})
        {:error, :not_found} -> conn |> put_status(404) |> json(%{error: "Assignment not found"})
      end
    else
      {:error, conn} -> conn
    end
  end

  defp require_admin(conn) do
    user = conn.assigns.auth_user

    if user && user.isAdmin do
      :ok
    else
      forbidden_conn =
        conn
        |> put_status(403)
        |> json(%{error: "Admin access required", code: "ADMIN_REQUIRED"})
        |> halt()

      {:error, forbidden_conn}
    end
  end

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)

  defp fetch_upload(conn) do
    case conn.body_params do
      %Plug.Upload{} = upload -> {:ok, upload}
      _ -> fetch_upload_from_params(conn.params)
    end
  end

  defp fetch_upload_from_params(%{"file" => %Plug.Upload{} = upload}), do: {:ok, upload}
  defp fetch_upload_from_params(_params), do: {:error, :no_upload}

  defp format_changeset_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end
end
