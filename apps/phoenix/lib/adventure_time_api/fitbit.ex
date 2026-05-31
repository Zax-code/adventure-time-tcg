defmodule AdventureTimeApi.Fitbit do
  @moduledoc """
  Fitbit OAuth, token management, subscriptions, and step sync.
  """

  import Ecto.Query

  alias AdventureTimeApi.Fitbit.Account
  alias AdventureTimeApi.Health
  alias AdventureTimeApi.Quests
  alias AdventureTimeApi.Repo
  alias AdventureTimeApiWeb.Endpoint

  @fitbit_auth_url "https://www.fitbit.com/oauth2/authorize"
  @fitbit_token_url "https://api.fitbit.com/oauth2/token"
  @fitbit_api_url "https://api.fitbit.com"
  @oauth_state_salt "fitbit_oauth_state"
  @oauth_max_age_seconds 600
  @refresh_buffer_seconds 300

  def configured? do
    present?(client_id()) and present?(client_secret())
  end

  def callback_uri do
    config(:redirect_uri) || "#{Endpoint.url()}/fitbit/callback"
  end

  def default_mobile_redirect_uri do
    config(:mobile_redirect_uri) || "adventure-time://settings"
  end

  def webhook_verification_code do
    config(:verification_code) || ""
  end

  def connected?(user_id) do
    Repo.exists?(from(account in Account, where: account.user_id == ^user_id))
  end

  def get_account(user_id) do
    Repo.get_by(Account, user_id: user_id)
  end

  def fitbit_status(user_id) do
    case get_account(user_id) do
      nil ->
        %{connected: false}

      %Account{} = account ->
        %{
          connected: true,
          userId: account.fitbit_user_id,
          connectedAt: account.inserted_at
        }
    end
  end

  def build_authorize_url(user_id, redirect_uri) do
    if configured?() do
      with {:ok, normalized_redirect_uri} <- normalize_redirect_uri(redirect_uri) do
        state =
          Phoenix.Token.sign(
            Endpoint,
            @oauth_state_salt,
            %{
              "user_id" => user_id,
              "redirect_uri" => normalized_redirect_uri
            }
          )

        params = %{
          "response_type" => "code",
          "client_id" => client_id(),
          "redirect_uri" => callback_uri(),
          "scope" => "activity",
          "state" => state,
          "prompt" => "login consent"
        }

        {:ok, "#{@fitbit_auth_url}?#{URI.encode_query(params)}"}
      end
    else
      {:error, :not_configured}
    end
  end

  def verify_state(state_token) when is_binary(state_token) do
    case Phoenix.Token.verify(Endpoint, @oauth_state_salt, state_token,
           max_age: @oauth_max_age_seconds
         ) do
      {:ok, %{"user_id" => user_id, "redirect_uri" => redirect_uri}} ->
        {:ok, %{user_id: user_id, redirect_uri: redirect_uri}}

      {:error, :expired} ->
        {:error, :expired_state}

      _ ->
        {:error, :invalid_state}
    end
  end

  def complete_oauth_link(user_id, code) do
    with true <- configured?() or {:error, :not_configured},
         {:ok, tokens} <- exchange_fitbit_code(code),
         :ok <- ensure_fitbit_account_available(user_id, tokens.user_id),
         {:ok, _account} <- upsert_account(user_id, tokens) do
      _ = create_fitbit_subscription(user_id)
      {:ok, :connected}
    end
  end

  def sync_steps_for_date(user_id, %Date{} = date) do
    with true <- connected?(user_id),
         {:ok, steps} <- get_steps_for_date(user_id, date),
         {:ok, _snapshot} <-
           Health.upsert_step_snapshot(user_id, "fitbit", steps, Date.to_iso8601(date)) do
      :ok = Quests.sync_steps_quest(user_id, date)
      {:ok, steps}
    else
      false -> {:error, :not_connected}
      {:error, _} = error -> error
      _ -> {:error, :sync_failed}
    end
  end

  def disconnect_account(user_id) do
    case get_account(user_id) do
      nil ->
        {:ok, :disconnected}

      %Account{} = account ->
        _ = delete_fitbit_subscription(account)
        _ = revoke_fitbit_token(account)

        case Repo.delete(account) do
          {:ok, _} -> {:ok, :disconnected}
          {:error, _} -> {:error, :disconnect_failed}
        end
    end
  end

  def verify_webhook_signature(body, signature) when is_binary(body) and is_binary(signature) do
    secret = client_secret()

    if present?(secret) do
      expected_signature =
        :crypto.mac(:hmac, :sha, "#{secret}&", body)
        |> Base.encode64()

      Plug.Crypto.secure_compare(expected_signature, signature)
    else
      false
    end
  end

  def process_webhook_notification(%{
        "collectionType" => "activities",
        "date" => date_string,
        "subscriptionId" => user_id
      }) do
    with {:ok, date} <- Date.from_iso8601(date_string),
         {:ok, _steps} <- sync_steps_for_date(user_id, date) do
      :ok
    else
      _ -> :ok
    end
  end

  def process_webhook_notification(_), do: :ok

  defp exchange_fitbit_code(code) do
    response =
      Req.post(@fitbit_token_url,
        headers: [{"authorization", "Basic #{basic_auth()}"}],
        form: [
          grant_type: "authorization_code",
          code: code,
          redirect_uri: callback_uri()
        ]
      )

    case response do
      {:ok, %Req.Response{status: status, body: body}} when status in 200..299 and is_map(body) ->
        {:ok,
         %{
           access_token: body["access_token"],
           refresh_token: body["refresh_token"],
           expires_in: body["expires_in"],
           user_id: body["user_id"],
           scope: body["scope"] || ""
         }}

      {:ok, %Req.Response{status: status}} ->
        {:error, {:token_exchange_failed, status}}

      {:error, _reason} ->
        {:error, :token_exchange_failed}
    end
  end

  defp refresh_access_token(%Account{} = account) do
    response =
      Req.post(@fitbit_token_url,
        headers: [{"authorization", "Basic #{basic_auth()}"}],
        form: [
          grant_type: "refresh_token",
          refresh_token: account.refresh_token
        ]
      )

    case response do
      {:ok, %Req.Response{status: status, body: body}} when status in 200..299 and is_map(body) ->
        token_expires_at =
          DateTime.utc_now()
          |> DateTime.add(body["expires_in"] || 0, :second)
          |> DateTime.truncate(:second)

        attrs = %{
          access_token: body["access_token"],
          refresh_token: body["refresh_token"],
          token_expires_at: token_expires_at
        }

        account
        |> Account.changeset(attrs)
        |> Repo.update()

      {:ok, %Req.Response{status: status}} ->
        {:error, {:token_refresh_failed, status}}

      {:error, _reason} ->
        {:error, :token_refresh_failed}
    end
  end

  defp get_valid_access_token(user_id) do
    case get_account(user_id) do
      nil ->
        {:error, :not_connected}

      %Account{} = account ->
        expires_at = account.token_expires_at || DateTime.utc_now()

        if DateTime.compare(
             DateTime.add(DateTime.utc_now(), @refresh_buffer_seconds, :second),
             expires_at
           ) in [:gt, :eq] do
          case refresh_access_token(account) do
            {:ok, refreshed_account} -> {:ok, refreshed_account.access_token}
            {:error, _} = error -> error
          end
        else
          {:ok, account.access_token}
        end
    end
  end

  def get_steps_for_date(user_id, %Date{} = date) do
    with {:ok, access_token} <- get_valid_access_token(user_id),
         {:ok, %Req.Response{status: status, body: body}}
         when status in 200..299 and is_map(body) <-
           Req.get(
             "#{@fitbit_api_url}/1/user/-/activities/date/#{Date.to_iso8601(date)}.json",
             headers: [{"authorization", "Bearer #{access_token}"}]
           ) do
      {:ok, get_in(body, ["summary", "steps"]) || 0}
    else
      {:ok, %Req.Response{status: status}} -> {:error, {:steps_fetch_failed, status}}
      {:error, _reason} = error -> error
      _ -> {:error, :steps_fetch_failed}
    end
  end

  defp upsert_account(user_id, tokens) do
    token_expires_at =
      DateTime.utc_now()
      |> DateTime.add(tokens.expires_in || 0, :second)
      |> DateTime.truncate(:second)

    attrs = %{
      user_id: user_id,
      fitbit_user_id: tokens.user_id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: token_expires_at,
      scope: tokens.scope
    }

    %Account{}
    |> Account.changeset(attrs)
    |> Repo.insert(
      on_conflict: [
        set: [
          fitbit_user_id: attrs.fitbit_user_id,
          access_token: attrs.access_token,
          refresh_token: attrs.refresh_token,
          token_expires_at: attrs.token_expires_at,
          scope: attrs.scope,
          updated_at: DateTime.utc_now() |> DateTime.truncate(:second)
        ]
      ],
      conflict_target: [:user_id]
    )
  end

  defp ensure_fitbit_account_available(user_id, fitbit_user_id) do
    case Repo.get_by(Account, fitbit_user_id: fitbit_user_id) do
      nil -> :ok
      %Account{user_id: ^user_id} -> :ok
      %Account{} -> {:error, :account_linked_elsewhere}
    end
  end

  defp create_fitbit_subscription(user_id) do
    with {:ok, access_token} <- get_valid_access_token(user_id),
         {:ok, %Req.Response{status: status}}
         when status in 200..299 or status == 409 <-
           Req.post(
             "#{@fitbit_api_url}/1/user/-/activities/apiSubscriptions/#{user_id}.json",
             headers: [{"authorization", "Bearer #{access_token}"}]
           ) do
      case get_account(user_id) do
        %Account{} = account ->
          account
          |> Account.changeset(%{subscription_id: user_id})
          |> Repo.update()

        nil ->
          {:error, :not_connected}
      end
    else
      {:ok, %Req.Response{status: status}} -> {:error, {:subscription_failed, status}}
      {:error, _reason} = error -> error
      _ -> {:error, :subscription_failed}
    end
  end

  defp delete_fitbit_subscription(%Account{subscription_id: nil}), do: :ok

  defp delete_fitbit_subscription(%Account{} = account) do
    with {:ok, access_token} <- get_valid_access_token(account.user_id),
         {:ok, %Req.Response{status: status}}
         when status in 200..299 or status == 404 <-
           Req.delete(
             "#{@fitbit_api_url}/1/user/-/activities/apiSubscriptions/#{account.subscription_id}.json",
             headers: [{"authorization", "Bearer #{access_token}"}]
           ) do
      :ok
    else
      _ -> :error
    end
  end

  defp revoke_fitbit_token(%Account{} = account) do
    Req.post("https://api.fitbit.com/oauth2/revoke",
      headers: [{"authorization", "Basic #{basic_auth()}"}],
      form: [token: account.access_token]
    )
  end

  defp basic_auth do
    Base.encode64("#{client_id()}:#{client_secret()}")
  end

  defp normalize_redirect_uri(redirect_uri) when is_binary(redirect_uri) do
    uri = URI.parse(redirect_uri)

    if present?(uri.scheme) do
      {:ok, redirect_uri}
    else
      {:error, :invalid_redirect_uri}
    end
  end

  defp normalize_redirect_uri(_), do: {:error, :invalid_redirect_uri}

  defp present?(value) when is_binary(value), do: String.trim(value) != ""
  defp present?(_), do: false

  defp client_id, do: config(:client_id)
  defp client_secret, do: config(:client_secret)
  defp config(key), do: Application.get_env(:adventure_time_api, __MODULE__, [])[key]
end
