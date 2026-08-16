defmodule AdventureTimeApi.AccessAssessment.IpQualityScore do
  @moduledoc false

  @behaviour AdventureTimeApi.AccessAssessment.IpIntelligence

  @default_endpoint "https://ipqualityscore.com/api/json/ip"

  @impl true
  def lookup(%{ip_address: ip_address} = input, opts) do
    endpoint = Keyword.get(opts, :endpoint, @default_endpoint)
    api_key = Keyword.fetch!(opts, :api_key)
    timeout_ms = Keyword.get(opts, :timeout_ms, 3_000)

    case Req.get(endpoint,
           headers: [{"ipqs-key", api_key}],
           params: params(input, ip_address),
           receive_timeout: timeout_ms,
           connect_options: [timeout: timeout_ms]
         ) do
      {:ok, %{status: 200, body: body}} -> normalize(body)
      {:ok, _response} -> {:error, :provider_unavailable}
      {:error, _reason} -> {:error, :provider_unavailable}
    end
  end

  defp params(input, ip_address) do
    %{
      "ip" => ip_address,
      "strictness" => 0,
      "allow_public_access_points" => true,
      "lighter_penalties" => true,
      "user_agent" => input[:user_agent],
      "user_language" => input[:accept_language],
      "identityID" => input[:identity_pseudonym],
      "installationID" => input[:installation_pseudonym]
    }
    |> Enum.reject(fn {_key, value} -> is_nil(value) or value == "" end)
  end

  defp normalize(body) when is_binary(body) do
    case Jason.decode(body) do
      {:ok, decoded} -> normalize(decoded)
      {:error, _reason} -> {:error, :provider_unavailable}
    end
  end

  defp normalize(%{"success" => true, "fraud_score" => fraud_score} = body)
       when is_number(fraud_score) and fraud_score >= 0 and fraud_score <= 100 do
    {:ok,
     %{
       provider: "ipqualityscore",
       provider_request_id: body["request_id"],
       fraud_score: round(fraud_score),
       proxy: body["proxy"],
       vpn: body["vpn"],
       active_tor: body["active_tor"],
       bot_status: body["bot_status"],
       recent_abuse: body["recent_abuse"],
       frequent_abuser: body["frequent_abuser"],
       high_risk_attacks: body["high_risk_attacks"],
       public_access_point: body["public_access_point"],
       hosting: body["hosting"],
       shared_connection: body["shared_connection"],
       asn: body["ASN"] || body["asn"],
       organization: body["organization"],
       connection_type: body["connection_type"],
       country_code: body["country_code"]
     }}
  end

  defp normalize(_body), do: {:error, :provider_unavailable}
end
