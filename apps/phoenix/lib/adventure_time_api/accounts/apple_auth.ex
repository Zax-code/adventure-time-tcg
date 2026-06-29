defmodule AdventureTimeApi.Accounts.AppleAuth do
  @moduledoc false

  alias AdventureTimeApi.Accounts.AuthError
  alias AdventureTimeApi.Auth

  @issuer "https://appleid.apple.com"
  @algorithm "RS256"

  def verify(%{identity_token: identity_token, nonce: nonce})
      when is_binary(identity_token) and identity_token != "" and is_binary(nonce) and nonce != "" do
    with {:ok, header} <- decode_header(identity_token),
         {:ok, jwk} <- fetch_jwk(header),
         {:ok, claims} <- verify_claims(identity_token, jwk),
         :ok <- validate_claims(claims, nonce) do
      build_profile(claims)
    else
      {:error, %AuthError{} = error} -> {:error, error}
      _ -> {:error, apple_failed_error()}
    end
  end

  def verify(_input) do
    {:error,
     %AuthError{
       message: "Apple authentication failed.",
       status_code: 400,
       code: "APPLE_AUTH_MISSING_TOKEN"
     }}
  end

  defp decode_header(token) do
    case JOSE.JWT.peek_protected(token) do
      %JOSE.JWS{fields: %{"kid" => kid}} when is_binary(kid) ->
        {:ok, %{"kid" => kid}}

      _ ->
        {:error, apple_failed_error()}
    end
  end

  defp fetch_jwk(%{"kid" => kid}) do
    with {:ok, %Req.Response{status: status, body: %{"keys" => keys}}} when status in 200..299 <-
           Req.get(keys_url()),
         %{} = jwk <- Enum.find(keys, &(&1["kid"] == kid)) do
      {:ok, JOSE.JWK.from_map(jwk)}
    else
      _ -> {:error, apple_failed_error()}
    end
  end

  defp verify_claims(token, jwk) do
    case JOSE.JWT.verify_strict(jwk, [@algorithm], token) do
      {true, %JOSE.JWT{fields: claims}, _} -> {:ok, claims}
      _ -> {:error, apple_failed_error()}
    end
  end

  defp validate_claims(claims, nonce) do
    allowed_audiences = Auth.apple_client_ids()

    cond do
      claims["iss"] != @issuer ->
        {:error, apple_failed_error()}

      allowed_audiences != [] and claims["aud"] not in allowed_audiences ->
        {:error, apple_failed_error()}

      not valid_nonce?(claims["nonce"], nonce) ->
        {:error, apple_failed_error()}

      not valid_expiration?(claims["exp"]) ->
        {:error, apple_failed_error()}

      not is_binary(claims["sub"]) or claims["sub"] == "" ->
        {:error, apple_failed_error()}

      true ->
        :ok
    end
  end

  defp valid_expiration?(exp) when is_integer(exp),
    do: exp > DateTime.utc_now() |> DateTime.to_unix()

  defp valid_expiration?(_exp), do: false

  defp valid_nonce?(claim_nonce, raw_nonce)
       when is_binary(claim_nonce) and is_binary(raw_nonce) do
    claim_nonce == sha256_hex(raw_nonce)
  end

  defp valid_nonce?(_claim_nonce, _raw_nonce), do: false

  defp sha256_hex(value) do
    :crypto.hash(:sha256, value) |> Base.encode16(case: :lower)
  end

  defp build_profile(claims) do
    email = claims["email"]
    email_verified = claims["email_verified"] in [true, "true", "1"]

    {:ok,
     %{
       provider: "apple",
       email: if(email_verified && is_binary(email), do: String.downcase(email), else: nil),
       subject: claims["sub"],
       email_verified: email_verified,
       name: nil,
       picture: nil
     }}
  end

  defp keys_url do
    config()[:keys_url] || "https://appleid.apple.com/auth/keys"
  end

  defp config do
    Application.get_env(:adventure_time_api, __MODULE__, [])
  end

  defp apple_failed_error do
    %AuthError{
      message: "Apple authentication failed.",
      status_code: 401,
      code: "APPLE_AUTH_FAILED"
    }
  end
end
