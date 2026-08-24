defmodule AdventureTimeApi.MediaTest do
  use AdventureTimeApi.DataCase, async: false
  use Oban.Testing, repo: AdventureTimeApi.Repo

  alias AdventureTimeApi.Accounts
  alias AdventureTimeApi.Accounts.User

  alias AdventureTimeApi.Catalog.{
    Card,
    CardBackVisual,
    ImageAsset,
    Pack,
    Rarity
  }

  alias AdventureTimeApi.Media
  alias AdventureTimeApi.Repo
  alias AdventureTimeApi.Workers.MediaCleanupWorker

  setup do
    original_config = Application.get_env(:adventure_time_api, Media)

    on_exit(fn ->
      Application.put_env(:adventure_time_api, Media, original_config)
    end)

    :ok
  end

  @tag :tmp_dir
  test "card replacement stores WebP metadata and cleans the old object after commit", %{
    tmp_dir: tmp_dir
  } do
    old_asset = asset(:card, "card/legacy.png")
    card = card(old_asset.id)
    {bypass, requests} = storage_bypass()
    upload = image_upload(tmp_dir, ".jpg", "image/jpeg", 2_000, 1_000)

    assert {:ok, new_asset_id} = Media.store_card_image(card.id, upload)

    updated_card = Repo.get!(Card, card.id)
    new_asset = Repo.get!(ImageAsset, new_asset_id)
    assert updated_card.image_asset_id == new_asset.id
    assert new_asset.mime_type == "image/webp"
    assert new_asset.width == 1_600
    assert new_asset.height == 800
    assert new_asset.byte_size > 0
    assert new_asset.content_hash =~ ~r/^[0-9a-f]{64}$/
    assert String.ends_with?(new_asset.object_key, ".webp")
    assert Repo.get(ImageAsset, old_asset.id)
    assert_enqueued(worker: MediaCleanupWorker, args: %{"asset_id" => old_asset.id})

    assert :ok = perform_cleanup(old_asset.id)
    assert Repo.get(ImageAsset, old_asset.id) == nil

    recorded = Agent.get(requests, &Enum.reverse/1)
    assert [%{method: "PUT", body: uploaded_body}, %{method: "DELETE"}] = recorded
    assert <<"RIFF", _size::little-size(32), "WEBP", _rest::binary>> = uploaded_body
    assert bypass.port > 0
  end

  @tag :tmp_dir
  test "profile replacement commits the new avatar and enqueues old cleanup", %{tmp_dir: tmp_dir} do
    old_asset = asset(:profile, "profile/legacy.png")
    user = user(old_asset.id)
    {_bypass, _requests} = storage_bypass()
    upload = image_upload(tmp_dir, ".png", "image/png", 200, 120)

    assert {:ok, new_asset_id} = Media.store_profile_image(user.id, upload)

    updated_user = Repo.get!(User, user.id)
    new_asset = Repo.get!(ImageAsset, new_asset_id)
    assert updated_user.avatar_asset_id == new_asset.id
    assert new_asset.mime_type == "image/webp"
    assert {new_asset.width, new_asset.height} == {512, 512}
    assert_enqueued(worker: MediaCleanupWorker, args: %{"asset_id" => old_asset.id})
  end

  @tag :tmp_dir
  test "a database failure after upload immediately deletes the new object", %{tmp_dir: tmp_dir} do
    {_bypass, requests} = storage_bypass()
    upload = image_upload(tmp_dir, ".webp", "image/webp", 80, 80)

    assert {:error, :not_found} = Media.store_card_image(Ecto.UUID.generate(), upload)
    assert Repo.aggregate(ImageAsset, :count, :id) == 0

    assert [%{method: "PUT"}, %{method: "DELETE"}] =
             requests |> Agent.get(&Enum.reverse/1) |> Enum.map(&Map.take(&1, [:method]))
  end

  @tag :tmp_dir
  test "an immediate object cleanup failure is logged without replacing the database error", %{
    tmp_dir: tmp_dir
  } do
    {_bypass, _requests} = storage_bypass(delete_statuses: [500])
    upload = image_upload(tmp_dir, ".png", "image/png", 80, 80)

    log =
      ExUnit.CaptureLog.capture_log(fn ->
        assert {:error, :not_found} = Media.store_card_image(Ecto.UUID.generate(), upload)
      end)

    assert log =~ "media cleanup failed for uncommitted card upload"
    assert log =~ "delete_failed:500"
    refute log =~ "secret"
    refute log =~ "minio"
  end

  test "cleanup failure keeps the asset for an idempotent retry" do
    asset = asset(:card, "card/retry.webp")
    {_bypass, requests} = storage_bypass(delete_statuses: [500, 204])

    assert {:error, "media cleanup failed"} = perform_cleanup(asset.id)
    assert Repo.get(ImageAsset, asset.id)

    assert :ok = perform_cleanup(asset.id)
    assert Repo.get(ImageAsset, asset.id) == nil
    assert Enum.count(Agent.get(requests, & &1), &(&1.method == "DELETE")) == 2

    assert :ok = perform_cleanup(asset.id)
  end

  test "cleanup uniqueness does not let a completed protected job suppress a later retry" do
    changeset = MediaCleanupWorker.new(%{"asset_id" => Ecto.UUID.generate()})

    assert changeset.changes.unique.states == Oban.Job.unique_states(:incomplete)
    refute :completed in changeset.changes.unique.states
  end

  test "MinIO object deletion treats repeated deletes as successful" do
    {_bypass, requests} = storage_bypass()

    assert :ok = Media.delete_object("card/idempotent.webp")
    assert :ok = Media.delete_object("card/idempotent.webp")
    assert Enum.count(Agent.get(requests, & &1), &(&1.method == "DELETE")) == 2
  end

  test "cleanup never deletes an asset still referenced by catalog data" do
    referenced_asset = asset(:catalog, "catalog/shared.svg")
    {bypass, requests} = storage_bypass()
    Bypass.pass(bypass)

    Repo.insert!(
      Pack.changeset(%Pack{}, %{
        name: unique("Protected Pack"),
        description: "Uses the asset",
        card_count: 5,
        cost: 100,
        color: "#ffffff",
        pack_art_asset_id: referenced_asset.id
      })
    )

    assert {:protected, [:pack]} = Media.cleanup_image_asset(referenced_asset.id)
    assert Repo.get(ImageAsset, referenced_asset.id)
    assert Agent.get(requests, & &1) == []
  end

  test "an object key shared by another asset row is retained" do
    asset = asset(:card, "shared/object.webp")
    other_asset = asset(:catalog, "shared/object.webp")
    {bypass, requests} = storage_bypass()
    Bypass.pass(bypass)

    assert :ok = Media.cleanup_image_asset(asset.id)
    assert Repo.get(ImageAsset, asset.id) == nil
    assert Repo.get(ImageAsset, other_asset.id)
    assert Agent.get(requests, & &1) == []
  end

  test "account deletion commits first and then cleans the avatar through Oban" do
    avatar = asset(:profile, "profile/delete-me.webp")
    user = user(avatar.id)
    {_bypass, requests} = storage_bypass()

    assert {:ok, %{deletedUserId: user_id}} = Accounts.delete_own_account(user.id)
    assert user_id == user.id
    assert Repo.get(User, user.id) == nil
    assert Repo.get(ImageAsset, avatar.id)
    assert_enqueued(worker: MediaCleanupWorker, args: %{"asset_id" => avatar.id})

    assert :ok = perform_cleanup(avatar.id)
    assert Repo.get(ImageAsset, avatar.id) == nil
    assert Enum.any?(Agent.get(requests, & &1), &(&1.method == "DELETE"))
  end

  test "the orphan audit is read-only and excludes every supported reference type" do
    orphan_card = asset(:card, "orphan/card.png")
    orphan_profile = asset(:profile, "orphan/profile.jpg")
    orphan_catalog = asset(:catalog, "orphan/catalog.svg")

    card_asset = asset(:card, "used/card.png")
    profile_asset = asset(:profile, "used/profile.png")
    pack_asset = asset(:catalog, "used/pack.png")
    back_asset = asset(:catalog, "used/back.svg")
    card(card_asset.id)
    user(profile_asset.id)

    Repo.insert!(
      Pack.changeset(%Pack{}, %{
        name: unique("Audit Pack"),
        description: "Audit",
        card_count: 5,
        cost: 100,
        color: "#ffffff",
        pack_art_asset_id: pack_asset.id
      })
    )

    Repo.insert!(
      CardBackVisual.changeset(%CardBackVisual{}, %{
        theme_name: "candy",
        rarity_name: "Common",
        image_asset_id: back_asset.id
      })
    )

    audit = Media.audit_orphaned_assets()
    candidate_ids = MapSet.new(audit.candidates, & &1.id)

    assert candidate_ids == MapSet.new([orphan_card.id, orphan_profile.id, orphan_catalog.id])
    assert audit.counts_by_kind == %{card: 1, profile: 1, catalog: 1}
    assert audit.total == 3
    assert Repo.aggregate(ImageAsset, :count, :id) == 7

    output = ExUnit.CaptureIO.capture_io(fn -> Mix.Tasks.Media.AuditOrphans.run([]) end)
    assert output =~ "Image asset orphan audit (read-only dry run)"
    assert output =~ "Total candidates: 3"
    assert output =~ "id=#{orphan_card.id}"
    assert Repo.aggregate(ImageAsset, :count, :id) == 7
  end

  defp storage_bypass(options \\ []) do
    bypass = Bypass.open()
    {:ok, requests} = Agent.start_link(fn -> [] end)

    delete_statuses =
      Agent.start_link(fn -> Keyword.get(options, :delete_statuses, []) end) |> elem(1)

    Application.put_env(:adventure_time_api, Media,
      base_url: "http://127.0.0.1:#{bypass.port}",
      bucket: "private-images",
      access_key: "minio",
      secret_key: "secret"
    )

    Bypass.expect(bypass, fn conn ->
      {:ok, body, conn} = Plug.Conn.read_body(conn)
      Agent.update(requests, &[request(conn, body) | &1])

      status =
        if conn.method == "DELETE" do
          Agent.get_and_update(delete_statuses, fn
            [next | rest] -> {next, rest}
            [] -> {204, []}
          end)
        else
          200
        end

      Plug.Conn.resp(conn, status, "")
    end)

    {bypass, requests}
  end

  defp request(conn, body), do: %{method: conn.method, path: conn.request_path, body: body}

  defp perform_cleanup(asset_id) do
    MediaCleanupWorker.perform(%Oban.Job{args: %{"asset_id" => asset_id}})
  end

  defp image_upload(tmp_dir, extension, mime_type, width, height) do
    path = Path.join(tmp_dir, "upload-#{System.unique_integer([:positive])}#{extension}")

    width
    |> Image.new!(height, color: "#7c3aed")
    |> Image.write!(path)

    %Plug.Upload{path: path, filename: Path.basename(path), content_type: mime_type}
  end

  defp asset(kind, object_key) do
    Repo.insert!(
      ImageAsset.changeset(%ImageAsset{}, %{
        kind: kind,
        mime_type: mime_for(object_key),
        object_key: object_key
      })
    )
  end

  defp user(avatar_asset_id) do
    Repo.insert!(
      User.registration_changeset(%User{}, %{
        email: "#{unique("media-user")}@example.com",
        display_name: "Media User"
      })
      |> Ecto.Changeset.change(avatar_asset_id: avatar_asset_id, access_status: :approved)
    )
  end

  defp card(image_asset_id) do
    rarity =
      Repo.insert!(
        Rarity.changeset(%Rarity{}, %{
          name: unique("Media Rare"),
          drop_rate: 5.0,
          color: "#123456"
        })
      )

    Repo.insert!(
      Card.changeset(%Card{}, %{
        name: unique("Media Card"),
        character: "BMO",
        description: "Media lifecycle test",
        hp: 20,
        attack: 5,
        defense: 5,
        speed: 40,
        type: "Hero",
        rarity_id: rarity.id,
        image_asset_id: image_asset_id
      })
    )
  end

  defp mime_for(path) do
    case Path.extname(path) do
      ".jpg" -> "image/jpeg"
      ".svg" -> "image/svg+xml"
      ".webp" -> "image/webp"
      _extension -> "image/png"
    end
  end

  defp unique(prefix), do: "#{prefix}-#{System.unique_integer([:positive])}"
end
