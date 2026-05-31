defmodule AdventureTimeApiWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :adventure_time_api

  socket("/socket", AdventureTimeApiWeb.UserSocket,
    websocket: true,
    longpoll: false
  )

  if code_reloading? do
    socket("/phoenix/live_reload/socket", Phoenix.LiveReloader.Socket)
    plug(Phoenix.LiveReloader)
    plug(Phoenix.CodeReloader)
    plug(Phoenix.Ecto.CheckRepoStatus, otp_app: :adventure_time_api)
  end

  plug(Plug.Static,
    at: "/",
    from: :adventure_time_api,
    gzip: false,
    only: AdventureTimeApiWeb.static_paths()
  )

  plug(Plug.RequestId)
  plug(Plug.Telemetry, event_prefix: [:phoenix, :endpoint])

  plug(Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Phoenix.json_library(),
    body_reader: {AdventureTimeApiWeb.RawBodyReader, :read_body, []}
  )

  plug(Plug.Head)
  plug(AdventureTimeApiWeb.Router)
end
