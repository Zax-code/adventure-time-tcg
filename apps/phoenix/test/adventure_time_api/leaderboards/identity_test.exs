defmodule AdventureTimeApi.Leaderboards.IdentityTest do
  use AdventureTimeApi.DataCase, async: true

  alias AdventureTimeApi.Accounts.User

  test "new users receive stable public identity fields from the database" do
    user =
      %User{}
      |> User.registration_changeset(%{
        email: "leaderboard-identity-#{System.unique_integer([:positive])}@example.com",
        display_name: "Finn"
      })
      |> Repo.insert!()

    assert {:ok, _uuid} = Ecto.UUID.cast(user.public_profile_id)
    assert user.public_discriminator =~ ~r/^[A-F0-9]{8}$/
    assert user.public_profile_status == :visible
    assert user.leaderboard_eligible
  end
end
