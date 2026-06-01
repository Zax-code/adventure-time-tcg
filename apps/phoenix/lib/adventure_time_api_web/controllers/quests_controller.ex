defmodule AdventureTimeApiWeb.QuestsController do
  use AdventureTimeApiWeb, :controller

  require Logger

  alias AdventureTimeApi.Quests

  @slow_request_ms 400

  # GET /quests
  def list_quests(conn, _params) do
    user_id = conn.assigns.auth_user.id

    {:ok, payload} = Quests.list_quests_for_user(user_id)
    json(conn, payload)
  end

  # POST /quests/claim
  def claim_quest(conn, %{"questId" => quest_id}) do
    user_id = conn.assigns.auth_user.id

    case Quests.claim_quest(user_id, quest_id) do
      {:ok, payload} ->
        json(conn, payload)

      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{error: "Quest not found"})

      {:error, :not_completed} ->
        conn
        |> put_status(400)
        |> json(%{error: "Quest not completed", code: "QUEST_NOT_COMPLETED"})

      {:error, :already_claimed} ->
        conn
        |> put_status(409)
        |> json(%{error: "Quest already claimed", code: "QUEST_ALREADY_CLAIMED"})

      {:error, _reason} ->
        conn |> put_status(500) |> json(%{error: "Internal error"})
    end
  end

  def claim_quest(conn, _params) do
    conn |> put_status(400) |> json(%{error: "questId is required"})
  end

  # GET /wordle
  def wordle_state(conn, params) do
    locale = Map.get(params, "locale")

    timed_action(conn, "wordle_state", fn conn, user_id ->
      case Quests.wordle_state(user_id, locale) do
        {:ok, payload} ->
          json(conn, payload)

        {:error, :invalid_wordle_locale} ->
          conn
          |> put_status(400)
          |> json(%{
            error: "Unsupported Wordle language",
            code: "INVALID_WORDLE_LANGUAGE"
          })
      end
    end)
  end

  # POST /wordle
  def submit_wordle_guess(conn, %{"guess" => guess} = params) do
    locale = Map.get(params, "locale")
    expected_date = Map.get(params, "expectedDate", Map.get(params, "date"))
    expected_quest_version = Map.get(params, "questVersion")

    timed_action(conn, "submit_wordle_guess", fn conn, user_id ->
      case Quests.submit_wordle_guess(
             user_id,
             guess,
             locale,
             expected_date,
             expected_quest_version
           ) do
        {:ok, payload} ->
          json(conn, payload)

        {:error, :invalid_wordle_locale} ->
          conn
          |> put_status(400)
          |> json(%{
            error: "Unsupported Wordle language",
            code: "INVALID_WORDLE_LANGUAGE"
          })

        {:error, :wordle_reset} ->
          conn
          |> put_status(409)
          |> json(%{error: "Wordle has reset since this game began", code: "WORDLE_RESET"})

        {:error, :invalid_guess_format} ->
          conn
          |> put_status(400)
          |> json(%{error: "Guess must be exactly 5 letters", code: "INVALID_GUESS"})

        {:error, :word_not_found} ->
          conn
          |> put_status(400)
          |> json(%{error: "Word not found in dictionary", code: "WORD_NOT_FOUND"})

        {:error, :already_solved} ->
          conn
          |> put_status(409)
          |> json(%{error: "Already solved today's Wordle", code: "WORDLE_ALREADY_SOLVED"})

        {:error, :attempts_exhausted} ->
          conn
          |> put_status(409)
          |> json(%{error: "No attempts remaining", code: "WORDLE_ATTEMPTS_EXHAUSTED"})

        {:error, _reason} ->
          conn |> put_status(500) |> json(%{error: "Internal error"})
      end
    end)
  end

  def submit_wordle_guess(conn, _params) do
    conn |> put_status(400) |> json(%{error: "guess is required"})
  end

  # GET /quests/speed-calculus
  def speed_calculus_state(conn, _params) do
    timed_action(conn, "speed_calculus_state", fn conn, user_id ->
      {:ok, payload} = Quests.speed_calculus_state(user_id)
      json(conn, payload)
    end)
  end

  # POST /quests/speed-calculus/start
  def start_speed_calculus_run(conn, _params) do
    timed_action(conn, "start_speed_calculus_run", fn conn, user_id ->
      case Quests.start_speed_calculus_run(user_id) do
        {:ok, payload} ->
          json(conn, payload)

        {:error, :cannot_start_run} ->
          conn
          |> put_status(400)
          |> json(%{error: "Cannot start a new run at this time", code: "CANNOT_START_RUN"})

        {:error, _reason} ->
          conn |> put_status(500) |> json(%{error: "Internal error"})
      end
    end)
  end

  # POST /quests/speed-calculus/answer
  def answer_speed_calculus(conn, %{"runId" => run_id, "answer" => answer}) do
    answer_int = parse_int(answer)
    quest_version = Map.get(conn.body_params, "questVersion")

    if is_nil(answer_int) do
      conn |> put_status(400) |> json(%{error: "answer must be an integer"})
    else
      timed_action(conn, "answer_speed_calculus", fn conn, user_id ->
        case Quests.answer_speed_calculus(user_id, run_id, answer_int, quest_version) do
          {:ok, payload} ->
            json(conn, payload)

          {:error, :speed_calculus_reset} ->
            conn
            |> put_status(409)
            |> json(%{
              error: "Speed Calculus was reset while you were playing",
              code: "SPEED_CALCULUS_RESET"
            })

          {:error, :run_not_found} ->
            conn |> put_status(404) |> json(%{error: "Run not found"})

          {:error, :run_not_active} ->
            conn
            |> put_status(400)
            |> json(%{error: "Run is not active", code: "RUN_NOT_ACTIVE"})

          {:error, :run_is_paused} ->
            conn |> put_status(400) |> json(%{error: "Run is paused", code: "RUN_IS_PAUSED"})

          {:error, _reason} ->
            conn |> put_status(500) |> json(%{error: "Internal error"})
        end
      end)
    end
  end

  def answer_speed_calculus(conn, _params) do
    conn |> put_status(400) |> json(%{error: "runId and answer are required"})
  end

  # POST /quests/speed-calculus/pause
  def pause_speed_calculus(conn, _params) do
    timed_action(conn, "pause_speed_calculus", fn conn, user_id ->
      case Quests.pause_speed_calculus(user_id) do
        {:ok, payload} ->
          json(conn, payload)

        {:error, :run_not_active} ->
          conn
          |> put_status(400)
          |> json(%{error: "Run is not active", code: "RUN_NOT_ACTIVE"})

        {:error, :run_is_paused} ->
          conn |> put_status(400) |> json(%{error: "Run is paused", code: "RUN_IS_PAUSED"})

        {:error, _reason} ->
          conn |> put_status(500) |> json(%{error: "Internal error"})
      end
    end)
  end

  # POST /quests/speed-calculus/resume
  def resume_speed_calculus(conn, _params) do
    timed_action(conn, "resume_speed_calculus", fn conn, user_id ->
      {:ok, payload} = Quests.resume_speed_calculus(user_id)
      json(conn, payload)
    end)
  end

  # POST /quests/speed-calculus/finish
  def finish_speed_calculus(conn, %{"runId" => run_id}) do
    quest_version = Map.get(conn.body_params, "questVersion")

    timed_action(conn, "finish_speed_calculus", fn conn, user_id ->
      case Quests.finish_speed_calculus(user_id, run_id, quest_version) do
        {:ok, payload} ->
          json(conn, payload)

        {:error, :speed_calculus_reset} ->
          conn
          |> put_status(409)
          |> json(%{
            error: "Speed Calculus was reset while you were playing",
            code: "SPEED_CALCULUS_RESET"
          })

        {:error, :run_not_found} ->
          conn |> put_status(404) |> json(%{error: "Run not found"})

        {:error, :run_not_active} ->
          conn
          |> put_status(400)
          |> json(%{error: "Run is not active", code: "RUN_NOT_ACTIVE"})

        {:error, _reason} ->
          conn |> put_status(500) |> json(%{error: "Internal error"})
      end
    end)
  end

  def finish_speed_calculus(conn, _params) do
    conn |> put_status(400) |> json(%{error: "runId is required"})
  end

  # POST /quests/speed-calculus/cashout
  def cashout_speed_calculus(conn, _params) do
    timed_action(conn, "cashout_speed_calculus", fn conn, user_id ->
      case Quests.cashout_speed_calculus(user_id) do
        {:ok, payload} ->
          json(conn, payload)

        {:error, :quest_not_found} ->
          conn |> put_status(404) |> json(%{error: "Quest not found"})

        {:error, :quest_already_locked} ->
          conn
          |> put_status(409)
          |> json(%{error: "Quest already locked", code: "QUEST_ALREADY_LOCKED"})

        {:error, :quest_already_claimed} ->
          conn
          |> put_status(409)
          |> json(%{error: "Quest already claimed", code: "QUEST_ALREADY_CLAIMED"})

        {:error, :active_run_in_progress} ->
          conn
          |> put_status(400)
          |> json(%{error: "A run is in progress", code: "ACTIVE_RUN_IN_PROGRESS"})

        {:error, :no_runs_completed} ->
          conn
          |> put_status(400)
          |> json(%{error: "No completed runs to cash out", code: "NO_RUNS_COMPLETED"})

        {:error, _reason} ->
          conn |> put_status(500) |> json(%{error: "Internal error"})
      end
    end)
  end

  defp timed_action(conn, event, fun) do
    user_id = conn.assigns.auth_user.id
    started_at = System.monotonic_time()
    conn = fun.(conn, user_id)

    duration_ms =
      System.convert_time_unit(System.monotonic_time() - started_at, :native, :millisecond)

    log_level = if duration_ms >= @slow_request_ms, do: :warning, else: :info

    Logger.log(
      log_level,
      "[quests] request_timing event=#{event} method=#{conn.method} path=#{conn.request_path} status=#{conn.status || 200} user_id=#{user_id} duration_ms=#{duration_ms}"
    )

    conn
  end

  defp parse_int(v) when is_integer(v), do: v

  defp parse_int(v) when is_binary(v) do
    case Integer.parse(v) do
      {i, ""} -> i
      _ -> nil
    end
  end

  defp parse_int(_), do: nil
end
