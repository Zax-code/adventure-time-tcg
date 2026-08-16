defmodule AdventureTimeApi.Workers.PruneAccessAssessmentDataWorker do
  @moduledoc false

  use Oban.Worker, queue: :maintenance, max_attempts: 3, unique: [period: 3_600]

  import Ecto.Query

  alias AdventureTimeApi.AccessAssessment.Assessment
  alias AdventureTimeApi.AccessAssessment.IntegrityChallenge
  alias AdventureTimeApi.AccessAssessment.IpRevealAudit
  alias AdventureTimeApi.AccessAssessment.Snapshot
  alias AdventureTimeApi.Accounts.AuthAttempt
  alias AdventureTimeApi.Accounts.EmailAccessRequest
  alias AdventureTimeApi.Repo

  @impl Oban.Worker
  def perform(%Oban.Job{args: args}) do
    now = parse_now(args["now"])

    exact_request_ids =
      Repo.all(
        from(a in Assessment,
          where:
            not is_nil(a.exact_ip_retained_until) and
              a.exact_ip_retained_until <= ^now and not is_nil(a.canonical_ip),
          select: a.email_access_request_id
        )
      )

    {exact_count, _} =
      Repo.update_all(
        from(a in Assessment,
          where:
            not is_nil(a.exact_ip_retained_until) and
              a.exact_ip_retained_until <= ^now and not is_nil(a.canonical_ip)
        ),
        set: [canonical_ip: nil]
      )

    if exact_request_ids != [] do
      Repo.update_all(
        from(a in AuthAttempt, where: a.email_access_request_id in ^exact_request_ids),
        set: [canonical_ip: nil, ip_address: nil]
      )

      Repo.update_all(
        from(r in EmailAccessRequest, where: r.id in ^exact_request_ids),
        set: [last_ip_address: nil]
      )
    end

    {detail_count, _} =
      Repo.update_all(
        from(a in Assessment,
          where:
            not is_nil(a.detailed_evidence_retained_until) and
              a.detailed_evidence_retained_until <= ^now and
              (not is_nil(a.ip_intelligence_evidence) or
                 not is_nil(a.play_integrity_evidence) or
                 not is_nil(a.identity_provider_pseudonym) or
                 not is_nil(a.installation_provider_pseudonym) or
                 fragment("cardinality(?) > 0", a.contributions))
        ),
        set: [
          ip_intelligence_evidence: nil,
          play_integrity_evidence: nil,
          identity_provider_pseudonym: nil,
          installation_provider_pseudonym: nil,
          contributions: []
        ]
      )

    summary_request_ids =
      Repo.all(
        from(a in Assessment,
          where: not is_nil(a.summary_retained_until) and a.summary_retained_until <= ^now,
          select: a.email_access_request_id
        )
      )

    {summary_count, _} =
      Repo.update_all(
        from(a in Assessment,
          where: not is_nil(a.summary_retained_until) and a.summary_retained_until <= ^now
        ),
        set: [
          state: :unavailable,
          scoring_model_version: nil,
          trustworthiness_confidence: nil,
          evidence_coverage: nil,
          band: nil,
          masked_ip_address: nil,
          network_facts: nil,
          missing_reasons: [],
          hard_failure_reasons: [],
          assessed_at: nil,
          summary_retained_until: nil
        ]
      )

    {reveal_audit_count, _} =
      if summary_request_ids == [] do
        {0, nil}
      else
        Repo.delete_all(
          from(audit in IpRevealAudit,
            where: audit.email_access_request_id in ^summary_request_ids
          )
        )
      end

    {snapshot_count, _} =
      Repo.delete_all(from(s in Snapshot, where: s.retained_until <= ^now))

    {challenge_count, _} =
      Repo.delete_all(from(c in IntegrityChallenge, where: c.expires_at <= ^now))

    :telemetry.execute(
      [:adventure_time_api, :access_assessment, :retention],
      %{
        exact_ip_deleted: exact_count,
        details_deleted: detail_count,
        summaries_deleted: summary_count,
        reveal_audits_deleted: reveal_audit_count,
        snapshots_deleted: snapshot_count,
        challenges_deleted: challenge_count
      },
      %{}
    )

    :ok
  end

  defp parse_now(nil), do: DateTime.utc_now() |> DateTime.truncate(:second)

  defp parse_now(value) do
    case DateTime.from_iso8601(value) do
      {:ok, now, _offset} -> DateTime.truncate(now, :second)
      _error -> DateTime.utc_now() |> DateTime.truncate(:second)
    end
  end
end
