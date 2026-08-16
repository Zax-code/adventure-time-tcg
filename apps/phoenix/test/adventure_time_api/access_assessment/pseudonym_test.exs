defmodule AdventureTimeApi.AccessAssessment.PseudonymTest do
  use ExUnit.Case, async: true

  alias AdventureTimeApi.AccessAssessment.Pseudonym

  test "creates versioned provider-scoped HMAC pseudonyms" do
    opts = [secret: "dedicated-provider-secret", version: "v1"]

    identity = Pseudonym.generate(:identity, " Finn@Example.com ", opts)
    repeated = Pseudonym.generate(:identity, "finn@example.com", opts)
    installation = Pseudonym.generate(:installation, "finn@example.com", opts)

    assert identity == repeated
    assert identity =~ ~r/^v1:[0-9a-f]{64}$/
    refute identity == installation
    refute identity =~ "finn@example.com"
  end
end
