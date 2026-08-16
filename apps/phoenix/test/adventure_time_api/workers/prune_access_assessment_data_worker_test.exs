defmodule AdventureTimeApi.Workers.PruneAccessAssessmentDataWorkerTest do
  use AdventureTimeApi.DataCase, async: true

  alias AdventureTimeApi.AccessAssessment.Assessment
  alias AdventureTimeApi.AccessAssessment.IntegrityChallenge
  alias AdventureTimeApi.AccessAssessment.IpRevealAudit
  alias AdventureTimeApi.AccessAssessment.Snapshot
  alias AdventureTimeApi.Accounts.AuthAttempt
  alias AdventureTimeApi.Accounts.EmailAccessRequest
  alias AdventureTimeApi.Accounts.User
  alias AdventureTimeApi.Workers.PruneAccessAssessmentDataWorker

  test "applies the 30, 90, and 365 day privacy windows idempotently" do
    now = ~U[2026-08-16 12:00:00Z]
    request = request()

    assessment =
      %Assessment{}
      |> Assessment.create_changeset(request.id, %{
        state: :partial,
        evidence_revision: 1,
        scoring_model_version: "access-request-v1",
        platform_profile: :android,
        canonical_ip: {198, 51, 100, 20},
        identity_provider_pseudonym: "identity",
        installation_provider_pseudonym: "installation",
        exact_ip_retained_until: DateTime.add(now, -1, :second),
        detailed_evidence_retained_until: DateTime.add(now, -1, :second),
        summary_retained_until: DateTime.add(now, -1, :second),
        ip_intelligence_evidence: %{
          provider: "ipqualityscore",
          settings_version: "v1",
          fraud_score: 10,
          looked_up_at: now
        },
        play_integrity_evidence: %{
          app_recognition: :play_recognized,
          licensing: :licensed,
          verified_at: now
        },
        contributions: [
          %{
            key: :identity,
            value: 90,
            weight: 20,
            reason_codes: ["identity.verified"],
            model_version: "access-request-v1"
          }
        ]
      })
      |> Repo.insert!()

    %AuthAttempt{}
    |> AuthAttempt.changeset(%{
      event_type: "attempt",
      email: request.email,
      email_access_request_id: request.id,
      canonical_ip: {198, 51, 100, 20},
      ip_address: "198.51.100.20"
    })
    |> Repo.insert!()

    %Snapshot{}
    |> Snapshot.create_changeset(request.id, nil, %{
      review_outcome: :approved,
      state: :partial,
      evidence_revision: 1,
      reviewed_at: DateTime.add(now, -366, :day),
      retained_until: DateTime.add(now, -1, :second)
    })
    |> Repo.insert!()

    %IntegrityChallenge{}
    |> IntegrityChallenge.create_changeset(request.id, %{
      challenge_digest: :crypto.hash(:sha256, "expired"),
      expected_request_hash: "hash",
      evidence_revision: 1,
      expires_at: DateTime.add(now, -1, :second)
    })
    |> Repo.insert!()

    actor = user("retention-reviewer@example.com")

    Repo.insert!(%IpRevealAudit{
      email_access_request_id: request.id,
      actor_id: actor.id,
      request_id: "request-id",
      inserted_at: DateTime.add(now, -366, :day)
    })

    assert :ok =
             PruneAccessAssessmentDataWorker.perform(%Oban.Job{
               args: %{"now" => DateTime.to_iso8601(now)}
             })

    assert :ok =
             PruneAccessAssessmentDataWorker.perform(%Oban.Job{
               args: %{"now" => DateTime.to_iso8601(now)}
             })

    assessment = Repo.get!(Assessment, assessment.id)
    assert assessment.canonical_ip == nil
    assert assessment.ip_intelligence_evidence == nil
    assert assessment.play_integrity_evidence == nil
    assert assessment.identity_provider_pseudonym == nil
    assert assessment.installation_provider_pseudonym == nil
    assert assessment.contributions == []
    assert assessment.scoring_model_version == nil
    assert assessment.trustworthiness_confidence == nil
    assert assessment.evidence_coverage == nil
    assert assessment.missing_reasons == []

    attempt = Repo.get_by!(AuthAttempt, email_access_request_id: request.id)
    assert attempt.canonical_ip == nil
    assert attempt.ip_address == nil
    assert Repo.get!(EmailAccessRequest, request.id).last_ip_address == nil
    assert Repo.aggregate(Snapshot, :count) == 0
    assert Repo.aggregate(IntegrityChallenge, :count) == 0
    assert Repo.aggregate(IpRevealAudit, :count) == 0
  end

  defp request do
    %EmailAccessRequest{}
    |> EmailAccessRequest.changeset(%{
      email: "retention@example.com",
      status: :approved,
      provider: "email",
      last_ip_address: "198.51.100.20"
    })
    |> Repo.insert!()
  end

  defp user(email) do
    %User{}
    |> User.registration_changeset(%{email: email})
    |> User.access_changeset(%{role: :super_admin, access_status: :approved})
    |> Repo.insert!()
  end
end
