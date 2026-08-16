defmodule AdventureTimeApi.AccessAssessment.EvidenceBuilderTest do
  use AdventureTimeApi.DataCase, async: false

  alias AdventureTimeApi.AccessAssessment
  alias AdventureTimeApi.AccessAssessment.Assessment
  alias AdventureTimeApi.AccessAssessment.EvidenceBuilder
  alias AdventureTimeApi.Accounts.AuthAttempt
  alias AdventureTimeApi.Accounts.AuthProviderIdentity
  alias AdventureTimeApi.Accounts.EmailAccessRequest
  alias AdventureTimeApi.Accounts.User

  setup do
    original = Application.get_env(:adventure_time_api, AccessAssessment, [])

    Application.put_env(
      :adventure_time_api,
      AccessAssessment,
      Keyword.put(original, :released_builds, %{
        "android" => [%{version: "1.0.22", build_number: "123"}],
        "ios" => [%{version: "1.0.22", build_number: "123"}]
      })
    )

    on_exit(fn -> Application.put_env(:adventure_time_api, AccessAssessment, original) end)
    :ok
  end

  test "a verified provider identity conflict is a hard failure" do
    request = request(provider: "google", provider_subject_hash: "subject-a")
    user = user("different@example.com")

    %AuthProviderIdentity{user_id: user.id}
    |> AuthProviderIdentity.changeset(%{
      provider: "google",
      provider_subject_hash: "subject-a",
      email: "different@example.com"
    })
    |> Repo.insert!()

    components = EvidenceBuilder.components(request, assessment(:android), missing_ip(), now())

    assert %{
             value: 0,
             hard_failure: true,
             reason_codes: ["identity.provider_mapping_conflict"]
           } = components.identity
  end

  test "continuity uses the retained 24-hour attempt window instead of all-time count" do
    request = request(attempt_count: 99)
    components = EvidenceBuilder.components(request, assessment(:web), missing_ip(), now())

    assert components.continuity.value == 55
    assert "continuity.low_attempt_volume" in components.continuity.reason_codes

    Enum.each(1..6, fn index ->
      insert_attempt(request, %{event_type: "attempt-#{index}"})
    end)

    components = EvidenceBuilder.components(request, assessment(:web), missing_ip(), now())
    assert components.continuity.value == 40
    assert "continuity.request_attempts_high" in components.continuity.reason_codes
  end

  test "a failed-credential burst prevents the low-volume continuity bonus" do
    request = request()

    Enum.each(1..3, fn index ->
      insert_attempt(request, %{
        event_type: "failed-#{index}",
        error_code: "INVALID_CREDENTIALS"
      })
    end)

    components = EvidenceBuilder.components(request, assessment(:web), missing_ip(), now())
    assert components.continuity.value == 50
    refute "continuity.low_attempt_volume" in components.continuity.reason_codes
  end

  test "client scoring requires well-formed continuous installation evidence and caps iOS at 90" do
    installation_hash = String.duplicate("a", 64)

    request =
      request(
        last_client_platform: "ios",
        last_client_app_version: "1.0.22",
        last_client_build_number: "123",
        last_user_agent: "AdventureTimeNative/1.0.22",
        last_installation_id_hash: installation_hash
      )

    Enum.each(1..2, fn index ->
      insert_attempt(request, %{
        event_type: "continuous-#{index}",
        installation_id_hash: installation_hash
      })
    end)

    assessment = %Assessment{
      assessment(:ios)
      | installation_provider_pseudonym: "installation-pseudonym",
        installation_id_well_formed: true
    }

    components = EvidenceBuilder.components(request, assessment, missing_ip(), now())

    assert components.client.value == 90
    assert "client.installation_continuous" in components.client.reason_codes
  end

  test "web client evidence uses same-site origin and ordinary browser shape" do
    request = request(last_client_platform: "web", last_user_agent: "Mozilla/5.0")

    assessment = %Assessment{
      assessment(:web)
      | origin_host_consistent: true,
        browser_request_shape: true
    }

    components = EvidenceBuilder.components(request, assessment, missing_ip(), now())

    assert components.client.value == 70

    assert components.client.reason_codes == [
             "client.same_site_origin",
             "client.browser_request_shape"
           ]
  end

  defp request(overrides \\ []) do
    defaults = [
      email: "evidence-#{System.unique_integer([:positive])}@example.com",
      status: :pending,
      provider: "email",
      attempt_count: 1,
      last_seen_at: now()
    ]

    %EmailAccessRequest{}
    |> EmailAccessRequest.changeset(Map.new(Keyword.merge(defaults, overrides)))
    |> Repo.insert!()
  end

  defp assessment(profile) do
    %Assessment{
      platform_profile: profile,
      evidence_revision: 1,
      scoring_model_version: "access-request-v1",
      state: :assessing
    }
  end

  defp insert_attempt(request, attrs) do
    %AuthAttempt{}
    |> AuthAttempt.changeset(
      Map.merge(
        %{
          event_type: "attempt",
          email: request.email,
          email_access_request_id: request.id,
          status_code: 403,
          error_code: "ACCESS_REQUEST_PENDING"
        },
        attrs
      )
    )
    |> Repo.insert!()
  end

  defp missing_ip, do: {:missing, "ip.provider_unavailable"}

  defp user(email) do
    %User{}
    |> User.registration_changeset(%{email: email})
    |> User.access_changeset(%{role: :user, access_status: :approved})
    |> Repo.insert!()
  end

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second)
end
