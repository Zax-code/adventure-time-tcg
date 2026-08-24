defmodule AdventureTimeApiWeb.MediaController do
  use AdventureTimeApiWeb, :controller

  alias AdventureTimeApi.Media
  alias AdventureTimeApi.Media.UploadError

  def card(conn, %{"id" => id}), do: serve_image(conn, id, :card)
  def catalog(conn, %{"id" => id}), do: serve_image(conn, id, :catalog)
  def profile(conn, %{"id" => id}), do: serve_image(conn, id, :profile)

  def upload_profile(conn, _params) do
    case conn.body_params do
      %Plug.Upload{} = upload ->
        handle_profile_upload(conn, upload)

      _ ->
        case conn.params do
          %{"file" => %Plug.Upload{} = upload} ->
            handle_profile_upload(conn, upload)

          _ ->
            conn |> put_status(:bad_request) |> json(%{error: "No file uploaded"})
        end
    end
  end

  defp handle_profile_upload(conn, %Plug.Upload{} = upload) do
    user_id = conn.assigns.auth_user.id

    case Media.store_profile_image(user_id, upload) do
      {:ok, asset_id} ->
        json(conn, %{assetId: asset_id})

      {:error, %UploadError{} = error} ->
        conn
        |> put_status(error.status)
        |> json(%{error: error.message, code: error.code |> Atom.to_string() |> String.upcase()})

      {:error, _reason} ->
        conn
        |> put_status(:bad_gateway)
        |> json(%{error: "Image storage is unavailable", code: "IMAGE_STORAGE_ERROR"})
    end
  end

  defp serve_image(conn, id, kind) do
    case Media.get_image_asset(id, kind) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Image not found"})

      asset ->
        case Media.fetch_image(asset) do
          {:ok, body, mime_type} ->
            conn
            |> put_resp_header("content-type", mime_type || "image/svg+xml")
            |> put_resp_header("cache-control", cache_control(kind))
            |> send_resp(200, body)

          {:error, _reason} ->
            conn
            |> put_status(:bad_gateway)
            |> json(%{error: "Failed to load image"})
        end
    end
  end

  defp cache_control(:card), do: Media.card_cache_control()
  defp cache_control(:catalog), do: Media.catalog_cache_control()
  defp cache_control(:profile), do: Media.profile_cache_control()
end
