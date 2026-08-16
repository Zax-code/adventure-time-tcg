defmodule AdventureTimeApi.AccessAssessment.SignalsTest do
  use ExUnit.Case, async: true

  alias AdventureTimeApi.AccessAssessment.Signals

  test "VPN-only IP evidence is described but never scored below 40" do
    evidence = ip_evidence(%{fraud_score: 90, vpn: true})

    assert %{
             value: 40,
             hard_failure: false,
             reason_codes: reasons
           } = Signals.ip_intelligence(evidence)

    assert "ip.vpn" in reasons
    refute "ip.confirmed_high_risk_attacks" in reasons
  end

  test "confirmed high-risk IP attacks fail only their component" do
    evidence = ip_evidence(%{fraud_score: 5, high_risk_attacks: true})

    assert %{
             value: 0,
             hard_failure: true,
             reason_codes: ["ip.confirmed_high_risk_attacks"]
           } = Signals.ip_intelligence(evidence)
  end

  test "a recognized, licensed strong-integrity Android build reaches 100" do
    evidence = %{
      app_recognition: :play_recognized,
      licensing: :licensed,
      device_verdicts: ["MEETS_STRONG_INTEGRITY"],
      package_name_verified: true,
      certificate_verified: true,
      version_verified: true,
      request_hash_verified: true,
      verified_at: ~U[2026-08-16 12:00:00Z]
    }

    assert %{value: 100, hard_failure: false} = Signals.play_integrity(evidence)
  end

  test "an unrecognized Android version fails only Play Integrity" do
    evidence = %{
      app_recognition: :unrecognized_version,
      licensing: :unevaluated,
      device_verdicts: [],
      package_name_verified: true,
      certificate_verified: true,
      version_verified: false,
      request_hash_verified: true,
      verified_at: ~U[2026-08-16 12:00:00Z]
    }

    assert %{
             value: 0,
             hard_failure: true,
             reason_codes: reasons
           } = Signals.play_integrity(evidence)

    assert "integrity.unrecognized_version" in reasons
  end

  defp ip_evidence(overrides) do
    Map.merge(
      %{
        fraud_score: 50,
        proxy: false,
        vpn: false,
        active_tor: false,
        bot_status: false,
        recent_abuse: false,
        frequent_abuser: false,
        high_risk_attacks: false,
        public_access_point: false,
        hosting: false,
        shared_connection: false,
        looked_up_at: ~U[2026-08-16 12:00:00Z]
      },
      overrides
    )
  end
end
