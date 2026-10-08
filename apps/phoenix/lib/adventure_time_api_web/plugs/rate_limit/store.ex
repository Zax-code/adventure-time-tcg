defmodule AdventureTimeApiWeb.Plugs.RateLimit.Store do
  @moduledoc false

  @table :adventure_time_api_rate_limits
  @prune_interval_ms 30_000
  # Stored as a 3-tuple whose third element is an atom, which compares greater than
  # any integer, so the expiry match spec never deletes it.
  @prune_marker :__last_prune__

  def reset do
    ensure_table!()
    :ets.delete_all_objects(@table)
    :ok
  end

  def check_and_increment(bucket, key, limit, scale_ms) do
    ensure_table!()
    now = System.monotonic_time(:millisecond)
    maybe_prune_expired(now)

    window = div(now, scale_ms)
    expires_at = (window + 1) * scale_ms
    lookup_key = {bucket, key, window}

    count =
      case :ets.lookup(@table, lookup_key) do
        [{^lookup_key, current_count, _current_expires_at}] ->
          next_count = current_count + 1
          true = :ets.insert(@table, {lookup_key, next_count, expires_at})
          next_count

        [] ->
          true = :ets.insert(@table, {lookup_key, 1, expires_at})
          1
      end

    if count <= limit, do: {:allow, count}, else: {:deny, count}
  end

  defp ensure_table! do
    case :ets.whereis(@table) do
      :undefined ->
        try do
          :ets.new(@table, [
            :named_table,
            :public,
            :set,
            read_concurrency: true,
            write_concurrency: true
          ])

          :ok
        rescue
          ArgumentError -> :ok
        end

      _ ->
        :ok
    end
  end

  # Expired windows are never read again (the window is part of the key), so they
  # only cost memory; sweep them periodically rather than on every request.
  defp maybe_prune_expired(now) do
    last_prune =
      case :ets.lookup(@table, @prune_marker) do
        [{@prune_marker, timestamp, _}] -> timestamp
        [] -> nil
      end

    if is_nil(last_prune) or now - last_prune >= @prune_interval_ms do
      :ets.insert(@table, {@prune_marker, now, :marker})
      prune_expired(now)
    end

    :ok
  end

  defp prune_expired(now) do
    :ets.select_delete(@table, [{{:"$1", :"$2", :"$3"}, [{:<, :"$3", now}], [true]}])
  end
end
