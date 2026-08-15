defmodule AdventureTimeApiWeb.LeaderboardsControllerTest do
  use AdventureTimeApiWeb.ConnCase, async: true

  alias AdventureTimeApi.Accounts.User
  alias AdventureTimeApi.Auth

  alias AdventureTimeApi.Leaderboards.{
    Board,
    Period,
    ScoringVersion,
    Snapshot,
    SnapshotRow
  }

  alias AdventureTimeApi.Repo

  test "GET /leaderboards/boards requires an approved authenticated player", %{conn: conn} do
    assert conn |> get(~p"/leaderboards/boards") |> json_response(401) == %{
             "error" => "Unauthorized"
           }

    user =
      %User{}
      |> User.registration_changeset(%{
        email: "boards-#{System.unique_integer([:positive])}@example.com",
        display_name: "BMO"
      })
      |> User.access_changeset(%{role: :user, access_status: :approved})
      |> Repo.insert!()

    {:ok, token} =
      Auth.sign_access_token(%{
        "sub" => user.id,
        "email" => user.email,
        "isAdmin" => false,
        "isSuperAdmin" => false
      })

    response =
      build_conn()
      |> put_req_header("authorization", "Bearer #{token}")
      |> get(~p"/leaderboards/boards")
      |> json_response(200)

    assert length(response["boards"]) == 10
    assert hd(response["boards"])["key"] == "steps/default"
    assert length(response["fallbackAvatarKeys"]) == 12
    assert is_binary(response["serverNow"])
  end

  test "GET /leaderboards/:quest/:mode returns immutable snapshot rows", %{conn: conn} do
    {user, token} = create_approved_user_and_token("snapshot")
    board = Repo.get_by!(Board, key: "steps/default")
    unique = System.unique_integer([:positive])

    scoring_version =
      %ScoringVersion{}
      |> ScoringVersion.changeset(%{
        version: "snapshot-test-#{unique}",
        schema_version: 1,
        configuration: %{"test" => true},
        configuration_hash: "hash-#{unique}",
        effective_week_start: Date.add(~D[2040-01-02], 7 * rem(unique, 400)),
        status: :active
      })
      |> Repo.insert!()

    period =
      %Period{}
      |> Period.changeset(%{
        period_type: :day,
        competition_timezone: "global",
        starts_at: ~U[2039-12-01 00:00:00.000000Z],
        ends_at: ~U[2039-12-01 23:59:59.000000Z],
        closes_at: ~U[2039-12-02 20:15:00.000000Z],
        competition_date: ~D[2039-12-01],
        status: :closed,
        origin: :verified,
        prizes_allowed: true,
        scoring_version_id: scoring_version.id,
        launch_partial: false
      })
      |> Repo.insert!()

    snapshot =
      %Snapshot{}
      |> Snapshot.changeset(%{
        period_id: period.id,
        board_id: board.id,
        revision: 1,
        status: :closed,
        scoring_version_id: scoring_version.id,
        participant_count: 1,
        valid_result_count: 1,
        configuration_hash: scoring_version.configuration_hash,
        source_cutoff: period.closes_at,
        finalized_at: period.closes_at,
        finalized_by: "test",
        current: true
      })
      |> Repo.insert!()

    %SnapshotRow{}
    |> SnapshotRow.changeset(%{
      snapshot_id: snapshot.id,
      user_id: user.id,
      public_profile_id: user.public_profile_id,
      position: 1,
      rank: 1,
      tie_group: 1,
      points_milli: 632_121,
      raw_result: %{"kind" => "steps", "steps" => 20_000},
      medal_tier: :gold
    })
    |> Repo.insert!()

    response =
      conn
      |> put_req_header("authorization", "Bearer #{token}")
      |> get(~p"/leaderboards/steps/default?period=yesterday")
      |> json_response(200)

    assert response["board"]["key"] == "steps/default"
    assert response["period"]["revision"] == 1
    assert [%{"rank" => 1, "pointsMilli" => 632_121} = row] = response["rows"]
    assert row["profile"]["publicProfileId"] == user.public_profile_id
    assert row["profile"]["fallbackAvatarKey"] in response_avatar_keys()
    assert response["currentPlayer"] == nil

    profile =
      build_conn()
      |> put_req_header("authorization", "Bearer #{token}")
      |> get(~p"/public-profiles/#{user.public_profile_id}")
      |> json_response(200)

    assert profile["profile"]["handle"] == "BMO##{user.public_discriminator}"
    assert profile["crowns"]["total"] == 0
    assert [%{"boardKey" => "steps/default", "points" => 632}] = profile["personalBests"]
  end

  defp create_approved_user_and_token(label) do
    user =
      %User{}
      |> User.registration_changeset(%{
        email: "#{label}-#{System.unique_integer([:positive])}@example.com",
        display_name: "BMO"
      })
      |> User.access_changeset(%{role: :user, access_status: :approved})
      |> Repo.insert!()

    {:ok, token} =
      Auth.sign_access_token(%{
        "sub" => user.id,
        "email" => user.email,
        "isAdmin" => false,
        "isSuperAdmin" => false
      })

    {user, token}
  end

  defp response_avatar_keys do
    AdventureTimeApi.Leaderboards.PublicProfiles.fallback_avatar_keys()
  end
end
