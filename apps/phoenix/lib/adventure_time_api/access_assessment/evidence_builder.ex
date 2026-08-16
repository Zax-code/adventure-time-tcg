defmodule AdventureTimeApi.AccessAssessment.EvidenceBuilder do
  @moduledoc false

  import Ecto.Query

  alias AdventureTimeApi.AccessAssessment.Assessment

  alias AdventureTimeApi.Accounts.{
    AuthAttempt,
    AuthProviderIdentity,
    EmailAccessRequest,
    EmailCredential,
    User
  }

  alias AdventureTimeApi.Repo

  def components(%EmailAccessRequest{} = request, %Assessment{} = assessment, ip_component, now) do
    %{
      play_integrity: play_integrity(assessment),
      identity: identity(request),
      continuity: continuity(request, assessment, now),
      client: client(request, assessment),
      ip_intelligence: ip_component
    }
  end

  defp play_integrity(%Assessment{play_integrity_evidence: nil}),
    do: {:missing, "integrity.not_submitted"}

  defp play_integrity(%Assessment{play_integrity_evidence: evidence}) do
    evidence
    |> Map.from_struct()
    |> AdventureTimeApi.AccessAssessment.Signals.play_integrity()
  end

  defp identity(%EmailAccessRequest{provider: provider} = request)
       when provider in ["google", "apple"] do
    repeated_mapping? =
      not is_nil(request.provider_subject_hash) and
        Repo.exists?(
          from(identity in AuthProviderIdentity,
            where:
              identity.provider == ^provider and
                identity.provider_subject_hash == ^request.provider_subject_hash and
                identity.email == ^request.email
          )
        )

    if repeated_mapping? do
      component(100, ["identity.provider_mapping_repeated"], request.last_seen_at)
    else
      component(90, ["identity.provider_verified"], request.last_seen_at)
    end
  end

  defp identity(request) do
    verified? =
      Repo.exists?(
        from(user in User,
          join: credential in EmailCredential,
          on: credential.user_id == user.id,
          where: user.email == ^request.email and not is_nil(credential.email_verified_at)
        )
      )

    if verified? do
      component(90, ["identity.email_verified"], request.last_seen_at)
    else
      component(50, ["identity.email_verification_pending"], request.last_seen_at)
    end
  end

  defp continuity(request, assessment, now) do
    since_24h = DateTime.add(now, -24, :hour)
    since_1h = DateTime.add(now, -1, :hour)
    since_10m = DateTime.add(now, -10, :minute)

    value = 50
    reasons = []

    {value, reasons} =
      adjust(
        {value, reasons},
        repeated_for_request?(
          :installation_id_hash,
          request.last_installation_id_hash,
          request.id
        ),
        10,
        "continuity.installation_repeated"
      )

    {value, reasons} =
      adjust(
        {value, reasons},
        repeated_for_request?(:provider_subject_hash, request.provider_subject_hash, request.id),
        10,
        "continuity.provider_identity_repeated"
      )

    {value, reasons} =
      adjust(
        {value, reasons},
        (request.attempt_count || 0) <= 3,
        5,
        "continuity.low_attempt_volume"
      )

    {value, reasons} =
      adjust(
        {value, reasons},
        (request.attempt_count || 0) > 5,
        -10,
        "continuity.request_attempts_high"
      )

    {value, reasons} =
      adjust(
        {value, reasons},
        distinct_identities(:installation_id_hash, request.last_installation_id_hash, since_24h) >=
          3,
        -20,
        "continuity.installation_many_identities"
      )

    {value, reasons} =
      adjust(
        {value, reasons},
        distinct_identities(:canonical_ip, assessment.canonical_ip, since_1h) >= 5,
        -20,
        "continuity.ip_many_identities"
      )

    {value, reasons} =
      adjust(
        {value, reasons},
        recent_attempts(request, assessment, since_10m) >= 20,
        -30,
        "continuity.recent_attempt_burst"
      )

    component(clamp(value), reasons, request.last_seen_at)
  end

  defp client(request, assessment) do
    native_ua? = String.starts_with?(request.last_user_agent || "", "AdventureTimeNative/")
    claimed_native? = request.last_client_platform in ["android", "ios"]
    platform_agrees? = claimed_native? and native_ua?
    build_recognized? = released_build?(request)

    {value, reasons} =
      {50, []}
      |> adjust(build_recognized?, 20, "client.released_build")
      |> adjust(platform_agrees?, 10, "client.platform_agrees")
      |> adjust(
        not is_nil(assessment.installation_provider_pseudonym),
        10,
        "client.installation_present"
      )
      |> adjust(claimed_native? and not native_ua?, -25, "client.platform_conflict")
      |> adjust(claimed_native? and not build_recognized?, -25, "client.unrecognized_build")

    max_value = if assessment.platform_profile == :web, do: 80, else: 100
    component(value |> clamp() |> min(max_value), reasons, request.last_seen_at)
  end

  defp released_build?(request) do
    builds =
      :adventure_time_api
      |> Application.get_env(AdventureTimeApi.AccessAssessment, [])
      |> Keyword.get(:released_builds, %{})
      |> Map.get(request.last_client_platform, [])

    Enum.any?(builds, fn build ->
      build.version == request.last_client_app_version and
        build.build_number == request.last_client_build_number
    end)
  end

  defp repeated_for_request?(_field, nil, _request_id), do: false

  defp repeated_for_request?(field, value, request_id) do
    AuthAttempt
    |> where([attempt], attempt.email_access_request_id == ^request_id)
    |> where([attempt], field(attempt, ^field) == ^value)
    |> Repo.aggregate(:count) >= 2
  end

  defp distinct_identities(_field, nil, _since), do: 0

  defp distinct_identities(field, value, since) do
    AuthAttempt
    |> where([attempt], field(attempt, ^field) == ^value and attempt.inserted_at >= ^since)
    |> select([attempt], count(attempt.email, :distinct))
    |> Repo.one()
  end

  defp recent_attempts(request, assessment, since) do
    conditions = dynamic([attempt], attempt.email_access_request_id == ^request.id)

    conditions =
      if assessment.canonical_ip do
        dynamic([attempt], ^conditions or attempt.canonical_ip == ^assessment.canonical_ip)
      else
        conditions
      end

    conditions =
      if request.last_installation_id_hash do
        dynamic(
          [attempt],
          ^conditions or attempt.installation_id_hash == ^request.last_installation_id_hash
        )
      else
        conditions
      end

    conditions =
      if request.provider_subject_hash do
        dynamic(
          [attempt],
          ^conditions or attempt.provider_subject_hash == ^request.provider_subject_hash
        )
      else
        conditions
      end

    AuthAttempt
    |> where([attempt], attempt.inserted_at >= ^since)
    |> where(^conditions)
    |> Repo.aggregate(:count)
  end

  defp adjust({value, reasons}, true, amount, reason), do: {value + amount, reasons ++ [reason]}
  defp adjust(result, _false, _amount, _reason), do: result

  defp component(value, reason_codes, observed_at) do
    %{
      value: value,
      reason_codes: reason_codes,
      explanations: Enum.map(reason_codes, &String.replace(&1, [".", "_"], " ")),
      observed_at: observed_at,
      hard_failure: false
    }
  end

  defp clamp(value), do: value |> max(0) |> min(100)
end
