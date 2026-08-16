defmodule AdventureTimeApi.Leaderboards.Query do
  @moduledoc "Authenticated leaderboard read model over immutable snapshot revisions."

  import Ecto.Query

  alias AdventureTimeApi.Accounts.User

  alias AdventureTimeApi.Leaderboards.{
    Board,
    Configuration,
    DailyResult,
    Period,
    PublicProfiles,
    Scoring,
    ScoringVersion,
    Snapshot,
    SnapshotRow
  }

  alias AdventureTimeApi.Repo

  @visible_row_limit 7

  @spec fetch(String.t(), String.t(), String.t(), Ecto.UUID.t()) ::
          {:ok, map()} | {:error, atom()}
  def fetch(quest, mode, period_name, current_user_id) do
    with %Board{} = board <- Repo.get_by(Board, key: "#{quest}/#{mode}", enabled: true),
         {:ok, period} <- fetch_period(board.id, period_name),
         %Snapshot{} = snapshot <-
           Repo.get_by(Snapshot, period_id: period.id, board_id: board.id, current: true),
         %ScoringVersion{} = scoring_version <-
           Repo.get(ScoringVersion, snapshot.scoring_version_id) do
      {:ok, build_payload(board, period, snapshot, scoring_version, current_user_id)}
    else
      nil -> {:error, :period_unavailable}
      {:error, reason} -> {:error, reason}
    end
  end

  @spec history(String.t(), String.t(), Ecto.UUID.t()) :: {:ok, map()} | {:error, atom()}
  def history(quest, mode, current_user_id) do
    with %Board{} = board <- Repo.get_by(Board, key: "#{quest}/#{mode}", enabled: true) do
      weeks =
        from(period in Period,
          join: snapshot in Snapshot,
          on:
            snapshot.period_id == period.id and snapshot.board_id == ^board.id and
              snapshot.current,
          join: scoring_version in ScoringVersion,
          on: scoring_version.id == snapshot.scoring_version_id,
          where:
            period.period_type == :week and period.status in [:closed, :corrected] and
              period.origin == :verified,
          order_by: [desc: period.week_start],
          limit: 12,
          select: {period, snapshot, scoring_version}
        )
        |> Repo.all()
        |> Enum.map(fn {period, snapshot, scoring_version} ->
          build_payload(board, period, snapshot, scoring_version, current_user_id)
        end)

      {:ok, %{weeks: weeks}}
    else
      nil -> {:error, :period_unavailable}
    end
  end

  def history_days(quest, mode, period_start, current_user_id) do
    with %Board{} = board <- Repo.get_by(Board, key: "#{quest}/#{mode}", enabled: true),
         {:ok, week_start} <- Date.from_iso8601(period_start) do
      week_end = Date.add(week_start, 6)

      days =
        from(period in Period,
          join: snapshot in Snapshot,
          on:
            snapshot.period_id == period.id and snapshot.board_id == ^board.id and
              snapshot.current,
          join: scoring_version in ScoringVersion,
          on: scoring_version.id == snapshot.scoring_version_id,
          where:
            period.period_type == :day and period.status in [:closed, :corrected] and
              period.competition_date >= ^week_start and period.competition_date <= ^week_end and
              period.origin == :verified,
          order_by: [asc: period.competition_date],
          select: {period, snapshot, scoring_version}
        )
        |> Repo.all()
        |> Enum.map(fn {period, snapshot, scoring_version} ->
          build_payload(board, period, snapshot, scoring_version, current_user_id)
        end)

      {:ok, %{days: days}}
    else
      nil -> {:error, :period_unavailable}
      {:error, _reason} -> {:error, :invalid_period}
    end
  end

  defp build_payload(board, period, snapshot, scoring_version, current_user_id) do
    rows = fetch_rows(snapshot.id, @visible_row_limit + 1)
    visible_rows = Enum.take(rows, @visible_row_limit)
    projected_rows = Enum.map(visible_rows, &project_row(&1, period))
    current_player_row = find_current_player(snapshot.id, current_user_id, period)

    %{
      board: project_board(board),
      period: project_period(period, snapshot),
      podium: Enum.filter(projected_rows, &(&1.rank <= 3)),
      rows: projected_rows,
      currentPlayer: current_player_row,
      pendingCurrentPlayerResult: pending_result(board, period, current_user_id, scoring_version),
      qualification: qualification(board.id, period, current_user_id, current_player_row),
      pageInfo: %{nextCursor: nil, hasNextPage: length(rows) > @visible_row_limit},
      scoring: %{
        version: scoring_version.version,
        displayMax: 1_000,
        weeklyRule: "average_best_3"
      }
    }
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
      standingsThrough: standings_through(period),
      prizesEnabled: period.prizes_allowed
    }
  end

  defp standings_through(%Period{period_type: :day, competition_date: date}), do: date

  defp standings_through(%Period{period_type: :week} = period) do
    week_end = Date.add(period.week_start, 6)

    from(day in Period,
      where:
        day.period_type == :day and day.status in [:closed, :corrected] and
          day.competition_date >= ^period.week_start and day.competition_date <= ^week_end,
      select: max(day.competition_date)
    )
    |> Repo.one()
  end

  defp pending_result(_board, %Period{period_type: :day}, _user_id, _version), do: nil

  defp pending_result(%Board{board_kind: :source} = board, period, user_id, _version) do
    pending_source_result(board.id, period, user_id)
  end

  defp pending_result(%Board{board_kind: :derived_family} = board, period, user_id, version) do
    member_keys = Map.get(board.derived_members, "members", [])

    member_boards =
      Repo.all(
        from(member in Board, where: member.key in ^member_keys, select: {member.id, member.key})
      )

    member_points =
      member_boards
      |> Enum.flat_map(fn {board_id, board_key} ->
        case pending_source_daily_result(board_id, period, user_id) do
          %DailyResult{} = result -> [{board_key, result.points_milli}]
          nil -> []
        end
      end)
      |> Map.new()

    with true <- map_size(member_points) > 0,
         {:ok, configuration} <- Configuration.normalize(version.configuration),
         {:ok, derived} <- Scoring.derived(configuration, board.key, member_points) do
      %{"kind" => "member_breakdown", "members" => derived.member_points_milli}
    else
      _ -> nil
    end
  end

  defp pending_source_result(board_id, period, user_id) do
    case pending_source_daily_result(board_id, period, user_id) do
      %DailyResult{} = result -> result.raw_result
      nil -> nil
    end
  end

  defp pending_source_daily_result(board_id, %Period{period_type: :week} = period, user_id) do
    week_end = Date.add(period.week_start, 6)

    closed_dates =
      from(day in Period,
        where:
          day.period_type == :day and day.status in [:closed, :corrected] and
            day.competition_date >= ^period.week_start and day.competition_date <= ^week_end,
        select: day.competition_date
      )
      |> Repo.all()

    from(result in DailyResult,
      where:
        result.user_id == ^user_id and result.board_id == ^board_id and result.active and
          result.result_status == :accepted and result.competition_date >= ^period.week_start and
          result.competition_date <= ^week_end and result.competition_date not in ^closed_dates,
      order_by: [desc: result.competition_date, desc: result.accepted_at],
      limit: 1,
      select: result
    )
    |> Repo.one()
  end

  defp qualification(_board_id, %Period{period_type: :day}, _user_id, _row), do: nil

  defp qualification(_board_id, %Period{period_type: :week}, _user_id, row) when not is_nil(row),
    do: nil

  defp qualification(board_id, %Period{period_type: :week} = period, user_id, nil) do
    week_end = Date.add(period.week_start, 6)

    closed_dates =
      from(day in Period,
        where:
          day.period_type == :day and day.status in [:closed, :corrected] and
            day.competition_date >= ^period.week_start and day.competition_date <= ^week_end,
        select: day.competition_date
      )
      |> Repo.all()

    count =
      from(result in DailyResult,
        where:
          result.user_id == ^user_id and result.board_id == ^board_id and result.active and
            result.result_status in [:accepted, :snapshotted] and
            result.competition_date >= ^period.week_start and
            result.competition_date <= ^week_end and result.competition_date in ^closed_dates
      )
      |> Repo.aggregate(:count)

    %{validResults: count, requiredResults: 3}
  end

  defp avatar_url(nil), do: nil

  defp avatar_url(asset_id) do
    AdventureTimeApiWeb.Endpoint.url() <> "/media/profile/" <> asset_id
  end
end
