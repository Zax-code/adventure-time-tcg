defmodule AdventureTimeApi.Workers.AssessAccessRequestWorker do
  @moduledoc false

  use Oban.Worker,
    queue: :assessments,
    max_attempts: 5,
    unique: [period: 86_400, fields: [:worker, :args]]

  alias AdventureTimeApi.AccessAssessment.{
    Assessment,
    EvidenceBuilder,
    IpIntelligence,
    Score,
    Signals
  }

  alias AdventureTimeApi.Accounts.EmailAccessRequest
  alias AdventureTimeApi.NetworkAddress
  alias AdventureTimeApi.Repo

  @impl Oban.Worker
  def perform(%Oban.Job{} = job) do
    started_at = System.monotonic_time()
    result = perform_assessment(job)

    :telemetry.execute(
      [:adventure_time_api, :access_assessment, :worker],
      %{count: 1, duration: System.monotonic_time() - started_at},
      %{result: worker_result(result)}
    )

    result
  end

  defp perform_assessment(%Oban.Job{
         args: %{
           "access_request_id" => access_request_id,
           "evidence_revision" => evidence_revision
         }
       }) do
    with %Assessment{} = assessment <-
           Repo.get_by(Assessment, email_access_request_id: access_request_id),
         true <- assessment.evidence_revision == evidence_revision,
         %EmailAccessRequest{} = request <- Repo.get(EmailAccessRequest, access_request_id) do
      assess(request, assessment)
    else
      nil -> :discard
      false -> :discard
    end
  end

  defp worker_result(:ok), do: :complete
  defp worker_result(:discard), do: :stale_or_missing
  defp worker_result({:error, _reason}), do: :retryable_error

  defp assess(request, assessment) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    {ip_component, ip_evidence, provider_result} = lookup_ip(request, assessment, now)
    components = EvidenceBuilder.components(request, assessment, ip_component, now)
    result = Score.calculate(assessment.platform_profile, components)

    case persist_current_revision(assessment, result, ip_evidence, now) do
      {:ok, _updated} when provider_result == :ok ->
        emit_outcome(result.state)
        :ok

      {:ok, _updated} ->
        emit_outcome(result.state)
        {:error, provider_result}

      {:error, :stale_revision} ->
        :discard

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  defp emit_outcome(state) do
    :telemetry.execute(
      [:adventure_time_api, :access_assessment, :outcome],
      %{count: 1},
      %{state: state}
    )
  end

  defp lookup_ip(_request, %Assessment{canonical_ip: nil}, _now) do
    {
      {:missing, "ip.canonical_address_unavailable"},
      nil,
      :canonical_address_unavailable
    }
  end

  defp lookup_ip(request, assessment, now) do
    if current_ip_evidence?(assessment, now) do
      evidence = Map.from_struct(assessment.ip_intelligence_evidence)
      {Signals.ip_intelligence(evidence), evidence, :ok}
    else
      fetch_ip(request, assessment, now)
    end
  end

  defp fetch_ip(request, assessment, now) do
    input = %{
      ip_address: NetworkAddress.to_string(assessment.canonical_ip),
      user_agent: request.last_user_agent,
      accept_language: request.last_accept_language,
      identity_pseudonym: assessment.identity_provider_pseudonym,
      installation_pseudonym: assessment.installation_provider_pseudonym
    }

    case IpIntelligence.lookup(input) do
      {:ok, evidence} ->
        evidence =
          evidence
          |> Map.put(:looked_up_at, now)
          |> Map.put(:settings_version, ip_settings_version())

        {Signals.ip_intelligence(evidence), evidence, :ok}

      {:error, reason} ->
        {{:missing, "ip.provider_unavailable"}, nil, reason}
    end
  end

  defp current_ip_evidence?(assessment, now) do
    assessment.ip_intelligence_evidence != nil and assessment.ip_enriched_at != nil and
      DateTime.diff(now, assessment.ip_enriched_at, :second) <= 24 * 60 * 60 and
      assessment.ip_intelligence_evidence.settings_version == ip_settings_version()
  end

  defp ip_settings_version do
    :adventure_time_api
    |> Application.get_env(IpIntelligence, [])
    |> Keyword.get(:settings_version, "v1")
  end

  defp persist_current_revision(original, result, ip_evidence, now) do
    case Repo.get(Assessment, original.id) do
      %Assessment{evidence_revision: revision} = current
      when revision == original.evidence_revision ->
        current
        |> Assessment.changeset(%{
          state: result.state,
          scoring_model_version: result.scoring_model_version,
          trustworthiness_confidence: result.trustworthiness_confidence,
          evidence_coverage: result.evidence_coverage,
          band: result.band,
          contributions: result.contributions,
          missing_reasons: result.missing_reasons,
          hard_failure_reasons: result.hard_failure_reasons,
          ip_intelligence_evidence: ip_evidence,
          ip_enriched_at: if(ip_evidence, do: now),
          assessed_at: now
        })
        |> Repo.update()

      _missing_or_newer ->
        {:error, :stale_revision}
    end
  end
end
