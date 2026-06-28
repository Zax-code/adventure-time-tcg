defmodule AdventureTimeApi.Accounts.GoogleAuth do
  @moduledoc false

  alias AdventureTimeApi.Auth
  alias AdventureTimeApi.Accounts.AuthError

  def verify(%{id_token: id_token}) when is_binary(id_token) and id_token != "" do
    with {:ok, payload} <- fetch_json("#{id_token_info_url()}?id_token=#{URI.encode(id_token)}") do
      build_profile(payload)
    end
  end

  def verify(%{access_token: access_token}) when is_binary(access_token) and access_token != "" do
    with {:ok, payload} <-
           fetch_json("#{access_token_info_url()}?access_token=#{URI.encode(access_token)}"),
         {:ok, base_profile} <- build_profile(payload),
         {:ok, userinfo} <- fetch_userinfo(access_token) do
      {:ok,
       %{
         email: base_profile.email,
         subject: userinfo["sub"] || base_profile.subject,
         email_verified: base_profile.email_verified,
         name: userinfo["name"] || base_profile.name,
         picture: userinfo["picture"] || base_profile.picture
       }}
    else
      {:fallback_userinfo, _reason, base_profile} -> {:ok, base_profile}
      error -> error
    end
  end

  def verify(_input) do
    {:error,
     %AuthError{
       message: "Google authentication failed.",
       status_code: 400,
       code: "GOOGLE_AUTH_MISSING_TOKEN"
     }}
  end

  defp fetch_json(url) do
    case Req.get(url) do
      {:ok, %Req.Response{status: status, body: body}} when status in 200..299 and is_map(body) ->
        {:ok, body}

      _ ->
        {:error,
         %AuthError{
           message: "Google authentication failed.",
           status_code: 401,
           code: "GOOGLE_AUTH_FAILED"
         }}
    end
  end

  defp fetch_userinfo(access_token) do
    case Req.get(userinfo_url(), headers: [{"authorization", "Bearer #{access_token}"}]) do
      {:ok, %Req.Response{status: status, body: body}} when status in 200..299 and is_map(body) ->
        {:ok, body}

      other ->
        {:fallback_userinfo, other, nil}
    end
  end

  defp build_profile(payload) do
    allowed_audiences = Auth.google_client_ids()
    audience = payload["aud"]
    email = payload["email"]
    email_verified = payload["email_verified"] == "true" or payload["verified_email"] == "true"

    cond do
      allowed_audiences != [] and audience not in allowed_audiences ->
        {:error,
         %AuthError{
           message: "Google authentication failed.",
           status_code: 401,
           code: "GOOGLE_AUTH_FAILED"
         }}

      is_nil(email) or not email_verified ->
        {:error,
         %AuthError{
           message: "Your Google account does not have a verified email.",
           status_code: 401,
           code: "GOOGLE_EMAIL_UNVERIFIED"
         }}

      true ->
        {:ok,
         %{
           email: String.downcase(email),
           subject: payload["sub"],
           email_verified: email_verified,
           name: payload["name"],
           picture: payload["picture"]
         }}
    end
  end

  defp id_token_info_url do
    config()[:id_token_info_url] || "https://oauth2.googleapis.com/tokeninfo"
  end

  defp access_token_info_url do
    config()[:access_token_info_url] || "https://www.googleapis.com/oauth2/v3/tokeninfo"
  end

  defp userinfo_url do
    config()[:userinfo_url] || "https://openidconnect.googleapis.com/v1/userinfo"
  end

  defp config do
    Application.get_env(:adventure_time_api, __MODULE__, [])
  end
end
