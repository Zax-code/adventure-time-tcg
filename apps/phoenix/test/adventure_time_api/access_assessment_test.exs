defmodule AdventureTimeApi.AccessAssessmentTest do
  use AdventureTimeApi.DataCase, async: false

  alias AdventureTimeApi.AccessAssessment
  alias AdventureTimeApi.AccessAssessment.Assessment
  alias AdventureTimeApi.AccessAssessment.Snapshot
  alias AdventureTimeApi.Accounts.EmailAccessRequest
  alias AdventureTimeApi.Accounts.User

  setup do
    original = Application.get_env(:adventure_time_api, AccessAssessment, [])
    Application.put_env(:adventure_time_api, AccessAssessment, collection_enabled: true)
    on_exit(fn -> Application.put_env(:adventure_time_api, AccessAssessment, original) end)
    :ok
  end

  test "captures local evidence for a non-Test-Lab request without making an access decision" do
    request = access_request("capture@example.com")

    assert {:ok, %Assessment{} = assessment} =
             AccessAssessment.capture(request, %{
               ip_address: "198.51.100.44",
               client_platform: "android",
               user_agent: "AdventureTimeNative/1.0.22",
               client_app_version: "1.0.22",
               client_build_number: "123"
             })

    assert assessment.state == :assessing
    assert assessment.evidence_revision == 1
    assert assessment.platform_profile == :android
    assert assessment.canonical_ip == {198, 51, 100, 44}
    assert assessment.masked_ip_address == "198.51.100.x"
    assert assessment.network_facts.test_lab == :not_matched
    assert assessment.network_facts.google_network == :not_matched
    assert request.status == :pending
  end

  test "a Test Lab match replaces scoring at capture time" do
    request = access_request("test-lab@example.com")

    assert {:ok, %Assessment{} = assessment} =
             AccessAssessment.capture(request, %{
               ip_address: "70.32.140.10",
               client_platform: "android",
               user_agent: "AdventureTimeNative/1.0.22"
             })

    assert assessment.state == :test_lab
    assert assessment.trustworthiness_confidence == nil
    assert assessment.network_facts.test_lab == :matched
    assert assessment.network_facts.test_lab_matched_cidr == "70.32.128.0/19"
    assert assessment.assessed_at
  end

  test "capture is inert when collection is disabled" do
    Application.put_env(:adventure_time_api, AccessAssessment, collection_enabled: false)
    request = access_request("disabled@example.com")

    assert {:ok, nil} = AccessAssessment.capture(request, %{ip_address: "198.51.100.1"})
    refute Repo.get_by(Assessment, email_access_request_id: request.id)
  end

  test "manual review stores an immutable score snapshot without the exact IP" do
    request = access_request("snapshot@example.com")

    {:ok, assessment} =
      AccessAssessment.capture(request, %{
        ip_address: "198.51.100.91",
        client_platform: "ios",
        user_agent: "AdventureTimeNative/44"
      })

    assessment =
      assessment
      |> Assessment.changeset(%{
        state: :partial,
        trustworthiness_confidence: 72,
        evidence_coverage: 75,
        band: :stronger,
        assessed_at: ~U[2026-08-16 12:00:00Z],
        missing_reasons: ["ip.provider_timeout"]
      })
      |> Repo.update!()

    actor = superadmin("reviewer@example.com")
    reviewed_at = ~U[2026-08-16 13:00:00Z]

    assert {:ok, %Snapshot{} = snapshot} =
             AccessAssessment.snapshot_review(
               Repo,
               request,
               actor,
               :approved,
               reviewed_at
             )

    assert snapshot.trustworthiness_confidence == 72
    assert snapshot.evidence_coverage == 75
    assert snapshot.reason_codes == ["ip.provider_timeout"]
    refute Map.has_key?(Map.from_struct(snapshot), :canonical_ip)

    updated = Repo.get!(Assessment, assessment.id)
    assert updated.exact_ip_retained_until == ~U[2026-09-15 13:00:00Z]
    assert updated.detailed_evidence_retained_until == ~U[2026-11-14 13:00:00Z]
    assert snapshot.retained_until == ~U[2027-08-16 13:00:00Z]
  end

  defp access_request(email) do
    %EmailAccessRequest{}
    |> EmailAccessRequest.changeset(%{email: email, status: :pending, provider: "email"})
    |> Repo.insert!()
  end

  defp superadmin(email) do
    %User{}
    |> User.registration_changeset(%{email: email, display_name: "Reviewer"})
    |> User.access_changeset(%{role: :super_admin, access_status: :approved})
    |> Repo.insert!()
  end
end
