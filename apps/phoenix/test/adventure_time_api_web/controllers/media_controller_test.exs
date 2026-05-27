defmodule AdventureTimeApiWeb.MediaControllerTest do
  use AdventureTimeApiWeb.ConnCase, async: false

  alias AdventureTimeApi.Accounts.{EmailCredential, User}
  alias AdventureTimeApi.Catalog.ImageAsset
  alias AdventureTimeApi.Repo

  @minio_env_keys [
    "MINIO_BASE_URL",
    "MINIO_ENDPOINT",
    "MINIO_PORT",
    "MINIO_USE_SSL",
    "MINIO_BUCKET",
    "MINIO_ACCESS_KEY",
    "MINIO_SECRET_KEY"
  ]

  setup do
    original_config = Application.get_env(:adventure_time_api, AdventureTimeApi.Media)

    on_exit(fn ->
      Application.put_env(:adventure_time_api, AdventureTimeApi.Media, original_config)
    end)

    :ok
  end

  test "GET /media/card/:id serves placeholder svg publicly", %{conn: conn} do
    asset =
      Repo.insert!(
        ImageAsset.changeset(%ImageAsset{}, %{
          kind: :card,
          mime_type: "image/svg+xml",
          placeholder_svg: "<svg>card</svg>"
        })
      )

    conn = get(conn, ~p"/media/card/#{asset.id}")

    assert response(conn, 200) == "<svg>card</svg>"
    assert get_resp_header(conn, "cache-control") == ["public, max-age=31536000, immutable"]
    assert get_resp_header(conn, "content-type") == ["image/svg+xml"]
  end

  test "GET /media/profile/:id requires auth", %{conn: conn} do
    asset =
      Repo.insert!(
        ImageAsset.changeset(%ImageAsset{}, %{
          kind: :profile,
          mime_type: "image/svg+xml",
          placeholder_svg: "<svg>profile</svg>"
        })
      )

    conn = get(conn, ~p"/media/profile/#{asset.id}")
    assert json_response(conn, 401) == %{"error" => "Unauthorized"}
  end

  test "GET /media/profile/:id serves placeholder svg when authed", _context do
    user = create_user_with_password("profile@example.com", "password123")
    access_token = login_access_token(user.email, "password123")

    asset =
      Repo.insert!(
        ImageAsset.changeset(%ImageAsset{}, %{
          kind: :profile,
          mime_type: "image/svg+xml",
          placeholder_svg: "<svg>profile</svg>"
        })
      )

    conn = access_token |> auth_conn() |> get(~p"/media/profile/#{asset.id}")

    assert response(conn, 200) == "<svg>profile</svg>"
    assert get_resp_header(conn, "cache-control") == ["private, max-age=3600"]
    assert get_resp_header(conn, "content-type") == ["image/svg+xml"]
  end

  test "GET /media/card/:id returns 404 for missing asset", %{conn: conn} do
    conn = get(conn, ~p"/media/card/#{Ecto.UUID.generate()}")
    assert json_response(conn, 404) == %{"error" => "Image not found"}
  end

  test "GET /media/card/:id serves object storage bytes when configured", %{conn: conn} do
    bypass = Bypass.open()

    Application.put_env(:adventure_time_api, AdventureTimeApi.Media,
      base_url: "http://127.0.0.1:#{bypass.port}",
      bucket: "private-images",
      access_key: "minio",
      secret_key: "secret"
    )

    Bypass.expect_once(bypass, "GET", "/private-images/cards/finn.png", fn conn ->
      conn = Plug.Conn.put_resp_header(conn, "content-type", "image/png")
      Plug.Conn.resp(conn, 200, "PNGDATA")
    end)

    asset =
      Repo.insert!(
        ImageAsset.changeset(%ImageAsset{}, %{
          kind: :card,
          mime_type: "image/png",
          object_key: "cards/finn.png"
        })
      )

    conn = get(conn, ~p"/media/card/#{asset.id}")

    assert response(conn, 200) == "PNGDATA"
    assert get_resp_header(conn, "content-type") == ["image/png"]
  end

  test "GET /media/card/:id serves object storage bytes when configured through MinIO env parts",
       %{conn: conn} do
    bypass = Bypass.open()
    restore_minio_env_on_exit()

    Application.put_env(:adventure_time_api, AdventureTimeApi.Media,
      base_url: nil,
      bucket: nil,
      access_key: nil,
      secret_key: nil
    )

    System.delete_env("MINIO_BASE_URL")
    System.put_env("MINIO_ENDPOINT", "127.0.0.1")
    System.put_env("MINIO_PORT", Integer.to_string(bypass.port))
    System.put_env("MINIO_USE_SSL", "false")
    System.put_env("MINIO_BUCKET", "private-images")
    System.put_env("MINIO_ACCESS_KEY", "minio")
    System.put_env("MINIO_SECRET_KEY", "secret")

    Bypass.expect_once(bypass, "GET", "/private-images/cards/jake.png", fn conn ->
      conn = Plug.Conn.put_resp_header(conn, "content-type", "image/png")
      Plug.Conn.resp(conn, 200, "ENVPNG")
    end)

    asset =
      Repo.insert!(
        ImageAsset.changeset(%ImageAsset{}, %{
          kind: :card,
          mime_type: "image/png",
          object_key: "cards/jake.png"
        })
      )

    conn = get(conn, ~p"/media/card/#{asset.id}")

    assert response(conn, 200) == "ENVPNG"
    assert get_resp_header(conn, "content-type") == ["image/png"]
  end

  test "GET /media/card/:id serves svg placeholder content type when object storage is unavailable",
       %{conn: conn} do
    restore_minio_env_on_exit()

    Application.put_env(:adventure_time_api, AdventureTimeApi.Media,
      base_url: nil,
      bucket: nil,
      access_key: nil,
      secret_key: nil
    )

    Enum.each(@minio_env_keys, &System.delete_env/1)

    asset =
      Repo.insert!(
        ImageAsset.changeset(%ImageAsset{}, %{
          kind: :card,
          mime_type: "image/png",
          object_key: "cards/missing.png"
        })
      )

    conn = get(conn, ~p"/media/card/#{asset.id}")

    assert response(conn, 200) =~ "<svg"
    assert get_resp_header(conn, "content-type") == ["image/svg+xml"]
  end

  test "GET /media/catalog/:id serves placeholder svg publicly", %{conn: conn} do
    asset =
      Repo.insert!(
        ImageAsset.changeset(%ImageAsset{}, %{
          kind: :catalog,
          mime_type: "image/svg+xml",
          placeholder_svg: "<svg>catalog</svg>"
        })
      )

    conn = get(conn, ~p"/media/catalog/#{asset.id}")

    assert response(conn, 200) == "<svg>catalog</svg>"
    assert get_resp_header(conn, "cache-control") == ["public, max-age=31536000, immutable"]
    assert get_resp_header(conn, "content-type") == ["image/svg+xml"]
  end

  test "GET /media/catalog/:id serves object storage bytes when configured", %{conn: conn} do
    bypass = Bypass.open()

    Application.put_env(:adventure_time_api, AdventureTimeApi.Media,
      base_url: "http://127.0.0.1:#{bypass.port}",
      bucket: "private-images",
      access_key: "minio",
      secret_key: "secret"
    )

    Bypass.expect_once(bypass, "GET", "/private-images/catalog/library.png", fn conn ->
      conn = Plug.Conn.put_resp_header(conn, "content-type", "image/png")
      Plug.Conn.resp(conn, 200, "CATALOGPNG")
    end)

    asset =
      Repo.insert!(
        ImageAsset.changeset(%ImageAsset{}, %{
          kind: :catalog,
          mime_type: "image/png",
          object_key: "catalog/library.png"
        })
      )

    conn = get(conn, ~p"/media/catalog/#{asset.id}")

    assert response(conn, 200) == "CATALOGPNG"
    assert get_resp_header(conn, "content-type") == ["image/png"]
  end

  defp create_user_with_password(email, password) do
    user =
      Repo.insert!(
        User.registration_changeset(%User{}, %{email: email, display_name: "Tester"})
        |> User.access_changeset(%{role: :user, access_status: :approved})
      )

    Repo.insert!(
      EmailCredential.changeset(%EmailCredential{}, %{
        password_hash: Bcrypt.hash_pwd_salt(password),
        email_verified_at: DateTime.utc_now() |> DateTime.truncate(:second)
      })
      |> Ecto.Changeset.put_change(:user_id, user.id)
    )

    user
  end

  defp login_access_token(email, password) do
    build_conn()
    |> post(~p"/auth/login", %{email: email, password: password})
    |> json_response(200)
    |> get_in(["tokens", "accessToken"])
  end

  defp auth_conn(access_token) do
    build_conn()
    |> put_req_header("authorization", "Bearer #{access_token}")
  end

  defp restore_minio_env_on_exit do
    original_env =
      Map.new(@minio_env_keys, fn key ->
        {key, System.get_env(key)}
      end)

    on_exit(fn ->
      Enum.each(original_env, fn
        {key, nil} -> System.delete_env(key)
        {key, value} -> System.put_env(key, value)
      end)
    end)
  end
end
