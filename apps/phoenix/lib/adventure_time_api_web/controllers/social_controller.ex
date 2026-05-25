defmodule AdventureTimeApiWeb.SocialController do
  use AdventureTimeApiWeb, :controller

  alias AdventureTimeApi.Social

  def users(conn, _params) do
    {:ok, response} = Social.list_giftable_users(conn.assigns.auth_user)
    json(conn, response)
  end

  def gifts(conn, _params) do
    {:ok, response} = Social.gifts_for_user(conn.assigns.auth_user)
    json(conn, response)
  end

  def send_gift(conn, params) do
    case Social.send_gift(params, conn.assigns.auth_user) do
      {:ok, response} ->
        json(conn, response)

      {:error, :bad_request, message} ->
        conn |> put_status(:bad_request) |> json(%{error: message})

      {:error, :not_found, message} ->
        conn |> put_status(:not_found) |> json(%{error: message})
    end
  end

  def process_gift(conn, params) do
    case Social.process_gift(params, conn.assigns.auth_user) do
      {:ok, response} ->
        json(conn, response)

      {:error, :bad_request, message} ->
        conn |> put_status(:bad_request) |> json(%{error: message})

      {:error, :not_found, message} ->
        conn |> put_status(:not_found) |> json(%{error: message})

      {:error, :forbidden, message} ->
        conn |> put_status(:forbidden) |> json(%{error: message})
    end
  end
end
