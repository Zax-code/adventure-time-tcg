defmodule AdventureTimeApi.Leaderboards.CalendarTest do
  use ExUnit.Case, async: true

  alias AdventureTimeApi.Leaderboards.Calendar

  describe "slot/2" do
    test "uses natural local midnight boundaries across daylight-saving changes" do
      assert {:ok, slot} = Calendar.slot(~D[2026-03-08], "America/New_York")

      assert slot.local_date == ~D[2026-03-08]
      assert slot.competition_week_key == ~D[2026-03-02]
      assert slot.starts_at == ~U[2026-03-08 05:00:00Z]
      assert slot.ends_at == ~U[2026-03-09 04:00:00Z]
      assert DateTime.diff(slot.ends_at, slot.starts_at, :hour) == 23
    end

    test "rejects unknown IANA timezones" do
      assert {:error, :invalid_timezone} = Calendar.slot(~D[2026-03-08], "Mars/Ooo")
    end
  end

  describe "publication_cutoff/1" do
    test "closes a civil date at 13:00 UTC on the following day" do
      assert Calendar.publication_cutoff(~D[2026-08-15]) == ~U[2026-08-16 13:00:00Z]
    end
  end
end
