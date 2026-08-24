defmodule AdventureTimeApiWeb.MediaControllerTest do
  use AdventureTimeApiWeb.ConnCase, async: false

  alias AdventureTimeApi.Accounts.{EmailCredential, User}
  alias AdventureTimeApi.Catalog.ImageAsset
  alias AdventureTimeApi.Media
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

  test "object storage readiness succeeds when the configured bucket accepts credentials" do
    bypass = Bypass.open()
    configure_minio_bypass(bypass)

    Bypass.expect_once(bypass, "HEAD", "/private-images", fn conn ->
      Plug.Conn.resp(conn, 200, "")
    end)

    assert Media.ready?() == :ok
  end

  test "object storage readiness reports rejected credentials" do
    bypass = Bypass.open()
    configure_minio_bypass(bypass)

    Bypass.expect_once(bypass, "HEAD", "/private-images", fn conn ->
      Plug.Conn.resp(conn, 403, "")
    end)

    assert Media.ready?() == {:error, {:object_storage_unready, 403}}
  end

  test "object storage readiness rejects a partial configuration" do
    restore_minio_env_on_exit()
    Enum.each(@minio_env_keys, &System.delete_env/1)

    Application.put_env(:adventure_time_api, AdventureTimeApi.Media,
      base_url: "http://127.0.0.1:9100",
      bucket: nil,
      access_key: "minio",
      secret_key: "secret"
    )

    assert Media.ready?() == {:error, :object_storage_not_configured}
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

  @tag :tmp_dir
  test "POST /settings/upload stores a normalized profile WebP", %{tmp_dir: tmp_dir} do
    user = create_user_with_password("profile-upload@example.com", "password123")
    access_token = login_access_token(user.email, "password123")
    bypass = Bypass.open()
    configure_minio_bypass(bypass)

    Bypass.expect_once(bypass, fn conn ->
      assert conn.method == "PUT"
      assert String.starts_with?(conn.request_path, "/private-images/profile/#{user.id}/")
      assert String.ends_with?(conn.request_path, ".webp")
      {:ok, body, conn} = Plug.Conn.read_body(conn)
      assert <<"RIFF", _size::little-size(32), "WEBP", _rest::binary>> = body
      Plug.Conn.resp(conn, 200, "")
    end)

    upload = image_upload(tmp_dir, ".png", "image/png")

    conn =
      access_token
      |> auth_conn()
      |> post(~p"/settings/upload", %{"file" => upload})

    assert %{"assetId" => asset_id} = json_response(conn, 200)
    asset = Repo.get!(ImageAsset, asset_id)
    assert asset.mime_type == "image/webp"
    assert {asset.width, asset.height} == {512, 512}
    assert asset.byte_size > 0
    assert asset.content_hash =~ ~r/^[0-9a-f]{64}$/
  end

  @tag :tmp_dir
  test "profile upload errors are structured for unsupported, mismatched, malformed, and oversized files",
       %{tmp_dir: tmp_dir} do
    user = create_user_with_password("profile-errors@example.com", "password123")
    access_token = login_access_token(user.email, "password123")

    svg_path = Path.join(tmp_dir, "unsupported.svg")
    File.write!(svg_path, ~s(<svg xmlns="http://www.w3.org/2000/svg"></svg>))

    assert_upload_error(
      access_token,
      upload(svg_path, "image/svg+xml"),
      400,
      "UNSUPPORTED_IMAGE_TYPE"
    )

    assert_upload_error(
      access_token,
      image_upload(tmp_dir, ".png", "image/jpeg"),
      400,
      "IMAGE_TYPE_MISMATCH"
    )

    malformed_path = Path.join(tmp_dir, "malformed.jpg")
    File.write!(malformed_path, <<0xFF, 0xD8, 0xFF, 1, 2, 3>>)

    assert_upload_error(
      access_token,
      upload(malformed_path, "image/jpeg"),
      400,
      "MALFORMED_IMAGE"
    )

    oversized_path = Path.join(tmp_dir, "oversized.jpg")
    {:ok, file} = File.open(oversized_path, [:write, :binary])
    {:ok, _position} = :file.position(file, Media.ImageProcessor.max_upload_bytes())
    :ok = IO.binwrite(file, <<0>>)
    File.close(file)

    assert_upload_error(
      access_token,
      upload(oversized_path, "image/jpeg"),
      413,
      "UPLOAD_TOO_LARGE"
    )
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

  defp assert_upload_error(access_token, upload, status, code) do
    conn =
      access_token
      |> auth_conn()
      |> post(~p"/settings/upload", %{"file" => upload})

    assert %{"code" => ^code, "error" => error} = json_response(conn, status)
    assert is_binary(error)
  end

  defp image_upload(tmp_dir, extension, mime_type) do
    path = Path.join(tmp_dir, "profile-#{System.unique_integer([:positive])}#{extension}")

    120
    |> Image.new!(80, color: "#14b8a6")
    |> Image.write!(path)

    upload(path, mime_type)
  end

  defp upload(path, mime_type) do
    %Plug.Upload{path: path, filename: Path.basename(path), content_type: mime_type}
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

  defp configure_minio_bypass(bypass) do
    restore_minio_env_on_exit()
    Enum.each(@minio_env_keys, &System.delete_env/1)

    Application.put_env(:adventure_time_api, AdventureTimeApi.Media,
      base_url: "http://127.0.0.1:#{bypass.port}",
      bucket: "private-images",
      access_key: "minio",
      secret_key: "secret"
    )
  end
end
