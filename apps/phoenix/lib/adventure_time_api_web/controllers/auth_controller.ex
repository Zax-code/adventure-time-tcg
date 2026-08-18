defmodule AdventureTimeApiWeb.AuthController do
  use AdventureTimeApiWeb, :controller

  alias AdventureTimeApi.Accounts
  alias AdventureTimeApi.Accounts.AuthError
  alias AdventureTimeApiWeb.Plugs.RateLimit
  alias AdventureTimeApiWeb.RequestMetadata

  def register(conn, params) do
    conn = RateLimit.call(conn, bucket: :auth_register, key_strategy: :ip)

    if conn.halted do
      conn
    else
      case Accounts.register(params, RequestMetadata.from_conn(conn)) do
        {:ok, response} ->
          conn |> put_status(:created) |> json(response)

        {:error, :validation, message} ->
          conn |> put_status(:bad_request) |> json(%{error: message})

        {:error, :conflict, message} ->
          conn |> put_status(:conflict) |> json(%{error: message})

        {:error, :delivery, message} ->
          conn |> put_status(:internal_server_error) |> json(%{error: message})

        {:error, %AuthError{} = error} ->
          render_auth_error(conn, error)
      end
    end
  end

  def login(conn, params) do
    conn = RateLimit.call(conn, bucket: :auth_login, key_strategy: :ip_email)

    if conn.halted do
      conn
    else
      case Accounts.login(params, RequestMetadata.from_conn(conn)) do
        {:ok, response} ->
          json(conn, response)

        {:error, %AuthError{} = error} ->
          render_auth_error(conn, error)

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
      case Accounts.login_with_google(params, RequestMetadata.from_conn(conn)) do
        {:ok, response} ->
          json(conn, response)

        {:error, %AuthError{} = error} ->
          render_auth_error(conn, error)
      end
    end
  end

  def apple(conn, params) do
    conn = RateLimit.call(conn, bucket: :auth_apple, key_strategy: :ip)

    if conn.halted do
      conn
    else
      case Accounts.login_with_apple(params, RequestMetadata.from_conn(conn)) do
        {:ok, response} ->
          json(conn, response)

        {:error, %AuthError{} = error} ->
          render_auth_error(conn, error)
      end
    end
  end

  def refresh(conn, %{"refreshToken" => refresh_token}) do
    conn = RateLimit.call(conn, bucket: :auth_refresh, key_strategy: :token_or_ip)

    if conn.halted do
      conn
    else
      case Accounts.refresh(refresh_token, RequestMetadata.from_conn(conn)) do
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

  defp render_auth_error(conn, error) do
    payload =
      %{error: error.message, code: error.code}
      |> Map.merge(error.details || %{})

    conn |> put_status(error.status_code) |> json(payload)
  end
end
