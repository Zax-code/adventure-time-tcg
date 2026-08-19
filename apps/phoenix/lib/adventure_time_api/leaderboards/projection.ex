defmodule AdventureTimeApi.Leaderboards.Projection do
  @moduledoc "Builds current leaderboard rows directly from accepted ranked results."

  import Ecto.Query

  alias AdventureTimeApi.Accounts.User

  alias AdventureTimeApi.Leaderboards.{
    Board,
    DailyResult,
    Period,
    Ranking,
    Scoring,
    WeeklySummary
  }

  alias AdventureTimeApi.Repo

  @overall_family_by_board %{
    "steps/default" => :steps,
    "daily-numbers/family" => :daily_numbers,
    "wordle/family" => :wordle,
    "speed-calculus/ranked" => :speed_calculus,
    "perfect-timing/official" => :perfect_timing
  }

  def rows(period, %Board{board_kind: :source} = board, configuration) do
    source_rows(period, board, configuration)
  end

  def rows(period, %Board{board_kind: :derived_family} = board, configuration) do
    derived_rows(period, board, configuration)
  end

  def rows(period, %Board{board_kind: :derived_overall} = board, configuration) do
    overall_rows(period, board, configuration)
  end

  defp source_rows(%Period{period_type: :day} = period, board, _configuration) do
    eligible_results(
      board.id,
      dynamic([result, _user], result.competition_date == ^period.competition_date)
    )
    |> Enum.map(fn {result, user} ->
      row_from_result(result, user)
      |> Map.put(:competitive_key, result.points_milli)
    end)
    |> Ranking.rank(& &1.competitive_key)
  end

  defp source_rows(%Period{period_type: :week} = period, board, configuration) do
    week_end = Date.add(period.week_start, 6)

    eligible_results(
      board.id,
      dynamic(
        [result, _user],
        result.competition_date >= ^period.week_start and result.competition_date <= ^week_end
      )
    )
    |> Enum.group_by(fn {result, _user} -> result.user_id end)
    |> Enum.flat_map(fn {_user_id, result_users} ->
      sorted = Enum.sort_by(result_users, fn {result, _user} -> result.points_milli end, :desc)
      points = Enum.map(sorted, fn {result, _user} -> result.points_milli end)

      case Scoring.weekly(configuration, points) do
        {:ok, %{status: :ranked} = score} ->
          selected = Enum.take(sorted, length(score.selected_points_milli))
          {_best_result, user} = hd(sorted)

          [
            %{
              user: user,
              user_id: user.id,
              public_profile_id: user.public_profile_id,
              points_milli: score.points_milli,
              raw_result:
                WeeklySummary.source(
                  board.key,
                  Enum.map(selected, fn {result, _user} -> result end)
                ),
              selected_daily_result_ids: Enum.map(selected, fn {result, _} -> result.id end),
              selected_points_milli: score.selected_points_milli,
              identity_audit: identity_audit(user),
              competitive_key: score.points_milli
            }
          ]

        _ ->
          []
      end
    end)
    |> Ranking.rank(& &1.competitive_key)
  end

  defp derived_rows(period, board, configuration) do
    members = Map.get(board.derived_members, "members", [])

    member_rows =
      from(member in Board, where: member.key in ^members)
      |> Repo.all()
      |> Enum.flat_map(fn member ->
        Enum.map(rows(period, member, configuration), &{member.key, &1})
      end)
      |> Enum.group_by(fn {_member_key, row} -> row.user_id end)

    member_rows
    |> Enum.map(fn {_user_id, keyed_rows} ->
      points = Map.new(keyed_rows, fn {key, row} -> {key, row.points_milli} end)
      {:ok, derived} = Scoring.derived(configuration, board.key, points)
      {_key, first_row} = hd(keyed_rows)
      user = first_row.user
      member_vector = Enum.map(members, &Map.get(derived.member_points_milli, &1, 0))

      raw_result =
        if period.period_type == :week do
          WeeklySummary.combine(board.key, Enum.map(keyed_rows, &elem(&1, 1)))
        else
          %{"kind" => "member_breakdown", "members" => derived.member_points_milli}
        end

      %{
        user: user,
        user_id: user.id,
        public_profile_id: user.public_profile_id,
        points_milli: derived.points_milli,
        raw_result: raw_result,
        selected_daily_result_ids:
          Enum.flat_map(keyed_rows, fn {_key, row} -> row.selected_daily_result_ids end),
        selected_points_milli: member_vector,
        identity_audit: identity_audit(user),
        competitive_key: derived.points_milli
      }
    end)
    |> Ranking.rank(& &1.competitive_key)
  end

  defp overall_rows(period, board, configuration) do
    members = Map.get(board.derived_members, "members", [])

    member_rows =
      from(member in Board, where: member.key in ^members)
      |> Repo.all()
      |> Enum.flat_map(fn member ->
        Enum.map(rows(period, member, configuration), &{member.key, &1})
      end)
      |> Enum.group_by(fn {_member_key, row} -> row.user_id end)

    member_rows
    |> Enum.map(fn {_user_id, keyed_rows} ->
      family_points =
        Map.new(keyed_rows, fn {key, row} ->
          {Map.fetch!(@overall_family_by_board, key), row.points_milli}
        end)

      {:ok, overall} = Scoring.overall(family_points)
      {_key, first_row} = hd(keyed_rows)
      user = first_row.user
      member_points = Map.new(keyed_rows, fn {key, row} -> {key, row.points_milli} end)
      normalized_points = Map.new(members, &{&1, Map.get(member_points, &1, 0)})

      raw_result =
        if period.period_type == :week do
          WeeklySummary.overall(Enum.map(keyed_rows, &elem(&1, 1)))
        else
          %{"kind" => "member_breakdown", "members" => normalized_points}
        end

      %{
        user: user,
        user_id: user.id,
        public_profile_id: user.public_profile_id,
        points_milli: overall.points_milli,
        raw_result: raw_result,
        selected_daily_result_ids:
          Enum.flat_map(keyed_rows, fn {_key, row} -> row.selected_daily_result_ids end),
        selected_points_milli: Enum.map(members, &Map.fetch!(normalized_points, &1)),
        identity_audit: identity_audit(user),
        competitive_key: overall.points_milli
      }
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
      user: user,
      user_id: user.id,
      public_profile_id: user.public_profile_id,
      points_milli: result.points_milli,
      raw_result: result.raw_result,
      selected_daily_result_ids: [result.id],
      selected_points_milli: [result.points_milli],
      identity_audit: identity_audit(user)
    }
  end

  defp identity_audit(user) do
    %{
      "displayName" => user.display_name,
      "discriminator" => user.public_discriminator,
      "avatarAssetId" => user.avatar_asset_id,
      "visibility" => Atom.to_string(user.public_profile_status)
    }
  end
end
