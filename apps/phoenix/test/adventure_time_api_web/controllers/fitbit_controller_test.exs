defmodule AdventureTimeApiWeb.FitbitControllerTest do
  use AdventureTimeApiWeb.ConnCase, async: false

  alias AdventureTimeApi.Fitbit

  setup do
    original_config = Application.get_env(:adventure_time_api, Fitbit)

    on_exit(fn ->
      if original_config do
        Application.put_env(:adventure_time_api, Fitbit, original_config)
      else
        Application.delete_env(:adventure_time_api, Fitbit)
      end
    end)

    :ok
  end

  test "the default OAuth callback URI uses the canonical public endpoint" do
    Application.put_env(:adventure_time_api, Fitbit, redirect_uri: nil)

    assert String.ends_with?(Fitbit.callback_uri(), "/api/fitbit/callback")
  end

  test "canonical callback and compatibility alias reach the same controller" do
    for path <- ["/api/fitbit/callback", "/fitbit/callback"] do
      conn = get(build_conn(), path)

      assert redirected_to(conn) ==
               "adventure-time://settings?fitbit=error&reason=missing_params"
    end
  end

  test "canonical webhook and compatibility alias support provider verification" do
    Application.put_env(:adventure_time_api, Fitbit, verification_code: "expected-code")

    for path <- ["/api/fitbit/webhook", "/fitbit/webhook"] do
      assert build_conn()
             |> get(path <> "?verify=expected-code")
             |> response(204) == ""

      assert build_conn()
             |> get(path <> "?verify=incorrect-code")
             |> response(404) == "Invalid verification code"
    end
  end

  test "canonical webhook and compatibility alias accept signed notifications" do
    body = "[]"
    client_secret = "test-client-secret"

    signature =
      :crypto.mac(:hmac, :sha, client_secret <> "&", body)
      |> Base.encode64()

    Application.put_env(:adventure_time_api, Fitbit, client_secret: client_secret)

    for path <- ["/api/fitbit/webhook", "/fitbit/webhook"] do
      assert build_conn()
             |> put_req_header("content-type", "application/json")
             |> put_req_header("x-fitbit-signature", signature)
             |> post(path, body)
             |> response(204) == ""
    end
  end
end
