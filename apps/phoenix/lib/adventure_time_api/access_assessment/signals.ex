defmodule AdventureTimeApi.AccessAssessment.Signals do
  @moduledoc """
  Versioned, deterministic component rules for `access-request-v1`.
  """

  @ip_classifications [
    {:vpn, "ip.vpn"},
    {:proxy, "ip.proxy"},
    {:hosting, "ip.hosting"},
    {:shared_connection, "ip.shared_connection"},
    {:public_access_point, "ip.public_access_point"}
  ]

  def ip_intelligence(%{high_risk_attacks: true} = evidence) do
    component(
      0,
      ["ip.confirmed_high_risk_attacks"],
      evidence[:looked_up_at],
      true
    )
  end

  def ip_intelligence(%{fraud_score: fraud_score} = evidence) do
    base_value = round(100 - fraud_score)
    {value, severe_reasons} = apply_ip_caps(base_value, evidence)
    classification_reasons = classification_reasons(evidence)

    value =
      if severe_reasons == [] and classification_reasons != [] do
        max(value, 40)
      else
        value
      end

    component(
      clamp(value),
      severe_reasons ++ classification_reasons,
      evidence[:looked_up_at],
      false
    )
  end

  def play_integrity(evidence) do
    hard_failures = integrity_hard_failures(evidence)

    cond do
      hard_failures != [] ->
        component(0, hard_failures, evidence[:verified_at], true)

      unevaluated_integrity?(evidence) ->
        {:missing, "integrity.unevaluated"}

      true ->
        {value, reasons} = evaluated_integrity(evidence)
        component(clamp(value), reasons, evidence[:verified_at], false)
    end
  end

  defp apply_ip_caps(base_value, evidence) do
    {base_value, []}
    |> cap(evidence[:frequent_abuser], 15, "ip.frequent_abuser")
    |> cap(evidence[:bot_status], 25, "ip.bot_status")
    |> cap(evidence[:recent_abuse], 25, "ip.recent_abuse")
    |> cap(evidence[:active_tor], 35, "ip.active_tor")
  end

  defp cap({value, reasons}, true, ceiling, reason),
    do: {min(value, ceiling), reasons ++ [reason]}

  defp cap(result, _false_or_missing, _ceiling, _reason), do: result

  defp classification_reasons(evidence) do
    @ip_classifications
    |> Enum.filter(fn {key, _reason} -> evidence[key] == true end)
    |> Enum.map(fn {_key, reason} -> reason end)
  end

  defp integrity_hard_failures(evidence) do
    []
    |> add_reason(evidence[:request_hash_verified] == false, "integrity.request_hash_mismatch")
    |> add_reason(evidence[:package_name_verified] == false, "integrity.package_mismatch")
    |> add_reason(evidence[:certificate_verified] == false, "integrity.certificate_mismatch")
    |> add_reason(evidence[:version_verified] == false, "integrity.version_mismatch")
    |> add_reason(
      evidence[:app_recognition] == :unrecognized_version,
      "integrity.unrecognized_version"
    )
  end

  defp add_reason(reasons, true, reason), do: reasons ++ [reason]
  defp add_reason(reasons, false, _reason), do: reasons

  defp unevaluated_integrity?(evidence) do
    evidence[:app_recognition] == :unevaluated and evidence[:licensing] == :unevaluated and
      Enum.empty?(evidence[:device_verdicts] || [])
  end

  defp evaluated_integrity(evidence) do
    {50, []}
    |> add(evidence[:app_recognition] == :play_recognized, 25, "integrity.play_recognized")
    |> add(
      evidence[:package_name_verified] and evidence[:certificate_verified] and
        evidence[:version_verified],
      10,
      "integrity.released_build_verified"
    )
    |> licensing(evidence[:licensing])
    |> device_integrity(evidence[:device_verdicts] || [])
  end

  defp add({value, reasons}, true, amount, reason), do: {value + amount, reasons ++ [reason]}
  defp add(result, _false, _amount, _reason), do: result

  defp licensing(result, :licensed), do: add(result, true, 10, "integrity.licensed")
  defp licensing(result, :unlicensed), do: add(result, true, -20, "integrity.unlicensed")
  defp licensing(result, _unevaluated), do: result

  defp device_integrity(result, verdicts) do
    cond do
      "MEETS_STRONG_INTEGRITY" in verdicts ->
        add(result, true, 15, "integrity.meets_strong_integrity")

      "MEETS_DEVICE_INTEGRITY" in verdicts ->
        add(result, true, 10, "integrity.meets_device_integrity")

      "MEETS_BASIC_INTEGRITY" in verdicts ->
        add(result, true, 0, "integrity.meets_basic_integrity")

      true ->
        add(result, true, -30, "integrity.no_device_integrity")
    end
  end

  defp component(value, reason_codes, observed_at, hard_failure) do
    %{
      value: value,
      reason_codes: reason_codes,
      explanations: Enum.map(reason_codes, &explanation/1),
      observed_at: observed_at,
      hard_failure: hard_failure
    }
  end

  defp explanation(reason_code), do: String.replace(reason_code, [".", "_"], " ")
  defp clamp(value), do: value |> max(0) |> min(100)
end
