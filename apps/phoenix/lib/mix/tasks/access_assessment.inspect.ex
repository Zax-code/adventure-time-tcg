defmodule Mix.Tasks.AccessAssessment.Inspect do
  @shortdoc "Reports aggregate access-assessment shadow-rollout metrics"

  @moduledoc """
  Reports aggregate access-assessment lifecycle, evidence, platform, provider,
  range-age, and manual-outcome metrics without row-level personal data.

      mix access_assessment.inspect
  """

  use Mix.Task

  import Ecto.Query

  alias AdventureTimeApi.AccessAssessment.Assessment
  alias AdventureTimeApi.AccessAssessment.Snapshot
  alias AdventureTimeApi.AccessRequestAssessment.NetworkClassification
  alias AdventureTimeApi.Repo

  @minimum_cohort_size 5

  @impl Mix.Task
  def run(_args) do
    Mix.Task.run("app.start")

    report = %{
      lifecycle: grouped_counts(:state),
      coverage_distribution: coverage_distribution(),
      score_distribution: score_distribution(),
      platform_profiles: grouped_counts(:platform_profile),
      provider_availability: provider_availability(),
      range_data: NetworkClassification.range_metadata(),
      manual_outcomes: manual_outcomes()
    }

    Mix.shell().info(Jason.encode!(report, pretty: true))
  end

  defp grouped_counts(field_name) do
    Assessment
    |> group_by([assessment], field(assessment, ^field_name))
    |> select([assessment], {field(assessment, ^field_name), count(assessment.id)})
    |> Repo.all()
    |> Map.new(fn {key, count} -> {to_string(key), count} end)
  end

  defp coverage_distribution do
    distribution(:evidence_coverage)
  end

  defp score_distribution do
    distribution(:trustworthiness_confidence)
  end

  defp distribution(field_name) do
    Assessment
    |> where([assessment], not is_nil(field(assessment, ^field_name)))
    |> group_by(
      [assessment],
      fragment(
        "CASE WHEN ? < 40 THEN '0-39' WHEN ? < 70 THEN '40-69' ELSE '70-100' END",
        field(assessment, ^field_name),
        field(assessment, ^field_name)
      )
    )
    |> select(
      [assessment],
      {fragment(
         "CASE WHEN ? < 40 THEN '0-39' WHEN ? < 70 THEN '40-69' ELSE '70-100' END",
         field(assessment, ^field_name),
         field(assessment, ^field_name)
       ), count(assessment.id)}
    )
    |> Repo.all()
    |> Map.new()
  end

  defp provider_availability do
    Repo.one(
      from(assessment in Assessment,
        select: %{
          total: count(assessment.id),
          ipqs_available:
            fragment("COUNT(*) FILTER (WHERE ? IS NOT NULL)", assessment.ip_intelligence_evidence),
          play_integrity_available:
            fragment("COUNT(*) FILTER (WHERE ? IS NOT NULL)", assessment.play_integrity_evidence)
        }
      )
    )
  end

  defp manual_outcomes do
    Snapshot
    |> group_by([snapshot], [snapshot.band, snapshot.review_outcome])
    |> select([snapshot], {snapshot.band, snapshot.review_outcome, count(snapshot.id)})
    |> Repo.all()
    |> Enum.filter(fn {_band, _outcome, count} -> count >= @minimum_cohort_size end)
    |> Enum.map(fn {band, outcome, count} ->
      %{
        band: band && to_string(band),
        outcome: to_string(outcome),
        count: count,
        disagreement:
          (band == :stronger and outcome == :rejected) or
            (band == :concerning and outcome == :approved)
      }
    end)
  end
end
