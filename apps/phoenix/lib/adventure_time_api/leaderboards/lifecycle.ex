defmodule AdventureTimeApi.Leaderboards.Lifecycle do
  @moduledoc """
  Retry-safe coordinator for leaderboard periods, snapshots, and weekly prizes.

  Natural local dates are aggregated only after the shared publication cutoff. Open
  weekly snapshots are replaceable revisions; closed snapshots and their grants are
  immutable unless a separate audited correction flow supersedes them.
  """

  import Ecto.Query

  alias AdventureTimeApi.Accounts.User

  alias AdventureTimeApi.Leaderboards.{
    Board,
    Boards,
    Calendar,
    Configuration,
    DailyResult,
    Locks,
    Period,
    Prizes,
    QuestResults,
    Ranking,
    RewardGrant,
    RewardWallet,
    Scoring,
    Snapshot,
    SnapshotRow,
    UserAchievement
  }

  alias AdventureTimeApi.Repo

  @finalizer "leaderboard-lifecycle-v1"

  @spec tick(DateTime.t()) :: :ok | {:error, term()}
  def tick(now \\ DateTime.utc_now()) do
    with {:ok, _version} <- Configuration.ensure_launch_version(),
         {:ok, _version} <- Configuration.activate_due(now) do
      QuestResults.reconcile_open_week(now)
      dates = competition_dates(Configuration.launch_date(), DateTime.to_date(now))
      periods = Enum.map(dates, &ensure_day_period(&1, now))

      weeks =
        dates
        |> Enum.map(&Date.beginning_of_week(&1, :monday))
        |> Enum.uniq()
        |> Enum.map(&ensure_week_period(&1, now))

      Enum.each(periods, &finalize_day_if_due(&1, now))
      Enum.each(weeks, &refresh_week(&1, now))
      :ok
    else
      {:error, :not_yet_effective} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp competition_dates(effective_date, today) do
    recorded_dates =
      from(result in DailyResult,
        where: result.competition_date >= ^effective_date,
        distinct: true,
        select: result.competition_date
      )
      |> Repo.all()

    [today, Date.add(today, -1) | recorded_dates]
    |> Enum.filter(&(Date.compare(&1, effective_date) != :lt))
    |> Enum.uniq()
    |> Enum.sort(Date)
  end

  defp ensure_day_period(date, now) do
    {version, _configuration} = scoring_for_date!(date)
    starts_at = utc_midnight(date)
    closes_at = Calendar.publication_cutoff(date)

    ensure_period(%{
      period_type: :day,
      starts_at: starts_at,
      ends_at: utc_midnight(Date.add(date, 1)),
      closes_at: closes_at,
      competition_date: date,
      week_start: Date.beginning_of_week(date, :monday),
      status: if(DateTime.compare(now, closes_at) == :lt, do: :open, else: :closing),
      prizes_allowed: false,
      scoring_version_id: version.id,
      launch_partial: false
    })
  end

  defp ensure_week_period(today, now) do
    week_start = Date.beginning_of_week(today, :monday)

    scoring_date =
      if Date.compare(week_start, Configuration.launch_date()) == :lt,
        do: Configuration.launch_date(),
        else: week_start

    {version, _configuration} = scoring_for_date!(scoring_date)
    starts_at = utc_midnight(week_start)
    ends_at = utc_midnight(Date.add(week_start, 7))
    closes_at = Calendar.publication_cutoff(Date.add(week_start, 6))

    ensure_period(%{
      period_type: :week,
      starts_at: starts_at,
      ends_at: ends_at,
      closes_at: closes_at,
      competition_date: nil,
      week_start: week_start,
      status: if(DateTime.compare(now, closes_at) == :lt, do: :open, else: :closing),
      prizes_allowed: Date.compare(week_start, version.effective_week_start) != :lt,
      scoring_version_id: version.id,
      launch_partial: Date.compare(week_start, version.effective_week_start) == :lt
    })
  end

  defp ensure_period(attrs) do
    %Period{}
    |> Period.changeset(Map.merge(%{competition_timezone: "global", origin: :verified}, attrs))
    |> Repo.insert(
      on_conflict: :nothing,
      conflict_target: [:period_type, :starts_at]
    )
    |> case do
      {:ok, _period} ->
        Repo.get_by!(Period, period_type: attrs.period_type, starts_at: attrs.starts_at)
    end
  end

  defp finalize_day_if_due(period, now) do
    if DateTime.compare(now, period.closes_at) == :lt do
      :ok
    else
      Repo.transaction(fn ->
        Boards.list_enabled()
        |> Enum.each(&Locks.daily_result!(&1.id, period.competition_date))

        {version, configuration} = scoring_for_period!(period)

        period =
          if period.status in [:closed, :corrected] do
            period
          else
            period |> Period.changeset(%{status: :closing}) |> Repo.update!()
          end

        build_all_snapshots(period, version, configuration, now)

        from(result in DailyResult,
          where:
            result.competition_date == ^period.competition_date and result.active and
              result.result_status == :accepted
        )
        |> Repo.update_all(
          set: [result_status: :snapshotted, provisional: false, updated_at: now]
        )

        if period.status == :closing do
          period |> Period.changeset(%{status: :closed}) |> Repo.update!()
        end
      end)
    end
  end

  defp refresh_week(period, now) do
    Repo.transaction(fn ->
      Boards.list_enabled()
      |> Enum.each(&Locks.period_board!(period.id, &1.id))

      {version, configuration} = scoring_for_period!(period)
      closing = DateTime.compare(now, period.closes_at) != :lt

      period =
        if closing and period.status not in [:closed, :corrected] do
          period |> Period.changeset(%{status: :closed}) |> Repo.update!()
        else
          period
        end

      build_all_snapshots(period, version, configuration, now)

      if period.status == :closed do
        award_week(period, now)
      end
    end)
  end

  defp build_all_snapshots(period, version, configuration, now) do
    Boards.list_enabled()
    |> Enum.each(fn board ->
      Repo.transaction(fn ->
        Locks.period_board!(period.id, board.id)

        if period.period_type == :day do
          Locks.daily_result!(board.id, period.competition_date)
        end

        rows =
          case board.board_kind do
            :source -> source_rows(period, board, configuration)
            :derived_family -> derived_rows(period, board, configuration)
          end

        persist_snapshot(period, board, version, rows, now)
      end)
    end)
  end

  defp source_rows(%Period{period_type: :day} = period, board, _configuration) do
    eligible_results(
      board.id,
      dynamic([result, _user], result.competition_date == ^period.competition_date)
    )
    |> Enum.map(fn {result, user} ->
      row_from_result(result, user)
      |> Map.put(:competitive_key, daily_competitive_key(board, result))
    end)
    |> Ranking.rank(& &1.competitive_key)
  end

  defp source_rows(%Period{period_type: :week} = period, board, configuration) do
    week_end = Date.add(period.week_start, 6)

    closed_dates =
      from(day in Period,
        where:
          day.period_type == :day and day.status in [:closed, :corrected] and
            day.competition_date >= ^period.week_start and day.competition_date <= ^week_end,
        select: day.competition_date
      )
      |> Repo.all()

    eligible_results(
      board.id,
      dynamic(
        [result, _user],
        result.competition_date >= ^period.week_start and result.competition_date <= ^week_end and
          result.competition_date in ^closed_dates
      )
    )
    |> Enum.group_by(fn {result, _user} -> result.user_id end)
    |> Enum.flat_map(fn {_user_id, result_users} ->
      sorted = Enum.sort_by(result_users, fn {result, _user} -> result.points_milli end, :desc)
      points = Enum.map(sorted, fn {result, _user} -> result.points_milli end)

      case Scoring.weekly(configuration, points) do
        {:ok, %{status: :ranked} = score} ->
          selected = Enum.take(sorted, length(score.selected_points_milli))
          {best_result, user} = hd(sorted)

          [
            %{
              user_id: user.id,
              public_profile_id: user.public_profile_id,
              points_milli: score.points_milli,
              raw_result: best_result.raw_result,
              selected_daily_result_ids: Enum.map(selected, fn {result, _} -> result.id end),
              selected_points_milli: score.selected_points_milli,
              identity_audit: identity_audit(user),
              competitive_key: {score.points_milli, score.selected_points_milli}
            }
          ]

        _ ->
          []
      end
    end)
    |> Ranking.rank(& &1.competitive_key)
  end

  defp eligible_results(board_id, dynamic_where) do
    from(result in DailyResult,
      join: user in User,
      on: user.id == result.user_id,
      where:
        result.board_id == ^board_id and result.active and
          result.result_status in [:accepted, :snapshotted] and
          result.integrity_status == :accepted and result.eligibility_status == :eligible and
          user.leaderboard_eligible and user.public_profile_status in [:visible, :hidden],
      where: ^dynamic_where,
      select: {result, user}
    )
    |> Repo.all()
  end

  defp row_from_result(result, user) do
    %{
      user_id: user.id,
      public_profile_id: user.public_profile_id,
      points_milli: result.points_milli,
      raw_result: result.raw_result,
      selected_daily_result_ids: [result.id],
      selected_points_milli: [result.points_milli],
      identity_audit: identity_audit(user)
    }
  end

  defp daily_competitive_key(_board, %{points_milli: 0}), do: {0, 0}

  defp daily_competitive_key(%Board{direction: :higher}, result),
    do: {result.points_milli, result.raw_numeric_value || 0}

  defp daily_competitive_key(%Board{direction: :lower}, result),
    do: {result.points_milli, -(result.raw_numeric_value || 0)}

  defp daily_competitive_key(_board, result), do: {result.points_milli, 0}

  defp derived_rows(period, board, configuration) do
    members = Map.get(board.derived_members, "members", [])

    member_rows =
      from(row in SnapshotRow,
        join: snapshot in Snapshot,
        on: snapshot.id == row.snapshot_id and snapshot.current,
        join: member in Board,
        on: member.id == snapshot.board_id,
        where: snapshot.period_id == ^period.id and member.key in ^members,
        select: {member.key, row}
      )
      |> Repo.all()
      |> Enum.group_by(fn {_member_key, row} -> row.user_id end)

    member_rows
    |> Enum.map(fn {user_id, keyed_rows} ->
      points = Map.new(keyed_rows, fn {key, row} -> {key, row.points_milli} end)
      {:ok, derived} = Scoring.derived(configuration, board.key, points)
      user = Repo.get!(User, user_id)
      member_vector = Enum.map(members, &Map.get(derived.member_points_milli, &1, 0))

      %{
        user_id: user.id,
        public_profile_id: user.public_profile_id,
        points_milli: derived.points_milli,
        raw_result: %{"kind" => "member_breakdown", "members" => derived.member_points_milli},
        selected_daily_result_ids:
          keyed_rows |> Enum.flat_map(fn {_key, row} -> row.selected_daily_result_ids end),
        selected_points_milli: member_vector,
        identity_audit: identity_audit(user),
        competitive_key: {derived.points_milli, member_vector}
      }
    end)
    |> Ranking.rank(& &1.competitive_key)
  end

  defp persist_snapshot(period, board, version, rows, now) do
    signature = snapshot_signature(rows)
    current = Repo.get_by(Snapshot, period_id: period.id, board_id: board.id, current: true)

    if reusable_snapshot?(current, period, signature) do
      current
    else
      if current do
        current
        |> Snapshot.changeset(%{current: false, status: :superseded})
        |> Repo.update!()
      end

      snapshot =
        %Snapshot{}
        |> Snapshot.changeset(%{
          period_id: period.id,
          board_id: board.id,
          revision: if(current, do: current.revision + 1, else: 1),
          status: :closed,
          scoring_version_id: version.id,
          participant_count: length(rows),
          valid_result_count: Enum.reduce(rows, 0, &(&2 + length(&1.selected_daily_result_ids))),
          configuration_hash: version.configuration_hash,
          source_cutoff: now,
          finalized_at: now,
          finalized_by: signature,
          supersedes_snapshot_id: current && current.id,
          current: true
        })
        |> Repo.insert!()

      rows
      |> Enum.each(fn row ->
        %SnapshotRow{}
        |> SnapshotRow.changeset(%{
          snapshot_id: snapshot.id,
          user_id: row.user_id,
          public_profile_id: row.public_profile_id,
          position: row.position,
          rank: row.rank,
          tie_group: row.rank,
          points_milli: row.points_milli,
          raw_result: row.raw_result,
          selected_daily_result_ids: row.selected_daily_result_ids,
          selected_points_milli: row.selected_points_milli,
          medal_tier: medal_tier(period, board, row.rank),
          identity_audit: row.identity_audit
        })
        |> Repo.insert!()
      end)

      snapshot
    end
  end

  defp reusable_snapshot?(nil, _period, _signature), do: false

  defp reusable_snapshot?(current, %Period{status: :closed} = period, _signature) do
    DateTime.compare(current.source_cutoff, period.closes_at) != :lt
  end

  defp reusable_snapshot?(current, _period, signature), do: current.finalized_by == signature

  defp snapshot_signature(rows) do
    content =
      Enum.map(
        rows,
        &Map.take(&1, [:user_id, :points_milli, :raw_result, :selected_daily_result_ids])
      )

    @finalizer <>
      ":" <> Base.encode16(:crypto.hash(:sha256, :erlang.term_to_binary(content)), case: :lower)
  end

  defp medal_tier(
         %Period{period_type: :week, prizes_allowed: true},
         %{prizes_enabled: true},
         rank
       ) do
    %{1 => :gold, 2 => :silver, 3 => :bronze}[rank]
  end

  defp medal_tier(_period, _board, _rank), do: nil

  defp award_week(period, now) do
    from(snapshot in Snapshot,
      join: board in Board,
      on: board.id == snapshot.board_id,
      where: snapshot.period_id == ^period.id and snapshot.current and board.prizes_enabled,
      select: {snapshot, board}
    )
    |> Repo.all()
    |> Enum.each(fn {snapshot, board} ->
      rows = Repo.all(from(row in SnapshotRow, where: row.snapshot_id == ^snapshot.id))

      rows
      |> Prizes.plan(board.quest_family, prizes_allowed: period.prizes_allowed)
      |> Enum.each(&grant_prize(&1, snapshot, board, period, now))
    end)
  end

  defp grant_prize(prize, snapshot, board, period, now) do
    idempotency_key = "#{snapshot.id}:#{prize.user_id}:#{prize.medal_tier}"

    Repo.transaction(fn ->
      attrs = %{
        id: Ecto.UUID.generate(),
        user_id: prize.user_id,
        snapshot_id: snapshot.id,
        board_id: board.id,
        medal_tier: prize.medal_tier,
        crown_family: prize.crown_family,
        amount: prize.crowns,
        status: :active,
        idempotency_key: idempotency_key,
        inserted_at: now,
        updated_at: now
      }

      {inserted, _rows} =
        Repo.insert_all(RewardGrant, [attrs],
          on_conflict: :nothing,
          conflict_target: :idempotency_key
        )

      case inserted do
        0 ->
          :already_awarded

        1 ->
          %RewardWallet{}
          |> RewardWallet.changeset(%{
            user_id: prize.user_id,
            crown_family: prize.crown_family,
            balance: prize.crowns
          })
          |> Repo.insert!(
            on_conflict: [inc: [balance: prize.crowns], set: [updated_at: now]],
            conflict_target: [:user_id, :crown_family]
          )

          %UserAchievement{}
          |> UserAchievement.changeset(%{
            user_id: prize.user_id,
            achievement_key:
              "weekly:#{board.key}:#{Date.to_iso8601(period.week_start)}:#{prize.medal_tier}",
            board_id: board.id,
            snapshot_id: snapshot.id,
            tier: prize.medal_tier,
            status: :active,
            awarded_at: now
          })
          |> Repo.insert!()

          Repo.get_by!(RewardGrant, idempotency_key: idempotency_key)
      end
    end)
  end

  defp identity_audit(user) do
    %{
      "displayName" => user.display_name,
      "discriminator" => user.public_discriminator,
      "avatarAssetId" => user.avatar_asset_id,
      "visibility" => Atom.to_string(user.public_profile_status)
    }
  end

  defp scoring_for_date!(date) do
    case Configuration.for_date(date) do
      {:ok, scoring} -> scoring
      {:error, reason} -> raise "scoring unavailable for #{date}: #{inspect(reason)}"
    end
  end

  defp scoring_for_period!(period) do
    version = Repo.get!(AdventureTimeApi.Leaderboards.ScoringVersion, period.scoring_version_id)

    case Configuration.normalize(version.configuration) do
      {:ok, configuration} -> {version, configuration}
      {:error, reason} -> raise "invalid period scoring configuration: #{inspect(reason)}"
    end
  end

  defp utc_midnight(date), do: DateTime.new!(date, ~T[00:00:00], "Etc/UTC")
end
