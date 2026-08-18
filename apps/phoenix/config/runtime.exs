import Config

truthy? = fn value -> value in ["1", "true", "TRUE", "yes", "YES"] end

assessment_collection_enabled =
  truthy?.(System.get_env("ACCESS_ASSESSMENT_COLLECTION_ENABLED"))

config :adventure_time_api, AdventureTimeApi.AccessAssessment,
  collection_enabled: assessment_collection_enabled,
  admin_display_enabled: truthy?.(System.get_env("ACCESS_ASSESSMENT_ADMIN_DISPLAY_ENABLED"))

if assessment_collection_enabled do
  ipqs_api_key =
    System.get_env("IPQS_API_KEY") ||
      raise("environment variable IPQS_API_KEY is required when assessment collection is enabled")

  if String.trim(ipqs_api_key) == "" do
    raise("IPQS_API_KEY must not be empty when assessment collection is enabled")
  end

  pseudonym_secret_path =
    System.get_env("ACCESS_ASSESSMENT_PSEUDONYM_SECRET_PATH") ||
      raise(
        "environment variable ACCESS_ASSESSMENT_PSEUDONYM_SECRET_PATH is required when assessment collection is enabled"
      )

  pseudonym_secret =
    pseudonym_secret_path
    |> File.read!()
    |> String.trim()

  if byte_size(pseudonym_secret) < 32 do
    raise("ACCESS_ASSESSMENT_PSEUDONYM_SECRET_PATH must contain at least 32 bytes")
  end

  play_credentials_path =
    System.get_env("PLAY_INTEGRITY_SERVICE_ACCOUNT_PATH") ||
      raise(
        "environment variable PLAY_INTEGRITY_SERVICE_ACCOUNT_PATH is required when assessment collection is enabled"
      )

  play_credentials =
    play_credentials_path
    |> File.read!()
    |> Jason.decode!()

  unless is_binary(play_credentials["client_email"]) and
           is_binary(play_credentials["private_key"]) do
    raise("PLAY_INTEGRITY_SERVICE_ACCOUNT_PATH must contain client_email and private_key fields")
  end

  play_cloud_project_number =
    System.get_env("PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER") ||
      raise(
        "environment variable PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER is required when assessment collection is enabled"
      )

  case Integer.parse(play_cloud_project_number) do
    {value, ""} when value > 0 -> :ok
    _invalid -> raise("PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER must be a positive integer")
  end

  play_certificate_digests =
    (System.get_env("PLAY_INTEGRITY_CERTIFICATE_DIGESTS") || "")
    |> String.split(",", trim: true)
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))

  released_version_codes =
    (System.get_env("PLAY_INTEGRITY_RELEASED_VERSION_CODES") || "")
    |> String.split(",", trim: true)
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))

  released_builds =
    (System.get_env("ACCESS_ASSESSMENT_RELEASED_BUILDS") || "")
    |> String.split(",", trim: true)
    |> Enum.reduce(%{}, fn entry, builds ->
      case String.split(entry, ":") do
        ["android", version, build_number, version_code]
        when version != "" and build_number != "" and version_code != "" ->
          Map.update(
            builds,
            "android",
            [%{version: version, build_number: build_number, version_code: version_code}],
            &[
              %{version: version, build_number: build_number, version_code: version_code} | &1
            ]
          )

        ["ios", version, build_number]
        when version != "" and build_number != "" ->
          Map.update(
            builds,
            "ios",
            [%{version: version, build_number: build_number}],
            &[%{version: version, build_number: build_number} | &1]
          )

        _invalid ->
          raise(
            "ACCESS_ASSESSMENT_RELEASED_BUILDS must contain android:version:build:version-code or ios:version:build entries"
          )
      end
    end)

  released_build_registry_version =
    System.get_env("ACCESS_ASSESSMENT_RELEASED_BUILD_REGISTRY_VERSION") ||
      raise(
        "environment variable ACCESS_ASSESSMENT_RELEASED_BUILD_REGISTRY_VERSION is required when assessment collection is enabled"
      )

  scoring_model_version =
    System.get_env("ACCESS_ASSESSMENT_SCORING_MODEL_VERSION") ||
      raise(
        "environment variable ACCESS_ASSESSMENT_SCORING_MODEL_VERSION is required when assessment collection is enabled"
      )

  test_lab_range_version =
    System.get_env("ACCESS_ASSESSMENT_TEST_LAB_RANGE_VERSION") ||
      raise(
        "environment variable ACCESS_ASSESSMENT_TEST_LAB_RANGE_VERSION is required when assessment collection is enabled"
      )

  google_range_version =
    System.get_env("ACCESS_ASSESSMENT_GOOGLE_RANGE_VERSION") ||
      raise(
        "environment variable ACCESS_ASSESSMENT_GOOGLE_RANGE_VERSION is required when assessment collection is enabled"
      )

  if play_certificate_digests == [] do
    raise(
      "environment variable PLAY_INTEGRITY_CERTIFICATE_DIGESTS is required when assessment collection is enabled"
    )
  end

  unless Enum.all?(play_certificate_digests, fn digest ->
           normalized = String.trim_trailing(digest, "=")

           case Base.url_decode64(normalized, padding: false) do
             {:ok, decoded} -> byte_size(decoded) == 32
             :error -> false
           end
         end) do
    raise("PLAY_INTEGRITY_CERTIFICATE_DIGESTS must contain base64url SHA-256 digests")
  end

  if released_version_codes == [] do
    raise(
      "environment variable PLAY_INTEGRITY_RELEASED_VERSION_CODES is required when assessment collection is enabled"
    )
  end

  unless Enum.all?(released_version_codes, fn version ->
           case Integer.parse(version) do
             {value, ""} when value > 0 -> true
             _invalid -> false
           end
         end) do
    raise("PLAY_INTEGRITY_RELEASED_VERSION_CODES must contain positive integers")
  end

  if map_size(released_builds) == 0 do
    raise(
      "environment variable ACCESS_ASSESSMENT_RELEASED_BUILDS is required when assessment collection is enabled"
    )
  end

  android_registry_codes =
    released_builds
    |> Map.get("android", [])
    |> Enum.map(& &1.version_code)

  unless android_registry_codes != [] and
           Enum.all?(android_registry_codes, &(&1 in released_version_codes)) do
    raise(
      "each Android released build version code must appear in PLAY_INTEGRITY_RELEASED_VERSION_CODES"
    )
  end

  config :adventure_time_api, AdventureTimeApi.AccessAssessment,
    collection_enabled: true,
    admin_display_enabled: truthy?.(System.get_env("ACCESS_ASSESSMENT_ADMIN_DISPLAY_ENABLED")),
    released_builds: released_builds,
    released_build_registry_version: released_build_registry_version,
    scoring_model_version: scoring_model_version,
    expected_range_versions: %{
      test_lab: test_lab_range_version,
      google: google_range_version
    }

  config :adventure_time_api, AdventureTimeApi.AccessAssessment.IpIntelligence,
    adapter: AdventureTimeApi.AccessAssessment.IpQualityScore,
    endpoint: System.get_env("IPQS_ENDPOINT") || "https://ipqualityscore.com/api/json/ip",
    api_key: ipqs_api_key,
    settings_version: System.get_env("IPQS_SETTINGS_VERSION") || "v1",
    timeout_ms: String.to_integer(System.get_env("IPQS_TIMEOUT_MS") || "3000")

  config :adventure_time_api, AdventureTimeApi.AccessAssessment.Pseudonym,
    secret: pseudonym_secret,
    version: System.get_env("ACCESS_ASSESSMENT_PSEUDONYM_VERSION") || "v1"

  config :adventure_time_api, AdventureTimeApi.AccessAssessment.PlayIntegrity,
    adapter: AdventureTimeApi.AccessAssessment.GooglePlayIntegrity,
    endpoint:
      System.get_env("PLAY_INTEGRITY_ENDPOINT") ||
        "https://playintegrity.googleapis.com",
    package_name:
      System.get_env("PLAY_INTEGRITY_PACKAGE_NAME") ||
        "love.leaetzak.adventuretime",
    cloud_project_number: play_cloud_project_number,
    certificate_digests: play_certificate_digests,
    released_version_codes: released_version_codes,
    credentials_path: play_credentials_path,
    timeout_ms: String.to_integer(System.get_env("PLAY_INTEGRITY_TIMEOUT_MS") || "3000")
