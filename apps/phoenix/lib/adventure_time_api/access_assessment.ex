defmodule AdventureTimeApi.AccessAssessment do
  @moduledoc """
  Captures, enriches, and exposes advisory access-request assessments.
  """

  alias AdventureTimeApi.AccessAssessment.Assessment
  alias AdventureTimeApi.AccessAssessment.Pseudonym
  alias AdventureTimeApi.AccessAssessment.Snapshot
  alias AdventureTimeApi.AccessRequestAssessment.NetworkClassification
  alias AdventureTimeApi.Accounts.EmailAccessRequest
  alias AdventureTimeApi.NetworkAddress
  alias AdventureTimeApi.Repo
  alias AdventureTimeApi.Workers.AssessAccessRequestWorker

  @spec capture(EmailAccessRequest.t(), map()) ::
          {:ok, Assessment.t() | nil} | {:error, Ecto.Changeset.t()}
  def capture(%EmailAccessRequest{} = access_request, metadata) when is_map(metadata) do
    if collection_enabled?() do
      persist_local_assessment(access_request, metadata)
    else
      {:ok, nil}
    end
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
    address = canonical_address(metadata[:ip_address])
    classification = NetworkClassification.classify(address)
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    current = Repo.get_by(Assessment, email_access_request_id: access_request.id)
    evidence_revision = if current, do: current.evidence_revision + 1, else: 1
    test_lab? = classification.test_lab == :matched

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
      pseudonym_version: pseudonym_version(),
      network_facts: classification,
      contributions: [],
      missing_reasons: if(test_lab?, do: [], else: ["ip.enrichment_pending"]),
      hard_failure_reasons: [],
      assessed_at: if(test_lab?, do: now),
      ip_enriched_at: nil,
      integrity_assessed_at: nil
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

      {:error, changeset} ->
        :telemetry.execute(
          [:adventure_time_api, :access_assessment, :enqueue_error],
          %{count: 1},
          %{error: inspect(changeset.errors)}
        )
    end

    result
  end

  defp enqueue_assessment(result, _test_lab_or_error), do: result

  defp set_review_retention(repo, assessment, reviewed_at) do
    assessment
    |> Assessment.changeset(%{
      exact_ip_retained_until: DateTime.add(reviewed_at, 30, :day),
      detailed_evidence_retained_until: DateTime.add(reviewed_at, 90, :day)
    })
    |> repo.update()
  end

  defp snapshot_attrs(assessment, outcome, reviewed_at) do
    network_classifications = embedded_map(assessment.network_facts)

    contributions = Enum.map(assessment.contributions, &embedded_map/1)

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
      contributions: contributions,
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

  defp identity_pseudonym(%EmailAccessRequest{provider: provider, email: email})
       when provider in ["google", "apple"] do
    Pseudonym.generate(:identity, email)
  end

  defp identity_pseudonym(_request), do: nil

  defp pseudonym_version do
    :adventure_time_api
    |> Application.get_env(Pseudonym, [])
    |> Keyword.get(:version, "v1")
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
end
