defmodule Mix.Tasks.PwaImport do
  use Mix.Task

  @shortdoc "Audit, apply, verify, or reset the PWA -> Phoenix import"

  @moduledoc """
  Usage:

      mix pwa_import audit
      mix pwa_import apply
      mix pwa_import verify
      mix pwa_import reset

  Options:

      --source-env PATH
      --target-env PATH
      --report-dir PATH
  """

  @impl true
  def run(args) do
    Mix.Task.run("app.start")

    {opts, positional, _invalid} =
      OptionParser.parse(args,
        strict: [source_env: :string, target_env: :string, report_dir: :string]
      )

    command = List.first(positional) || "audit"

    result =
      case command do
        "audit" -> AdventureTimeApi.PwaImport.audit(opts)
        "apply" -> AdventureTimeApi.PwaImport.apply(opts)
        "verify" -> AdventureTimeApi.PwaImport.verify(opts)
        "reset" -> AdventureTimeApi.PwaImport.reset(opts)
        other -> Mix.raise("unknown pwa_import command: #{other}")
      end

    Mix.shell().info(Jason.encode_to_iodata!(result, pretty: true))
  end
end
