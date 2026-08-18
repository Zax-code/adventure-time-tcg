defmodule AdventureTimeApi.AccessRequestAssessment.RangeDataRefreshTest do
  use ExUnit.Case, async: true

  alias AdventureTimeApi.AccessRequestAssessment.RangeDataRefresh

  @retrieved_at ~U[2026-08-16 12:00:00Z]

  test "builds independently sourced Google range data" do
    goog =
      Jason.encode!(%{
        "creationTime" => "2026-08-16T07:05:49.345831",
        "syncToken" => "123",
        "prefixes" => [%{"ipv4Prefix" => "8.8.8.0/24"}]
      })

    cloud =
      Jason.encode!(%{
        "creationTime" => "2026-08-16T07:05:49.345831",
        "syncToken" => "123",
        "prefixes" => [%{"ipv4Prefix" => "8.8.8.0/25"}]
      })

    assert %{
             "version" => "google-ip-ranges-123",
             "retrievedAt" => "2026-08-16T12:00:00Z",
             "prefixes" => ["8.8.8.0/24"],
             "sources" => [%{"url" => goog_url}, %{"url" => cloud_url}]
           } = RangeDataRefresh.google_document(goog, cloud, @retrieved_at)

    assert goog_url =~ "goog.json"
    assert cloud_url =~ "cloud.json"
  end

  test "rejects overlapping Test Lab ranges" do
    assert_raise ArgumentError, ~r/overlapping networks/, fn ->
      RangeDataRefresh.test_lab_document(
        ["70.32.128.0/19", "70.32.128.48/28"],
        @retrieved_at
      )
    end
  end
end
