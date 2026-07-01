defmodule AdventureTimeApiWeb.NotFoundController do
  use AdventureTimeApiWeb, :controller

  alias AdventureTimeApiWeb.ErrorHTML

  def show(conn, _params) do
    conn
    |> put_status(:not_found)
    |> respond()
  end

  defp respond(%{private: %{phoenix_format: "json"}} = conn) do
    json(conn, %{error: "Not Found"})
  end

  defp respond(conn) do
    conn
    |> put_resp_content_type("text/html")
    |> put_resp_header("cache-control", "public, max-age=60")
    |> send_resp(404, ErrorHTML.not_found_document())
  end
end
