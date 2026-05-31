defmodule AdventureTimeApiWeb.NotificationController do
  use AdventureTimeApiWeb, :controller

  alias AdventureTimeApi.Notifications

  def register_device(conn, params) do
    case Notifications.register_device(conn.assigns.auth_user.id, params) do
      {:ok, _device} ->
        json(conn, %{success: true})

      {:error, %Ecto.Changeset{} = changeset} ->
        message =
          changeset.errors
          |> Enum.map(fn {field, {detail, _}} -> "#{field} #{detail}" end)
          |> Enum.join(", ")

        conn |> put_status(:bad_request) |> json(%{error: message})

      {:error, :invalid_attributes} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "installationId, expoPushToken, and platform are required"})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{error: "Failed to register notification device", reason: inspect(reason)})
    end
  end

  def unregister_device(conn, %{"installation_id" => installation_id}) do
    :ok = Notifications.unregister_device(conn.assigns.auth_user.id, installation_id)
    json(conn, %{success: true})
  end

  def unregister_device(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{error: "installationId is required"})
  end
end
