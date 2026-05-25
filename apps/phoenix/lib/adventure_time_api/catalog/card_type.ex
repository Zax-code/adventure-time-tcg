defmodule AdventureTimeApi.Catalog.CardType do
  @canonical_types [
    "Hero",
    "Tech",
    "Royalty",
    "Candy",
    "Undead",
    "Ice",
    "Fire",
    "Magic",
    "Demon",
    "Cosmic"
  ]

  @legacy_type_map %{
    "ALLY" => "Hero",
    "MAGE" => "Magic",
    "ROGUE" => "Undead"
  }

  def values, do: @canonical_types

  def normalize_input(value) when is_binary(value) do
    normalized = value |> String.trim() |> String.downcase()

    Enum.find_value(@canonical_types, fn type ->
      if String.downcase(type) == normalized, do: type, else: nil
    end)
  end

  def normalize_input(_value), do: nil

  def canonicalize(value) when is_binary(value) do
    case normalize_input(value) do
      nil -> Map.get(@legacy_type_map, String.trim(value))
      type -> type
    end
  end

  def canonicalize(_value), do: nil

  def canonicalize!(value) do
    case canonicalize(value) do
      nil -> raise ArgumentError, "unknown card type: #{inspect(value)}"
      type -> type
    end
  end
end
