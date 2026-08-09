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

  # GET /quests/daily-numbers
  def daily_numbers_state(conn, %{"mode" => mode}) do
    timed_action(conn, "daily_numbers_state", fn conn, user_id ->
      case Quests.daily_numbers_state(user_id, mode) do
        {:ok, payload} ->
          json(conn, payload)

        {:error, :invalid_daily_numbers_mode} ->
          conn
          |> put_status(400)
          |> json(%{
            error: "Unsupported Daily Numbers mode",
            code: "INVALID_DAILY_NUMBERS_MODE"
          })
      end
    end)
  end

  def daily_numbers_state(conn, _params) do
    conn |> put_status(400) |> json(%{error: "mode is required"})
  end

  # POST /quests/daily-numbers/submit
  def submit_daily_numbers(conn, %{"mode" => mode, "dateKey" => date_key, "steps" => steps}) do
    expected_quest_version = Map.get(conn.body_params, "questVersion")
    elapsed_ms = Map.get(conn.body_params, "elapsedMs", 0)

    timed_action(conn, "submit_daily_numbers", fn conn, user_id ->
      case Quests.submit_daily_numbers(
             user_id,
             mode,
             date_key,
             steps,
             expected_quest_version,
             elapsed_ms
           ) do
        {:ok, payload} ->
          json(conn, payload)

        {:error, :invalid_daily_numbers_mode} ->
          conn
          |> put_status(400)
          |> json(%{
            error: "Unsupported Daily Numbers mode",
            code: "INVALID_DAILY_NUMBERS_MODE"
          })

        {:error, :daily_numbers_reset} ->
          conn
          |> put_status(409)
          |> json(%{
            error: "Daily Numbers reset while this puzzle was open",
            code: "DAILY_NUMBERS_RESET"
          })

        {:error, :daily_numbers_already_submitted} ->
          conn
          |> put_status(409)
          |> json(%{
            error: "Daily Numbers already submitted for today",
            code: "DAILY_NUMBERS_ALREADY_SUBMITTED"
          })

        {:error, message} when is_binary(message) ->
          conn
          |> put_status(400)
          |> json(%{error: message, code: "INVALID_DAILY_NUMBERS_SUBMISSION"})

        {:error, _reason} ->
          conn |> put_status(500) |> json(%{error: "Internal error"})
      end
    end)
  end

  def submit_daily_numbers(conn, _params) do
    conn
    |> put_status(400)
    |> json(%{error: "mode, dateKey, and steps are required"})
  end

  # GET /quests/daily-numbers/history
  def daily_numbers_archive_history(conn, _params) do
    timed_action(conn, "daily_numbers_archive_history", fn conn, user_id ->
      {:ok, payload} = Quests.daily_numbers_archive_history(user_id)
      json(conn, payload)
    end)
  end

  # GET /quests/daily-numbers/archive
  def daily_numbers_archive_state(conn, %{"date" => date_key, "mode" => mode}) do
    timed_action(conn, "daily_numbers_archive_state", fn conn, user_id ->
      case Quests.daily_numbers_archive_state(user_id, date_key, mode) do
        {:ok, payload} ->
          json(conn, payload)

        {:error, :invalid_daily_numbers_mode} ->
          conn
          |> put_status(400)
          |> json(%{
            error: "Unsupported Daily Numbers mode",
            code: "INVALID_DAILY_NUMBERS_MODE"
          })

        {:error, :invalid_daily_numbers_archive_date} ->
          conn
          |> put_status(400)
          |> json(%{
            error: "Invalid Daily Numbers archive date",
            code: "INVALID_DAILY_NUMBERS_ARCHIVE_DATE"
          })

        {:error, :daily_numbers_archive_today_or_future} ->
          conn
          |> put_status(400)
          |> json(%{
            error: "Daily Numbers archive only supports previous dates",
            code: "DAILY_NUMBERS_ARCHIVE_TODAY_OR_FUTURE"
          })

        {:error, :daily_numbers_archive_out_of_range} ->
          conn
          |> put_status(404)
          |> json(%{
            error: "Daily Numbers archive date is outside the available history",
            code: "DAILY_NUMBERS_ARCHIVE_OUT_OF_RANGE"
          })
      end
    end)
  end

  def daily_numbers_archive_state(conn, _params) do
    conn |> put_status(400) |> json(%{error: "date and mode are required"})
  end

  # POST /quests/daily-numbers/archive/submit
  def submit_daily_numbers_archive(conn, %{
        "mode" => mode,
        "dateKey" => date_key,
        "steps" => steps
      }) do
    elapsed_ms = Map.get(conn.body_params, "elapsedMs", 0)

    timed_action(conn, "submit_daily_numbers_archive", fn conn, user_id ->
      case Quests.submit_daily_numbers_archive(user_id, date_key, mode, steps, elapsed_ms) do
        {:ok, payload} ->
          json(conn, payload)

        {:error, :invalid_daily_numbers_mode} ->
          conn
          |> put_status(400)
          |> json(%{
            error: "Unsupported Daily Numbers mode",
            code: "INVALID_DAILY_NUMBERS_MODE"
          })

        {:error, :invalid_daily_numbers_archive_date} ->
          conn
          |> put_status(400)
          |> json(%{
            error: "Invalid Daily Numbers archive date",
            code: "INVALID_DAILY_NUMBERS_ARCHIVE_DATE"
          })

        {:error, :daily_numbers_archive_today_or_future} ->
          conn
          |> put_status(400)
          |> json(%{
            error: "Daily Numbers archive only supports previous dates",
            code: "DAILY_NUMBERS_ARCHIVE_TODAY_OR_FUTURE"
          })

        {:error, :daily_numbers_archive_out_of_range} ->
          conn
          |> put_status(404)
          |> json(%{
            error: "Daily Numbers archive date is outside the available history",
            code: "DAILY_NUMBERS_ARCHIVE_OUT_OF_RANGE"
          })

        {:error, message} when is_binary(message) ->
          conn
          |> put_status(400)
          |> json(%{error: message, code: "INVALID_DAILY_NUMBERS_SUBMISSION"})

        {:error, _reason} ->
          conn |> put_status(500) |> json(%{error: "Internal error"})
      end
    end)
  end

  def submit_daily_numbers_archive(conn, _params) do
    conn
    |> put_status(400)
    |> json(%{error: "mode, dateKey, and steps are required"})
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

  # GET /wordle/definition
  def wordle_definition(conn, params) do
    locale = Map.get(params, "locale")

    timed_action(conn, "wordle_definition", fn conn, user_id ->
      case Quests.wordle_definition(user_id, locale) do
        {:ok, payload} ->
          json(conn, payload)

        {:error, :invalid_wordle_locale} ->
          conn
          |> put_status(400)
          |> json(%{
            error: "Unsupported Wordle language",
            code: "INVALID_WORDLE_LANGUAGE"
          })

        {:error, :definition_not_found} ->
          conn
          |> put_status(404)
          |> json(%{
            error: "Definition not found for today's Wordle word",
            code: "WORDLE_DEFINITION_NOT_FOUND"
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

  # GET /quests/perfect-timing
  def perfect_timing_state(conn, _params) do
    timed_action(conn, "perfect_timing_state", fn conn, user_id ->
      render_perfect_timing_result(conn, Quests.perfect_timing_state(user_id))
    end)
  end

  # POST /quests/perfect-timing/start
  def start_perfect_timing(conn, %{"dateKey" => date_key, "questVersion" => quest_version}) do
    timed_action(conn, "start_perfect_timing", fn conn, user_id ->
      render_perfect_timing_result(
        conn,
        Quests.start_perfect_timing(user_id, date_key, quest_version)
      )
    end)
  end

  def start_perfect_timing(conn, _params) do
    conn |> put_status(400) |> json(%{error: "dateKey and questVersion are required"})
  end

  # POST /quests/perfect-timing/stop
  def stop_perfect_timing(
        conn,
        %{
          "attemptId" => attempt_id,
          "elapsedMs" => elapsed_ms,
          "stopReason" => stop_reason,
          "dateKey" => date_key,
          "questVersion" => quest_version
        }
      ) do
    case parse_int(elapsed_ms) do
      nil ->
        conn |> put_status(400) |> json(%{error: "elapsedMs must be an integer"})

      parsed_elapsed_ms ->
        timed_action(conn, "stop_perfect_timing", fn conn, user_id ->
          render_perfect_timing_result(
            conn,
            Quests.stop_perfect_timing(
              user_id,
              attempt_id,
              parsed_elapsed_ms,
              stop_reason,
              date_key,
              quest_version
            )
          )
        end)
    end
  end

  def stop_perfect_timing(conn, _params) do
    conn
    |> put_status(400)
    |> json(%{
      error: "attemptId, elapsedMs, stopReason, dateKey, and questVersion are required"
    })
  end

  # POST /quests/perfect-timing/continue
  def continue_perfect_timing(
        conn,
        %{"attemptId" => attempt_id, "dateKey" => date_key, "questVersion" => quest_version}
      ) do
    timed_action(conn, "continue_perfect_timing", fn conn, user_id ->
      render_perfect_timing_result(
        conn,
        Quests.continue_perfect_timing(user_id, attempt_id, date_key, quest_version)
      )
    end)
  end

  def continue_perfect_timing(conn, _params) do
    conn
    |> put_status(400)
    |> json(%{error: "attemptId, dateKey, and questVersion are required"})
  end

  # POST /quests/perfect-timing/keep
  def keep_perfect_timing(
        conn,
        %{"attemptId" => attempt_id, "dateKey" => date_key, "questVersion" => quest_version}
      ) do
    timed_action(conn, "keep_perfect_timing", fn conn, user_id ->
      render_perfect_timing_result(
        conn,
        Quests.keep_perfect_timing(user_id, attempt_id, date_key, quest_version)
      )
    end)
  end

  def keep_perfect_timing(conn, _params) do
    conn
    |> put_status(400)
    |> json(%{error: "attemptId, dateKey, and questVersion are required"})
  end

  # POST /quests/perfect-timing/training/target
  def perfect_timing_training_target(conn, _params) do
    timed_action(conn, "perfect_timing_training_target", fn conn, user_id ->
      {:ok, payload} = Quests.perfect_timing_training_target(user_id)
      json(conn, payload)
    end)
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

  # POST /quests/speed-calculus/training/start
  def start_speed_calculus_training(conn, _params) do
    timed_action(conn, "start_speed_calculus_training", fn conn, user_id ->
      {:ok, payload} = Quests.start_speed_calculus_training(user_id)
      json(conn, payload)
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
    quest_version = Map.get(conn.body_params, "questVersion")

    case parse_optional_int_list(Map.get(conn.body_params, "answers")) do
      {:ok, answers} ->
        timed_action(conn, "pause_speed_calculus", fn conn, user_id ->
          case Quests.pause_speed_calculus(user_id, answers, quest_version) do
            {:ok, payload} ->
              json(conn, payload)

            {:error, :speed_calculus_reset} ->
              conn
              |> put_status(409)
              |> json(%{
                error: "Speed Calculus was reset while you were playing",
                code: "SPEED_CALCULUS_RESET"
              })

            {:error, :run_not_active} ->
              conn
              |> put_status(400)
              |> json(%{error: "Run is not active", code: "RUN_NOT_ACTIVE"})

            {:error, :run_is_paused} ->
              conn |> put_status(400) |> json(%{error: "Run is paused", code: "RUN_IS_PAUSED"})

            {:error, :invalid_answers} ->
              conn
              |> put_status(400)
              |> json(%{error: "answers must be a list of integers", code: "INVALID_ANSWERS"})

            {:error, _reason} ->
              conn |> put_status(500) |> json(%{error: "Internal error"})
          end
        end)

      :error ->
        conn
        |> put_status(400)
        |> json(%{error: "answers must be a list of integers", code: "INVALID_ANSWERS"})
    end
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

    case parse_optional_int_list(Map.get(conn.body_params, "answers")) do
      {:ok, answers} ->
        timed_action(conn, "finish_speed_calculus", fn conn, user_id ->
          case Quests.finish_speed_calculus(user_id, run_id, quest_version, answers) do
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

            {:error, :invalid_answers} ->
              conn
              |> put_status(400)
              |> json(%{error: "answers must be a list of integers", code: "INVALID_ANSWERS"})

            {:error, _reason} ->
              conn |> put_status(500) |> json(%{error: "Internal error"})
          end
        end)

      :error ->
        conn
        |> put_status(400)
        |> json(%{error: "answers must be a list of integers", code: "INVALID_ANSWERS"})
    end
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

  defp render_perfect_timing_result(conn, {:ok, payload}), do: json(conn, payload)

  defp render_perfect_timing_result(conn, {:error, :perfect_timing_reset}) do
    conn
    |> put_status(409)
    |> json(%{
      error: "Perfect Timing reset while this attempt was open",
      code: "PERFECT_TIMING_RESET"
    })
  end

  defp render_perfect_timing_result(conn, {:error, :attempt_not_found}) do
    conn |> put_status(404) |> json(%{error: "Attempt not found", code: "ATTEMPT_NOT_FOUND"})
  end

  defp render_perfect_timing_result(conn, {:error, :attempts_exhausted}) do
    conn
    |> put_status(409)
    |> json(%{error: "No attempts remaining", code: "PERFECT_TIMING_ATTEMPTS_EXHAUSTED"})
  end

  defp render_perfect_timing_result(conn, {:error, :result_awaiting_decision}) do
    conn
    |> put_status(409)
    |> json(%{error: "Choose whether to continue or keep this result", code: "RESULT_PENDING"})
  end

  defp render_perfect_timing_result(conn, {:error, :cannot_keep_miss}) do
    conn
    |> put_status(400)
    |> json(%{error: "A missed result cannot be kept", code: "CANNOT_KEEP_MISS"})
  end

  defp render_perfect_timing_result(conn, {:error, :result_not_active}) do
    conn
    |> put_status(409)
    |> json(%{error: "This result is no longer active", code: "RESULT_NOT_ACTIVE"})
  end

  defp render_perfect_timing_result(conn, {:error, reason})
       when reason in [:invalid_elapsed_ms, :impossible_elapsed_ms, :invalid_stop_reason] do
    conn
    |> put_status(400)
    |> json(%{error: "Invalid attempt result", code: "INVALID_PERFECT_TIMING_RESULT"})
  end

  defp render_perfect_timing_result(conn, {:error, :quest_not_found}) do
    conn |> put_status(404) |> json(%{error: "Quest not found", code: "QUEST_NOT_FOUND"})
  end

  defp render_perfect_timing_result(conn, {:error, _reason}) do
    conn |> put_status(500) |> json(%{error: "Internal error"})
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

  defp parse_optional_int_list(nil), do: {:ok, nil}

  defp parse_optional_int_list(values) when is_list(values) do
    parsed = Enum.map(values, &parse_int/1)

    if Enum.all?(parsed, &is_integer/1) do
      {:ok, parsed}
    else
      :error
    end
  end

  defp parse_optional_int_list(_), do: :error
end
