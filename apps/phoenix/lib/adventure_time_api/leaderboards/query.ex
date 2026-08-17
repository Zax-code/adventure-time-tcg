defmodule AdventureTimeApi.Leaderboards.Query do
  @moduledoc "Authenticated live and finalized leaderboard read model."

  import Ecto.Query

  alias AdventureTimeApi.Accounts.User

  alias AdventureTimeApi.Leaderboards.{
    Board,
    Calendar,
    Configuration,
    Period,
    Projection,
    PublicProfiles,
    ScoringVersion,
    Snapshot,
    SnapshotRow
  }

  alias AdventureTimeApi.Repo

  @visible_row_limit 7

  def fetch(quest, mode, period_name, current_user_id, now \\ DateTime.utc_now()) do
    with %Board{} = board <- Repo.get_by(Board, key: "#{quest}/#{mode}", enabled: true),
         %User{} = user <- Repo.get(User, current_user_id),
         {:ok, period} <- resolve_period(period_name, user, now) do
      if period.status in [:closed, :corrected] do
        fetch_finalized(board, period, current_user_id, now)
      else
        with {:ok, {scoring_version, configuration}} <- scoring_for_period(period) do
          {:ok,
           build_live_payload(
             board,
             period,
             scoring_version,
             configuration,
             current_user_id,
             now
           )}
        end
      end
    else
      nil -> {:error, :period_unavailable}
      {:error, reason} -> {:error, reason}
    end
  end

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
          build_snapshot_payload(
            board,
            period,
            snapshot,
            scoring_version,
            current_user_id,
            DateTime.utc_now()
          )
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
          build_snapshot_payload(
            board,
            period,
            snapshot,
            scoring_version,
            current_user_id,
            DateTime.utc_now()
          )
        end)

      {:ok, %{days: days}}
    else
      nil -> {:error, :period_unavailable}
      {:error, _reason} -> {:error, :invalid_period}
    end
  end

  defp fetch_finalized(board, period, current_user_id, now) do
    with %Snapshot{} = snapshot <-
           Repo.get_by(Snapshot, period_id: period.id, board_id: board.id, current: true),
         %ScoringVersion{} = scoring_version <-
           Repo.get(ScoringVersion, snapshot.scoring_version_id) do
      {:ok,
       build_snapshot_payload(
         board,
         period,
         snapshot,
         scoring_version,
         current_user_id,
         now
       )}
    else
      nil -> {:error, :period_unavailable}
    end
  end

  defp build_live_payload(board, period, scoring_version, configuration, current_user_id, now) do
    all_rows = Projection.rows(period, board, configuration)
    visible_rows = Enum.take(all_rows, @visible_row_limit)
    projected_rows = Enum.map(visible_rows, &project_live_row(&1, period))

    current_player =
      all_rows
      |> Enum.find(&(&1.user_id == current_user_id))
      |> case do
        nil -> nil
        row -> project_live_row(row, period)
      end

    build_payload(
      board,
      period,
      projected_rows,
      current_player,
      length(all_rows) > @visible_row_limit,
      scoring_version,
      latest_revision(period, board),
      now
    )
  end

  defp build_snapshot_payload(
         board,
         period,
         snapshot,
         scoring_version,
         current_user_id,
         now
       ) do
    rows = fetch_rows(snapshot.id, @visible_row_limit + 1)
    visible_rows = Enum.take(rows, @visible_row_limit)
    projected_rows = Enum.map(visible_rows, &project_snapshot_row(&1, period))
    current_player_row = find_current_player(snapshot.id, current_user_id, period)

    build_payload(
      board,
      period,
      projected_rows,
      current_player_row,
      length(rows) > @visible_row_limit,
      scoring_version,
      snapshot.revision,
      now
    )
  end

  defp build_payload(
         board,
         period,
         projected_rows,
         current_player,
         has_next_page,
         scoring_version,
         revision,
         now
       ) do
    %{
      board: project_board(board),
      period: project_period(period, revision, now),
      podium: Enum.filter(projected_rows, &(&1.rank <= 3)),
      rows: projected_rows,
      currentPlayer: current_player,
      pendingCurrentPlayerResult: nil,
      pendingCurrentPlayerPoints: nil,
      qualification: nil,
      pageInfo: %{nextCursor: nil, hasNextPage: has_next_page},
      scoring: %{
        version: scoring_version.version,
        weeklyRule: weekly_rule(scoring_version)
      }
    }
  end

  defp resolve_period(period_name, user, now) do
    with {:ok, local_now} <- DateTime.shift_zone(now, user.timezone) do
      today = DateTime.to_date(local_now)

      case period_name do
        "today" -> resolve_day(today, now)
        "yesterday" -> resolve_day(Date.add(today, -1), now)
        "current_week" -> resolve_week(Date.beginning_of_week(today, :monday), now)
        "last_week" -> resolve_week(Date.add(Date.beginning_of_week(today, :monday), -7), now)
        _ -> {:error, :invalid_period}
      end
    else
      _ -> {:error, :invalid_timezone}
    end
  end

  defp resolve_day(date, now) do
    period = Repo.get_by(Period, period_type: :day, competition_date: date, origin: :verified)
    {:ok, period || virtual_day(date, now)}
  end

  defp resolve_week(week_start, now) do
    period = Repo.get_by(Period, period_type: :week, week_start: week_start, origin: :verified)
    {:ok, period || virtual_week(week_start, now)}
  end

  defp virtual_day(date, now) do
    {version, _configuration} = scoring_for_date!(date)
    closes_at = Calendar.publication_cutoff(date)

    %Period{
      period_type: :day,
      starts_at: utc_midnight(date),
      ends_at: utc_midnight(Date.add(date, 1)),
      closes_at: closes_at,
      competition_date: date,
      week_start: Date.beginning_of_week(date, :monday),
      status: if(DateTime.compare(now, closes_at) == :lt, do: :open, else: :closing),
      prizes_allowed: false,
      scoring_version_id: version.id,
      launch_partial: false,
      origin: :verified
    }
  end

  defp virtual_week(week_start, now) do
    scoring_date = max_date(week_start, Configuration.launch_date())
    {version, _configuration} = scoring_for_date!(scoring_date)
    closes_at = Calendar.publication_cutoff(Date.add(week_start, 6))

    %Period{
      period_type: :week,
      starts_at: utc_midnight(week_start),
      ends_at: utc_midnight(Date.add(week_start, 7)),
      closes_at: closes_at,
      competition_date: nil,
      week_start: week_start,
      status: if(DateTime.compare(now, closes_at) == :lt, do: :open, else: :closing),
      prizes_allowed: Date.compare(week_start, version.effective_week_start) != :lt,
      scoring_version_id: version.id,
      launch_partial: Date.compare(week_start, version.effective_week_start) == :lt,
      origin: :verified
    }
  end

  defp scoring_for_period(period) do
    scoring_date =
      period.competition_date || max_date(period.week_start, Configuration.launch_date())

    Configuration.for_date(scoring_date)
  end

  defp scoring_for_date!(date) do
    case Configuration.for_date(date) do
      {:ok, scoring} -> scoring
      {:error, reason} -> raise "scoring unavailable for #{date}: #{inspect(reason)}"
    end
  end

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
      row_and_user -> project_snapshot_row(row_and_user, period)
    end
  end

  defp project_snapshot_row({row, user}, period),
    do: project_row(row, user, period, row.medal_tier)

  defp project_live_row(row, period), do: project_row(row, row.user, period, nil)

  defp project_row(row, user, period, medal) do
    %{
      position: row.position,
      rank: row.rank,
      profile: project_identity(row, user),
      rawResult: row.raw_result,
      points: div(row.points_milli + 500, 1_000),
      pointsMilli: row.points_milli,
      provisional: period.status in [:open, :closing],
      medal: medal
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

  defp project_period(period, revision, now) do
    week_end = period.week_start && Date.add(period.week_start, 6)

    %{
      type: period.period_type,
      status: period.status,
      startsAt: period.starts_at,
      endsAt: period.ends_at,
      closesAt: period.closes_at,
      serverNow: now,
      revision: revision,
      provisional: period.status in [:open, :closing],
      competitionDate: period.competition_date,
      weekStart: period.week_start,
      weekEnd: week_end,
      standingsThrough: period.competition_date || week_end,
      prizesEnabled: period.prizes_allowed
    }
  end

  defp latest_revision(%Period{id: nil}, _board), do: 0

  defp latest_revision(period, board) do
    case Repo.get_by(Snapshot, period_id: period.id, board_id: board.id, current: true) do
      %Snapshot{revision: revision} -> revision
      nil -> 0
    end
  end

  defp max_date(first, second) do
    if Date.compare(first, second) == :lt, do: second, else: first
  end

  defp weekly_rule(scoring_version) do
    case get_in(scoring_version.configuration, ["weekly", "formula"]) do
      "sum_all_eligible" -> "sum_all_eligible"
      _ -> "average_best_3"
    end
  end

  defp utc_midnight(date), do: DateTime.new!(date, ~T[00:00:00], "Etc/UTC")

  defp avatar_url(nil), do: nil

  defp avatar_url(asset_id) do
    AdventureTimeApiWeb.Endpoint.url() <> "/media/profile/" <> asset_id
  end
end
