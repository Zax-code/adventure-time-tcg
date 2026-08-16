defmodule AdventureTimeApi.Leaderboards.PublicProfiles do
  @moduledoc """
  Safe public identity projection helpers.

  Fallbacks are deterministic from the non-private public profile UUID and remain
  stable across display-name and uploaded-avatar changes.
  """

  @fallback_avatar_keys ~w(
    finn
    jake
    princess-bubblegum
    marceline
    bmo
    ice-king
    flame-princess
    lumpy-space-princess
    lady-rainicorn
    gunter
    peppermint-butler
    tree-trunks
  )

  @spec fallback_avatar_keys() :: [String.t()]
  def fallback_avatar_keys, do: @fallback_avatar_keys

  @spec fallback_avatar_key(Ecto.UUID.t() | nil) :: String.t() | nil
  def fallback_avatar_key(public_profile_id) when is_binary(public_profile_id) do
    with {:ok, uuid_binary} <- Ecto.UUID.dump(public_profile_id) do
      <<bucket::unsigned-integer-size(32), _::binary>> = :crypto.hash(:sha256, uuid_binary)
      Enum.at(@fallback_avatar_keys, rem(bucket, length(@fallback_avatar_keys)))
    else
      :error -> nil
    end
  end

  def fallback_avatar_key(_public_profile_id), do: nil

  import Ecto.Query

  alias AdventureTimeApi.Accounts.User

  alias AdventureTimeApi.Leaderboards.{
    Board,
    Period,
    RewardWallet,
    Snapshot,
    SnapshotRow,
    UserAchievement
  }

  alias AdventureTimeApi.Repo

  @spec fetch(Ecto.UUID.t()) :: {:ok, map()} | {:error, :not_found | :private_profile}
  def fetch(public_profile_id) do
    case Repo.get_by(User, public_profile_id: public_profile_id) do
      %User{public_profile_status: :visible} = user -> {:ok, build_profile(user)}
      %User{} -> {:error, :private_profile}
      nil -> {:error, :not_found}
    end
  end

  defp build_profile(user) do
    crown_balances =
      from(wallet in RewardWallet,
        where: wallet.user_id == ^user.id,
        select: {wallet.crown_family, wallet.balance}
      )
      |> Repo.all()
      |> Map.new()

    crowns = %{
      steps: Map.get(crown_balances, :steps, 0),
      dailyNumbers: Map.get(crown_balances, :daily_numbers, 0),
      wordle: Map.get(crown_balances, :wordle, 0),
      speedCalculus: Map.get(crown_balances, :speed_calculus, 0),
      perfectTiming: Map.get(crown_balances, :perfect_timing, 0)
    }

    crowns = Map.put(crowns, :total, crowns |> Map.values() |> Enum.sum())

    medal_counts =
      from(achievement in UserAchievement,
        where: achievement.user_id == ^user.id and achievement.status == :active,
        group_by: achievement.tier,
        select: {achievement.tier, count(achievement.id)}
      )
      |> Repo.all()
      |> Map.new()

    %{
      profile: project_identity(user),
      crowns: crowns,
      medals: %{
        gold: Map.get(medal_counts, :gold, 0),
        silver: Map.get(medal_counts, :silver, 0),
        bronze: Map.get(medal_counts, :bronze, 0)
      },
      recentPlacements: recent_placements(user.id),
      personalBests: personal_bests(user.id)
    }
  end

  defp recent_placements(user_id) do
    from(row in SnapshotRow,
      join: snapshot in Snapshot,
      on: snapshot.id == row.snapshot_id and snapshot.current,
      join: period in Period,
      on: period.id == snapshot.period_id,
      join: board in Board,
      on: board.id == snapshot.board_id,
      where:
        row.user_id == ^user_id and period.period_type == :week and
          period.status in [:closed, :corrected] and period.origin == :verified,
      order_by: [desc: period.week_start],
      limit: 10,
      select: {board.key, period.week_start, row.rank, row.points_milli, row.medal_tier}
    )
    |> Repo.all()
    |> Enum.map(fn {board_key, week_start, rank, points_milli, medal} ->
      %{
        boardKey: board_key,
        weekStart: week_start,
        rank: rank,
        points: div(points_milli + 500, 1_000),
        medal: medal
      }
    end)
  end

  defp personal_bests(user_id) do
    from(row in SnapshotRow,
      join: snapshot in Snapshot,
      on: snapshot.id == row.snapshot_id and snapshot.current,
      join: period in Period,
      on: period.id == snapshot.period_id,
      join: board in Board,
      on: board.id == snapshot.board_id,
      where:
        row.user_id == ^user_id and period.period_type == :day and
          period.status in [:closed, :corrected] and period.origin == :verified,
      order_by: [desc: row.points_milli],
      select: {board.key, row.raw_result, row.points_milli}
    )
    |> Repo.all()
    |> Enum.uniq_by(&elem(&1, 0))
    |> Enum.map(fn {board_key, raw_result, points_milli} ->
      %{boardKey: board_key, rawResult: raw_result, points: div(points_milli + 500, 1_000)}
    end)
  end

  defp project_identity(user) do
    display_name = user.display_name || "Player"

    %{
      publicProfileId: user.public_profile_id,
      displayName: user.display_name,
      discriminator: user.public_discriminator,
      handle: "#{display_name}##{user.public_discriminator}",
      avatarUrl: avatar_url(user.avatar_asset_id),
      fallbackAvatarKey: fallback_avatar_key(user.public_profile_id),
      visibility: :visible
    }
  end

  defp avatar_url(nil), do: nil

  defp avatar_url(asset_id) do
    AdventureTimeApiWeb.Endpoint.url() <> "/media/profile/" <> asset_id
  end
end
