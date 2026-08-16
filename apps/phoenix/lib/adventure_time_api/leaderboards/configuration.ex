defmodule AdventureTimeApi.Leaderboards.Configuration do
  @moduledoc """
  Persists and resolves immutable scoring configurations.

  Database JSON is deliberately converted back through an allow-listed template so
  persisted strings can never create atoms or select an unapproved formula.
  """

  import Ecto.Query

  alias AdventureTimeApi.Leaderboards.{Scoring, ScoringVersion}
  alias AdventureTimeApi.Repo

  @launch Scoring.launch_configuration()

  @spec ensure_launch_version() :: {:ok, ScoringVersion.t()} | {:error, term()}
  def ensure_launch_version do
    stored = Jason.decode!(Jason.encode!(@launch))
    hash = configuration_hash(stored)

    %ScoringVersion{}
    |> ScoringVersion.changeset(%{
      version: @launch.version,
      schema_version: @launch.schema_version,
      configuration: stored,
      configuration_hash: hash,
      effective_week_start: @launch.effective_competition_week,
      status: :scheduled
    })
    |> Repo.insert(
      on_conflict: :nothing,
      conflict_target: :version,
      returning: true
    )
    |> case do
      {:ok, %ScoringVersion{id: nil}} ->
        {:ok, Repo.get_by!(ScoringVersion, version: @launch.version)}

      result ->
        result
    end
  end

  @spec activate_due(DateTime.t()) ::
          {:ok, ScoringVersion.t()} | {:error, :not_yet_effective | term()}
  def activate_due(%DateTime{} = now) do
    today = DateTime.to_date(now)

    Repo.transaction(fn ->
      due =
        from(version in ScoringVersion,
          where:
            version.status in [:scheduled, :active] and
              version.effective_week_start <= ^today,
          order_by: [desc: version.effective_week_start],
          limit: 1,
          lock: "FOR UPDATE"
        )
        |> Repo.one()

      if due do
        from(version in ScoringVersion,
          where: version.status == :active and version.id != ^due.id
        )
        |> Repo.update_all(set: [status: :retired, updated_at: now])

        due
        |> ScoringVersion.changeset(%{status: :active, activated_at: due.activated_at || now})
        |> Repo.update!()
      else
        Repo.rollback(:not_yet_effective)
      end
    end)
  end

  @spec for_date(Date.t()) :: {:ok, {ScoringVersion.t(), map()}} | {:error, atom()}
  def for_date(%Date{} = date) do
    version =
      from(version in ScoringVersion,
        where: version.status in [:active, :retired] and version.effective_week_start <= ^date,
        order_by: [desc: version.effective_week_start],
        limit: 1
      )
      |> Repo.one()

    with %ScoringVersion{} = version <- version,
         {:ok, configuration} <- normalize(version.configuration) do
      {:ok, {version, configuration}}
    else
      nil -> {:error, :scoring_unavailable}
      {:error, reason} -> {:error, reason}
    end
  end

  @spec normalize(map()) :: {:ok, map()} | {:error, :invalid_configuration}
  def normalize(configuration) when is_map(configuration) do
    case normalize_from_template(configuration, @launch) do
      {:ok, normalized} -> {:ok, normalized}
      :error -> {:error, :invalid_configuration}
    end
  end

  def normalize(_configuration), do: {:error, :invalid_configuration}

  @spec configuration_hash(map()) :: String.t()
  def configuration_hash(configuration) do
    configuration
    |> Jason.encode!()
    |> then(&:crypto.hash(:sha256, &1))
    |> Base.encode16(case: :lower)
  end

  defp normalize_from_template(value, %Date{}) when is_binary(value) do
    case Date.from_iso8601(value) do
      {:ok, date} -> {:ok, date}
      _ -> :error
    end
  end

  defp normalize_from_template(value, template) when is_atom(template) and is_binary(value) do
    if value == Atom.to_string(template), do: {:ok, template}, else: :error
  end

  defp normalize_from_template(value, template)
       when is_integer(template) and is_integer(value),
       do: {:ok, value}

  defp normalize_from_template(value, template) when is_binary(template) and is_binary(value),
    do: {:ok, value}

  defp normalize_from_template(values, template) when is_list(values) and is_list(template) do
    if Enum.all?(values, &is_binary/1), do: {:ok, values}, else: :error
  end

  defp normalize_from_template(values, template) when is_map(values) and is_map(template) do
    Enum.reduce_while(template, {:ok, %{}}, fn {key, template_value}, {:ok, acc} ->
      stored_key = if is_atom(key) or is_integer(key), do: to_string(key), else: key

      case Map.fetch(values, stored_key) do
        {:ok, value} ->
          case normalize_from_template(value, template_value) do
            {:ok, normalized} -> {:cont, {:ok, Map.put(acc, key, normalized)}}
            :error -> {:halt, :error}
          end

        :error ->
          {:halt, :error}
      end
    end)
  end

  defp normalize_from_template(value, template) when value == template, do: {:ok, value}
  defp normalize_from_template(_value, _template), do: :error
end
