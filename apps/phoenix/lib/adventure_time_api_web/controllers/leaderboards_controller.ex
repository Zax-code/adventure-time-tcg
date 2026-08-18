defmodule AdventureTimeApiWeb.LeaderboardsController do
  use AdventureTimeApiWeb, :controller

  alias AdventureTimeApi.Leaderboards.{Boards, PublicProfiles, Query}

  def boards(conn, _params) do
    boards =
      Boards.list_enabled()
      |> Enum.map(fn board ->
        %{
          key: board.key,
          quest: board.key |> String.split("/", parts: 2) |> hd(),
          family: board.quest_family,
          mode: board.mode,
          direction: board.direction,
          boardKind: board.board_kind,
          rawResultKind: board.raw_result_kind,
          enabled: board.enabled,
          prizesEnabled: board.prizes_enabled,
          displayOrder: board.display_order,
          members: Map.get(board.derived_members, "members", [])
        }
      end)

    json(conn, %{
      boards: boards,
      fallbackAvatarKeys: PublicProfiles.fallback_avatar_keys(),
      serverNow: DateTime.utc_now()
    })
  end

  def show(conn, %{"quest" => quest, "mode" => mode, "period" => period}) do
    result =
      if period == "history" do
        Query.history(quest, mode, conn.assigns.auth_user.id)
      else
        Query.fetch(quest, mode, period, conn.assigns.auth_user.id)
      end

    case result do
      {:ok, payload} ->
        json(conn, payload)

      {:error, :invalid_period} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Invalid leaderboard period", code: "INVALID_LEADERBOARD_PERIOD"})

      {:error, :period_unavailable} ->
        conn
        |> put_status(:not_found)
        |> json(%{
          error: "Leaderboard period unavailable",
          code: "LEADERBOARD_PERIOD_UNAVAILABLE"
        })
    end
  end

  def public_profile(conn, %{"public_profile_id" => public_profile_id}) do
    case PublicProfiles.fetch(public_profile_id) do
      {:ok, payload} ->
        json(conn, payload)

      {:error, :private_profile} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Public profile unavailable", code: "PUBLIC_PROFILE_UNAVAILABLE"})

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Public profile not found", code: "PUBLIC_PROFILE_NOT_FOUND"})
    end
  end

  def history_days(conn, %{
        "quest" => quest,
        "mode" => mode,
        "period_start" => period_start
      }) do
    case Query.history_days(quest, mode, period_start, conn.assigns.auth_user.id) do
      {:ok, payload} ->
        json(conn, payload)

      {:error, :invalid_period} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Invalid leaderboard period", code: "INVALID_LEADERBOARD_PERIOD"})

      {:error, :period_unavailable} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Leaderboard unavailable", code: "LEADERBOARD_PERIOD_UNAVAILABLE"})
    end
  end
end
