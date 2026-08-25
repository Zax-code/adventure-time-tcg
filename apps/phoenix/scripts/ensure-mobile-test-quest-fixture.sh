#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
APP_DIR=$(cd -- "$SCRIPT_DIR/.." && pwd)

: "${MOBILE_TEST_EMAIL:=mobile-test@leaetzak.love}"

cd "$APP_DIR"

mix run -e '
import Ecto.Query

require Logger

alias AdventureTimeApi.Accounts.User
alias AdventureTimeApi.Quests
alias AdventureTimeApi.Quests.{
  DailyQuest,
  PerfectTiming,
  SpeedCalculusEngine,
  WordleDictionaryWord,
  WordleEngine
}
alias AdventureTimeApi.Repo

Logger.configure(level: :warning)

email =
  System.get_env("MOBILE_TEST_EMAIL", "mobile-test@leaetzak.love")
  |> String.trim()
  |> String.downcase()

timezone = System.get_env("MOBILE_TEST_TIMEZONE", "America/New_York")

user =
  Repo.get_by!(User, email: email)
  |> User.profile_changeset(%{timezone: timezone})
  |> Repo.update!()

date = Quests.current_reset_date_for_user(user.id)

{:ok, _reset} = Quests.admin_reset_daily_quests(user.id)

candidates =
  WordleDictionaryWord
  |> where([word], word.locale == "en" and word.is_solution_candidate == true)
  |> order_by([word], asc: word.word)
  |> select([word], word.word)
  |> Repo.all()

target = WordleEngine.select_word_for_date(candidates, date)

case Quests.submit_wordle_guess(
       user.id,
       target,
       "en",
       Date.to_iso8601(date),
       nil
     ) do
  {:ok, %{solved: true}} -> :ok
  other -> raise "failed to prepare solved Wordle fixture: #{inspect(other)}"
end

perfect_timing_quest =
  Repo.get_by!(DailyQuest,
    user_id: user.id,
    date: date,
    quest_type: PerfectTiming.quest_type()
  )

started_at = DateTime.utc_now()

{:ok, perfect_timing_started} =
  PerfectTiming.start(
    user.id,
    date,
    timezone,
    Date.to_iso8601(date),
    perfect_timing_quest.id,
    started_at
  )

stopped_at =
  DateTime.add(started_at, perfect_timing_started.targetMs, :millisecond)

{:ok, perfect_timing_result} =
  PerfectTiming.stop(
    user.id,
    date,
    timezone,
    perfect_timing_started.activeAttempt.id,
    perfect_timing_started.targetMs,
    "manual",
    Date.to_iso8601(date),
    perfect_timing_quest.id,
    stopped_at
  )

{:ok, perfect_timing_final} =
  PerfectTiming.keep_result(
    user.id,
    date,
    timezone,
    perfect_timing_result.currentResult.id,
    Date.to_iso8601(date),
    perfect_timing_quest.id,
    stopped_at
  )

unless perfect_timing_final.finalized do
  raise "quest fixture did not produce a finalized Perfect Timing result"
end

for {answer_count, wrong_indexes} <- [{4, [1]}, {5, [0, 4]}] do
  {:ok, speed_started} = Quests.start_speed_calculus_run(user.id)

  answers =
    speed_started.activeRun.seed
    |> SpeedCalculusEngine.build_questions(answer_count)
    |> Enum.with_index()
    |> Enum.map(fn {question, index} ->
      if index in wrong_indexes, do: question.answer + 1, else: question.answer
    end)

  {:ok, _speed_finished} =
    Quests.finish_speed_calculus(
      user.id,
      speed_started.activeRun.runId,
      speed_started.questVersion,
      answers
    )
end

{:ok, speed_state} = Quests.speed_calculus_state(user.id)

unless speed_state.runsUsed == 2 and length(speed_state.history) == 2 do
  raise "quest fixture did not produce two shareable Speed Calculus runs"
end

{:ok, %{quests: quests}} = Quests.list_quests_for_user(user.id)

unless Enum.any?(quests, fn quest ->
         quest.type == "wordle_daily_en" and quest.completed and not quest.claimed
       end) do
  raise "quest fixture did not produce a claimable English Wordle"
end

unless Enum.any?(quests, fn quest ->
         quest.type == PerfectTiming.quest_type() and quest.claimed
       end) do
  raise "quest fixture did not produce a shareable Perfect Timing result"
end

IO.puts("quest fixture ready")
'
