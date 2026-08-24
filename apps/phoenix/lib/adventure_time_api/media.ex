defmodule AdventureTimeApi.Media do
  @moduledoc """
  Media boundary for serving stored or placeholder-backed image assets.
  """

  import Ecto.Query
  require Logger

  alias Ecto.Multi
  alias AdventureTimeApi.Accounts.User
  alias AdventureTimeApi.Catalog.{Card, CardBackVisual, ImageAsset, Pack}
  alias AdventureTimeApi.Media.ImageProcessor
  alias AdventureTimeApi.Repo
  alias AdventureTimeApi.Workers.MediaCleanupWorker

  @catalog_mime_types ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]

  def ready? do
    config = object_storage_config()

    case config do
      %{base_url: base_url, bucket: bucket, access_key: access_key, secret_key: secret_key}
      when is_binary(base_url) and is_binary(bucket) and is_binary(access_key) and
             is_binary(secret_key) and base_url != "" and bucket != "" and access_key != "" and
             secret_key != "" ->
        url = [String.trim_trailing(base_url, "/"), bucket] |> Enum.join("/")

        case signed_request(:head, url, "", access_key, secret_key) do
          {:ok, %{status: status}} when status in 200..299 ->
            :ok

          {:ok, %{status: status}} ->
            {:error, {:object_storage_unready, status}}

          {:error, reason} ->
            {:error, {:object_storage_unready, reason}}
        end

      _ when map_size(config) == 4 ->
        if Enum.all?(config, fn {_key, value} -> value in [nil, ""] end) do
          :ok
        else
          {:error, :object_storage_not_configured}
        end

      _ ->
        :ok
    end
  end

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

  def store_profile_image(user_id, %Plug.Upload{} = upload) do
    store_processed_image(:profile, user_id, upload)
  end

  def store_card_image(card_id, %Plug.Upload{} = upload) do
    store_processed_image(:card, card_id, upload)
  end

  def cleanup_image_asset(asset_id) when is_binary(asset_id) do
    Repo.transaction(fn -> cleanup_image_asset_transaction(asset_id) end)
    |> case do
      {:ok, result} -> result
      {:error, reason} -> {:error, reason}
    end
  end

  def delete_object(object_key) when is_binary(object_key) and object_key != "" do
    case object_storage_config() do
      %{base_url: base_url, bucket: bucket, access_key: access_key, secret_key: secret_key}
      when is_binary(base_url) and is_binary(bucket) and is_binary(access_key) and
             is_binary(secret_key) ->
        url = object_url(base_url, bucket, object_key)

        case signed_request(:delete, url, "", access_key, secret_key) do
          {:ok, %{status: status}} when status in [200, 202, 204, 404] ->
            :ok

          {:ok, %{status: status}} ->
            {:error, {:delete_failed, status}}

          {:error, reason} ->
            {:error, reason}
        end

      _ ->
        {:error, :object_storage_not_configured}
    end
  end

  def audit_orphaned_assets do
    candidates =
      ImageAsset
      |> join(:left, [asset], card in Card, on: card.image_asset_id == asset.id)
      |> join(:left, [asset, _card], user in User, on: user.avatar_asset_id == asset.id)
      |> join(:left, [asset, _card, _user], pack in Pack, on: pack.pack_art_asset_id == asset.id)
      |> join(:left, [asset, _card, _user, _pack], visual in CardBackVisual,
        on: visual.image_asset_id == asset.id
      )
      |> where(
        [_asset, card, user, pack, visual],
        is_nil(card.id) and is_nil(user.id) and is_nil(pack.id) and is_nil(visual.id)
      )
      |> distinct(true)
      |> order_by([asset], asc: asset.kind, asc: asset.inserted_at, asc: asset.id)
      |> Repo.all()
      |> Enum.map(&orphan_candidate/1)

    counts_by_kind =
      Enum.reduce(candidates, %{card: 0, profile: 0, catalog: 0}, fn candidate, counts ->
        Map.update!(counts, candidate.kind, &(&1 + 1))
      end)

    %{total: length(candidates), counts_by_kind: counts_by_kind, candidates: candidates}
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

  def ensure_catalog_image(object_key, binary_data, mime_type) do
    if mime_type in @catalog_mime_types do
      ImageAsset
      |> where(
        [image_asset],
        image_asset.kind == :catalog and image_asset.object_key == ^object_key
      )
      |> Repo.one()
      |> case do
        %ImageAsset{} = asset ->
          {:ok, asset}

        nil ->
          case put_object(object_key, binary_data, mime_type) do
            :ok ->
              %ImageAsset{}
              |> ImageAsset.changeset(%{
                kind: :catalog,
                mime_type: mime_type,
                object_key: object_key
              })
              |> Repo.insert()

            {:error, reason} ->
              {:error, reason}
          end
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
        {:ok, placeholder, "image/svg+xml"}

      _ ->
        {:ok, default_placeholder(asset.kind), "image/svg+xml"}
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

  defp store_processed_image(kind, owner_id, upload) do
    with {:ok, processed} <- ImageProcessor.process(upload, kind) do
      object_key = "#{kind}/#{owner_id}/#{Ecto.UUID.generate()}.webp"

      case put_object(object_key, processed.bytes, processed.mime_type) do
        :ok ->
          persist_processed_image(kind, owner_id, object_key, processed)
          |> case do
            {:ok, asset_id} ->
              {:ok, asset_id}

            {:error, reason} ->
              cleanup_new_object(object_key, kind, owner_id)
              {:error, reason}
          end

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  defp persist_processed_image(kind, owner_id, object_key, processed) do
    Multi.new()
    |> Multi.run(:owner, fn repo, _changes -> lock_owner(repo, kind, owner_id) end)
    |> Multi.insert(:asset, fn _changes ->
      ImageAsset.changeset(%ImageAsset{}, %{
        kind: kind,
        mime_type: processed.mime_type,
        object_key: object_key,
        width: processed.width,
        height: processed.height,
        byte_size: processed.byte_size,
        content_hash: processed.content_hash
      })
    end)
    |> Multi.update(:swap, fn %{asset: asset, owner: %{record: record}} ->
      swap_changeset(record, kind, asset.id)
    end)
    |> Multi.run(:cleanup_job, fn _repo, %{owner: %{old_asset_id: old_asset_id}} ->
      enqueue_cleanup_job(old_asset_id)
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{asset: asset}} -> {:ok, asset.id}
      {:error, _step, reason, _changes} -> {:error, reason}
    end
  end

  defp lock_owner(repo, :profile, owner_id) do
    User
    |> where([user], user.id == ^owner_id)
    |> lock("FOR UPDATE")
    |> repo.one()
    |> case do
      %User{} = user -> {:ok, %{record: user, old_asset_id: user.avatar_asset_id}}
      nil -> {:error, :not_found}
    end
  end

  defp lock_owner(repo, :card, owner_id) do
    Card
    |> where([card], card.id == ^owner_id)
    |> lock("FOR UPDATE")
    |> repo.one()
    |> case do
      %Card{} = card -> {:ok, %{record: card, old_asset_id: card.image_asset_id}}
      nil -> {:error, :not_found}
    end
  end

  defp swap_changeset(%User{} = user, :profile, asset_id) do
    Ecto.Changeset.change(user, avatar_asset_id: asset_id)
  end

  defp swap_changeset(%Card{} = card, :card, asset_id) do
    Ecto.Changeset.change(card, image_asset_id: asset_id)
  end

  defp enqueue_cleanup_job(nil), do: {:ok, nil}

  defp enqueue_cleanup_job(asset_id) do
    %{"asset_id" => asset_id}
    |> MediaCleanupWorker.new()
    |> Oban.insert()
  end

  defp cleanup_new_object(object_key, kind, owner_id) do
    case delete_object(object_key) do
      :ok ->
        :ok

      {:error, reason} ->
        Logger.warning(
          "media cleanup failed for uncommitted #{kind} upload owner=#{owner_id} reason=#{cleanup_reason(reason)}"
        )
    end
  end

  defp cleanup_image_asset_transaction(asset_id) do
    asset =
      ImageAsset
      |> where([image_asset], image_asset.id == ^asset_id)
      |> lock("FOR UPDATE")
      |> Repo.one()

    cond do
      is_nil(asset) ->
        :ok

      asset_referenced?(asset.id) ->
        {:protected, asset_reference_kinds(asset.id)}

      is_nil(asset.object_key) or asset.object_key == "" ->
        delete_asset_row(asset)

      object_key_owned_by_another_asset?(asset) ->
        delete_asset_row(asset)

      true ->
        case delete_object(asset.object_key) do
          :ok -> delete_asset_row(asset)
          {:error, reason} -> Repo.rollback({:object_delete_failed, reason})
        end
    end
  end

  defp delete_asset_row(asset) do
    case Repo.delete(asset) do
      {:ok, _asset} -> :ok
      {:error, changeset} -> Repo.rollback({:asset_delete_failed, changeset})
    end
  end

  defp asset_referenced?(asset_id), do: asset_reference_kinds(asset_id) != []

  defp asset_reference_kinds(asset_id) do
    [
      {:card, from(card in Card, where: card.image_asset_id == ^asset_id)},
      {:profile, from(user in User, where: user.avatar_asset_id == ^asset_id)},
      {:pack, from(pack in Pack, where: pack.pack_art_asset_id == ^asset_id)},
      {:card_back, from(visual in CardBackVisual, where: visual.image_asset_id == ^asset_id)}
    ]
    |> Enum.flat_map(fn {kind, query} -> if Repo.exists?(query), do: [kind], else: [] end)
  end

  defp object_key_owned_by_another_asset?(asset) do
    ImageAsset
    |> where(
      [image_asset],
      image_asset.object_key == ^asset.object_key and image_asset.id != ^asset.id
    )
    |> Repo.exists?()
  end

  defp orphan_candidate(asset) do
    %{
      id: asset.id,
      kind: asset.kind,
      object_key: asset.object_key,
      mime_type: asset.mime_type,
      width: asset.width,
      height: asset.height,
      byte_size: asset.byte_size,
      content_hash: asset.content_hash,
      inserted_at: asset.inserted_at
    }
  end

  defp cleanup_reason({operation, status}) when is_atom(operation) and is_integer(status),
    do: "#{operation}:#{status}"

  defp cleanup_reason(reason) when is_atom(reason), do: Atom.to_string(reason)
  defp cleanup_reason(_reason), do: "transport_error"

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
      base_url: object_storage_base_url(config),
      bucket: System.get_env("MINIO_BUCKET") || config[:bucket],
      access_key: System.get_env("MINIO_ACCESS_KEY") || config[:access_key],
      secret_key: System.get_env("MINIO_SECRET_KEY") || config[:secret_key]
    }
  end

  defp object_storage_base_url(config) do
    System.get_env("MINIO_BASE_URL") || config[:base_url] || minio_base_url_from_parts()
  end

  defp minio_base_url_from_parts do
    case {System.get_env("MINIO_ENDPOINT"), System.get_env("MINIO_PORT")} do
      {endpoint, port}
      when is_binary(endpoint) and endpoint != "" and is_binary(port) and port != "" ->
        scheme = if System.get_env("MINIO_USE_SSL") in ~w(true 1), do: "https", else: "http"
        "#{scheme}://#{endpoint}:#{port}"

      _ ->
        nil
    end
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
