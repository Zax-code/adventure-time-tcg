defmodule AdventureTimeApi.Repo.Migrations.AddOverallQuestsLeaderboard do
  use Ecto.Migration

  def up do
    drop(constraint(:leaderboard_boards, :leaderboard_boards_kind_valid))

    create(
      constraint(:leaderboard_boards, :leaderboard_boards_kind_valid,
        check: "board_kind IN ('source', 'derived_family', 'derived_overall')"
      )
    )

    execute("""
    INSERT INTO leaderboard_boards
      (id, key, quest_family, mode, direction, board_kind, derived_members,
       enabled, prizes_enabled, display_order, raw_result_kind, validation_policy,
       inserted_at, updated_at)
    VALUES
      (gen_random_uuid(), 'overall/all-quests', 'overall', 'all-quests', 'points',
       'derived_overall',
       '{"members":["steps/default","daily-numbers/family","wordle/family","speed-calculus/ranked","perfect-timing/official"]}',
       true, false, 11, 'member_breakdown', '{}', now(), now())
    ON CONFLICT (key) DO NOTHING
    """)
  end

  def down do
    execute("DELETE FROM leaderboard_boards WHERE key = 'overall/all-quests'")

    drop(constraint(:leaderboard_boards, :leaderboard_boards_kind_valid))

    create(
      constraint(:leaderboard_boards, :leaderboard_boards_kind_valid,
        check: "board_kind IN ('source', 'derived_family')"
      )
    )
  end
end
