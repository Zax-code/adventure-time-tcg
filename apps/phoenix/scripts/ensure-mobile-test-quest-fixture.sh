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
alias AdventureTimeApi.Quests.{WordleDictionaryWord, WordleEngine}
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

{:ok, %{quests: quests}} = Quests.list_quests_for_user(user.id)

unless Enum.any?(quests, fn quest ->
         quest.type == "wordle_daily_en" and quest.completed and not quest.claimed
       end) do
  raise "quest fixture did not produce a claimable English Wordle"
end

IO.puts("quest fixture ready")
'
