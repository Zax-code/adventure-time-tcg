defmodule AdventureTimeApi.Leaderboards.ResultRecorderTest do
  use AdventureTimeApi.DataCase, async: true

  alias AdventureTimeApi.Accounts.User

  alias AdventureTimeApi.Leaderboards.{
    Board,
    CompetitionSlot,
    DailyResult,
    ResultRecorder,
    ResultTelemetry,
    Scoring,
    ScoringVersion
  }

  test "records server-normalized results and preserves superseded versions" do
    user = insert_user!()
    board = Repo.get_by!(Board, key: "steps/default")
    scoring_version = insert_scoring_version!()
    slot = insert_slot!(user.id)

    first =
      record_steps!(user, board, scoring_version, slot,
        steps: 20_000,
        source_id: Ecto.UUID.generate()
      )

    assert first.points_milli == 632_121
    assert first.result_status == :accepted
    assert first.active

    assert Repo.get_by!(ResultTelemetry, result_id: first.id).normalized_metrics == %{
             "steps" => 20_000
           }

    replacement =
      record_steps!(user, board, scoring_version, slot,
        steps: 18_000,
        source_id: Ecto.UUID.generate()
      )

    refute Repo.reload!(first).active
    assert replacement.active
    assert replacement.supersedes_result_id == first.id
    assert Repo.aggregate(DailyResult, :count) == 2
  end

  defp record_steps!(user, board, scoring_version, slot, options) do
    assert {:ok, result} =
             ResultRecorder.record_validated(%{
               user_id: user.id,
               board_key: board.key,
               competition_slot_id: slot.id,
               competition_date: slot.local_date,
               source_kind: "health_step_snapshot",
               source_id: options[:source_id],
               raw_result: %{"steps" => options[:steps]},
               raw_numeric_value: options[:steps],
               outcome: "accepted",
               scoring_version_id: scoring_version.id,
               scoring_configuration: Scoring.launch_configuration(),
               submitted_at: DateTime.utc_now(),
               telemetry: %{normalized_metrics: %{"steps" => options[:steps]}}
             })

    result
  end

  defp insert_user! do
    %User{}
    |> User.registration_changeset(%{
      email: "recorder-#{System.unique_integer([:positive])}@example.com",
      display_name: "Jake"
    })
    |> Repo.insert!()
  end

  defp insert_scoring_version! do
    unique = System.unique_integer([:positive])

    %ScoringVersion{}
    |> ScoringVersion.changeset(%{
      version: "test-#{unique}",
      schema_version: 1,
      configuration: %{"test" => true},
      configuration_hash: Ecto.UUID.generate(),
      effective_week_start: Date.add(~D[2030-01-07], 7 * rem(unique, 500)),
      status: :active
    })
    |> Repo.insert!()
  end

  defp insert_slot!(user_id) do
    %CompetitionSlot{}
    |> CompetitionSlot.changeset(%{
      user_id: user_id,
      competition_week_key: ~D[2026-08-10],
      slot_number: 6,
      local_date: ~D[2026-08-15],
      detected_timezone: "America/New_York",
      effective_timezone: "America/New_York",
      starts_at: ~U[2026-08-15 04:00:00.000000Z],
      ends_at: ~U[2026-08-16 04:00:00.000000Z],
      status: :open
    })
    |> Repo.insert!()
  end
end
