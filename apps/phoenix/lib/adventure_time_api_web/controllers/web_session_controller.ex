defmodule AdventureTimeApiWeb.WebSessionController do
  use AdventureTimeApiWeb, :controller

  alias AdventureTimeApi.Accounts
  alias AdventureTimeApi.Accounts.AuthError
  alias AdventureTimeApi.Auth
  alias AdventureTimeApiWeb.Plugs.RateLimit
  alias AdventureTimeApiWeb.RequestMetadata

  def auth_config(conn, _params) do
    config = controller_config()
    google_client_id = present_config(config[:google_client_id])
    apple_client_id = present_config(config[:apple_client_id])
    apple_redirect_uri = present_config(config[:apple_redirect_uri])

    apple =
      if apple_client_id && valid_apple_redirect_uri?(apple_redirect_uri) do
        %{clientId: apple_client_id, redirectUri: apple_redirect_uri}
      end

    conn
    |> prepare_response()
    |> json(%{googleClientId: google_client_id, apple: apple})
  end

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

  def google(conn, params) do
    conn =
      conn
      |> prepare_response()
      |> RateLimit.call(bucket: :auth_google, key_strategy: :ip)

    if conn.halted do
      conn
    else
      provider_session(conn, Accounts.login_with_google(params, RequestMetadata.from_conn(conn)))
    end
  end

  def apple(conn, params) do
    conn =
      conn
      |> prepare_response()
      |> RateLimit.call(bucket: :auth_apple, key_strategy: :ip)

    if conn.halted do
      conn
    else
      provider_session(conn, Accounts.login_with_apple(params, RequestMetadata.from_conn(conn)))
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

  defp provider_session(conn, result) do
    case result do
      {:ok, response} ->
        put_session_response(conn, response)

      {:error, %AuthError{} = error} ->
        conn
        |> put_status(error.status_code)
        |> json(%{error: error.message, code: error.code})
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
    config = controller_config()

    [
      http_only: true,
      path: "/",
      same_site: "Strict",
      secure: Keyword.fetch!(config, :refresh_cookie_secure)
    ]
  end

  defp refresh_cookie_name do
    controller_config()
    |> Keyword.fetch!(:refresh_cookie_name)
  end

  defp controller_config do
    Application.fetch_env!(:adventure_time_api, __MODULE__)
  end

  defp present_config(value) when is_binary(value) do
    case String.trim(value) do
      "" -> nil
      configured -> configured
    end
  end

  defp present_config(_value), do: nil

  defp valid_apple_redirect_uri?(value) when is_binary(value) do
    case URI.parse(value) do
      %URI{scheme: "https", host: host} when is_binary(host) and host != "" -> true
      _ -> false
    end
  end

  defp valid_apple_redirect_uri?(_value), do: false
end
