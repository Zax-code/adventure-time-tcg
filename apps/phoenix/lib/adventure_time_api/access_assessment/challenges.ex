defmodule AdventureTimeApi.AccessAssessment.Challenges do
  @moduledoc false

  import Ecto.Query

  alias AdventureTimeApi.AccessAssessment.Assessment
  alias AdventureTimeApi.AccessAssessment.IntegrityChallenge
  alias AdventureTimeApi.Repo

  @kind "play_integrity_standard"
  @action "access_request_assessment"
  @hash_version "v1"
  @ttl_seconds 5 * 60

  def issue(access_request_id) do
    started_at = System.monotonic_time()

    result =
      if AdventureTimeApi.AccessAssessment.collection_enabled?() do
        case Repo.get_by(Assessment, email_access_request_id: access_request_id) do
          %Assessment{platform_profile: :android, state: state} = assessment
          when state != :test_lab ->
            issue_for_assessment(assessment)

          _other ->
            {:ok, nil}
        end
      else
        {:ok, nil}
      end

    emit(:issue, challenge_result(result), started_at)
    result
  end

  def consume(token) when is_binary(token) do
    started_at = System.monotonic_time()
    digest = digest(token)
    now = now()

    result =
      Repo.transaction(fn ->
        challenge =
          Repo.one(
            from(c in IntegrityChallenge,
              where:
                c.challenge_digest == ^digest and is_nil(c.consumed_at) and
                  c.expires_at > ^now,
              lock: "FOR UPDATE"
            )
          )

        case challenge do
          %IntegrityChallenge{} ->
            challenge
            |> Ecto.Changeset.change(consumed_at: now)
            |> Repo.update!()

          nil ->
            Repo.rollback(:invalid_challenge)
        end
      end)

    emit(:consume, challenge_result(result), started_at)
    result
  end

  def consume(_token), do: {:error, :invalid_challenge}

  defp issue_for_assessment(assessment) do
    token = :crypto.strong_rand_bytes(32) |> Base.url_encode64(padding: false)
    challenge_digest = digest(token)
    expires_at = DateTime.add(now(), @ttl_seconds, :second)

    request_hash =
      request_hash(
        challenge_digest,
        assessment.email_access_request_id,
        assessment.evidence_revision,
        package_name()
      )

    attrs = %{
      challenge_digest: challenge_digest,
      expected_request_hash: request_hash,
      evidence_revision: assessment.evidence_revision,
      expires_at: expires_at
    }

    case %IntegrityChallenge{}
         |> IntegrityChallenge.create_changeset(assessment.email_access_request_id, attrs)
         |> Repo.insert() do
      {:ok, _stored} ->
        {:ok,
         %{
           kind: @kind,
           token: token,
           requestHash: request_hash,
           expiresAt: expires_at
         }}

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  defp request_hash(challenge_digest, request_id, evidence_revision, package_name) do
    [
      @hash_version,
      Base.url_encode64(challenge_digest, padding: false),
      request_id,
      Integer.to_string(evidence_revision),
      package_name,
      @action
    ]
    |> Enum.join("\n")
    |> digest()
    |> Base.url_encode64(padding: false)
  end

  defp digest(value), do: :crypto.hash(:sha256, value)
  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second)

  defp package_name do
    :adventure_time_api
    |> Application.get_env(AdventureTimeApi.AccessAssessment.PlayIntegrity, [])
    |> Keyword.get(:package_name, "love.leaetzak.adventuretime")
  end

  defp emit(operation, result, started_at) do
    :telemetry.execute(
      [:adventure_time_api, :access_assessment, :challenge],
      %{count: 1, duration: System.monotonic_time() - started_at},
      %{operation: operation, result: result}
    )
  end

  defp challenge_result({:ok, nil}), do: :not_applicable
  defp challenge_result({:ok, _challenge}), do: :ok
  defp challenge_result({:error, :invalid_challenge}), do: :invalid
  defp challenge_result({:error, _reason}), do: :error
end
