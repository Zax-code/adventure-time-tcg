defmodule AdventureTimeApi.AccessAssessment.GooglePlayIntegrityTest do
  use ExUnit.Case, async: true

  alias AdventureTimeApi.AccessAssessment.GooglePlayIntegrity

  test "decodes server-side and keeps only normalized verified evidence" do
    bypass = Bypass.open()
    now = ~U[2026-08-16 12:00:00Z]

    Bypass.expect_once(
      bypass,
      "POST",
      "/v1/love.leaetzak.adventuretime:decodeIntegrityToken",
      fn conn ->
        assert Plug.Conn.get_req_header(conn, "authorization") == ["Bearer access-token"]
        {:ok, body, conn} = Plug.Conn.read_body(conn)
        assert Jason.decode!(body) == %{"integrity_token" => "raw-sensitive-token"}

        payload = %{
          tokenPayloadExternal: %{
            requestDetails: %{
              requestPackageName: "love.leaetzak.adventuretime",
              requestHash: "expected-hash",
              timestampMillis: DateTime.to_unix(now, :millisecond)
            },
            appIntegrity: %{
              appRecognitionVerdict: "PLAY_RECOGNIZED",
              packageName: "love.leaetzak.adventuretime",
              certificateSha256Digest: ["release-cert"],
              versionCode: "123"
            },
            accountDetails: %{appLicensingVerdict: "LICENSED"},
            deviceIntegrity: %{
              deviceRecognitionVerdict: ["MEETS_DEVICE_INTEGRITY"]
            },
            rawField: "must not escape"
          }
        }

        Plug.Conn.resp(conn, 200, Jason.encode!(payload))
      end
    )

    assert {:ok, evidence} =
             GooglePlayIntegrity.decode(
               "raw-sensitive-token",
               %{request_hash: "expected-hash", now: now},
               endpoint: "http://127.0.0.1:#{bypass.port}",
               access_token_provider: fn -> {:ok, "access-token"} end,
               package_name: "love.leaetzak.adventuretime",
               certificate_digests: ["release-cert"],
               released_version_codes: ["123"]
             )

    assert evidence == %{
             app_recognition: :play_recognized,
             licensing: :licensed,
             device_verdicts: ["MEETS_DEVICE_INTEGRITY"],
             package_name_verified: true,
             certificate_verified: true,
             version_verified: true,
             request_hash_verified: true,
             token_timestamp: now,
             verified_at: now
           }

    refute inspect(evidence) =~ "raw-sensitive-token"
    refute inspect(evidence) =~ "must not escape"
  end

  test "binding mismatches are normalized as hard-failure evidence" do
    bypass = Bypass.open()
    now = ~U[2026-08-16 12:00:00Z]

    Bypass.expect_once(bypass, "POST", "/v1/expected.package:decodeIntegrityToken", fn conn ->
      payload = %{
        tokenPayloadExternal: %{
          requestDetails: %{
            requestPackageName: "other.package",
            requestHash: "wrong-hash",
            timestampMillis: DateTime.to_unix(now, :millisecond)
          },
          appIntegrity: %{
            appRecognitionVerdict: "UNRECOGNIZED_VERSION",
            packageName: "other.package",
            certificateSha256Digest: ["wrong-cert"],
            versionCode: "999"
          },
          accountDetails: %{appLicensingVerdict: "UNEVALUATED"},
          deviceIntegrity: %{}
        }
      }

      Plug.Conn.resp(conn, 200, Jason.encode!(payload))
    end)

    assert {:ok, evidence} =
             GooglePlayIntegrity.decode(
               "token",
               %{request_hash: "expected-hash", now: now},
               endpoint: "http://127.0.0.1:#{bypass.port}",
               access_token_provider: fn -> {:ok, "access-token"} end,
               package_name: "expected.package",
               certificate_digests: ["expected-cert"],
               released_version_codes: ["123"]
             )

    assert evidence.request_hash_verified == false
    assert evidence.package_name_verified == false
    assert evidence.certificate_verified == false
    assert evidence.version_verified == false
    assert evidence.app_recognition == :unrecognized_version
  end
end
