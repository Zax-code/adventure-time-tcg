defmodule AdventureTimeApiWeb.PlayIntegrityControllerTest do
  use AdventureTimeApiWeb.ConnCase, async: false

  alias AdventureTimeApi.AccessAssessment
  alias AdventureTimeApi.AccessAssessment.Assessment
  alias AdventureTimeApi.AccessAssessment.Challenges
  alias AdventureTimeApi.AccessAssessment.PlayIntegrity
  alias AdventureTimeApi.AccessAssessment.Signals
  alias AdventureTimeApi.Accounts.EmailAccessRequest
  alias AdventureTimeApi.Repo

  defmodule FakeAdapter do
    @behaviour PlayIntegrity

    @impl true
    def decode("sensitive-token", expected, _opts) do
      now = expected.now

      {:ok,
       %{
         app_recognition: :play_recognized,
         licensing: :licensed,
         device_verdicts: ["MEETS_DEVICE_INTEGRITY"],
         package_name_verified: true,
         certificate_verified: true,
         version_verified: true,
         version_code: "123",
         request_hash_verified: true,
         token_timestamp: now,
         verified_at: now
       }}
    end

    def decode("timeout-token", _expected, _opts), do: {:error, :timeout}
  end

  setup do
    assessment_config = Application.get_env(:adventure_time_api, AccessAssessment, [])
    integrity_config = Application.get_env(:adventure_time_api, PlayIntegrity, [])

    Application.put_env(:adventure_time_api, AccessAssessment, collection_enabled: true)
    Application.put_env(:adventure_time_api, PlayIntegrity, adapter: FakeAdapter)

    on_exit(fn ->
      Application.put_env(:adventure_time_api, AccessAssessment, assessment_config)
      Application.put_env(:adventure_time_api, PlayIntegrity, integrity_config)
    end)

    :ok
  end

  test "consumes a challenge, stores only normalized evidence, and returns 204", %{conn: conn} do
    request = access_request()

    {:ok, _assessment} =
      AccessAssessment.capture(request, %{
        ip_address: "198.51.100.20",
        client_platform: "android",
        user_agent: "AdventureTimeNative/1.0.22"
      })

    {:ok, challenge} = Challenges.issue(request.id)

    conn =
      post(conn, "/auth/access-request-assessment/play-integrity", %{
        "challengeToken" => challenge.token,
        "integrityToken" => "sensitive-token"
      })

    assert response(conn, 204) == ""

    assessment = Repo.get_by!(Assessment, email_access_request_id: request.id)
    assert assessment.evidence_revision == 2
    assert assessment.play_integrity_evidence.app_recognition == :play_recognized
    refute inspect(assessment) =~ "sensitive-token"

    replay =
      post(build_conn(), "/auth/access-request-assessment/play-integrity", %{
        "challengeToken" => challenge.token,
        "integrityToken" => "sensitive-token"
      })

    assert replay.status == 400

    assert json_response(replay, 400) == %{
             "error" => "Invalid integrity submission",
             "code" => "INVALID_INTEGRITY_SUBMISSION"
           }
  end

  test "persists an explicit missing reason when the provider times out", %{conn: conn} do
    request = access_request()

    {:ok, _assessment} =
      AccessAssessment.capture(request, %{
        ip_address: "198.51.100.21",
        client_platform: "android",
        user_agent: "AdventureTimeNative/1.0.22"
      })

    {:ok, challenge} = Challenges.issue(request.id)

    conn =
      post(conn, "/auth/access-request-assessment/play-integrity", %{
        "challengeToken" => challenge.token,
        "integrityToken" => "timeout-token"
      })

    assert response(conn, 204) == ""

    assessment = Repo.get_by!(Assessment, email_access_request_id: request.id)
    assert assessment.evidence_revision == 2
    assert assessment.play_integrity_evidence.failure_reason == "integrity.provider_timeout"

    assert Signals.play_integrity(Map.from_struct(assessment.play_integrity_evidence)) ==
             {:missing, "integrity.provider_timeout"}
  end

  defp access_request do
    %EmailAccessRequest{}
    |> EmailAccessRequest.changeset(%{
      email: "integrity-#{System.unique_integer([:positive])}@example.com",
      status: :pending,
      provider: "email"
    })
    |> Repo.insert!()
  end
end
