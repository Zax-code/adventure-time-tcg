defmodule AdventureTimeApi.Workers.AssessAccessRequestWorkerTest do
  use AdventureTimeApi.DataCase, async: false
  use Oban.Testing, repo: AdventureTimeApi.Repo

  alias AdventureTimeApi.AccessAssessment
  alias AdventureTimeApi.AccessAssessment.{Assessment, IpIntelligence}
  alias AdventureTimeApi.Accounts.EmailAccessRequest
  alias AdventureTimeApi.Workers.AssessAccessRequestWorker

  setup do
    bypass = Bypass.open()
    original_assessment = Application.get_env(:adventure_time_api, AccessAssessment, [])
    original_ip = Application.get_env(:adventure_time_api, IpIntelligence, [])

    Application.put_env(:adventure_time_api, AccessAssessment, collection_enabled: true)

    Application.put_env(:adventure_time_api, IpIntelligence,
      adapter: AdventureTimeApi.AccessAssessment.IpQualityScore,
      endpoint: "http://127.0.0.1:#{bypass.port}/api/json/ip",
      api_key: "test-key",
      timeout_ms: 1_000
    )

    on_exit(fn ->
      Application.put_env(:adventure_time_api, AccessAssessment, original_assessment)
      Application.put_env(:adventure_time_api, IpIntelligence, original_ip)
    end)

    {:ok, bypass: bypass}
  end

  test "enriches and scores the current evidence revision without putting evidence in job args",
       %{
         bypass: bypass
       } do
    request =
      %EmailAccessRequest{}
      |> EmailAccessRequest.changeset(%{
        email: "worker@example.com",
        status: :pending,
        provider: "google",
        provider_subject_hash: String.duplicate("a", 64),
        last_user_agent: "AdventureTimeNative/unknown (android; 1.0.22)",
        last_accept_language: "en-US",
        last_client_platform: "android",
        last_client_app_version: "1.0.22",
        last_client_build_number: "unknown",
        last_installation_id_hash: String.duplicate("b", 64),
        attempt_count: 1,
        last_seen_at: ~U[2026-08-16 12:00:00Z]
      })
      |> Repo.insert!()

    assert {:ok, assessment} =
             AccessAssessment.capture(request, %{
               ip_address: "198.51.100.44",
               user_agent: request.last_user_agent,
               accept_language: request.last_accept_language,
               client_platform: "android",
               client_app_version: "1.0.22",
               client_build_number: "unknown",
               installation_id: "installation-source"
             })

    assert_enqueued(
      worker: AssessAccessRequestWorker,
      args: %{
        "access_request_id" => request.id,
        "evidence_revision" => assessment.evidence_revision
      }
    )

    [job] = all_enqueued(worker: AssessAccessRequestWorker)
    assert Map.keys(job.args) |> Enum.sort() == ["access_request_id", "evidence_revision"]

    Bypass.expect_once(bypass, "GET", "/api/json/ip", fn conn ->
      Plug.Conn.resp(
        conn,
        200,
        Jason.encode!(%{
          success: true,
          request_id: "normalized-only",
          fraud_score: 10,
          proxy: false,
          vpn: false,
          active_tor: false,
          bot_status: false,
          recent_abuse: false,
          frequent_abuser: false,
          high_risk_attacks: false,
          public_access_point: false,
          hosting: false,
          shared_connection: false,
          raw_secret_vendor_detail: "must disappear"
        })
      )
    end)

    assert :ok = perform_job(AssessAccessRequestWorker, job.args)

    updated = Repo.get!(Assessment, assessment.id)
    assert updated.state == :partial
    assert updated.trustworthiness_confidence == 76
    assert updated.evidence_coverage == 70
    assert updated.band == :stronger
    assert updated.missing_reasons == ["integrity.not_submitted"]
    assert updated.ip_intelligence_evidence.provider_request_id == "normalized-only"
    refute inspect(updated) =~ "must disappear"
  end
end
