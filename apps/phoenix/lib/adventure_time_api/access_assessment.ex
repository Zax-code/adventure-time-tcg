defmodule AdventureTimeApi.AccessAssessment do
  @moduledoc """
  Captures, enriches, and exposes advisory access-request assessments.
  """

  alias AdventureTimeApi.AccessAssessment.Assessment
  alias AdventureTimeApi.AccessAssessment.Challenges
  alias AdventureTimeApi.AccessAssessment.PlayIntegrity
  alias AdventureTimeApi.AccessAssessment.IpRevealAudit
  alias AdventureTimeApi.AccessAssessment.Pseudonym
  alias AdventureTimeApi.AccessAssessment.Snapshot
  alias AdventureTimeApi.AccessRequestAssessment.NetworkClassification
  alias AdventureTimeApi.Accounts.EmailAccessRequest
  alias AdventureTimeApi.NetworkAddress
  alias AdventureTimeApi.Repo
  alias AdventureTimeApi.Workers.AssessAccessRequestWorker

  import Ecto.Query

  def admin_views(access_request_ids) when is_list(access_request_ids) do
    if admin_display_enabled?() do
      Assessment
      |> where([assessment], assessment.email_access_request_id in ^access_request_ids)
      |> Repo.all()
      |> Map.new(&{&1.email_access_request_id, admin_view(&1)})
    else
      %{}
    end
  end

  def reveal_ip(access_request_id, actor_id, audit_request_id) do
    started_at = System.monotonic_time()

    result =
      Repo.transaction(fn ->
        assessment =
          Repo.one(
            from(a in Assessment,
              where: a.email_access_request_id == ^access_request_id,
              lock: "FOR UPDATE"
            )
          )

        now = DateTime.utc_now() |> DateTime.truncate(:second)

        if revealable?(assessment, now) do
          %IpRevealAudit{}
          |> IpRevealAudit.create_changeset(access_request_id, actor_id, %{
            request_id: audit_request_id
          })
          |> Repo.insert!()

          %{
            ipAddress: NetworkAddress.to_string(assessment.canonical_ip),
            retainedUntil: iso8601(assessment.exact_ip_retained_until)
          }
        else
          Repo.rollback(:gone)
        end
      end)

    :telemetry.execute(
      [:adventure_time_api, :access_assessment, :ip_reveal],
      %{count: 1, duration: System.monotonic_time() - started_at},
      %{result: if(match?({:ok, _response}, result), do: :ok, else: :gone)}
    )

    result
  end

  def submit_play_integrity(challenge_token, integrity_token)
      when is_binary(challenge_token) and is_binary(integrity_token) do
    with {:ok, challenge} <- Challenges.consume(challenge_token),
         %Assessment{} = assessment <-
           Repo.get_by(Assessment,
             email_access_request_id: challenge.email_access_request_id
           ),
         true <- assessment.evidence_revision == challenge.evidence_revision do
      expected = %{
        request_hash: challenge.expected_request_hash,
        now: DateTime.utc_now() |> DateTime.truncate(:second)
      }

      case PlayIntegrity.decode(integrity_token, expected) do
        {:ok, evidence} -> persist_integrity(assessment, evidence)
        {:error, provider_failure} -> persist_integrity_failure(assessment, provider_failure)
      end
    else
      _invalid_or_stale -> {:error, :invalid_challenge}
    end
  end

  def submit_play_integrity(_challenge_token, _integrity_token),
    do: {:error, :invalid_challenge}

  @spec capture(EmailAccessRequest.t(), map()) ::
          {:ok, Assessment.t() | nil} | {:error, Ecto.Changeset.t()}
  def capture(%EmailAccessRequest{} = access_request, metadata) when is_map(metadata) do
    started_at = System.monotonic_time()

    result =
      if collection_enabled?() do
        persist_local_assessment(access_request, metadata)
      else
        {:ok, nil}
      end

    :telemetry.execute(
      [:adventure_time_api, :access_assessment, :capture],
      %{count: 1, duration: System.monotonic_time() - started_at},
      %{result: capture_result(result)}
    )

    result
  end

  def collection_enabled? do
    :adventure_time_api
    |> Application.get_env(__MODULE__, [])
    |> Keyword.get(:collection_enabled, false)
  end

  def admin_display_enabled? do
    :adventure_time_api
    |> Application.get_env(__MODULE__, [])
    |> Keyword.get(:admin_display_enabled, false)
  end

  def rescore(access_request_id) do
    if collection_enabled?() do
      case Repo.get_by(Assessment, email_access_request_id: access_request_id) do
        %Assessment{state: :test_lab} ->
          {:ok, :test_lab}

        %Assessment{} = assessment ->
          assessment
          |> Assessment.changeset(%{
            state: :assessing,
            evidence_revision: assessment.evidence_revision + 1,
            trustworthiness_confidence: nil,
            evidence_coverage: nil,
            band: nil,
            contributions: [],
            missing_reasons: ["assessment.rescore_pending"],
            hard_failure_reasons: []
          })
          |> Repo.update()
          |> enqueue_assessment(false)

        nil ->
          {:ok, nil}
      end
    else
      {:ok, nil}
    end
  end

  @spec snapshot_review(
          module(),
          EmailAccessRequest.t(),
          map(),
          :approved | :rejected,
          DateTime.t()
        ) ::
          {:ok, Snapshot.t() | nil} | {:error, Ecto.Changeset.t()}
  def snapshot_review(
        repo,
        %EmailAccessRequest{} = request,
        %{id: actor_id},
        outcome,
        reviewed_at
      )
      when outcome in [:approved, :rejected] do
    case repo.get_by(Assessment, email_access_request_id: request.id) do
      nil ->
        {:ok, nil}

      %Assessment{} = assessment ->
        with {:ok, _updated_assessment} <- set_review_retention(repo, assessment, reviewed_at) do
          attrs = snapshot_attrs(assessment, outcome, reviewed_at)

          %Snapshot{}
          |> Snapshot.create_changeset(request.id, actor_id, attrs)
          |> repo.insert()
        end
    end
  end

  defp persist_local_assessment(access_request, metadata) do
    classification_started_at = System.monotonic_time()
    address = canonical_address(metadata[:ip_address])
    classification = NetworkClassification.classify(address)

    :telemetry.execute(
      [:adventure_time_api, :access_assessment, :classification],
      %{count: 1, duration: System.monotonic_time() - classification_started_at},
      %{test_lab: classification.test_lab, google_network: classification.google_network}
    )

    now = DateTime.utc_now() |> DateTime.truncate(:second)
    current = Repo.get_by(Assessment, email_access_request_id: access_request.id)
    evidence_revision = if current, do: current.evidence_revision + 1, else: 1
    test_lab? = classification.test_lab == :matched

    {retained_ip_evidence, retained_ip_enriched_at} =
      reusable_ip_evidence(current, address, now, test_lab?)

    attrs = %{
      state: if(test_lab?, do: :test_lab, else: :assessing),
      evidence_revision: evidence_revision,
      scoring_model_version: "access-request-v1",
      platform_profile: platform_profile(metadata),
      trustworthiness_confidence: nil,
      evidence_coverage: nil,
      band: nil,
      canonical_ip: address,
      masked_ip_address: mask(address),
      identity_provider_pseudonym: identity_pseudonym(access_request),
      installation_provider_pseudonym:
        Pseudonym.generate(:installation, metadata[:installation_id]),
      installation_id_well_formed: metadata[:installation_id_well_formed] == true,
      origin_host_consistent: metadata[:origin_host_consistent],
      browser_request_shape: metadata[:browser_request_shape],
      pseudonym_version: pseudonym_version(),
      network_facts: classification,
      ip_intelligence_evidence: retained_ip_evidence,
      play_integrity_evidence: nil,
      contributions: [],
      missing_reasons: if(test_lab?, do: [], else: ["ip.enrichment_pending"]),
      hard_failure_reasons: [],
      assessed_at: if(test_lab?, do: now),
      ip_enriched_at: retained_ip_enriched_at,
      integrity_assessed_at: nil,
      exact_ip_retained_until: nil,
      detailed_evidence_retained_until: nil,
      summary_retained_until: nil
    }

    result =
      case current do
        nil ->
          %Assessment{}
          |> Assessment.create_changeset(access_request.id, attrs)
          |> Repo.insert()

        %Assessment{} = assessment ->
          assessment
          |> Assessment.changeset(attrs)
          |> Repo.update()
      end

    enqueue_assessment(result, test_lab?)
  end

  defp enqueue_assessment({:ok, assessment} = result, false) do
    %{
      access_request_id: assessment.email_access_request_id,
      evidence_revision: assessment.evidence_revision
    }
    |> AssessAccessRequestWorker.new()
    |> Oban.insert()
    |> case do
      {:ok, _job} ->
        :ok

      {:error, _changeset} ->
        :telemetry.execute(
          [:adventure_time_api, :access_assessment, :enqueue_error],
          %{count: 1},
          %{error: :job_insert_failed}
        )
    end

    result
  end

  defp enqueue_assessment(result, _test_lab_or_error), do: result

  defp persist_integrity(assessment, evidence) do
    next_revision = assessment.evidence_revision + 1

    result =
      assessment
      |> Assessment.changeset(%{
        evidence_revision: next_revision,
        play_integrity_evidence: evidence,
        integrity_assessed_at: evidence.verified_at
      })
      |> Repo.update()

    enqueue_assessment(result, false)
  end

  defp persist_integrity_failure(assessment, provider_failure) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    result =
      assessment
      |> Assessment.changeset(%{
        evidence_revision: assessment.evidence_revision + 1,
        play_integrity_evidence: %{
          app_recognition: :unevaluated,
          licensing: :unevaluated,
          device_verdicts: [],
          failure_reason: integrity_failure_reason(provider_failure),
          verified_at: now
        },
        integrity_assessed_at: now
      })
      |> Repo.update()

    case enqueue_assessment(result, false) do
      {:ok, _assessment} -> {:ok, :unavailable}
      error -> error
    end
  end

  defp integrity_failure_reason(:timeout), do: "integrity.provider_timeout"
  defp integrity_failure_reason(:quota_exhausted), do: "integrity.provider_quota_exhausted"
  defp integrity_failure_reason(:invalid_response), do: "integrity.provider_invalid_response"
  defp integrity_failure_reason(:network_error), do: "integrity.provider_network_error"

  defp integrity_failure_reason(:provider_auth_unavailable),
    do: "integrity.provider_auth_unavailable"

  defp integrity_failure_reason(_other), do: "integrity.provider_unavailable"

  defp set_review_retention(repo, assessment, reviewed_at) do
    assessment
    |> Assessment.changeset(%{
      exact_ip_retained_until: DateTime.add(reviewed_at, 30, :day),
      detailed_evidence_retained_until: DateTime.add(reviewed_at, 90, :day),
      summary_retained_until: DateTime.add(reviewed_at, 365, :day)
    })
    |> repo.update()
  end

  defp snapshot_attrs(assessment, outcome, reviewed_at) do
    network_classifications = embedded_map(assessment.network_facts)

    contribution_reasons =
      assessment.contributions
      |> Enum.flat_map(& &1.reason_codes)

    %{
      review_outcome: outcome,
      state: assessment.state,
      evidence_revision: assessment.evidence_revision,
      scoring_model_version: assessment.scoring_model_version,
      platform_profile: assessment.platform_profile,
      trustworthiness_confidence: assessment.trustworthiness_confidence,
      evidence_coverage: assessment.evidence_coverage,
      band: assessment.band,
      network_classifications: network_classifications,
      reason_codes:
        Enum.uniq(
          assessment.missing_reasons ++
            assessment.hard_failure_reasons ++ contribution_reasons
        ),
      assessed_at: assessment.assessed_at,
      reviewed_at: reviewed_at,
      retained_until: DateTime.add(reviewed_at, 365, :day)
    }
  end

  defp embedded_map(nil), do: %{}

  defp embedded_map(embedded) do
    embedded
    |> Map.from_struct()
    |> Map.drop([:__meta__])
  end

  defp canonical_address(nil), do: nil

  defp canonical_address(value) do
    case NetworkAddress.parse(value) do
      {:ok, address} -> address
      :error -> nil
    end
  end

  defp capture_result({:ok, nil}), do: :disabled
  defp capture_result({:ok, _assessment}), do: :ok
  defp capture_result({:error, _changeset}), do: :error

  defp reusable_ip_evidence(nil, _address, _now, _test_lab?), do: {nil, nil}
  defp reusable_ip_evidence(_current, _address, _now, true), do: {nil, nil}

  defp reusable_ip_evidence(current, address, now, false) do
    evidence = current.ip_intelligence_evidence

    if current.canonical_ip == address and evidence != nil and current.ip_enriched_at != nil and
         DateTime.diff(now, current.ip_enriched_at, :second) <= 24 * 60 * 60 and
         evidence.settings_version == ip_settings_version() do
      {Map.from_struct(evidence), current.ip_enriched_at}
    else
      {nil, nil}
    end
  end

  defp platform_profile(metadata) do
    platform = metadata[:client_platform]
    user_agent = metadata[:user_agent] || ""
    native? = String.starts_with?(user_agent, "AdventureTimeNative/")

    cond do
      platform == "android" and native? -> :android
      platform == "ios" and native? -> :ios
      platform == "web" and not native? -> :web
      true -> :unknown
    end
  end

  defp identity_pseudonym(%EmailAccessRequest{
         provider: provider,
         provider_subject_hash: subject_hash
       })
       when provider in ["google", "apple"] and is_binary(subject_hash) do
    Pseudonym.generate(:identity, subject_hash)
  end

  defp identity_pseudonym(_request), do: nil

  defp pseudonym_version do
    :adventure_time_api
    |> Application.get_env(Pseudonym, [])
    |> Keyword.get(:version, "v1")
  end

  defp ip_settings_version do
    :adventure_time_api
    |> Application.get_env(AdventureTimeApi.AccessAssessment.IpIntelligence, [])
    |> Keyword.get(:settings_version, "v1")
  end

  defp mask(nil), do: nil
  defp mask({a, b, c, _d}), do: "#{a}.#{b}.#{c}.x"

  defp mask(address) when tuple_size(address) == 8 do
    prefix =
      address
      |> Tuple.to_list()
      |> Enum.take(4)
      |> Enum.map_join(":", &Integer.to_string(&1, 16))

    "#{prefix}::/64"
  end

  defp admin_view(%Assessment{scoring_model_version: nil}), do: nil

  defp admin_view(%Assessment{state: :test_lab} = assessment) do
    network = network_view(assessment)

    %{
      "state" => "test_lab",
      "heuristic" => true,
      "modelVersion" => assessment.scoring_model_version,
      "platformProfile" => Atom.to_string(assessment.platform_profile),
      "network" => network,
      "assessedAt" => iso8601(assessment.assessed_at)
    }
  end

  defp admin_view(%Assessment{} = assessment) do
    base = %{
      "state" => Atom.to_string(assessment.state),
      "heuristic" => true,
      "modelVersion" => assessment.scoring_model_version,
      "platformProfile" => Atom.to_string(assessment.platform_profile),
      "coverage" => assessment.evidence_coverage,
      "missingReasons" => assessment.missing_reasons,
      "hardFailureReasons" => assessment.hard_failure_reasons,
      "network" => network_view(assessment),
      "assessedAt" => iso8601(assessment.assessed_at)
    }

    if assessment.state in [:complete, :partial] do
      Map.merge(base, %{
        "confidence" => assessment.trustworthiness_confidence,
        "band" => assessment.band && Atom.to_string(assessment.band),
        "contributions" => Enum.map(assessment.contributions, &contribution_view/1)
      })
    else
      base
    end
  end

  defp network_view(assessment) do
    facts = assessment.network_facts
    intelligence = assessment.ip_intelligence_evidence

    %{
      "maskedIpAddress" => assessment.masked_ip_address,
      "googleNetwork" => enum_string(facts && facts.google_network),
      "testLab" => enum_string(facts && facts.test_lab),
      "testLabMatchedCidr" => facts && facts.test_lab_matched_cidr,
      "testLabRangeVersion" => facts && facts.test_lab_range_version,
      "googleMatchedCidr" => facts && facts.google_network_matched_cidr,
      "googleRangeVersion" => facts && facts.google_network_range_version,
      "testLabRangeStale" => facts && facts.test_lab_range_stale,
      "googleRangeStale" => facts && facts.google_network_range_stale,
      "organization" => intelligence && intelligence.organization,
      "asn" => intelligence && intelligence.asn,
      "countryCode" => intelligence && intelligence.country_code,
      "connectionType" => intelligence && intelligence.connection_type,
      "vpn" => intelligence && intelligence.vpn,
      "proxy" => intelligence && intelligence.proxy,
      "hosting" => intelligence && intelligence.hosting,
      "tor" => intelligence && intelligence.active_tor
    }
  end

  defp contribution_view(contribution) do
    %{
      "key" => Atom.to_string(contribution.key),
      "weight" => contribution.weight,
      "value" => contribution.value,
      "effectFromNeutral" => contribution.effect_from_neutral,
      "reasonCodes" => contribution.reason_codes,
      "explanations" => contribution.explanations,
      "observedAt" => iso8601(contribution.observed_at),
      "hardFailure" => contribution.hard_failure,
      "modelVersion" => contribution.model_version
    }
  end

  defp revealable?(%Assessment{canonical_ip: address} = assessment, now)
       when not is_nil(address) do
    is_nil(assessment.exact_ip_retained_until) or
      DateTime.compare(assessment.exact_ip_retained_until, now) == :gt
  end

  defp revealable?(_assessment, _now), do: false

  defp enum_string(nil), do: "unknown"
  defp enum_string(value), do: Atom.to_string(value)
  defp iso8601(nil), do: nil
  defp iso8601(value), do: DateTime.to_iso8601(value)
end
