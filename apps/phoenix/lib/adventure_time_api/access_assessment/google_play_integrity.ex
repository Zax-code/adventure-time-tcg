defmodule AdventureTimeApi.AccessAssessment.GooglePlayIntegrity do
  @moduledoc false

  @behaviour AdventureTimeApi.AccessAssessment.PlayIntegrity

  @default_endpoint "https://playintegrity.googleapis.com"
  @freshness_seconds 5 * 60
  @recognized_device_verdicts [
    "MEETS_BASIC_INTEGRITY",
    "MEETS_DEVICE_INTEGRITY",
    "MEETS_STRONG_INTEGRITY"
  ]

  @impl true
  def decode(token, expected, opts) when is_binary(token) do
    endpoint = Keyword.get(opts, :endpoint, @default_endpoint)
    package_name = Keyword.fetch!(opts, :package_name)
    timeout_ms = Keyword.get(opts, :timeout_ms, 3_000)
    access_token_provider = Keyword.fetch!(opts, :access_token_provider)

    with {:ok, access_token} <- access_token_provider.(),
         {:ok, %{status: 200, body: body}} <-
           Req.post("#{endpoint}/v1/#{package_name}:decodeIntegrityToken",
             headers: [{"authorization", "Bearer #{access_token}"}],
             json: %{"integrity_token" => token},
             receive_timeout: timeout_ms,
             connect_options: [timeout: timeout_ms]
           ),
         {:ok, evidence} <- normalize(body, expected, opts) do
      {:ok, evidence}
    else
      _error -> {:error, :provider_unavailable}
    end
  end

  defp normalize(body, expected, opts) when is_binary(body) do
    case Jason.decode(body) do
      {:ok, decoded} -> normalize(decoded, expected, opts)
      _error -> {:error, :invalid_verdict}
    end
  end

  defp normalize(%{"tokenPayloadExternal" => payload}, expected, opts) do
    request = payload["requestDetails"] || %{}
    app = payload["appIntegrity"] || %{}
    account = payload["accountDetails"] || %{}
    device = payload["deviceIntegrity"] || %{}
    now = Map.fetch!(expected, :now)

    with {:ok, token_timestamp} <- timestamp(request["timestampMillis"]),
         true <- fresh?(token_timestamp, now) do
      package_name = Keyword.fetch!(opts, :package_name)
      certificate_digests = Keyword.get(opts, :certificate_digests, [])
      released_version_codes = Keyword.get(opts, :released_version_codes, [])
      actual_certificates = app["certificateSha256Digest"] || []
      actual_version = to_string(app["versionCode"] || "")

      {:ok,
       %{
         app_recognition: app_recognition(app["appRecognitionVerdict"]),
         licensing: licensing(account["appLicensingVerdict"]),
         device_verdicts: normalize_device_verdicts(device["deviceRecognitionVerdict"]),
         package_name_verified:
           request["requestPackageName"] == package_name and app["packageName"] == package_name,
         certificate_verified:
           certificate_digests != [] and
             Enum.any?(actual_certificates, &(&1 in certificate_digests)),
         version_verified:
           released_version_codes != [] and actual_version in released_version_codes,
         request_hash_verified: request["requestHash"] == expected.request_hash,
         token_timestamp: token_timestamp,
         verified_at: now
       }}
    else
      _invalid_or_stale -> {:error, :invalid_verdict}
    end
  end

  defp normalize(_body, _expected, _opts), do: {:error, :invalid_verdict}

  defp timestamp(value) when is_integer(value) do
    case DateTime.from_unix(value, :millisecond) do
      {:ok, timestamp} -> {:ok, DateTime.truncate(timestamp, :second)}
      _error -> {:error, :invalid_timestamp}
    end
  end

  defp timestamp(value) when is_binary(value) do
    case Integer.parse(value) do
      {millis, ""} -> timestamp(millis)
      _error -> {:error, :invalid_timestamp}
    end
  end

  defp timestamp(_value), do: {:error, :invalid_timestamp}

  defp fresh?(timestamp, now) do
    delta = DateTime.diff(now, timestamp, :second)
    delta >= -30 and delta <= @freshness_seconds
  end

  defp app_recognition("PLAY_RECOGNIZED"), do: :play_recognized
  defp app_recognition("UNRECOGNIZED_VERSION"), do: :unrecognized_version
  defp app_recognition(_other), do: :unevaluated

  defp licensing("LICENSED"), do: :licensed
  defp licensing("UNLICENSED"), do: :unlicensed
  defp licensing(_other), do: :unevaluated

  defp normalize_device_verdicts(verdicts) when is_list(verdicts) do
    Enum.filter(verdicts, &(&1 in @recognized_device_verdicts))
  end

  defp normalize_device_verdicts(_other), do: []
end
