defmodule AdventureTimeApiWeb.Plugs.SafeParsersTest do
  use ExUnit.Case, async: true

  import Plug.Conn
  import Plug.Test

  alias AdventureTimeApiWeb.Plugs.SafeParsers

  test "returns structured 413 JSON when a multipart body exceeds policy" do
    boundary = "media-boundary"

    body =
      "--#{boundary}\r\n" <>
        "content-disposition: form-data; name=\"file\"; filename=\"large.jpg\"\r\n" <>
        "content-type: image/jpeg\r\n\r\n" <>
        :binary.copy(<<0>>, 256) <>
        "\r\n--#{boundary}--\r\n"

    options =
      SafeParsers.init(
        parsers: [:multipart],
        pass: ["*/*"],
        length: 128
      )

    conn =
      conn(:post, "/settings/upload", body)
      |> put_req_header("content-type", "multipart/form-data; boundary=#{boundary}")
      |> SafeParsers.call(options)

    assert conn.halted
    assert conn.status == 413

    assert Jason.decode!(conn.resp_body) == %{
             "error" => "Upload exceeds the 12 MB application limit",
             "code" => "UPLOAD_TOO_LARGE"
           }
  end
end
