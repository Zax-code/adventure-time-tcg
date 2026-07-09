defmodule AdventureTimeApiWeb.WebSessionController do
  use AdventureTimeApiWeb, :controller

  alias AdventureTimeApi.Accounts
  alias AdventureTimeApi.Accounts.AuthError
  alias AdventureTimeApi.Auth
  alias AdventureTimeApiWeb.Plugs.RateLimit
  alias AdventureTimeApiWeb.RequestMetadata

  def create(conn, params) do
    conn =
      conn
      |> prepare_response()
      |> RateLimit.call(bucket: :auth_login, key_strategy: :ip_email)

    if conn.halted do
      conn
    else
      case Accounts.login(params, RequestMetadata.from_conn(conn)) do
        {:ok, response} ->
          put_session_response(conn, response)

        {:error, %AuthError{} = error} ->
          conn
          |> put_status(error.status_code)
          |> json(%{error: error.message, code: error.code})

        {:error, _reason, message} ->
          conn |> put_status(:unauthorized) |> json(%{error: message})
      end
    end
  end

  def refresh(conn, _params) do
    conn =
      conn
      |> fetch_cookies()
      |> prepare_response()
      |> RateLimit.call(
        bucket: :auth_refresh,
        key_strategy: {:cookie_token_or_ip, refresh_cookie_name()}
      )

    if conn.halted do
      conn
    else
      case Map.get(conn.req_cookies, refresh_cookie_name()) do
        refresh_token when is_binary(refresh_token) and refresh_token != "" ->
          refresh_session(conn, refresh_token)

        _missing ->
          conn
          |> clear_refresh_cookie()
          |> put_status(:unauthorized)
          |> json(%{error: "Web session is missing", code: "WEB_SESSION_MISSING"})
      end
    end
  end

  def delete(conn, _params) do
    conn =
      conn
      |> fetch_cookies()
      |> prepare_response()
      |> RateLimit.call(
        bucket: :auth_logout,
        key_strategy: {:cookie_token_or_ip, refresh_cookie_name()}
      )

    if conn.halted do
      conn
    else
      case Map.get(conn.req_cookies, refresh_cookie_name()) do
        refresh_token when is_binary(refresh_token) and refresh_token != "" ->
          _ = Accounts.logout(refresh_token)

        _missing ->
          :ok
      end

      conn
      |> clear_refresh_cookie()
      |> send_resp(:no_content, "")
    end
  end

  defp refresh_session(conn, refresh_token) do
    case Accounts.refresh(refresh_token, RequestMetadata.from_conn(conn)) do
      {:ok, response} ->
        put_session_response(conn, response)

      {:error, "ACCESS_REQUEST_PENDING", message} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: message, code: "ACCESS_REQUEST_PENDING"})

      {:error, _reason, message} ->
        conn
        |> clear_refresh_cookie()
        |> put_status(:unauthorized)
        |> json(%{error: message, code: "WEB_SESSION_INVALID"})
    end
  end

  defp put_session_response(conn, response) do
    conn
    |> put_refresh_cookie(response.tokens.refreshToken)
    |> json(%{
      user: response.user,
      accessToken: response.tokens.accessToken
    })
  end

  defp prepare_response(conn) do
    conn
    |> put_resp_header("cache-control", "no-store")
    |> put_resp_header("pragma", "no-cache")
    |> put_resp_header("vary", "Cookie")
    |> put_resp_header("x-content-type-options", "nosniff")
  end

  defp put_refresh_cookie(conn, refresh_token) do
    put_resp_cookie(
      conn,
      refresh_cookie_name(),
      refresh_token,
      Keyword.put(cookie_options(), :max_age, Auth.refresh_ttl_days() * 24 * 60 * 60)
    )
  end

  defp clear_refresh_cookie(conn) do
    delete_resp_cookie(conn, refresh_cookie_name(), cookie_options())
  end

  defp cookie_options do
    config = Application.fetch_env!(:adventure_time_api, __MODULE__)

    [
      http_only: true,
      path: "/",
      same_site: "Strict",
      secure: Keyword.fetch!(config, :refresh_cookie_secure)
    ]
  end

  defp refresh_cookie_name do
    :adventure_time_api
    |> Application.fetch_env!(__MODULE__)
    |> Keyword.fetch!(:refresh_cookie_name)
  end
end
