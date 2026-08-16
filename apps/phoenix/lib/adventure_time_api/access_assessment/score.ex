defmodule AdventureTimeApi.AccessAssessment.Score do
  @moduledoc """
  Pure, provider-neutral calculation of an explainable access-request score.
  """

  @model_version "access-request-v1"
  @minimum_coverage 40

  @profiles %{
    android: [
      play_integrity: 30,
      identity: 20,
      continuity: 15,
      client: 10,
      ip_intelligence: 25
    ],
    ios: [identity: 30, continuity: 25, client: 20, ip_intelligence: 25],
    web: [identity: 35, continuity: 25, client: 15, ip_intelligence: 25],
    unknown: [identity: 30, continuity: 25, client: 20, ip_intelligence: 25]
  }

  @type profile :: :android | :ios | :web | :unknown

  def model_version, do: @model_version

  @spec calculate(profile(), map(), keyword()) :: map()
  def calculate(profile, components, opts \\ []) when is_map(components) do
    if Keyword.get(opts, :test_lab) == :matched do
      test_lab_result(profile)
    else
      calculate_components(profile, components)
    end
  end

  defp calculate_components(profile, components) do
    weights = Map.fetch!(@profiles, profile)

    {contributions, missing_reasons} =
      Enum.reduce(weights, {[], []}, fn {key, weight}, {available, missing} ->
        case Map.get(components, key, {:missing, "#{key}.unavailable"}) do
          {:missing, reason} when is_binary(reason) ->
            {available, [reason | missing]}

          component when is_map(component) ->
            contribution = contribution!(key, weight, component)
            {[contribution | available], missing}

          invalid ->
            raise ArgumentError, "invalid #{key} evidence: #{inspect(invalid)}"
        end
      end)

    contributions = Enum.reverse(contributions)
    missing_reasons = Enum.reverse(missing_reasons)
    available_weight = Enum.sum(Enum.map(contributions, & &1.weight))
    coverage = round(100 * available_weight / 100)
    score = score(contributions, available_weight, coverage)

    %{
      state: lifecycle(coverage, missing_reasons),
      scoring_model_version: @model_version,
      platform_profile: profile,
      trustworthiness_confidence: score,
      evidence_coverage: coverage,
      band: band(score),
      contributions: contributions,
      missing_reasons: missing_reasons,
      hard_failure_reasons: hard_failure_reasons(contributions)
    }
  end

  defp contribution!(key, weight, component) do
    value = Map.fetch!(component, :value)

    unless is_integer(value) and value in 0..100 do
      raise ArgumentError, "#{key} value must be an integer from 0 through 100"
    end

    %{
      key: key,
      weight: weight,
      value: value,
      effect_from_neutral: (value - 50) * weight / 100,
      reason_codes: Map.get(component, :reason_codes, []),
      explanations: Map.get(component, :explanations, []),
      observed_at: Map.get(component, :observed_at),
      hard_failure: Map.get(component, :hard_failure, false)
    }
  end

  defp score(_contributions, _available_weight, coverage) when coverage < @minimum_coverage,
    do: nil

  defp score(contributions, available_weight, _coverage) do
    weighted_total = Enum.sum(Enum.map(contributions, &(&1.value * &1.weight)))
    round(weighted_total / available_weight)
  end

  defp lifecycle(coverage, _missing_reasons) when coverage < @minimum_coverage,
    do: :unavailable

  defp lifecycle(_coverage, []), do: :complete
  defp lifecycle(_coverage, _missing_reasons), do: :partial

  defp band(nil), do: nil
  defp band(score) when score >= 70, do: :stronger
  defp band(score) when score >= 40, do: :mixed
  defp band(_score), do: :concerning

  defp hard_failure_reasons(contributions) do
    contributions
    |> Enum.filter(& &1.hard_failure)
    |> Enum.flat_map(& &1.reason_codes)
    |> Enum.uniq()
  end

  defp test_lab_result(profile) do
    %{
      state: :test_lab,
      scoring_model_version: @model_version,
      platform_profile: profile,
      trustworthiness_confidence: nil,
      evidence_coverage: nil,
      band: nil,
      contributions: [],
      missing_reasons: [],
      hard_failure_reasons: []
    }
  end
end
