defmodule AdventureTimeApiWeb.RawBodyReaderTest do
  use ExUnit.Case, async: true

  import Plug.Test

  alias AdventureTimeApiWeb.RawBodyReader

  test "keeps the raw body only for the Fitbit webhook" do
    for path <- ["/api/fitbit/webhook", "/fitbit/webhook"] do
      {:ok, body, conn} = RawBodyReader.read_body(conn(:post, path, ~s({"a":1})), [])
      assert body == ~s({"a":1})
      assert conn.private[:raw_body] == ~s({"a":1})
    end

    {:ok, body, conn} = RawBodyReader.read_body(conn(:post, "/quests/claim", ~s({"a":1})), [])
    assert body == ~s({"a":1})
    refute Map.has_key?(conn.private, :raw_body)
  end
end
