defmodule AdventureTimeApi.Catalog.ImageAsset do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @kinds [:card, :profile, :catalog]

  schema "image_assets" do
    field(:kind, Ecto.Enum, values: @kinds)
    field(:mime_type, :string)
    field(:object_key, :string)
    field(:placeholder_svg, :string)
    field(:width, :integer)
    field(:height, :integer)
    field(:byte_size, :integer)
    field(:content_hash, :string)

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(image_asset, attrs) do
    image_asset
    |> cast(attrs, [
      :kind,
      :mime_type,
      :object_key,
      :placeholder_svg,
      :width,
      :height,
      :byte_size,
      :content_hash
    ])
    |> validate_required([:kind, :mime_type])
    |> validate_number(:width, greater_than: 0)
    |> validate_number(:height, greater_than: 0)
    |> validate_number(:byte_size, greater_than: 0)
    |> validate_format(:content_hash, ~r/^[0-9a-f]{64}$/)
  end
end
