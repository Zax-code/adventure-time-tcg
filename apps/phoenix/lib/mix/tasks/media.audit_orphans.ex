defmodule Mix.Tasks.Media.AuditOrphans do
  use Mix.Task

  alias AdventureTimeApi.Media

  @shortdoc "Report unreferenced image asset rows without deleting anything"

  @moduledoc """
  Reports image asset rows that are not referenced by a card, user, pack, or
  card-back visual.

      mix media.audit_orphans

  This task is always read-only. It does not inspect or delete MinIO-only
  objects and it has no delete mode.
  """

  @impl Mix.Task
  def run(_args) do
    Mix.Task.run("app.start")

    audit = Media.audit_orphaned_assets()

    Mix.shell().info("Image asset orphan audit (read-only dry run)")
    Mix.shell().info("Total candidates: #{audit.total}")

    Enum.each([:card, :profile, :catalog], fn kind ->
      Mix.shell().info("#{kind}: #{Map.fetch!(audit.counts_by_kind, kind)}")
    end)

    Enum.each(audit.candidates, fn candidate ->
      Mix.shell().info(
        Enum.join(
          [
            "id=#{candidate.id}",
            "kind=#{candidate.kind}",
            "object_key=#{candidate.object_key || "(none)"}",
            "mime_type=#{candidate.mime_type}",
            "dimensions=#{dimensions(candidate)}",
            "byte_size=#{candidate.byte_size || "(unknown)"}",
            "content_hash=#{candidate.content_hash || "(unknown)"}",
            "inserted_at=#{DateTime.to_iso8601(candidate.inserted_at)}"
          ],
          " "
        )
      )
    end)
  end

  defp dimensions(%{width: width, height: height}) when is_integer(width) and is_integer(height),
    do: "#{width}x#{height}"

  defp dimensions(_candidate), do: "(unknown)"
end
