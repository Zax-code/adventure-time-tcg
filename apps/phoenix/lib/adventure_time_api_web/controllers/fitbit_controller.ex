defmodule AdventureTimeApiWeb.FitbitController do
  use AdventureTimeApiWeb, :controller

  alias AdventureTimeApi.Fitbit

  def authorize(conn, params) do
    redirect_uri = Map.get(params, "redirectUri", Fitbit.default_mobile_redirect_uri())

    case Fitbit.build_authorize_url(conn.assigns.auth_user.id, redirect_uri) do
      {:ok, authorize_url} ->
        json(conn, %{authorizeUrl: authorize_url})

      {:error, :invalid_redirect_uri} ->
        conn |> put_status(:bad_request) |> json(%{error: "Invalid redirectUri"})

      {:error, :not_configured} ->
        conn |> put_status(:service_unavailable) |> json(%{error: "Fitbit is not configured"})
    end
  end

  def status(conn, _params) do
    json(conn, Fitbit.fitbit_status(conn.assigns.auth_user.id))
  end

  def disconnect(conn, _params) do
    case Fitbit.disconnect_account(conn.assigns.auth_user.id) do
      {:ok, :disconnected} ->
        json(conn, %{success: true})

      {:error, _reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{error: "Failed to disconnect Fitbit"})
    end
  end

  def callback(conn, params) do
    redirect_uri =
      case Map.get(params, "state") do
        nil ->
          Fitbit.default_mobile_redirect_uri()

        state_token ->
          case Fitbit.verify_state(state_token) do
            {:ok, %{redirect_uri: verified_redirect_uri}} ->
              verified_redirect_uri

            _ ->
              Fitbit.default_mobile_redirect_uri()
          end
      end

    cond do
      is_binary(params["error"]) ->
        redirect(conn, external: redirect_with_status(redirect_uri, "error", params["error"]))

      is_nil(params["code"]) or is_nil(params["state"]) ->
        redirect(conn, external: redirect_with_status(redirect_uri, "error", "missing_params"))

      true ->
        case Fitbit.verify_state(params["state"]) do
          {:ok, %{user_id: user_id, redirect_uri: verified_redirect_uri}} ->
            case Fitbit.complete_oauth_link(user_id, params["code"]) do
              {:ok, :connected} ->
                redirect(conn,
                  external: redirect_with_status(verified_redirect_uri, "connected", nil)
                )

              {:error, :account_linked_elsewhere} ->
                redirect(
                  conn,
                  external:
                    redirect_with_status(
                      verified_redirect_uri,
                      "error",
                      "account_linked_elsewhere"
                    )
                )

              {:error, :not_configured} ->
                redirect(conn,
                  external: redirect_with_status(verified_redirect_uri, "error", "not_configured")
                )

              {:error, _reason} ->
                redirect(
                  conn,
                  external:
                    redirect_with_status(verified_redirect_uri, "error", "exchange_failed")
                )
            end

          {:error, reason} ->
            redirect(
              conn,
              external:
                redirect_with_status(
                  redirect_uri,
                  "error",
                  Atom.to_string(reason)
                )
            )
        end
    end
  end

  def webhook_verify(conn, %{"verify" => verify_code}) do
    if verify_code == Fitbit.webhook_verification_code() and verify_code != "" do
      send_resp(conn, 204, "")
    else
      send_resp(conn, 404, "Invalid verification code")
    end
  end

  def webhook_verify(conn, _params) do
    send_resp(conn, 400, "Missing verify parameter")
  end

  def webhook(conn, _params) do
    raw_body = conn.private[:raw_body] || ""
    signature = List.first(get_req_header(conn, "x-fitbit-signature")) || ""

    if Fitbit.verify_webhook_signature(raw_body, signature) do
      case Jason.decode(raw_body) do
        {:ok, notifications} when is_list(notifications) ->
          Enum.each(notifications, &Fitbit.process_webhook_notification/1)
          send_resp(conn, 204, "")

        _ ->
          send_resp(conn, 400, "Invalid JSON")
      end
    else
      send_resp(conn, 401, "Invalid signature")
    end
  end

  defp redirect_with_status(uri, "connected", nil) do
    append_query(uri, %{"fitbit" => "connected"})
  end

  defp redirect_with_status(uri, "error", reason) do
    append_query(uri, %{"fitbit" => "error", "reason" => reason || "unknown"})
  end

  defp append_query(uri, params) do
    parsed = URI.parse(uri)
    current = URI.decode_query(parsed.query || "")
    next_query = Map.merge(current, params) |> URI.encode_query()
    URI.to_string(%{parsed | query: next_query})
  end
end
