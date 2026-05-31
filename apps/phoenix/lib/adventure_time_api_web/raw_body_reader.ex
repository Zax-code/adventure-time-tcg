defmodule AdventureTimeApiWeb.RawBodyReader do
  @moduledoc false

  def read_body(conn, opts) do
    read_body(conn, opts, "")
  end

  defp read_body(conn, opts, acc) do
    case Plug.Conn.read_body(conn, opts) do
      {:ok, body, conn} ->
        full_body = acc <> body
        {:ok, full_body, Plug.Conn.put_private(conn, :raw_body, full_body)}

      {:more, body, conn} ->
        read_body(conn, opts, acc <> body)
    end
  end
end