end

case System.get_env("ACCESS_ASSESSMENT_TRUSTED_PROXY_CIDRS") do
  value when is_binary(value) and value != "" ->
    trusted_proxy_cidrs =
      value
      |> String.split(",", trim: true)
      |> Enum.map(&String.trim/1)

    config :adventure_time_api, AdventureTimeApiWeb.Plugs.CanonicalClientIp,
      trusted_proxy_cidrs: trusted_proxy_cidrs

  _missing ->
    if config_env() == :prod do
      config :adventure_time_api, AdventureTimeApiWeb.Plugs.CanonicalClientIp,
        trusted_proxy_cidrs: ["127.0.0.0/8", "::1/128"]
    end
end

google_web_client_id =
  [
    System.get_env("AUTH_GOOGLE_ID"),
    System.get_env("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"),
    if(config_env() in [:dev, :prod],
      do: "831806850937-p3udmkmhoeik4d63rt3r422bj91g02b3.apps.googleusercontent.com"
    )
  ]
  |> Enum.find(&(is_binary(&1) and String.trim(&1) != ""))

config :adventure_time_api, AdventureTimeApiWeb.WebSessionController,
  google_client_id: google_web_client_id,
  apple_client_id: System.get_env("APPLE_WEB_CLIENT_ID"),
  apple_redirect_uri: System.get_env("APPLE_WEB_REDIRECT_URI")

