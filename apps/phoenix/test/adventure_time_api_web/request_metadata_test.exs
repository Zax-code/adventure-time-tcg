defmodule AdventureTimeApiWeb.RequestMetadataTest do
  use AdventureTimeApiWeb.ConnCase, async: true

  alias AdventureTimeApiWeb.RequestMetadata

  test "normalizes weak web request-shape and same-site origin facts" do
    conn =
      build_conn()
      |> put_req_header("origin", "https://www.example.com")
      |> put_req_header("user-agent", "Mozilla/5.0")
      |> put_req_header("x-adventure-time-platform", "web")

    metadata = RequestMetadata.from_conn(conn)

    assert metadata.origin_host_consistent == true
    assert metadata.browser_request_shape == true
    assert metadata.installation_id_well_formed == false
  end

  test "validates native installation identifiers without retaining new raw facts" do
    installation_id = Ecto.UUID.generate()

    conn =
      build_conn()
      |> put_req_header("user-agent", "AdventureTimeNative/1.0.22")
      |> put_req_header("x-adventure-time-platform", "android")
      |> put_req_header("x-adventure-time-installation-id", installation_id)

    metadata = RequestMetadata.from_conn(conn)

    assert metadata.installation_id == installation_id
    assert metadata.installation_id_well_formed == true
    assert metadata.browser_request_shape == false
    assert metadata.origin_host_consistent == nil
  end
end
