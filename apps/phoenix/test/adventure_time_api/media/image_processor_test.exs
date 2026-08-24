defmodule AdventureTimeApi.Media.ImageProcessorTest do
  use ExUnit.Case, async: true

  alias AdventureTimeApi.Media.ImageProcessor
  alias AdventureTimeApi.Media.UploadError

  @tag :tmp_dir
  test "normalizes JPEG, PNG, and WebP card uploads to optimized WebP", %{tmp_dir: tmp_dir} do
    Enum.each(
      [{".jpg", "image/jpeg"}, {".png", "image/png"}, {".webp", "image/webp"}],
      fn {extension, mime_type} ->
        upload = image_upload(tmp_dir, extension, mime_type, 2_000, 1_000)

        assert {:ok, processed} = ImageProcessor.process(upload, :card)
        assert <<"RIFF", _size::little-size(32), "WEBP", _rest::binary>> = processed.bytes
        assert processed.mime_type == "image/webp"
        assert processed.width == 1_600
        assert processed.height == 800
        assert processed.byte_size == byte_size(processed.bytes)
        assert processed.content_hash == sha256_hex(processed.bytes)
      end
    )
  end

  @tag :tmp_dir
  test "profile images are center-cropped, never upscaled, and padded to 512 square", %{
    tmp_dir: tmp_dir
  } do
    upload = image_upload(tmp_dir, ".png", "image/png", 120, 80)

    assert {:ok, processed} = ImageProcessor.process(upload, :profile)
    assert processed.width == 512
    assert processed.height == 512

    assert {:ok, output} = Image.open(processed.bytes)
    assert Image.has_alpha?(output)
    assert {:ok, [_red, _green, _blue, 0]} = Image.get_pixel(output, 215, 256)
    assert {:ok, [_red, _green, _blue, 255]} = Image.get_pixel(output, 216, 256)
  end

  @tag :tmp_dir
  test "applies orientation before removing source metadata", %{tmp_dir: tmp_dir} do
    path = Path.join(tmp_dir, "oriented.jpg")

    40
    |> Image.new!(20, color: "#ef4444")
    |> Image.set_orientation!(6)
    |> Image.write!(path, strip_metadata: false)

    assert {:ok, processed} = ImageProcessor.process(upload(path, "image/jpeg"), :card)
    assert {processed.width, processed.height} == {20, 40}

    assert {:ok, output} = Image.open(processed.bytes)
    assert {:error, _reason} = Vix.Vips.Image.header_value(output, "orientation")
    assert {:error, _reason} = Vix.Vips.Image.header_value(output, "exif-data")
  end

  @tag :tmp_dir
  test "rejects unsupported image types", %{tmp_dir: tmp_dir} do
    path = Path.join(tmp_dir, "image.svg")
    File.write!(path, ~s(<svg xmlns="http://www.w3.org/2000/svg"></svg>))

    assert {:error, %UploadError{code: :unsupported_image_type, status: 400}} =
             ImageProcessor.process(upload(path, "image/svg+xml"), :card)
  end

  @tag :tmp_dir
  test "rejects a declared MIME type that conflicts with the decoded format", %{tmp_dir: tmp_dir} do
    upload = image_upload(tmp_dir, ".png", "image/jpeg", 20, 20)

    assert {:error, %UploadError{code: :image_type_mismatch, status: 400}} =
             ImageProcessor.process(upload, :card)
  end

  @tag :tmp_dir
  test "rejects malformed bytes with a supported signature", %{tmp_dir: tmp_dir} do
    path = Path.join(tmp_dir, "broken.jpg")
    File.write!(path, <<0xFF, 0xD8, 0xFF, 0, 1, 2, 3>>)

    assert {:error, %UploadError{code: :malformed_image, status: 400}} =
             ImageProcessor.process(upload(path, "image/jpeg"), :card)
  end

  @tag :tmp_dir
  test "rejects encoded uploads larger than 12 MB before decoding", %{tmp_dir: tmp_dir} do
    path = Path.join(tmp_dir, "oversized.jpg")
    {:ok, file} = File.open(path, [:write, :binary])
    :ok = :file.position(file, ImageProcessor.max_upload_bytes()) |> elem(0)
    :ok = IO.binwrite(file, <<0>>)
    File.close(file)

    assert {:error, %UploadError{code: :upload_too_large, status: 413}} =
             ImageProcessor.process(upload(path, "image/jpeg"), :card)
  end

  @tag :tmp_dir
  test "rejects images over the decoded pixel safety limit", %{tmp_dir: tmp_dir} do
    upload = image_upload(tmp_dir, ".png", "image/png", 6_500, 6_500)

    assert {:error, %UploadError{code: :decoded_image_too_large, status: 400}} =
             ImageProcessor.process(upload, :card)
  end

  defp image_upload(tmp_dir, extension, mime_type, width, height) do
    path = Path.join(tmp_dir, "source-#{System.unique_integer([:positive])}#{extension}")

    width
    |> Image.new!(height, color: "#40a0e0")
    |> Image.write!(path)

    upload(path, mime_type)
  end

  defp upload(path, mime_type) do
    %Plug.Upload{path: path, filename: Path.basename(path), content_type: mime_type}
  end

  defp sha256_hex(bytes) do
    :crypto.hash(:sha256, bytes)
    |> Base.encode16(case: :lower)
  end
end
