defmodule AdventureTimeApi.Auth do
  @moduledoc false

  @algorithm "HS256"

  def sign_access_token(claims) do
    claims
    |> Map.put("type", "access")
    |> sign(ttl_seconds())
  end

  def sign_refresh_token(session_id, user_id) do
    %{"sub" => user_id, "sid" => session_id, "type" => "refresh"}
    |> sign(refresh_ttl_days() * 24 * 60 * 60)
  end

  def verify_access_token(token) do
    with {:ok, claims} <- verify(token, access_secret()),
         "access" <- claims["type"],
         true <- is_binary(claims["sub"]) do
      {:ok, claims}
    else
      _ -> {:error, :invalid_token}
    end
  end

  def verify_refresh_token(token) do
    with {:ok, claims} <- verify_signed(token, refresh_secret()),
         "refresh" <- claims["type"],
         true <- is_binary(claims["sub"]),
         true <- is_binary(claims["sid"]),
         true <- is_integer(claims["exp"]) do
      {:ok, claims}
    else
      _ -> {:error, :invalid_token}
    end
  end

  def ttl_seconds, do: config()[:access_token_ttl_seconds] || 15 * 60
  def refresh_ttl_days, do: config()[:refresh_token_ttl_days] || 30
  def google_client_ids, do: config()[:google_client_ids] || []

  defp sign(claims, ttl_seconds) do
    now = DateTime.utc_now() |> DateTime.to_unix()

    claims =
      claims
      |> Map.put_new("iat", now)
      |> Map.put_new("exp", now + ttl_seconds)

    signer = JOSE.JWK.from_oct(access_secret_for_claims(claims))

    token =
      JOSE.JWT.sign(signer, %{"alg" => @algorithm}, claims)
      |> JOSE.JWS.compact()

    case token do
      {:ok, signed} -> {:ok, signed}
      {_, signed} -> {:ok, signed}
      _ -> {:error, :token_sign_failed}
    end
  end

  defp verify(token, secret) do
    with {:ok, claims} <- verify_signed(token, secret) do
      verify_expiration(claims)
    end
  end

  defp verify_signed(token, secret) do
    signer = JOSE.JWK.from_oct(secret)

    case JOSE.JWT.verify_strict(signer, [@algorithm], token) do
      {true, %JOSE.JWT{fields: claims}, _} -> {:ok, claims}
      _ -> {:error, :invalid_token}
    end
  end

  defp verify_expiration(%{"exp" => exp} = claims) when is_integer(exp) do
    if exp > DateTime.utc_now() |> DateTime.to_unix() do
      {:ok, claims}
    else
      {:error, :invalid_token}
    end
  end

  defp verify_expiration(_claims), do: {:error, :invalid_token}

  defp access_secret_for_claims(%{"type" => "refresh"}), do: refresh_secret()
  defp access_secret_for_claims(_claims), do: access_secret()

  defp access_secret do
    config()[:access_token_secret] || raise "missing access token secret"
  end

  defp refresh_secret do
    config()[:refresh_token_secret] || raise "missing refresh token secret"
  end

  defp config do
    Application.fetch_env!(:adventure_time_api, __MODULE__)
  end
end
