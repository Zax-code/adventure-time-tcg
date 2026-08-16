defmodule AdventureTimeApi.Leaderboards.LifecycleTest do
  use AdventureTimeApi.DataCase, async: false

  alias AdventureTimeApi.Accounts.User
  alias AdventureTimeApi.Accounts
  alias AdventureTimeApi.Health.StepSnapshot

  alias AdventureTimeApi.Leaderboards.{
    Configuration,
    DailyResult,
    Lifecycle,
    Period,
    Query,
    QuestResults,
    RewardGrant,
    RewardWallet,
    Snapshot,
    SnapshotRow,
    UserAchievement
  }

  test "opens a queryable empty current week and is idempotent" do
    user = insert_user!("empty")
    now = ~U[2026-08-17 00:05:00.000000Z]

    assert :ok = Lifecycle.tick(now)
    assert :ok = Lifecycle.tick(now)

    assert Repo.aggregate(Period, :count) == 4
    assert Repo.aggregate(Snapshot, :count) == 20

    assert {:ok, payload} = Query.fetch("steps", "default", "current_week", user.id)
    assert payload.rows == []
    assert payload.qualification == %{validResults: 0, requiredResults: 3}
    assert payload.period.provisional
  end

  test "opens the partial launch week as a no-prize preview" do
    assert :ok = Lifecycle.tick(~U[2026-08-15 12:00:00.000000Z])

    week = Repo.get_by!(Period, period_type: :week, week_start: ~D[2026-08-10])
    assert week.launch_partial
    refute week.prizes_allowed
    assert week.status == :open
  end

  test "reconciles authoritative source records missed by request hooks" do
    user = insert_user!("reconcile")

    %StepSnapshot{}
    |> StepSnapshot.changeset(%{
      user_id: user.id,
      source: :device_health,
      step_count: 12_000,
      recorded_for: ~D[2026-08-17]
    })
    |> Repo.insert!()

    assert Repo.aggregate(DailyResult, :count) == 0
    assert :ok = Lifecycle.tick(~U[2026-08-17 12:00:00.000000Z])
    assert Repo.aggregate(DailyResult, :count) == 1

    assert {:ok, weekly} = Query.fetch("steps", "default", "current_week", user.id)
    assert weekly.pendingCurrentPlayerResult == %{"kind" => "steps", "steps" => 12_000}
  end

  test "closes local-date results and ranks the best three in the current week", _context do
    first = insert_user!("first")
    second = insert_user!("second")
    activate!()

    Enum.each(
      [
        {~D[2026-08-17], 10_000},
        {~D[2026-08-18], 20_000},
        {~D[2026-08-19], 30_000},
        {~D[2026-08-20], 40_000}
      ],
      fn {date, steps} -> insert_and_sync_steps!(first, date, steps) end
    )

    Enum.each(
      [
        {~D[2026-08-17], 10_000},
        {~D[2026-08-18], 15_000},
        {~D[2026-08-19], 20_000}
      ],
      fn {date, steps} -> insert_and_sync_steps!(second, date, steps) end
    )

    now = ~U[2026-08-20 20:16:00.000000Z]
    assert :ok = Lifecycle.tick(now)

    assert {:ok, yesterday} = Query.fetch("steps", "default", "yesterday", first.id)
    assert Enum.map(yesterday.rows, & &1.rank) == [1, 2]
    assert yesterday.currentPlayer.rank == 1

    assert {:ok, weekly} = Query.fetch("steps", "default", "current_week", second.id)
    assert Enum.map(weekly.rows, & &1.rank) == [1, 2]
    assert hd(weekly.rows).pointsMilli == 600_820
    assert weekly.period.standingsThrough == ~D[2026-08-19]
    assert weekly.pendingCurrentPlayerResult == nil
    assert weekly.currentPlayer.rank == 2
    assert is_nil(weekly.qualification)

    assert {:ok, first_weekly} = Query.fetch("steps", "default", "current_week", first.id)
    assert first_weekly.pendingCurrentPlayerResult == %{"kind" => "steps", "steps" => 40_000}

    assert DailyResult
           |> where([result], result.result_status == :snapshotted)
           |> Repo.aggregate(:count) == 6
  end

  test "competition ties award all tied podium players once after the full week closes" do
    users = Enum.map(1..3, &insert_user!("tie-#{&1}"))
    activate!()

    Enum.each(users, fn user ->
      Enum.each(0..2, fn offset ->
        insert_and_sync_steps!(user, Date.add(~D[2026-08-17], offset), 20_000)
      end)
    end)

    close = ~U[2026-08-24 20:16:00.000000Z]
    assert :ok = Lifecycle.tick(close)
    assert :ok = Lifecycle.tick(close)

    week = Repo.get_by!(Period, period_type: :week, week_start: ~D[2026-08-17])
    assert week.status == :closed
    assert week.prizes_allowed

    snapshot =
      Repo.get_by!(Snapshot,
        period_id: week.id,
        board_id: board_id("steps/default"),
        current: true
      )

    assert SnapshotRow
           |> where([row], row.snapshot_id == ^snapshot.id)
           |> order_by([row], asc: row.position)
           |> Repo.all()
           |> Enum.map(& &1.rank) == [1, 1, 1]

    assert Repo.aggregate(UserAchievement, :count) == 3
    assert Repo.aggregate(RewardGrant, :count) == 3

    assert RewardWallet
           |> Repo.all()
           |> Enum.map(& &1.balance)
           |> Enum.sort() == [3, 3, 3]

    assert {:ok, %{weeks: [history]}} = Query.history("steps", "default", hd(users).id)
    assert history.period.status == :closed
    assert history.period.standingsThrough == ~D[2026-08-23]
    assert Enum.map(history.rows, & &1.rank) == [1, 1, 1]

    deleted_user = hd(users)
    assert {:ok, %{success: true}} = Accounts.delete_own_account(deleted_user.id)

    deleted_row = Repo.get_by!(SnapshotRow, snapshot_id: snapshot.id, position: 1)
    assert is_nil(deleted_row.user_id)
    assert is_nil(deleted_row.public_profile_id)
    assert deleted_row.identity_audit == %{}
    assert is_binary(deleted_row.anonymous_tombstone)
  end

  defp activate! do
    {:ok, _version} = Configuration.ensure_launch_version()
    {:ok, _version} = Configuration.activate_due(~U[2026-08-17 00:01:00.000000Z])
  end

  defp insert_user!(suffix) do
    %User{}
    |> User.registration_changeset(%{
      email: "lifecycle-#{suffix}-#{System.unique_integer([:positive])}@example.com",
      display_name: suffix,
      timezone: "Etc/UTC"
    })
    |> Repo.insert!()
  end

  defp insert_and_sync_steps!(user, date, steps) do
    %StepSnapshot{}
    |> StepSnapshot.changeset(%{
      user_id: user.id,
      source: :device_health,
      step_count: steps,
      recorded_for: date
    })
    |> Repo.insert!()

    assert {:ok, _result} = QuestResults.sync(user.id, date, :steps)
  end

  defp board_id(key) do
    AdventureTimeApi.Leaderboards.Board
    |> Repo.get_by!(key: key)
    |> Map.fetch!(:id)
  end
end
