defmodule AdventureTimeApi.Media do
  @moduledoc """
  Media boundary for serving stored or placeholder-backed image assets.
  """

  import Ecto.Query

  alias AdventureTimeApi.Accounts.User
  alias AdventureTimeApi.Catalog.Card
  alias AdventureTimeApi.Catalog.ImageAsset
  alias AdventureTimeApi.Repo

  @catalog_mime_types ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]

  def get_image_asset(id, kind) when kind in [:card, :profile, :catalog] do
    ImageAsset
    |> where([image_asset], image_asset.id == ^id and image_asset.kind == ^kind)
    |> Repo.one()
  end

  def list_catalog_assets do
    ImageAsset
    |> where([image_asset], image_asset.kind == :catalog)
    |> order_by([image_asset], desc: image_asset.inserted_at)
    |> Repo.all()
    |> Enum.map(&to_catalog_asset_response/1)
  end

  def fetch_image(asset) do
    case asset.object_key do
      object_key when is_binary(object_key) and object_key != "" ->
        fetch_object_image(asset, object_key)

      _ ->
        placeholder_response(asset)
    end
  end

  def store_profile_image(user_id, binary_data, mime_type) do
    object_key = "profile/#{user_id}/#{Ecto.UUID.generate()}"

    case put_object(object_key, binary_data, mime_type) do
      :ok ->
        Ecto.Multi.new()
        |> Ecto.Multi.insert(:asset, fn _changes ->
          ImageAsset.changeset(%ImageAsset{}, %{
            kind: :profile,
            mime_type: mime_type,
            object_key: object_key
          })
        end)
        |> Ecto.Multi.run(:user, fn repo, %{asset: asset} ->
          now = DateTime.utc_now() |> DateTime.truncate(:second)

          {1, _} =
            from(u in User, where: u.id == ^user_id)
            |> repo.update_all(set: [avatar_asset_id: asset.id, updated_at: now])

          {:ok, asset.id}
        end)
        |> Repo.transaction()
        |> case do
          {:ok, %{asset: asset}} -> {:ok, asset.id}
          {:error, _step, reason, _changes} -> {:error, reason}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  def store_card_image(card_id, binary_data, mime_type) do
    object_key = "card/#{card_id}/#{Ecto.UUID.generate()}"

    case put_object(object_key, binary_data, mime_type) do
      :ok ->
        Ecto.Multi.new()
        |> Ecto.Multi.insert(:asset, fn _changes ->
          ImageAsset.changeset(%ImageAsset{}, %{
            kind: :card,
            mime_type: mime_type,
            object_key: object_key
          })
        end)
        |> Ecto.Multi.run(:card, fn repo, %{asset: asset} ->
          now = DateTime.utc_now() |> DateTime.truncate(:second)

          {count, _} =
            from(card in Card, where: card.id == ^card_id)
            |> repo.update_all(set: [image_asset_id: asset.id, updated_at: now])

          case count do
            1 -> {:ok, asset.id}
            _ -> {:error, :not_found}
          end
        end)
        |> Repo.transaction()
        |> case do
          {:ok, %{asset: asset}} -> {:ok, asset.id}
          {:error, _step, reason, _changes} -> {:error, reason}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  def store_catalog_image(binary_data, mime_type) do
    if mime_type in @catalog_mime_types do
      object_key = "catalog/#{Ecto.UUID.generate()}"

      case put_object(object_key, binary_data, mime_type) do
        :ok ->
          %ImageAsset{}
          |> ImageAsset.changeset(%{
            kind: :catalog,
            mime_type: mime_type,
            object_key: object_key
          })
          |> Repo.insert()
          |> case do
            {:ok, asset} -> {:ok, to_catalog_asset_response(asset)}
            {:error, changeset} -> {:error, changeset}
          end

        {:error, reason} ->
          {:error, reason}
      end
    else
      {:error, :unsupported_mime_type}
    end
  end

  def card_cache_control, do: "public, max-age=31536000, immutable"
  def catalog_cache_control, do: "public, max-age=31536000, immutable"
  def profile_cache_control, do: "private, max-age=3600"

  defp fetch_object_image(asset, object_key) do
    case object_storage_config() do
      %{base_url: base_url, bucket: bucket, access_key: access_key, secret_key: secret_key}
      when is_binary(base_url) and is_binary(bucket) and is_binary(access_key) and
             is_binary(secret_key) ->
        url = object_url(base_url, bucket, object_key)

        case signed_request(:get, url, "", access_key, secret_key) do
          {:ok, %{status: 200, body: body}} when is_binary(body) ->
            {:ok, body, asset.mime_type || "image/svg+xml"}

          {:ok, %{status: 404}} ->
            placeholder_response(asset)

          {:ok, %{status: status}} ->
            {:error, {:object_fetch_failed, status}}

          {:error, reason} ->
            {:error, reason}
        end

      _ ->
        placeholder_response(asset)
    end
  end

  defp placeholder_response(asset) do
    case asset.placeholder_svg do
      placeholder when is_binary(placeholder) and placeholder != "" ->
        {:ok, placeholder, asset.mime_type || "image/svg+xml"}

      _ ->
        {:ok, default_placeholder(asset.kind), asset.mime_type || "image/svg+xml"}
    end
  end

  defp default_placeholder(:card) do
    ~s(<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="100%" height="100%" fill="#1f2937"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#f9fafb" font-size="28">Adventure Time Card</text></svg>)
  end

  defp default_placeholder(:profile) do
    ~s(<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="100%" height="100%" rx="128" fill="#0f766e"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ecfeff" font-size="24">AT</text></svg>)
  end

  defp default_placeholder(:catalog) do
    ~s(<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="100%" height="100%" fill="#0f172a"/><circle cx="256" cy="200" r="84" fill="#38bdf8" fill-opacity="0.28"/><rect x="104" y="308" width="304" height="72" rx="18" fill="#e2e8f0" fill-opacity="0.16"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#e2e8f0" font-size="28">Catalog Asset</text></svg>)
  end

  defp to_catalog_asset_response(asset) do
    %{
      id: asset.id,
      kind: Atom.to_string(asset.kind),
      mimeType: asset.mime_type,
      previewUrl: "/media/catalog/#{asset.id}",
      insertedAt: DateTime.to_iso8601(asset.inserted_at)
    }
  end

  defp put_object(object_key, binary_data, mime_type) do
    case object_storage_config() do
      %{base_url: base_url, bucket: bucket, access_key: access_key, secret_key: secret_key}
      when is_binary(base_url) and is_binary(bucket) and is_binary(access_key) and
             is_binary(secret_key) ->
        url = object_url(base_url, bucket, object_key)

        case signed_request(:put, url, binary_data, access_key, secret_key, [
               {"content-type", mime_type}
             ]) do
          {:ok, %{status: status}} when status in [200, 201] ->
            :ok

          {:ok, %{status: status}} ->
            {:error, {:upload_failed, status}}

          {:error, reason} ->
            {:error, reason}
        end

      _ ->
        {:error, :object_storage_not_configured}
    end
  end

  defp object_storage_config do
    config =
      Application.get_env(:adventure_time_api, __MODULE__, [])
      |> Enum.into(%{})

    %{
      base_url: System.get_env("MINIO_BASE_URL") || config[:base_url],
      bucket: System.get_env("MINIO_BUCKET") || config[:bucket],
      access_key: System.get_env("MINIO_ACCESS_KEY") || config[:access_key],
      secret_key: System.get_env("MINIO_SECRET_KEY") || config[:secret_key]
    }
  end

  defp object_url(base_url, bucket, object_key) do
    encoded_key =
      object_key
      |> String.split("/", trim: true)
      |> Enum.map(fn segment -> URI.encode(segment, &URI.char_unreserved?/1) end)
      |> Enum.join("/")

    [String.trim_trailing(base_url, "/"), bucket, encoded_key] |> Enum.join("/")
  end

  defp signed_request(method, url, body, access_key, secret_key, extra_headers \\ []) do
    uri = URI.parse(url)
    payload_hash = sha256_hex(body)
    amz_date = amz_now()
    date_stamp = String.slice(amz_date, 0, 8)
    host = host_header(uri)

    headers =
      [
        {"host", host},
        {"x-amz-content-sha256", payload_hash},
        {"x-amz-date", amz_date}
      ] ++ extra_headers

    canonical_request =
      [
        method |> Atom.to_string() |> String.upcase(),
        canonical_uri(uri),
        canonical_query(uri),
        canonical_headers(headers),
        "",
        signed_headers(headers),
        payload_hash
      ]
      |> Enum.join("\n")

    credential_scope = Enum.join([date_stamp, "us-east-1", "s3", "aws4_request"], "/")

    string_to_sign =
      [
        "AWS4-HMAC-SHA256",
        amz_date,
        credential_scope,
        sha256_hex(canonical_request)
      ]
      |> Enum.join("\n")

    signature =
      signing_key(secret_key, date_stamp)
      |> hmac(string_to_sign)
      |> Base.encode16(case: :lower)

    authorization =
      "AWS4-HMAC-SHA256 Credential=#{access_key}/#{credential_scope}, SignedHeaders=#{signed_headers(headers)}, Signature=#{signature}"

    Req.request(
      method: method,
      url: url,
      body: body,
      headers: headers ++ [{"authorization", authorization}]
    )
  end

  defp canonical_uri(%URI{path: path}) do
    path
    |> to_string()
    |> String.split("/", trim: false)
    |> Enum.map(fn segment -> URI.encode(segment, &URI.char_unreserved?/1) end)
    |> Enum.join("/")
    |> case do
      "" -> "/"
      encoded -> encoded
    end
  end

  defp canonical_query(%URI{query: nil}), do: ""

  defp canonical_query(%URI{query: query}) do
    query
    |> URI.decode_query()
    |> Enum.sort_by(fn {key, value} -> {key, value} end)
    |> Enum.map_join("&", fn {key, value} ->
      URI.encode_www_form(key) <> "=" <> URI.encode_www_form(value)
    end)
  end

  defp canonical_headers(headers) do
    headers
    |> Enum.map(fn {key, value} ->
      normalized = value |> to_string() |> String.trim() |> String.replace(~r/\s+/, " ")
      {String.downcase(key), normalized}
    end)
    |> Enum.sort_by(fn {key, _value} -> key end)
    |> Enum.map_join("\n", fn {key, value} -> "#{key}:#{value}" end)
  end

  defp signed_headers(headers) do
    headers
    |> Enum.map(fn {key, _value} -> String.downcase(key) end)
    |> Enum.uniq()
    |> Enum.sort()
    |> Enum.join(";")
  end

  defp host_header(%URI{host: host, port: port, scheme: scheme}) do
    default_port = if scheme == "https", do: 443, else: 80

    case port do
      nil -> host
      ^default_port -> host
      _ -> "#{host}:#{port}"
    end
  end

  defp amz_now do
    DateTime.utc_now()
    |> DateTime.truncate(:second)
    |> Calendar.strftime("%Y%m%dT%H%M%SZ")
  end

  defp signing_key(secret_key, date_stamp) do
    ("AWS4" <> secret_key)
    |> hmac(date_stamp)
    |> hmac("us-east-1")
    |> hmac("s3")
    |> hmac("aws4_request")
  end

  defp hmac(key, data), do: :crypto.mac(:hmac, :sha256, key, data)
  defp sha256_hex(data), do: :crypto.hash(:sha256, data) |> Base.encode16(case: :lower)
end
