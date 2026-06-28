defmodule AdventureTimeApiWeb.AuthController do
  use AdventureTimeApiWeb, :controller

  alias AdventureTimeApi.Accounts
  alias AdventureTimeApi.Accounts.AuthError
  alias AdventureTimeApiWeb.Plugs.RateLimit

  def register(conn, params) do
    conn = RateLimit.call(conn, bucket: :auth_register, key_strategy: :ip)

    if conn.halted do
      conn
    else
      case Accounts.register(params, request_metadata(conn)) do
        {:ok, response} ->
          conn |> put_status(:created) |> json(response)

        {:error, :validation, message} ->
          conn |> put_status(:bad_request) |> json(%{error: message})

        {:error, :conflict, message} ->
          conn |> put_status(:conflict) |> json(%{error: message})

        {:error, :delivery, message} ->
          conn |> put_status(:internal_server_error) |> json(%{error: message})

        {:error, %AuthError{} = error} ->
          conn |> put_status(error.status_code) |> json(%{error: error.message, code: error.code})
      end
    end
  end

  def login(conn, params) do
    conn = RateLimit.call(conn, bucket: :auth_login, key_strategy: :ip_email)

    if conn.halted do
      conn
    else
      case Accounts.login(params, request_metadata(conn)) do
        {:ok, response} ->
          json(conn, response)

        {:error, %AuthError{} = error} ->
          conn |> put_status(error.status_code) |> json(%{error: error.message, code: error.code})

        {:error, _reason, message} ->
          conn |> put_status(:unauthorized) |> json(%{error: message})
      end
    end
  end

  def verify_email(conn, params) do
    conn = RateLimit.call(conn, bucket: :auth_verify_email, key_strategy: :ip)

    if conn.halted do
      conn
    else
      case Accounts.verify_email(params) do
        {:ok, response} ->
          json(conn, response)

        {:error, :validation, message} ->
          conn |> put_status(:bad_request) |> json(%{error: message})

        {:error, :invalid_code, message} ->
          conn |> put_status(:bad_request) |> json(%{error: message})

        {:error, :expired, message} ->
          conn |> put_status(:gone) |> json(%{error: message})

        {:error, :not_found, message} ->
          conn |> put_status(:not_found) |> json(%{error: message})
      end
    end
  end

  def resend_verification(conn, params) do
    conn = RateLimit.call(conn, bucket: :auth_resend_verification, key_strategy: :ip)

    if conn.halted do
      conn
    else
      case Accounts.resend_verification(params) do
        {:ok, response} ->
          json(conn, response)

        {:error, :validation, message} ->
          conn |> put_status(:bad_request) |> json(%{error: message})

        {:error, :conflict, message} ->
          conn |> put_status(:conflict) |> json(%{error: message})

        {:error, :not_found, message} ->
          conn |> put_status(:not_found) |> json(%{error: message})

        {:error, :delivery, message} ->
          conn |> put_status(:internal_server_error) |> json(%{error: message})
      end
    end
  end

  def request_password_reset(conn, params) do
    conn = RateLimit.call(conn, bucket: :auth_request_password_reset, key_strategy: :ip_email)

    if conn.halted do
      conn
    else
      case Accounts.request_password_reset(params) do
        {:ok, response} ->
          json(conn, response)

        {:error, :validation, message} ->
          conn |> put_status(:bad_request) |> json(%{error: message})
      end
    end
  end

  def reset_password(conn, params) do
    conn = RateLimit.call(conn, bucket: :auth_reset_password, key_strategy: :ip_email)

    if conn.halted do
      conn
    else
      case Accounts.reset_password(params) do
        {:ok, response} ->
          json(conn, response)

        {:error, :validation, message} ->
          conn |> put_status(:bad_request) |> json(%{error: message})

        {:error, :invalid_code, message} ->
          conn |> put_status(:bad_request) |> json(%{error: message})

        {:error, :expired, message} ->
          conn |> put_status(:gone) |> json(%{error: message})

        {:error, :not_found, message} ->
          conn |> put_status(:not_found) |> json(%{error: message})
      end
    end
  end

  def google(conn, params) do
    conn = RateLimit.call(conn, bucket: :auth_google, key_strategy: :ip)

    if conn.halted do
      conn
    else
      case Accounts.login_with_google(params, request_metadata(conn)) do
        {:ok, response} ->
          json(conn, response)

        {:error, %AuthError{} = error} ->
          conn
          |> put_status(error.status_code)
          |> json(%{error: error.message, code: error.code})
      end
    end
  end

  def apple(conn, params) do
    conn = RateLimit.call(conn, bucket: :auth_apple, key_strategy: :ip)

    if conn.halted do
      conn
    else
      case Accounts.login_with_apple(params, request_metadata(conn)) do
        {:ok, response} ->
          json(conn, response)

        {:error, %AuthError{} = error} ->
          conn
          |> put_status(error.status_code)
          |> json(%{error: error.message, code: error.code})
      end
    end
  end

  def refresh(conn, %{"refreshToken" => refresh_token}) do
    conn = RateLimit.call(conn, bucket: :auth_refresh, key_strategy: :token_or_ip)

    if conn.halted do
      conn
    else
      case Accounts.refresh(refresh_token, request_metadata(conn)) do
        {:ok, response} ->
          json(conn, response)

        {:error, "ACCESS_REQUEST_PENDING", message} ->
          conn
          |> put_status(:forbidden)
          |> json(%{error: message, code: "ACCESS_REQUEST_PENDING"})

        {:error, _reason, message} ->
          conn |> put_status(:unauthorized) |> json(%{error: message})
      end
    end
  end

  def refresh(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{error: "Missing refresh token"})
  end

  def logout(conn, %{"refreshToken" => refresh_token}) do
    _ = Accounts.logout(refresh_token)
    send_resp(conn, :no_content, "")
  end

  def logout(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{error: "Missing refresh token"})
  end

  defp request_metadata(conn) do
    %{
      request_id: response_header(conn, "x-request-id") || request_header(conn, "x-request-id"),
      user_agent: List.first(get_req_header(conn, "user-agent")),
      ip_address: forwarded_ip(conn) || ip_to_string(conn.remote_ip),
      accept_language: request_header(conn, "accept-language"),
      client_platform: request_header(conn, "x-adventure-time-platform"),
      client_app_version: request_header(conn, "x-adventure-time-app-version"),
      client_build_number: request_header(conn, "x-adventure-time-build-number"),
      installation_id: request_header(conn, "x-adventure-time-installation-id"),
      attestation_status: request_header(conn, "x-adventure-time-attestation") || "not_provided"
    }
  end

  defp forwarded_ip(conn) do
    conn
    |> request_header("x-forwarded-for")
    |> case do
      nil -> request_header(conn, "x-real-ip")
      value -> value |> String.split(",") |> List.first() |> String.trim()
    end
  end

  defp request_header(conn, name), do: conn |> get_req_header(name) |> List.first()
  defp response_header(conn, name), do: conn |> get_resp_header(name) |> List.first()

  defp ip_to_string(nil), do: nil
  defp ip_to_string(tuple) when is_tuple(tuple), do: tuple |> Tuple.to_list() |> Enum.join(".")
end