# config/runtime.exs is executed for all environments, including
# during releases. It is executed after compilation and before the
# system starts, so it is typically used to load production configuration
# and secrets from environment variables or elsewhere. Do not define
# any compile-time configuration in here, as it won't be applied.
# The block below contains prod specific runtime configuration.

# ## Using releases
#
# If you use `mix release`, you need to explicitly enable the server
# by passing the PHX_SERVER=true when you start it:
#
#     PHX_SERVER=true bin/adventure_time_api start
#
# Alternatively, you can use `mix phx.gen.release` to generate a `bin/server`
# script that automatically sets the env var above.
if System.get_env("PHX_SERVER") do
  config :adventure_time_api, AdventureTimeApiWeb.Endpoint, server: true
end

case System.get_env("WEBSITE_INDEX_PATH") do
  path when is_binary(path) and path != "" ->
    config :adventure_time_api, AdventureTimeApiWeb.Plugs.WebsiteDocumentPlug, index_path: path

  _missing ->
    :ok
end

case System.get_env("AUTH_EMAIL_DELIVERY_ADAPTER") do
  "noop" ->
    config :adventure_time_api, AdventureTimeApi.Accounts.EmailDelivery,
      adapter: AdventureTimeApi.Accounts.EmailDelivery.NoopAdapter

  "sendmail" ->
    config :adventure_time_api, AdventureTimeApi.Accounts.EmailDelivery,
      adapter: AdventureTimeApi.Accounts.EmailDelivery.SendmailAdapter

  _ ->
    :ok
end

config :adventure_time_api, AdventureTimeApi.Fitbit,
  client_id: System.get_env("FITBIT_CLIENT_ID"),
  client_secret: System.get_env("FITBIT_CLIENT_SECRET"),
  redirect_uri: System.get_env("FITBIT_REDIRECT_URI"),
  verification_code: System.get_env("FITBIT_VERIFICATION_CODE"),
  mobile_redirect_uri: System.get_env("FITBIT_MOBILE_REDIRECT_URI")

config :adventure_time_api, AdventureTimeApi.Notifications,
  push_api_url: System.get_env("EXPO_PUSH_API_URL"),
  access_token: System.get_env("EXPO_ACCESS_TOKEN")

if config_env() == :prod do
  config :adventure_time_api, AdventureTimeApi.Auth,
    access_token_secret:
      System.get_env("ACCESS_TOKEN_SECRET") ||
        raise("environment variable ACCESS_TOKEN_SECRET is missing"),
    refresh_token_secret:
      System.get_env("REFRESH_TOKEN_SECRET") ||
        raise("environment variable REFRESH_TOKEN_SECRET is missing"),
    google_client_ids:
      [
        google_web_client_id,
        System.get_env("GOOGLE_IOS_CLIENT_ID"),
        System.get_env("GOOGLE_ANDROID_CLIENT_ID")
      ]
      |> Enum.reject(&is_nil/1)
      |> Enum.reject(&(&1 == "")),
    apple_client_ids:
      [
        System.get_env("APPLE_BUNDLE_ID") || "love.leaetzak.adventuretime",
        System.get_env("IOS_BUNDLE_IDENTIFIER"),
        System.get_env("APPLE_WEB_CLIENT_ID")
      ]
      |> Enum.reject(&is_nil/1)
      |> Enum.reject(&(&1 == ""))

  config :adventure_time_api, AdventureTimeApi.Accounts,
    verification_secret:
      System.get_env("EMAIL_VERIFICATION_SECRET") ||
        raise("environment variable EMAIL_VERIFICATION_SECRET is missing"),
    expose_dev_code: System.get_env("AUTH_EMAIL_EXPOSE_DEV_CODE") == "true"

  minio_base_url =
    case {System.get_env("MINIO_ENDPOINT"), System.get_env("MINIO_PORT")} do
      {endpoint, port}
      when is_binary(endpoint) and endpoint != "" and is_binary(port) and port != "" ->
        scheme = if System.get_env("MINIO_USE_SSL") in ~w(true 1), do: "https", else: "http"
        "#{scheme}://#{endpoint}:#{port}"

      _ ->
        nil
    end

  config :adventure_time_api, AdventureTimeApi.Media,
    base_url: minio_base_url,
    bucket: System.get_env("MINIO_BUCKET"),
    access_key: System.get_env("MINIO_ACCESS_KEY"),
    secret_key: System.get_env("MINIO_SECRET_KEY")
