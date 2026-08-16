defmodule AdventureTimeApi.AccessRequestAssessment.NetworkClassificationTest do
  use ExUnit.Case, async: true

  alias AdventureTimeApi.AccessRequestAssessment.NetworkClassification

  test "classifies a current Firebase Test Lab address separately from Google ownership" do
    assert %{
             test_lab: :matched,
             google_network: :matched,
             test_lab_matched_cidr: "70.32.128.0/19",
             test_lab_range_version: "firebase-test-lab-2026-08-13"
           } = NetworkClassification.classify({70, 32, 140, 10})
  end

  test "does not confuse a generic Google-owned address with Test Lab" do
    assert %{
             test_lab: :not_matched,
             google_network: :matched,
             test_lab_matched_cidr: nil
           } = NetworkClassification.classify({8, 8, 8, 8})
  end

  test "classifies non-Google addresses independently" do
    assert %{
             test_lab: :not_matched,
             google_network: :not_matched
           } = NetworkClassification.classify({203, 0, 113, 19})
  end

  test "supports Test Lab IPv6 ranges" do
    assert %{
             test_lab: :matched,
             google_network: :matched,
             test_lab_matched_cidr: "2001:4860:103a::/48"
           } = NetworkClassification.classify("2001:4860:103a::1234")
  end

  test "returns unknown classifications without a trustworthy address" do
    assert %{
             test_lab: :unknown,
             google_network: :unknown,
             test_lab_matched_cidr: nil
           } = NetworkClassification.classify(nil)
  end
end
