defmodule AdventureTimeApiWeb.RawBodyReader do
  @moduledoc false

  def read_body(conn, opts) do
    read_body(conn, opts, "")
  end

  defp read_body(conn, opts, acc) do
    max_length = Keyword.get(opts, :length, 8_000_000)

    case Plug.Conn.read_body(conn, opts) do
      {:ok, body, conn} ->
        full_body = acc <> body

        if byte_size(full_body) > max_length do
          raise Plug.Parsers.RequestTooLargeError
        else
          {:ok, full_body, Plug.Conn.put_private(conn, :raw_body, full_body)}
        end

      {:more, body, conn} ->
        full_body = acc <> body

        if byte_size(full_body) >= max_length do
          raise Plug.Parsers.RequestTooLargeError
        else
          read_body(conn, opts, full_body)
        end
    end
  end
end
