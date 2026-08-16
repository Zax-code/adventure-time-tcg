defmodule AdventureTimeApi.AccessAssessment.IpQualityScoreTest do
  use ExUnit.Case, async: true

  alias AdventureTimeApi.AccessAssessment.IpQualityScore

  setup do
    bypass = Bypass.open()

    opts = [
      endpoint: "http://127.0.0.1:#{bypass.port}/api/json/ip",
      api_key: "test-secret-key",
      timeout_ms: 1_000
    ]

    {:ok, bypass: bypass, opts: opts}
  end

  test "sends only approved inputs and normalizes a successful response", %{
    bypass: bypass,
    opts: opts
  } do
    Bypass.expect_once(bypass, "GET", "/api/json/ip", fn conn ->
      assert Plug.Conn.get_req_header(conn, "ipqs-key") == ["test-secret-key"]
      query = URI.decode_query(conn.query_string)

      assert query == %{
               "allow_public_access_points" => "true",
               "identityID" => "v1:identity-pseudonym",
               "installationID" => "v1:installation-pseudonym",
               "ip" => "198.51.100.44",
               "lighter_penalties" => "true",
               "strictness" => "0",
               "user_agent" => "AdventureTimeNative/44",
               "user_language" => "fr-FR"
             }

      Plug.Conn.resp(
        conn,
        200,
        Jason.encode!(%{
          success: true,
          request_id: "provider-request",
          fraud_score: 18,
          proxy: true,
          vpn: true,
          active_tor: false,
          bot_status: false,
          recent_abuse: false,
          frequent_abuser: false,
          high_risk_attacks: false,
          public_access_point: true,
          hosting: false,
          shared_connection: true,
          ASN: 64_500,
          organization: "Example Carrier",
          connection_type: "Mobile",
          raw_vendor_field_that_must_not_escape: "discard me"
        })
      )
    end)

    assert {:ok, evidence} =
             IpQualityScore.lookup(
               %{
                 ip_address: "198.51.100.44",
                 user_agent: "AdventureTimeNative/44",
                 accept_language: "fr-FR",
                 identity_pseudonym: "v1:identity-pseudonym",
                 installation_pseudonym: "v1:installation-pseudonym"
               },
               opts
             )

    assert evidence == %{
             provider: "ipqualityscore",
             provider_request_id: "provider-request",
             fraud_score: 18,
             proxy: true,
             vpn: true,
             active_tor: false,
             bot_status: false,
             recent_abuse: false,
             frequent_abuser: false,
             high_risk_attacks: false,
             public_access_point: true,
             hosting: false,
             shared_connection: true,
             asn: 64_500,
             organization: "Example Carrier",
             connection_type: "Mobile"
           }
  end

  test "provider failures become unavailable evidence", %{bypass: bypass, opts: opts} do
    Bypass.expect_once(bypass, "GET", "/api/json/ip", fn conn ->
      Plug.Conn.resp(conn, 200, Jason.encode!(%{success: false, message: "quota exhausted"}))
    end)

    assert {:error, :provider_unavailable} =
             IpQualityScore.lookup(%{ip_address: "198.51.100.44"}, opts)
  end
end
