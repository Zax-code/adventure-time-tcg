#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
APP_DIR=$(cd -- "$SCRIPT_DIR/.." && pwd)
REPO_ROOT=$(cd -- "$APP_DIR/../.." && pwd)
source "$REPO_ROOT/scripts/resolve-mobile-test-password.sh"

: "${MOBILE_TEST_EMAIL:=mobile-test@leaetzak.love}"
: "${MOBILE_TEST_DISPLAY_NAME:=Mobile Test User}"
: "${MOBILE_TEST_MIN_COINS:=100}"

if [[ -z "${MOBILE_TEST_PASSWORD:-}" ]]; then
  if ! MOBILE_TEST_PASSWORD="$(resolve_mobile_test_password "$MOBILE_TEST_EMAIL")"; then
    print_mobile_test_password_help "$MOBILE_TEST_EMAIL"
    exit 1
  fi
  export MOBILE_TEST_PASSWORD
fi

cd "$APP_DIR"

mix run -e '
import Ecto.Query

alias AdventureTimeApi.Accounts.{EmailCredential, User}
alias AdventureTimeApi.Catalog.Card
alias AdventureTimeApi.Inventory.OwnedCard
alias AdventureTimeApi.Repo

email = System.get_env("MOBILE_TEST_EMAIL", "mobile-test@leaetzak.love") |> String.trim() |> String.downcase()
display_name = System.get_env("MOBILE_TEST_DISPLAY_NAME", "Mobile Test User")
password = System.fetch_env!("MOBILE_TEST_PASSWORD")
min_coins =
  System.get_env("MOBILE_TEST_MIN_COINS", "100")
  |> String.trim()
  |> String.to_integer()

now = DateTime.utc_now() |> DateTime.truncate(:second)

user =
  case Repo.get_by(User, email: email) do
    nil ->
      Repo.insert!(
        User.registration_changeset(%User{}, %{email: email, display_name: display_name, coins: min_coins})
        |> Ecto.Changeset.change(coins: min_coins)
        |> User.access_changeset(%{role: :user, access_status: :approved})
      )

    %User{} = existing_user ->
      Repo.update!(
        existing_user
        |> User.registration_changeset(%{email: email, display_name: display_name})
        |> Ecto.Changeset.change(coins: max(existing_user.coins || 0, min_coins))
        |> User.access_changeset(%{role: existing_user.role, access_status: :approved})
      )
  end

case Repo.get_by(EmailCredential, user_id: user.id) do
  nil ->
    %EmailCredential{}
    |> EmailCredential.changeset(%{
      password_hash: Bcrypt.hash_pwd_salt(password),
      email_verified_at: now
    })
    |> Ecto.Changeset.put_change(:user_id, user.id)
    |> Repo.insert!()

  %EmailCredential{} = credential ->
    credential
    |> Ecto.Changeset.change(
      password_hash: Bcrypt.hash_pwd_salt(password),
      email_verified_at: now
    )
    |> Repo.update!()
end

card_ids =
  Card
  |> where([c], c.is_archived == false)
  |> Repo.all()
  |> Enum.map(& &1.id)

existing_owned_ids =
  OwnedCard
  |> where([oc], oc.user_id == ^user.id)
  |> Repo.all()
  |> Map.new(&{&1.card_id, &1})

Enum.each(card_ids, fn card_id ->
  case Map.get(existing_owned_ids, card_id) do
    nil ->
      %OwnedCard{}
      |> OwnedCard.changeset(%{quantity: 1, obtained_at: now})
      |> Ecto.Changeset.put_change(:user_id, user.id)
      |> Ecto.Changeset.put_change(:card_id, card_id)
      |> Repo.insert!()

    %OwnedCard{} = owned_card when owned_card.quantity > 0 ->
      :ok

    %OwnedCard{} = owned_card ->
      owned_card
      |> Ecto.Changeset.change(quantity: 1, obtained_at: now)
      |> Repo.update!()
  end
end)

IO.puts("ready #{email} cards=#{length(card_ids)} min_coins=#{min_coins}")
'
