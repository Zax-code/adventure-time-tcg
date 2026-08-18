defmodule AdventureTimeApi.AccessAssessment.ScoreTest do
  use ExUnit.Case, async: true

  alias AdventureTimeApi.AccessAssessment.Score

  test "a complete neutral Android assessment scores 50 with full coverage" do
    components = %{
      play_integrity: available(50),
      identity: available(50),
      continuity: available(50),
      client: available(50),
      ip_intelligence: available(50)
    }

    assert %{
             state: :complete,
             trustworthiness_confidence: 50,
             evidence_coverage: 100,
             band: :mixed,
             missing_reasons: []
           } = Score.calculate(:android, components)
  end

  test "partial evidence is normalized while coverage retains missing weight" do
    components = %{
      identity: available(90),
      continuity: available(50),
      client: available(50),
      play_integrity: {:missing, "integrity.not_submitted"},
      ip_intelligence: {:missing, "ip.provider_timeout"}
    }

    assert %{
             state: :partial,
             trustworthiness_confidence: 68,
             evidence_coverage: 45,
             band: :mixed,
             missing_reasons: ["integrity.not_submitted", "ip.provider_timeout"]
           } = Score.calculate(:android, components)
  end

  test "coverage below 40 percent suppresses the trust score" do
    components = %{
      identity: available(90),
      continuity: available(50),
      client: {:missing, "client.unavailable"},
      play_integrity: {:missing, "integrity.not_submitted"},
      ip_intelligence: {:missing, "ip.provider_timeout"}
    }

    assert %{
             state: :unavailable,
             trustworthiness_confidence: nil,
             evidence_coverage: 35,
             band: nil
           } = Score.calculate(:android, components)
  end

  test "a component-local hard failure does not cap or override the total score" do
    components = %{
      play_integrity: available(0, hard_failure: true),
      identity: available(100),
      continuity: available(100),
      client: available(100),
      ip_intelligence: available(100)
    }

    assert %{
             state: :complete,
             trustworthiness_confidence: 70,
             band: :stronger,
             hard_failure_reasons: ["test.reason"]
           } = Score.calculate(:android, components)
  end

  test "Test Lab classification replaces scoring" do
    assert %{
             state: :test_lab,
             trustworthiness_confidence: nil,
             evidence_coverage: nil,
             band: nil
           } = Score.calculate(:android, %{}, test_lab: :matched)
  end

  defp available(value, opts \\ []) do
    %{
      value: value,
      reason_codes: ["test.reason"],
      explanations: ["Test explanation"],
      observed_at: ~U[2026-08-16 12:00:00Z],
      hard_failure: Keyword.get(opts, :hard_failure, false)
    }
  end
end
