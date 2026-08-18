defmodule AdventureTimeApi.NetworkAddress.Type do
  @moduledoc false

  use Ecto.Type

  alias AdventureTimeApi.NetworkAddress

  def type, do: :inet

  def cast(%Postgrex.INET{address: address}), do: cast(address)

  def cast(value) do
    case NetworkAddress.parse(value) do
      {:ok, address} -> {:ok, address}
      :error -> :error
    end
  end

  def load(%Postgrex.INET{address: address}), do: cast(address)
  def load(value), do: cast(value)

  def dump(%Postgrex.INET{} = inet), do: {:ok, inet}

  def dump(value) do
    case NetworkAddress.parse(value) do
      {:ok, address} -> {:ok, %Postgrex.INET{address: address, netmask: nil}}
      :error -> :error
    end
  end
end