end

if config_env() == :prod do
  database_url =
    System.get_env("DATABASE_URL") ||
      raise """
      environment variable DATABASE_URL is missing.
      For example: ecto://USER:PASS@HOST/DATABASE
      """

  maybe_ipv6 = if System.get_env("ECTO_IPV6") in ~w(true 1), do: [:inet6], else: []

  config :adventure_time_api, AdventureTimeApi.Repo,
    # ssl: true,
    url: database_url,
    pool_size: String.to_integer(System.get_env("POOL_SIZE") || "10"),
    # For machines with several cores, consider starting multiple pools of `pool_size`
    # pool_count: 4,
    socket_options: maybe_ipv6

  # The secret key base is used to sign/encrypt cookies and other secrets.
  # A default value is used in config/dev.exs and config/test.exs but you
  # want to use a different value for prod and you most likely don't want
  # to check this value into version control, so we use an environment
  # variable instead.
  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise """
      environment variable SECRET_KEY_BASE is missing.
      You can generate one by calling: mix phx.gen.secret
      """

  host = System.get_env("PHX_HOST") || "app.leaetzak.love"

  port =
    String.to_integer(System.get_env("PORT") || System.get_env("PHX_PORT") || "4200")

  ip =
    case System.get_env("PHX_IP") || "0.0.0.0" do
      "0.0.0.0" -> {0, 0, 0, 0}
      "127.0.0.1" -> {127, 0, 0, 1}
      "localhost" -> {127, 0, 0, 1}
      other -> raise "unsupported PHX_IP value: #{inspect(other)}"
    end

  config :adventure_time_api, :dns_cluster_query, System.get_env("DNS_CLUSTER_QUERY")

  config :adventure_time_api, AdventureTimeApiWeb.Endpoint,
    url: [host: host, port: 443, scheme: "https"],
    http: [
      # Enable IPv6 and bind on all interfaces.
      # Set it to  {0, 0, 0, 0, 0, 0, 0, 1} for local network only access.
      # See the documentation on https://hexdocs.pm/bandit/Bandit.html#t:options/0
      # for details about using IPv6 vs IPv4 and loopback vs public addresses.
      ip: ip,
      port: port
    ],
    secret_key_base: secret_key_base

  # ## SSL Support
  #
  # To get SSL working, you will need to add the `https` key
  # to your endpoint configuration:
  #
  #     config :adventure_time_api, AdventureTimeApiWeb.Endpoint,
  #       https: [
  #         ...,
  #         port: 443,
  #         cipher_suite: :strong,
  #         keyfile: System.get_env("SOME_APP_SSL_KEY_PATH"),
  #         certfile: System.get_env("SOME_APP_SSL_CERT_PATH")
  #       ]
  #
  # The `cipher_suite` is set to `:strong` to support only the
  # latest and more secure SSL ciphers. This means old browsers
  # and clients may not be supported. You can set it to
  # `:compatible` for wider support.
  #
  # `:keyfile` and `:certfile` expect an absolute path to the key
  # and cert in disk or a relative path inside priv, for example
  # "priv/ssl/server.key". For all supported SSL configuration
  # options, see https://hexdocs.pm/plug/Plug.SSL.html#configure/1
  #
  # We also recommend setting `force_ssl` in your config/prod.exs,
  # ensuring no data is ever sent via http, always redirecting to https:
  #
  #     config :adventure_time_api, AdventureTimeApiWeb.Endpoint,
  #       force_ssl: [hsts: true]
  #
  # Check `Plug.SSL` for all available options in `force_ssl`.
end
