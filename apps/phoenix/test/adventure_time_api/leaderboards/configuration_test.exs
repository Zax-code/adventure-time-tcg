defmodule AdventureTimeApi.Leaderboards.ConfigurationTest do
  use AdventureTimeApi.DataCase, async: true

  alias AdventureTimeApi.Leaderboards.{Configuration, Scoring, ScoringVersion}

  test "persists, activates, and reloads the allow-listed launch configuration" do
    now = ~U[2026-08-17 00:01:00.000000Z]

    assert {:ok, scheduled} = Configuration.ensure_launch_version()
    assert scheduled.status == :scheduled

    assert scheduled.configuration["boards"]["steps/default"]["formula"] ==
             "saturating_higher_better"

    assert {:ok, active} = Configuration.activate_due(now)
    assert active.id == scheduled.id
    assert active.status == :active
    assert {:ok, {^active, normalized}} = Configuration.for_date(~D[2026-08-17])
    assert normalized == Scoring.launch_configuration()
    assert {:ok, 632_121} = Scoring.score(normalized, "steps/default", %{"steps" => 20_000})

    assert Repo.aggregate(ScoringVersion, :count) == 1
  end

  test "activates for the no-prize partial launch week but not before launch" do
    assert {:ok, scheduled} = Configuration.ensure_launch_version()

    assert {:error, :not_yet_effective} =
             Configuration.activate_due(~U[2026-08-14 23:59:59.000000Z])

    assert Repo.reload!(scheduled).status == :scheduled

    assert {:ok, active} = Configuration.activate_due(~U[2026-08-15 00:00:00.000000Z])
    assert {:ok, {^active, _configuration}} = Configuration.for_date(~D[2026-08-15])
  end
end
