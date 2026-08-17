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
        starts_at: ~U[2026-08-16 00:00:00.000000Z],
        ends_at: ~U[2026-08-17 00:00:00.000000Z],
        closes_at: ~U[2026-08-17 13:00:00.000000Z],
        competition_date: ~D[2026-08-16],
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
      points_milli: 1_000_000,
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
    assert [%{"rank" => 1, "pointsMilli" => 1_000_000} = row] = response["rows"]
    assert row["profile"]["publicProfileId"] == user.public_profile_id
    assert row["profile"]["fallbackAvatarKey"] in response_avatar_keys()
    assert response["currentPlayer"]["rank"] == 1

    profile =
      build_conn()
      |> put_req_header("authorization", "Bearer #{token}")
      |> get(~p"/public-profiles/#{user.public_profile_id}")
      |> json_response(200)

    assert profile["profile"]["handle"] == "BMO##{user.public_discriminator}"
    assert profile["crowns"]["total"] == 0
    assert [%{"boardKey" => "steps/default", "points" => 1_000}] = profile["personalBests"]
  end

  test "GET /leaderboards/:quest/:mode returns the top seven and pins a lower-ranked player", %{
    conn: conn
  } do
    {current_user, token} = create_approved_user_and_token("rank-eight")
    board = Repo.get_by!(Board, key: "steps/default")
    unique = System.unique_integer([:positive])

    scoring_version =
      %ScoringVersion{}
      |> ScoringVersion.changeset(%{
        version: "top-seven-test-#{unique}",
        schema_version: 1,
        configuration: %{"test" => true},
        configuration_hash: "top-seven-hash-#{unique}",
        effective_week_start: Date.add(~D[2040-01-02], 7 * rem(unique, 400)),
        status: :active
      })
      |> Repo.insert!()

    period =
      %Period{}
      |> Period.changeset(%{
        period_type: :day,
        competition_timezone: "global",
        starts_at: ~U[2026-08-16 00:00:00.000000Z],
        ends_at: ~U[2026-08-17 00:00:00.000000Z],
        closes_at: ~U[2026-08-17 13:00:00.000000Z],
        competition_date: ~D[2026-08-16],
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
        participant_count: 8,
        valid_result_count: 8,
        configuration_hash: scoring_version.configuration_hash,
        source_cutoff: period.closes_at,
        finalized_at: period.closes_at,
        finalized_by: "test",
        current: true
      })
      |> Repo.insert!()

    for rank <- 1..7 do
      {user, _token} = create_approved_user_and_token("top-seven-#{rank}")
      insert_snapshot_row(snapshot, user, rank, (900 - rank) * 1_000)
    end

    insert_snapshot_row(snapshot, current_user, 8, 700_000)

    response =
      conn
      |> put_req_header("authorization", "Bearer #{token}")
      |> get(~p"/leaderboards/steps/default?period=yesterday")
      |> json_response(200)

    assert Enum.map(response["rows"], & &1["rank"]) == Enum.to_list(1..7)
    assert response["currentPlayer"]["rank"] == 8

    assert response["currentPlayer"]["profile"]["publicProfileId"] ==
             current_user.public_profile_id

    assert response["pageInfo"]["hasNextPage"]
  end

  defp create_approved_user_and_token(label) do
    user =
      %User{}
      |> User.registration_changeset(%{
        email: "#{label}-#{System.unique_integer([:positive])}@example.com",
        display_name: "BMO",
        timezone: "Etc/UTC"
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

  defp insert_snapshot_row(snapshot, user, rank, points_milli) do
    %SnapshotRow{}
    |> SnapshotRow.changeset(%{
      snapshot_id: snapshot.id,
      user_id: user.id,
      public_profile_id: user.public_profile_id,
      position: rank,
      rank: rank,
      tie_group: rank,
      points_milli: points_milli,
      raw_result: %{"kind" => "steps", "steps" => 20_000 - rank},
      medal_tier: if(rank <= 3, do: Enum.at([:gold, :silver, :bronze], rank - 1), else: nil)
    })
    |> Repo.insert!()
  end
end
