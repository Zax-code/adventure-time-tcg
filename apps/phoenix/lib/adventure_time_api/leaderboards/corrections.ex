defmodule AdventureTimeApi.Leaderboards.Corrections do
  @moduledoc "Audited super-admin exclusions and immutable snapshot corrections."

  import Ecto.Query

  alias AdventureTimeApi.Leaderboards.{
    Board,
    DailyResult,
    Period,
    Prizes,
    RewardGrant,
    RewardWallet,
    Snapshot,
    SnapshotCorrection,
    SnapshotRow,
    UserAchievement
  }

  alias AdventureTimeApi.Repo

  def exclude_result(result_id, actor, reason) when is_binary(reason) do
    with :ok <- authorize(actor),
         :ok <- validate_reason(reason),
         %DailyResult{} = result <- Repo.get(DailyResult, result_id),
         true <-
           result.result_status != :snapshotted or {:error, :closed_snapshot_requires_correction} do
      result
      |> Ecto.Changeset.change(%{
        result_status: :excluded,
        eligibility_status: :moderated,
        excluded_reason: String.trim(reason),
        excluded_by_user_id: actor.id,
        excluded_at: DateTime.utc_now()
      })
      |> Repo.update()
    else
      nil -> {:error, :not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  def exclude_result(_result_id, _actor, _reason), do: {:error, :invalid_reason}

  def preview(snapshot_id, actor, reason, excluded_user_ids)
      when is_binary(reason) and is_list(excluded_user_ids) do
    with :ok <- authorize(actor),
         :ok <- validate_reason(reason),
         {:ok, excluded_user_ids} <- validate_user_ids(excluded_user_ids),
         %Snapshot{current: true} = snapshot <- Repo.get(Snapshot, snapshot_id),
         %Period{} = period <- Repo.get(Period, snapshot.period_id),
         true <- period.status in [:closed, :corrected] or {:error, :period_not_closed},
         rows <- rows_for(snapshot.id),
         true <-
           Enum.any?(rows, &(&1.user_id in excluded_user_ids)) or {:error, :no_matching_rows} do
      proposed_rows = corrected_rows(rows, excluded_user_ids)
      changes = %{"excludeUserIds" => Enum.sort(excluded_user_ids)}
      rank_delta = rank_delta(rows, proposed_rows)
      reward_delta = reward_delta(rows, proposed_rows)
      now = DateTime.utc_now()
      preview_hash = preview_hash(snapshot, changes, rank_delta, reward_delta)

      correction =
        %SnapshotCorrection{
          source_snapshot_id: snapshot.id,
          source_revision: snapshot.revision,
          status: :previewed,
          preview_hash: preview_hash,
          reason: String.trim(reason),
          actor_user_id: actor.id,
          proposed_changes: changes,
          rank_delta: rank_delta,
          reward_delta: reward_delta,
          previewed_at: now
        }
        |> Repo.insert!()

      {:ok, project(correction)}
    else
      nil -> {:error, :not_found}
      %Snapshot{} -> {:error, :stale_snapshot}
      {:error, reason} -> {:error, reason}
    end
  end

  def preview(_snapshot_id, _actor, _reason, _ids), do: {:error, :invalid_changes}

  def confirm(snapshot_id, actor, preview_hash, true) when is_binary(preview_hash) do
    with :ok <- authorize(actor) do
      Repo.transaction(fn ->
        correction =
          Repo.one(
            from(correction in SnapshotCorrection,
              where:
                correction.source_snapshot_id == ^snapshot_id and
                  correction.preview_hash == ^preview_hash and correction.status == :previewed,
              order_by: [desc: correction.inserted_at],
              limit: 1,
              lock: "FOR UPDATE"
            )
          ) || Repo.rollback(:preview_not_found)

        source =
          Repo.one(
            from(snapshot in Snapshot,
              where: snapshot.id == ^snapshot_id,
              lock: "FOR UPDATE"
            )
          ) || Repo.rollback(:not_found)

        unless source.current and source.revision == correction.source_revision do
          Repo.rollback(:stale_correction_preview)
        end

        now = DateTime.utc_now()
        excluded_user_ids = Map.fetch!(correction.proposed_changes, "excludeUserIds")
        rows = source.id |> rows_for() |> corrected_rows(excluded_user_ids)
        period = Repo.get!(Period, source.period_id)
        board = Repo.get!(Board, source.board_id)

        source
        |> Ecto.Changeset.change(current: false, status: :superseded)
        |> Repo.update!()

        replacement =
          %Snapshot{
            period_id: source.period_id,
            board_id: source.board_id,
            revision: source.revision + 1,
            status: :closed,
            scoring_version_id: source.scoring_version_id,
            participant_count: length(rows),
            valid_result_count:
              Enum.reduce(rows, 0, &(&2 + length(&1.selected_daily_result_ids))),
            configuration_hash: source.configuration_hash,
            source_cutoff: now,
            finalized_at: now,
            finalized_by: "audited-correction:#{correction.id}",
            correction_reason: correction.reason,
            supersedes_snapshot_id: source.id,
            current: true
          }
          |> Repo.insert!()

        Enum.each(rows, &insert_replacement_row(&1, replacement, period, board))
        reconcile_prizes(source, replacement, period, board, actor, correction.reason, now)

        if period.status in [:closed, :corrected] do
          period |> Ecto.Changeset.change(status: :corrected) |> Repo.update!()
        end

        correction =
          correction
          |> Ecto.Changeset.change(%{
            status: :applied,
            confirmed_at: now,
            applied_at: now,
            resulting_snapshot_id: replacement.id
          })
          |> Repo.update!()

        project(correction)
      end)
    end
  end

  def confirm(_snapshot_id, _actor, _hash, _confirmed),
    do: {:error, :explicit_confirmation_required}

  defp authorize(%{id: id, isSuperAdmin: true}) when is_binary(id), do: :ok
  defp authorize(_actor), do: {:error, :super_admin_required}

  defp validate_reason(reason) do
    if String.length(String.trim(reason)) >= 8, do: :ok, else: {:error, :invalid_reason}
  end

  defp validate_user_ids(ids) do
    ids = Enum.uniq(ids)

    if ids != [] and Enum.all?(ids, &match?({:ok, _}, Ecto.UUID.cast(&1))) do
      {:ok, ids}
    else
      {:error, :invalid_changes}
    end
  end

  defp rows_for(snapshot_id) do
    Repo.all(
      from(row in SnapshotRow,
        where: row.snapshot_id == ^snapshot_id,
        order_by: [asc: row.position]
      )
    )
  end

  defp corrected_rows(rows, excluded_user_ids) do
    rows
    |> Enum.reject(&(&1.user_id in excluded_user_ids))
    |> Enum.chunk_by(& &1.rank)
    |> Enum.flat_map_reduce(1, fn tied_rows, next_position ->
      rank = next_position

      projected =
        tied_rows
        |> Enum.with_index(next_position)
        |> Enum.map(fn {row, position} ->
          %{row | position: position, rank: rank, tie_group: rank}
        end)

      {projected, next_position + length(tied_rows)}
    end)
    |> elem(0)
  end

  defp rank_delta(before_rows, after_rows) do
    before = Map.new(before_rows, &{&1.user_id, &1.rank})
    after_map = Map.new(after_rows, &{&1.user_id, &1.rank})

    Enum.reduce(before, %{}, fn {user_id, old_rank}, acc ->
      new_rank = Map.get(after_map, user_id)

      if old_rank == new_rank,
        do: acc,
        else: Map.put(acc, user_id, %{"before" => old_rank, "after" => new_rank})
    end)
  end

  defp reward_delta(before_rows, after_rows) do
    %{"before" => podium(before_rows), "after" => podium(after_rows)}
  end

  defp podium(rows) do
    rows
    |> Enum.filter(&(&1.rank <= 3))
    |> Enum.map(&%{"userId" => &1.user_id, "rank" => &1.rank})
  end

  defp preview_hash(snapshot, changes, rank_delta, reward_delta) do
    {snapshot.id, snapshot.revision, changes, rank_delta, reward_delta}
    |> :erlang.term_to_binary([:deterministic])
    |> then(&:crypto.hash(:sha256, &1))
    |> Base.encode16(case: :lower)
  end

  defp insert_replacement_row(row, snapshot, period, board) do
    medal =
      if period.period_type == :week and period.prizes_allowed and board.prizes_enabled,
        do: %{1 => :gold, 2 => :silver, 3 => :bronze}[row.rank],
        else: nil

    %SnapshotRow{
      snapshot_id: snapshot.id,
      user_id: row.user_id,
      public_profile_id: row.public_profile_id,
      anonymous_tombstone: row.anonymous_tombstone,
      position: row.position,
      rank: row.rank,
      tie_group: row.tie_group,
      points_milli: row.points_milli,
      raw_result: row.raw_result,
      selected_daily_result_ids: row.selected_daily_result_ids,
      selected_points_milli: row.selected_points_milli,
      medal_tier: medal,
      identity_audit: row.identity_audit
    }
    |> Repo.insert!()
  end

  defp reconcile_prizes(source, replacement, period, board, actor, reason, now) do
    if period.period_type == :week and period.prizes_allowed and board.prizes_enabled do
      reverse_source_prizes(source, replacement, actor, reason, now)

      Repo.all(from(row in SnapshotRow, where: row.snapshot_id == ^replacement.id))
      |> Prizes.plan(board.quest_family, prizes_allowed: true)
      |> Enum.each(&grant_replacement_prize(&1, replacement, board, period, now))

      link_superseding_grants(source, replacement)
    end
  end

  defp reverse_source_prizes(source, replacement, actor, reason, now) do
    Repo.all(
      from(grant in RewardGrant,
        where: grant.snapshot_id == ^source.id and grant.status == :active,
        lock: "FOR UPDATE"
      )
    )
    |> Enum.each(fn grant ->
      wallet =
        Repo.one!(
          from(wallet in RewardWallet,
            where:
              wallet.user_id == ^grant.user_id and wallet.crown_family == ^grant.crown_family,
            lock: "FOR UPDATE"
          )
        )

      if wallet.balance < grant.amount, do: Repo.rollback(:invalid_crown_balance)

      wallet
      |> RewardWallet.changeset(%{balance: wallet.balance - grant.amount})
      |> Repo.update!()

      grant
      |> Ecto.Changeset.change(%{
        status: :reversed,
        reversed_at: now,
        reversal_reason: reason,
        reversed_by_user_id: actor.id
      })
      |> Repo.update!()
    end)

    from(achievement in UserAchievement,
      where: achievement.snapshot_id == ^source.id and achievement.status == :active
    )
    |> Repo.update_all(
      set: [
        status: :reversed,
        reversed_at: now,
        reversal_reason: reason,
        reversed_by_user_id: actor.id,
        replacement_snapshot_id: replacement.id,
        updated_at: now
      ]
    )
  end

  defp grant_replacement_prize(prize, snapshot, board, period, now) do
    grant =
      %RewardGrant{
        user_id: prize.user_id,
        snapshot_id: snapshot.id,
        board_id: board.id,
        medal_tier: prize.medal_tier,
        crown_family: prize.crown_family,
        amount: prize.crowns,
        status: :active,
        idempotency_key: "#{snapshot.id}:#{prize.user_id}:#{prize.medal_tier}"
      }
      |> Repo.insert!()

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
        "weekly:#{board.key}:#{Date.to_iso8601(period.week_start)}:#{prize.medal_tier}:revision-#{snapshot.revision}",
      board_id: board.id,
      snapshot_id: snapshot.id,
      tier: prize.medal_tier,
      status: :active,
      awarded_at: now
    })
    |> Repo.insert!()

    grant
  end

  defp link_superseding_grants(source, replacement) do
    new_grants =
      Repo.all(from(grant in RewardGrant, where: grant.snapshot_id == ^replacement.id))
      |> Map.new(&{&1.user_id, &1.id})

    Repo.all(
      from(grant in RewardGrant,
        where: grant.snapshot_id == ^source.id and grant.status == :reversed
      )
    )
    |> Enum.each(fn grant ->
      case Map.get(new_grants, grant.user_id) do
        nil ->
          :ok

        superseding_id ->
          grant
          |> Ecto.Changeset.change(superseding_grant_id: superseding_id)
          |> Repo.update!()
      end
    end)
  end

  defp project(correction) do
    %{
      id: correction.id,
      sourceSnapshotId: correction.source_snapshot_id,
      sourceRevision: correction.source_revision,
      status: correction.status,
      previewHash: correction.preview_hash,
      proposedChanges: correction.proposed_changes,
      rankDelta: correction.rank_delta,
      rewardDelta: correction.reward_delta,
      resultingSnapshotId: correction.resulting_snapshot_id
    }
  end
end
