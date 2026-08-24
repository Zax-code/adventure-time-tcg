defmodule AdventureTimeApiWeb.Plugs.SafeParsers do
  @moduledoc false

  import Plug.Conn

  def init(options), do: Plug.Parsers.init(options)

  def call(conn, options) do
    Plug.Parsers.call(conn, options)
  rescue
    Plug.Parsers.RequestTooLargeError ->
      conn
      |> put_resp_content_type("application/json")
      |> send_resp(
        413,
        Jason.encode!(%{
          error: "Upload exceeds the 12 MB application limit",
          code: "UPLOAD_TOO_LARGE"
        })
      )
      |> halt()
  end
end
