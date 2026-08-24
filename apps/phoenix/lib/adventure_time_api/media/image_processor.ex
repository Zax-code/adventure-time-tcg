defmodule AdventureTimeApi.Media.ImageProcessor do
  @moduledoc false

  alias AdventureTimeApi.Media.UploadError

  @max_upload_bytes 12 * 1024 * 1024
  @max_decoded_pixels 40_000_000
  @card_max_edge 1_600
  @profile_size 512
  @webp_quality 82
  @webp_effort 6

  @supported_mime_types %{
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp"
  }
  @generic_mime_types [nil, "", "application/octet-stream"]

  def max_upload_bytes, do: @max_upload_bytes
  def max_decoded_pixels, do: @max_decoded_pixels
  def webp_quality, do: @webp_quality

  def process(%Plug.Upload{path: path, content_type: declared_mime_type}, kind)
      when kind in [:card, :profile] do
    with :ok <- validate_encoded_size(path),
         {:ok, decoded_format} <- detect_format(path),
         :ok <- validate_declared_mime_type(declared_mime_type, decoded_format),
         {:ok, image} <- open_image(path),
         :ok <- validate_decoded_size(image),
         {:ok, processed_image} <- transform(image, kind),
         {:ok, bytes} <- encode_webp(processed_image) do
      {width, height, _bands} = Image.shape(processed_image)

      {:ok,
       %{
         bytes: bytes,
         mime_type: "image/webp",
         width: width,
         height: height,
         byte_size: byte_size(bytes),
         content_hash: sha256_hex(bytes)
       }}
    end
  end

  defp validate_encoded_size(path) do
    case File.stat(path) do
      {:ok, %{size: size}} when size > @max_upload_bytes ->
        upload_error(:upload_too_large, 413, "Image upload exceeds the 12 MB limit")

      {:ok, _stat} ->
        :ok

      {:error, _reason} ->
        upload_error(:malformed_image, 400, "Image could not be read")
    end
  end

  defp detect_format(path) do
    case File.open(path, [:read, :binary], fn file -> IO.binread(file, 16) end) do
      {:ok, <<0xFF, 0xD8, 0xFF, _rest::binary>>} ->
        {:ok, :jpeg}

      {:ok, <<0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, _rest::binary>>} ->
        {:ok, :png}

      {:ok, <<"RIFF", _size::little-size(32), "WEBP", _rest::binary>>} ->
        {:ok, :webp}

      {:ok, _bytes} ->
        upload_error(
          :unsupported_image_type,
          400,
          "Unsupported image type. Allowed: JPEG, PNG, WebP"
        )

      {:error, _reason} ->
        upload_error(:malformed_image, 400, "Image could not be read")
    end
  end

  defp validate_declared_mime_type(declared_mime_type, decoded_format) do
    expected_mime_type = Map.fetch!(@supported_mime_types, decoded_format)

    case normalize_mime_type(declared_mime_type) do
      ^expected_mime_type ->
        :ok

      mime_type when mime_type in @generic_mime_types ->
        :ok

      mime_type when mime_type in ["image/jpeg", "image/png", "image/webp"] ->
        upload_error(
          :image_type_mismatch,
          400,
          "Declared image type does not match the uploaded image"
        )

      _other ->
        upload_error(
          :unsupported_image_type,
          400,
          "Unsupported image type. Allowed: JPEG, PNG, WebP"
        )
    end
  end

  defp normalize_mime_type("image/jpg"), do: "image/jpeg"

  defp normalize_mime_type(mime_type) when is_binary(mime_type) do
    mime_type
    |> String.split(";", parts: 2)
    |> List.first()
    |> String.trim()
    |> String.downcase()
  end

  defp normalize_mime_type(_mime_type), do: nil

  defp open_image(path) do
    case Image.open(path, access: :sequential, fail_on: :truncated) do
      {:ok, image} -> {:ok, image}
      {:error, _reason} -> upload_error(:malformed_image, 400, "Malformed image data")
    end
  rescue
    _exception -> upload_error(:malformed_image, 400, "Malformed image data")
  end

  defp validate_decoded_size(image) do
    {width, height, _bands} = Image.shape(image)

    if width * height > @max_decoded_pixels do
      upload_error(
        :decoded_image_too_large,
        400,
        "Decoded image exceeds the 40 megapixel safety limit"
      )
    else
      :ok
    end
  end

  defp transform(image, :card) do
    case Image.thumbnail(image, @card_max_edge, resize: :down, autorotate: true) do
      {:ok, processed_image} -> {:ok, processed_image}
      {:error, _reason} -> upload_error(:malformed_image, 400, "Malformed image data")
    end
  rescue
    _exception -> upload_error(:malformed_image, 400, "Malformed image data")
  end

  defp transform(image, :profile) do
    with {:ok, {oriented_image, _flags}} <- Image.autorotate(image),
         {width, height, _bands} = Image.shape(oriented_image),
         crop_size = min(width, height),
         {:ok, cropped_image} <- Image.center_crop(oriented_image, crop_size, crop_size),
         {:ok, sized_image} <-
           Image.thumbnail(cropped_image, @profile_size,
             resize: :down,
             autorotate: false,
             crop: :center
           ),
         {:ok, alpha_image} <- ensure_alpha(sized_image),
         {:ok, padded_image} <-
           Image.embed(alpha_image, @profile_size, @profile_size,
             x: :center,
             y: :center,
             extend_mode: :background,
             background: {:black, alpha: :transparent}
           ) do
      {:ok, padded_image}
    else
      {:error, _reason} -> upload_error(:malformed_image, 400, "Malformed image data")
    end
  rescue
    _exception -> upload_error(:malformed_image, 400, "Malformed image data")
  end

  defp ensure_alpha(image) do
    if Image.has_alpha?(image) do
      {:ok, image}
    else
      Image.add_alpha(image, :opaque)
    end
  end

  defp encode_webp(image) do
    case Image.write(image, :memory,
           suffix: ".webp",
           quality: @webp_quality,
           effort: @webp_effort,
           strip_metadata: true
         ) do
      {:ok, bytes} -> {:ok, bytes}
      {:error, _reason} -> upload_error(:malformed_image, 400, "Malformed image data")
    end
  rescue
    _exception -> upload_error(:malformed_image, 400, "Malformed image data")
  end

  defp upload_error(code, status, message) do
    {:error, %UploadError{code: code, status: status, message: message}}
  end

  defp sha256_hex(bytes) do
    :crypto.hash(:sha256, bytes)
    |> Base.encode16(case: :lower)
  end
end
