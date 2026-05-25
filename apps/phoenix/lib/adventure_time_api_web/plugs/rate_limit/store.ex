defmodule AdventureTimeApiWeb.Plugs.RateLimit.Store do
  @moduledoc false

  @table :adventure_time_api_rate_limits

  def reset do
    ensure_table!()
    :ets.delete_all_objects(@table)
    :ok
  end

  def check_and_increment(bucket, key, limit, scale_ms) do
    ensure_table!()
    prune_expired(System.monotonic_time(:millisecond))

    now = System.monotonic_time(:millisecond)
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
        :ets.new(@table, [
          :named_table,
          :public,
          :set,
          read_concurrency: true,
          write_concurrency: true
        ])

        :ok

      _ ->
        :ok
    end
  end

  defp prune_expired(now) do
    :ets.select_delete(@table, [{{:"$1", :"$2", :"$3"}, [{:<, :"$3", now}], [true]}])
  end
end
