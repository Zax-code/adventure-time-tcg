defmodule AdventureTimeApi.Leaderboards.Calendar do
  @moduledoc """
  Pure competition-calendar calculations for natural local days.

  Persisted competition slots keep these calculated UTC boundaries immutable. Device
  timezone changes can therefore affect only the next unopened slot.
  """

  @publication_hour 20
  @publication_minute 15

  @spec slot(Date.t(), String.t()) :: {:ok, map()} | {:error, :invalid_timezone}
  def slot(%Date{} = local_date, timezone) when is_binary(timezone) do
    with {:ok, starts_at} <- local_midnight(local_date, timezone),
         {:ok, ends_at} <- local_midnight(Date.add(local_date, 1), timezone) do
      {:ok,
       %{
         local_date: local_date,
         competition_week_key: Date.beginning_of_week(local_date, :monday),
         effective_timezone: timezone,
         starts_at: starts_at,
         ends_at: ends_at
       }}
    else
      _ -> {:error, :invalid_timezone}
    end
  end

  def slot(_local_date, _timezone), do: {:error, :invalid_timezone}

  @spec publication_cutoff(Date.t()) :: DateTime.t()
  def publication_cutoff(%Date{} = competition_date) do
    competition_date
    |> Date.add(1)
    |> DateTime.new!(Time.new!(@publication_hour, @publication_minute, 0), "Etc/UTC")
  end

  defp local_midnight(date, timezone) do
    case DateTime.new(date, ~T[00:00:00], timezone) do
      {:ok, datetime} -> {:ok, DateTime.shift_zone!(datetime, "Etc/UTC")}
      _ -> {:error, :invalid_timezone}
    end
  end
end
