defmodule AdventureTimeApi.HealthTest do
  use AdventureTimeApi.DataCase, async: true

  alias AdventureTimeApi.Accounts.User
  alias AdventureTimeApi.Health
  alias AdventureTimeApi.Health.StepSnapshot
  alias AdventureTimeApi.Repo

  test "get_latest_step_snapshot prefers the most recent recorded day" do
    user =
      %User{}
      |> User.registration_changeset(%{
        email: "steps-tester@example.com",
        display_name: "Steps Tester"
      })
      |> Repo.insert!()

    today = Date.utc_today()
    yesterday = Date.add(today, -1)

    %StepSnapshot{}
    |> StepSnapshot.changeset(%{
      user_id: user.id,
      source: :device_health,
      step_count: 12_345,
      recorded_for: today
    })
    |> Repo.insert!()

    %StepSnapshot{}
    |> StepSnapshot.changeset(%{
      user_id: user.id,
      source: :fitbit,
      step_count: 8_765,
      recorded_for: yesterday
    })
    |> Repo.insert!()

    latest = Health.get_latest_step_snapshot(user.id)

    assert latest.recorded_for == today
    assert latest.step_count == 12_345
  end
end
