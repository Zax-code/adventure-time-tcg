defmodule AdventureTimeApi.Leaderboards.Query do
  @moduledoc "Authenticated leaderboard read model over immutable snapshot revisions."

  import Ecto.Query

  alias AdventureTimeApi.Accounts.User

  alias AdventureTimeApi.Leaderboards.{
    Board,
    DailyResult,
    Period,
    PublicProfiles,
    ScoringVersion,
    Snapshot,
    SnapshotRow
  }

  alias AdventureTimeApi.Repo

  @spec fetch(String.t(), String.t(), String.t(), Ecto.UUID.t()) ::
          {:ok, map()} | {:error, atom()}
  def fetch(quest, mode, period_name, current_user_id) do
    with %Board{} = board <- Repo.get_by(Board, key: "#{quest}/#{mode}", enabled: true),
         {:ok, period} <- fetch_period(board.id, period_name),
         %Snapshot{} = snapshot <-
           Repo.get_by(Snapshot, period_id: period.id, board_id: board.id, current: true),
         %ScoringVersion{} = scoring_version <-
           Repo.get(ScoringVersion, snapshot.scoring_version_id) do
      rows = fetch_rows(snapshot.id, 50)
      projected_rows = Enum.map(rows, &project_row(&1, period))
      current_player_row = find_current_player(snapshot.id, current_user_id, period)

      {:ok,
       %{
         board: project_board(board),
         period: project_period(period, snapshot),
         podium: Enum.filter(projected_rows, &(&1.rank <= 3)),
         rows: projected_rows,
         currentPlayer:
           if(Enum.any?(rows, fn {row, _user} -> row.user_id == current_user_id end),
             do: nil,
             else: current_player_row
           ),
         pendingCurrentPlayerResult: nil,
         qualification: qualification(board.id, period, current_user_id, current_player_row),
         pageInfo: %{nextCursor: nil, hasNextPage: false},
         scoring: %{
           version: scoring_version.version,
           displayMax: 1_000,
           weeklyRule: "average_best_3"
         }
       }}
    else
      nil -> {:error, :period_unavailable}
      {:error, reason} -> {:error, reason}
    end
  end

  defp fetch_period(board_id, "yesterday") do
    period =
      from(period in Period,
        join: snapshot in Snapshot,
        on:
          snapshot.period_id == period.id and snapshot.board_id == ^board_id and snapshot.current,
        where:
          period.period_type == :day and period.status in [:closed, :corrected] and
            period.origin == :verified,
        order_by: [desc: period.competition_date],
        limit: 1,
        select: period
      )
      |> Repo.one()

    if period, do: {:ok, period}, else: {:error, :period_unavailable}
  end

  defp fetch_period(board_id, "current_week") do
    period =
      from(period in Period,
        join: snapshot in Snapshot,
        on:
          snapshot.period_id == period.id and snapshot.board_id == ^board_id and snapshot.current,
        where:
          period.period_type == :week and
            period.status in [:open, :closing, :closed, :corrected] and
            period.origin == :verified,
        order_by: [desc: period.week_start],
        limit: 1,
        select: period
      )
      |> Repo.one()

    if period, do: {:ok, period}, else: {:error, :period_unavailable}
  end

  defp fetch_period(_board_id, _period_name), do: {:error, :invalid_period}

  defp fetch_rows(snapshot_id, limit) do
    from(row in SnapshotRow,
      left_join: user in User,
      on: user.id == row.user_id,
      where: row.snapshot_id == ^snapshot_id,
      order_by: [asc: row.position],
      limit: ^limit,
      select: {row, user}
    )
    |> Repo.all()
  end

  defp find_current_player(snapshot_id, user_id, period) do
    from(row in SnapshotRow,
      left_join: user in User,
      on: user.id == row.user_id,
      where: row.snapshot_id == ^snapshot_id and row.user_id == ^user_id,
      select: {row, user}
    )
    |> Repo.one()
    |> case do
      nil -> nil
      row_and_user -> project_row(row_and_user, period)
    end
  end

  defp project_row({row, user}, period) do
    %{
      position: row.position,
      rank: row.rank,
      profile: project_identity(row, user),
      rawResult: row.raw_result,
      points: div(row.points_milli + 500, 1_000),
      pointsMilli: row.points_milli,
      provisional: period.status in [:open, :closing],
      medal: row.medal_tier
    }
  end

  defp project_identity(_row, %User{public_profile_status: :visible} = user) do
    display_name = user.display_name || "Player"

    %{
      publicProfileId: user.public_profile_id,
      displayName: user.display_name,
      discriminator: user.public_discriminator,
      handle: "#{display_name}##{user.public_discriminator}",
      avatarUrl: avatar_url(user.avatar_asset_id),
      fallbackAvatarKey: PublicProfiles.fallback_avatar_key(user.public_profile_id),
      visibility: :visible
    }
  end

  defp project_identity(_row, %User{} = user) do
    %{
      publicProfileId: user.public_profile_id,
      displayName: "Player hidden",
      discriminator: user.public_discriminator,
      handle: "Player hidden##{user.public_discriminator}",
      avatarUrl: nil,
      fallbackAvatarKey: PublicProfiles.fallback_avatar_key(user.public_profile_id),
      visibility: user.public_profile_status
    }
  end

  defp project_identity(row, nil) do
    %{
      publicProfileId: nil,
      displayName: "Deleted player",
      discriminator: "",
      handle: "Deleted player",
      avatarUrl: nil,
      fallbackAvatarKey: PublicProfiles.fallback_avatar_key(row.anonymous_tombstone) || "bmo",
      visibility: :deleted
    }
  end

  defp project_board(board) do
    %{
      key: board.key,
      quest: board.key |> String.split("/", parts: 2) |> hd(),
      family: board.quest_family,
      mode: board.mode,
      direction: board.direction,
      boardKind: board.board_kind,
      rawResultKind: board.raw_result_kind,
      enabled: board.enabled,
      prizesEnabled: board.prizes_enabled,
      displayOrder: board.display_order,
      members: Map.get(board.derived_members, "members", [])
    }
  end

  defp project_period(period, snapshot) do
    %{
      type: period.period_type,
      status: period.status,
      startsAt: period.starts_at,
      endsAt: period.ends_at,
      closesAt: period.closes_at,
      serverNow: DateTime.utc_now(),
      revision: snapshot.revision,
      provisional: period.status in [:open, :closing],
      standingsThrough: period.competition_date,
      prizesEnabled: period.prizes_allowed
    }
  end

  defp qualification(_board_id, %Period{period_type: :day}, _user_id, _row), do: nil

  defp qualification(_board_id, %Period{period_type: :week}, _user_id, row) when not is_nil(row),
    do: nil

  defp qualification(board_id, %Period{period_type: :week} = period, user_id, nil) do
    week_end = Date.add(period.week_start, 6)

    count =
      from(result in DailyResult,
        where:
          result.user_id == ^user_id and result.board_id == ^board_id and result.active and
            result.result_status in [:accepted, :snapshotted] and
            result.competition_date >= ^period.week_start and
            result.competition_date <= ^week_end
      )
      |> Repo.aggregate(:count)

    %{validResults: count, requiredResults: 3}
  end

  defp avatar_url(nil), do: nil

  defp avatar_url(asset_id) do
    AdventureTimeApiWeb.Endpoint.url() <> "/media/profile/" <> asset_id
  end
end
