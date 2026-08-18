defmodule AdventureTimeApi.Leaderboards.ProjectionTest do
  use AdventureTimeApi.DataCase, async: true

  alias AdventureTimeApi.Accounts.User

  alias AdventureTimeApi.Leaderboards.{
    Board,
    CompetitionSlot,
    DailyResult,
    Period,
    Projection,
    Scoring,
    ScoringVersion
  }

  test "all quests sums every family and ranks a player with only one eligible result" do
    date = ~D[2026-08-17]
    scoring_version = insert_scoring_version!()
    all_quests = Repo.get_by!(Board, key: "overall/all-quests")
    finn = insert_user!("finn")
    marceline = insert_user!("marceline")
    finn_slot = insert_slot!(finn.id, date)
    marceline_slot = insert_slot!(marceline.id, date)

    insert_result!(finn, finn_slot, scoring_version, date, "steps/default", 1_000_000)
    insert_result!(finn, finn_slot, scoring_version, date, "daily-numbers/1-5", 2_000_000)
    insert_result!(finn, finn_slot, scoring_version, date, "wordle/en", 300_000)
    insert_result!(finn, finn_slot, scoring_version, date, "speed-calculus/ranked", 600_000)

    insert_result!(
      finn,
      finn_slot,
      scoring_version,
      date,
      "perfect-timing/official",
      1_200_000
    )

    insert_result!(
      marceline,
      marceline_slot,
      scoring_version,
      date,
      "perfect-timing/official",
      10_000_000
    )

    period = %Period{period_type: :day, competition_date: date}
    rows = Projection.rows(period, all_quests, Scoring.launch_configuration())

    assert [marceline_row, finn_row] = rows
    assert marceline_row.user_id == marceline.id
    assert marceline_row.points_milli == 10_000_000
    assert marceline_row.rank == 1
    assert length(marceline_row.selected_daily_result_ids) == 1

    assert finn_row.user_id == finn.id
    assert finn_row.points_milli == 5_100_000
    assert finn_row.rank == 2
    assert length(finn_row.selected_daily_result_ids) == 5

    assert finn_row.raw_result == %{
             "kind" => "member_breakdown",
             "members" => %{
               "daily-numbers/family" => 2_000_000,
               "perfect-timing/official" => 1_200_000,
               "speed-calculus/ranked" => 600_000,
               "steps/default" => 1_000_000,
               "wordle/family" => 300_000
             }
           }
  end

  defp insert_user!(label) do
    %User{}
    |> User.registration_changeset(%{
      email: "projection-#{label}-#{System.unique_integer([:positive])}@example.com",
      display_name: String.capitalize(label),
      timezone: "Etc/UTC"
    })
    |> Repo.insert!()
  end

  defp insert_scoring_version! do
    unique = System.unique_integer([:positive])

    %ScoringVersion{}
    |> ScoringVersion.changeset(%{
      version: "projection-test-#{unique}",
      schema_version: 1,
      configuration: Jason.decode!(Jason.encode!(Scoring.launch_configuration())),
      configuration_hash: Ecto.UUID.generate(),
      effective_week_start: Date.add(~D[2040-01-02], 7 * rem(unique, 400)),
      status: :active
    })
    |> Repo.insert!()
  end

  defp insert_slot!(user_id, date) do
    %CompetitionSlot{}
    |> CompetitionSlot.changeset(%{
      user_id: user_id,
      competition_week_key: Date.beginning_of_week(date, :monday),
      slot_number: 1,
      local_date: date,
      detected_timezone: "Etc/UTC",
      effective_timezone: "Etc/UTC",
      starts_at: DateTime.new!(date, ~T[00:00:00], "Etc/UTC"),
      ends_at: DateTime.new!(Date.add(date, 1), ~T[00:00:00], "Etc/UTC"),
      status: :open
    })
    |> Repo.insert!()
  end

  defp insert_result!(user, slot, scoring_version, date, board_key, points_milli) do
    board = Repo.get_by!(Board, key: board_key)

    %DailyResult{}
    |> DailyResult.changeset(%{
      user_id: user.id,
      board_id: board.id,
      competition_slot_id: slot.id,
      competition_date: date,
      source_kind: "projection_test",
      source_id: Ecto.UUID.generate(),
      raw_result: %{"kind" => "correct_answers", "correctAnswers" => 1},
      points_milli: points_milli,
      scoring_version_id: scoring_version.id,
      result_status: :accepted,
      integrity_status: :accepted,
      eligibility_status: :eligible,
      active: true,
      provisional: true,
      submitted_at: DateTime.utc_now()
    })
    |> Repo.insert!()
  end
end
