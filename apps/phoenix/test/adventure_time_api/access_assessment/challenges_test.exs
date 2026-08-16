defmodule AdventureTimeApi.AccessAssessment.ChallengesTest do
  use AdventureTimeApi.DataCase, async: true

  alias AdventureTimeApi.AccessAssessment.Assessment
  alias AdventureTimeApi.AccessAssessment.Challenges
  alias AdventureTimeApi.AccessAssessment.IntegrityChallenge
  alias AdventureTimeApi.Accounts.EmailAccessRequest

  test "issues an opaque one-use challenge bound to the assessment revision" do
    request = request_with_assessment()

    assert {:ok, challenge} = Challenges.issue(request.id)
    assert challenge.kind == "play_integrity_standard"
    assert is_binary(challenge.token)
    assert is_binary(challenge.requestHash)
    assert %DateTime{} = challenge.expiresAt

    refute Repo.one(from(c in IntegrityChallenge, select: c.challenge_digest)) ==
             challenge.token

    assert {:ok, consumed} = Challenges.consume(challenge.token)
    assert consumed.email_access_request_id == request.id
    assert consumed.expected_request_hash == challenge.requestHash
    assert {:error, :invalid_challenge} = Challenges.consume(challenge.token)
  end

  test "does not issue a challenge for non-Android or Test Lab assessments" do
    request = request_with_assessment(:ios, :assessing)
    assert {:ok, nil} = Challenges.issue(request.id)

    request = request_with_assessment(:android, :test_lab)
    assert {:ok, nil} = Challenges.issue(request.id)
  end

  defp request_with_assessment(profile \\ :android, state \\ :assessing) do
    request =
      %EmailAccessRequest{}
      |> EmailAccessRequest.changeset(%{
        email: "challenge-#{System.unique_integer([:positive])}@example.com",
        status: :pending,
        provider: "email"
      })
      |> Repo.insert!()

    %Assessment{}
    |> Assessment.create_changeset(request.id, %{
      state: state,
      evidence_revision: 3,
      scoring_model_version: "access-request-v1",
      platform_profile: profile
    })
    |> Repo.insert!()

    request
  end
end
