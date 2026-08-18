defmodule AdventureTimeApi.AccessAssessment.ServiceAccountAccessToken do
  @moduledoc false

  @scope "https://www.googleapis.com/auth/playintegrity"
  @audience "https://oauth2.googleapis.com/token"

  def fetch(opts) do
    with path when is_binary(path) <- Keyword.get(opts, :credentials_path),
         {:ok, encoded} <- File.read(path),
         {:ok, credentials} <- Jason.decode(encoded),
         {:ok, assertion} <- assertion(credentials),
         {:ok, %{status: 200, body: body}} <- exchange(assertion, opts),
         token when is_binary(token) <- body["access_token"] do
      {:ok, token}
    else
      _error -> {:error, :credentials_unavailable}
    end
  end

  defp assertion(%{"client_email" => email, "private_key" => private_key}) do
    now = System.system_time(:second)

    claims = %{
      "iss" => email,
      "scope" => @scope,
      "aud" => @audience,
      "iat" => now,
      "exp" => now + 3_600
    }

    try do
      compact =
        private_key
        |> JOSE.JWK.from_pem()
        |> JOSE.JWT.sign(%{"alg" => "RS256", "typ" => "JWT"}, claims)
        |> JOSE.JWS.compact()
        |> elem(1)

      {:ok, compact}
    rescue
      _error -> {:error, :invalid_credentials}
    end
  end

  defp assertion(_credentials), do: {:error, :invalid_credentials}

  defp exchange(assertion, opts) do
    timeout_ms = Keyword.get(opts, :timeout_ms, 3_000)

    Req.post(@audience,
      form: [
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: assertion
      ],
      receive_timeout: timeout_ms,
      connect_options: [timeout: timeout_ms]
    )
  end
end
