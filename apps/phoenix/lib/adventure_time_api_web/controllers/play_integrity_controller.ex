defmodule AdventureTimeApiWeb.PlayIntegrityController do
  use AdventureTimeApiWeb, :controller

  alias AdventureTimeApi.AccessAssessment
  alias AdventureTimeApiWeb.Plugs.RateLimit

  def create(conn, %{
        "challengeToken" => challenge_token,
        "integrityToken" => integrity_token
      }) do
    conn = RateLimit.call(conn, bucket: :auth_play_integrity, key_strategy: :ip_challenge)

    if conn.halted do
      conn
    else
      case AccessAssessment.submit_play_integrity(challenge_token, integrity_token) do
        {:ok, _result} -> send_resp(conn, :no_content, "")
        {:error, _reason} -> invalid_submission(conn)
      end
    end
  end

  def create(conn, _params), do: invalid_submission(conn)

  defp invalid_submission(conn) do
    conn
    |> put_status(:bad_request)
    |> json(%{
      error: "Invalid integrity submission",
      code: "INVALID_INTEGRITY_SUBMISSION"
    })
  end
end
