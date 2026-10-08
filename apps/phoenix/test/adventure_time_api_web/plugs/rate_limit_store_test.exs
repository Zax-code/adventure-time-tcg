defmodule AdventureTimeApiWeb.Plugs.RateLimit.StoreTest do
  use ExUnit.Case, async: false

  alias AdventureTimeApiWeb.Plugs.RateLimit.Store

  @table :adventure_time_api_rate_limits

  setup do
    Store.reset()
    on_exit(&Store.reset/0)
  end

  test "counts per bucket and key within a window" do
    assert {:allow, 1} = Store.check_and_increment(:test_bucket, "a", 2, 60_000)
    assert {:allow, 2} = Store.check_and_increment(:test_bucket, "a", 2, 60_000)
    assert {:deny, 3} = Store.check_and_increment(:test_bucket, "a", 2, 60_000)
    assert {:allow, 1} = Store.check_and_increment(:test_bucket, "b", 2, 60_000)
  end

  test "expired windows are pruned on the periodic sweep, not every call" do
    Store.check_and_increment(:test_bucket, "seed", 10, 60_000)
    # Monotonic time can be negative, so expire relative to it.
    expired_at = System.monotonic_time(:millisecond) - 1_000
    :ets.insert(@table, {{:test_bucket, "stale", 0}, 1, expired_at})

    Store.check_and_increment(:test_bucket, "seed", 10, 60_000)
    assert [_] = :ets.lookup(@table, {:test_bucket, "stale", 0})

    :ets.insert(@table, {:__last_prune__, System.monotonic_time(:millisecond) - 31_000, :marker})
    Store.check_and_increment(:test_bucket, "seed", 10, 60_000)

    assert [] = :ets.lookup(@table, {:test_bucket, "stale", 0})
    assert [_] = :ets.lookup(@table, :__last_prune__)
  end
end
