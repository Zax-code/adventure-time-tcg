defmodule AdventureTimeApi.Media.UploadError do
  @moduledoc false

  @enforce_keys [:code, :status, :message]
  defstruct [:code, :status, :message]
end
