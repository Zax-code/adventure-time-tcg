defmodule AdventureTimeApiWeb.HealthControllerTest do
  use AdventureTimeApiWeb.ConnCase, async: false

  @minio_env_keys [
    "MINIO_BASE_URL",
    "MINIO_ENDPOINT",
    "MINIO_PORT",
    "MINIO_USE_SSL",
    "MINIO_BUCKET",
    "MINIO_ACCESS_KEY",
    "MINIO_SECRET_KEY"
  ]

  test "GET /health", %{conn: conn} do
    conn = get(conn, ~p"/health")

    assert json_response(conn, 200) == %{
             "service" => "phoenix",
             "status" => "ok"
           }
  end

  test "GET /ready", %{conn: conn} do
    conn = get(conn, ~p"/ready")

    assert json_response(conn, 200) == %{
             "service" => "phoenix",
             "status" => "ready"
           }
  end

  test "GET /ready/media", %{conn: conn} do
    conn = get(conn, ~p"/ready/media")

    assert json_response(conn, 200) == %{
             "service" => "media",
             "status" => "ready"
           }
  end

  test "GET /ready/media rejects an object store that refuses configured credentials", %{
    conn: conn
  } do
    bypass = Bypass.open()
    restore_media_config_on_exit()

    Application.put_env(:adventure_time_api, AdventureTimeApi.Media,
      base_url: "http://127.0.0.1:#{bypass.port}",
      bucket: "private-images",
      access_key: "minio",
      secret_key: "wrong-secret"
    )

    Bypass.expect_once(bypass, "HEAD", "/private-images", fn conn ->
      Plug.Conn.resp(conn, 403, "")
    end)

    conn = get(conn, ~p"/ready/media")

    assert json_response(conn, 503) == %{
             "service" => "media",
             "status" => "not_ready"
           }
  end

  test "GET /status keeps the human-facing fallback for non-document requests", %{conn: conn} do
    conn =
      conn
      |> put_req_header("accept", "text/html")
      |> put_req_header("sec-fetch-dest", "empty")
      |> get(~p"/status")

    body = html_response(conn, 200)
    assert get_resp_header(conn, "content-type") == ["text/html; charset=utf-8"]
    assert body =~ "What this status covers"
    assert body =~ "Checking Adventure Time TCG"
    assert body =~ "data-status-page"
    assert body =~ "Contact support"
  end

  defp restore_media_config_on_exit do
    original_config = Application.get_env(:adventure_time_api, AdventureTimeApi.Media)
    original_env = Map.new(@minio_env_keys, &{&1, System.get_env(&1)})

    Enum.each(@minio_env_keys, &System.delete_env/1)

    on_exit(fn ->
      Application.put_env(:adventure_time_api, AdventureTimeApi.Media, original_config)

      Enum.each(original_env, fn
        {key, nil} -> System.delete_env(key)
        {key, value} -> System.put_env(key, value)
      end)
    end)
  end
end
