defmodule AdventureTimeApi.AccessAssessment.Pseudonym do
  @moduledoc false

  @namespace "access-request-ipqs"

  def generate(type, identifier, opts \\ nil)

  def generate(_type, nil, _opts), do: nil
  def generate(_type, "", _opts), do: nil

  def generate(type, identifier, opts) when type in [:identity, :installation] do
    opts = opts || Application.get_env(:adventure_time_api, __MODULE__, [])
    secret = Keyword.get(opts, :secret)
    version = Keyword.get(opts, :version, "v1")

    if is_binary(secret) and byte_size(secret) >= 16 do
      normalized = normalize(type, identifier)
      message = Enum.join([@namespace, version, Atom.to_string(type), normalized], <<0>>)

      digest =
        :crypto.mac(:hmac, :sha256, secret, message)
        |> Base.encode16(case: :lower)

      "#{version}:#{digest}"
    end
  end

  defp normalize(:identity, identifier), do: identifier |> String.trim() |> String.downcase()
  defp normalize(:installation, identifier), do: String.trim(identifier)
end
