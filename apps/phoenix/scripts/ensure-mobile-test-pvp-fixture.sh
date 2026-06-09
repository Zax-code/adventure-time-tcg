#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
APP_DIR=$(cd -- "$SCRIPT_DIR/.." && pwd)
REPO_ROOT=$(cd -- "$APP_DIR/../.." && pwd)
source "$REPO_ROOT/scripts/resolve-mobile-test-password.sh"

: "${MOBILE_TEST_EMAIL:=mobile-test@leaetzak.love}"
: "${MOBILE_TEST_DISPLAY_NAME:=Mobile Test User}"
: "${MOBILE_TEST_OPPONENT_EMAIL:=mobile-opponent@leaetzak.love}"
: "${MOBILE_TEST_OPPONENT_DISPLAY_NAME:=Mobile PvP Opponent}"
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

require Logger

alias AdventureTimeApi.Accounts.{EmailCredential, User}
alias AdventureTimeApi.Catalog.{Card, Rarity}
alias AdventureTimeApi.Inventory.OwnedCard
alias AdventureTimeApi.Pvp.{Loadout, Match}
alias AdventureTimeApi.Pvp
alias AdventureTimeApi.Repo

Logger.configure(level: :warning)

password = System.fetch_env!("MOBILE_TEST_PASSWORD")
primary_email =
  System.get_env("MOBILE_TEST_EMAIL", "mobile-test@leaetzak.love")
  |> String.trim()
  |> String.downcase()

primary_display_name =
  System.get_env("MOBILE_TEST_DISPLAY_NAME", "Mobile Test User")

opponent_email =
  System.get_env("MOBILE_TEST_OPPONENT_EMAIL", "mobile-opponent@leaetzak.love")
  |> String.trim()
  |> String.downcase()

opponent_display_name =
  System.get_env("MOBILE_TEST_OPPONENT_DISPLAY_NAME", "Mobile PvP Opponent")

min_coins =
  System.get_env("MOBILE_TEST_MIN_COINS", "100")
  |> String.trim()
  |> String.to_integer()

now = DateTime.utc_now() |> DateTime.truncate(:second)

ensure_user = fn email, display_name ->
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

  user
end

primary_user = ensure_user.(primary_email, primary_display_name)
opponent_user = ensure_user.(opponent_email, opponent_display_name)

rarity_id =
  case Repo.get_by(Rarity, name: "Common") do
    %Rarity{id: id} -> id
    nil ->
      case Repo.one(from(r in Rarity, order_by: [asc: r.inserted_at], limit: 1)) do
        %Rarity{id: id} ->
          id

        nil ->
          Repo.insert!(
            Rarity.changeset(%Rarity{}, %{
              name: "Common",
              drop_rate: 1.0,
              color: "#94A3B8"
            })
          ).id
      end
  end

ensure_card = fn name, character, description, hp, attack, defense, speed ->
  attrs = %{
    name: name,
    character: character,
    description: description,
    hp: hp,
    attack: attack,
    defense: defense,
    speed: speed,
    type: "Hero",
    rarity_id: rarity_id,
    is_archived: false
  }

  case Repo.get_by(Card, name: name) do
    nil ->
      Repo.insert!(Card.changeset(%Card{}, attrs))

    %Card{} = card ->
      card
      |> Card.changeset(attrs)
      |> Repo.update!()
  end
end

primary_cards =
  [
    {"E2E Finn Vanguard", "Finn", "Fast frontline striker for PvP E2E validation.", 32, 10, 5, 95},
    {"E2E Jake Shield", "Jake", "Balanced defender for PvP E2E validation.", 34, 8, 8, 88},
    {"E2E Marceline Tempo", "Marceline", "Fast attacker for PvP E2E validation.", 28, 11, 4, 90},
    {"E2E Princess Bubblegum Tactics", "Princess Bubblegum", "Bench support for PvP E2E validation.", 27, 9, 6, 84},
    {"E2E BMO Focus", "BMO", "Bench specialist for PvP E2E validation.", 25, 8, 7, 82},
    {"E2E Lady Rainicorn Spark", "Lady Rainicorn", "Flex slot for PvP E2E validation.", 29, 9, 6, 86}
  ]
  |> Enum.map(fn {name, character, description, hp, attack, defense, speed} ->
    ensure_card.(name, character, description, hp, attack, defense, speed)
  end)

opponent_cards =
  [
    {"E2E Ice King Slowstorm", "Ice King", "Slower opposing lead for PvP E2E validation.", 33, 9, 7, 36},
    {"E2E Gunter Wobble", "Gunter", "Slow opposing bruiser for PvP E2E validation.", 30, 9, 6, 34},
    {"E2E Lich Drag", "Lich", "Slow opposing caster for PvP E2E validation.", 31, 10, 5, 32},
    {"E2E Peppermint Butler Plot", "Peppermint Butler", "Slow opposing bench card for PvP E2E validation.", 27, 8, 6, 30},
    {"E2E Flame Princess Ember", "Flame Princess", "Slow opposing bench threat for PvP E2E validation.", 28, 10, 4, 28},
    {"E2E Lemongrab Shriek", "Lemongrab", "Slow opposing flex slot for PvP E2E validation.", 29, 8, 6, 26}
  ]
  |> Enum.map(fn {name, character, description, hp, attack, defense, speed} ->
    ensure_card.(name, character, description, hp, attack, defense, speed)
  end)

ensure_owned_card = fn user_id, card_id ->
  case Repo.get_by(OwnedCard, user_id: user_id, card_id: card_id) do
    nil ->
      %OwnedCard{}
      |> OwnedCard.changeset(%{quantity: 1, obtained_at: now})
      |> Ecto.Changeset.put_change(:user_id, user_id)
      |> Ecto.Changeset.put_change(:card_id, card_id)
      |> Repo.insert!()

    %OwnedCard{} = owned_card ->
      owned_card
      |> Ecto.Changeset.change(quantity: max(owned_card.quantity || 0, 1), obtained_at: now)
      |> Repo.update!()
  end
end

Enum.each(primary_cards, fn card -> ensure_owned_card.(primary_user.id, card.id) end)
Enum.each(opponent_cards, fn card -> ensure_owned_card.(opponent_user.id, card.id) end)

primary_card_ids = Enum.map(primary_cards, & &1.id)
opponent_card_ids = Enum.map(opponent_cards, & &1.id)

ensure_loadout = fn user_id, name, card_ids ->
  case Repo.get_by(Loadout, owner_id: user_id, name: name) do
    nil ->
      Repo.insert!(
        Loadout.changeset(%Loadout{}, %{owner_id: user_id, name: name, card_ids: card_ids})
      )

    %Loadout{} = loadout ->
      loadout
      |> Loadout.changeset(%{owner_id: user_id, name: name, card_ids: card_ids})
      |> Repo.update!()
  end
end

ensure_loadout.(primary_user.id, "E2E PvP Fast Loadout", primary_card_ids)
ensure_loadout.(opponent_user.id, "E2E PvP Slow Loadout", opponent_card_ids)

from(match in Match,
  where:
    (match.inviter_id == ^primary_user.id and match.invitee_id == ^opponent_user.id) or
      (match.inviter_id == ^opponent_user.id and match.invitee_id == ^primary_user.id)
)
|> Repo.delete_all()

{:ok, %{success: true}} = Pvp.create_invite(primary_user.id, opponent_user.email, primary_card_ids)

match =
  Repo.one!(
    from(match in Match,
      where:
        match.inviter_id == ^primary_user.id and match.invitee_id == ^opponent_user.id and
          match.status == "pending",
      order_by: [desc: match.inserted_at],
      limit: 1
    )
  )

{:ok, %{match: accepted_match, battleState: battle_state}} =
  Pvp.accept_match(opponent_user.id, match.id, opponent_card_ids)

if battle_state["currentPlayerId"] != primary_user.id do
  raise "Expected primary E2E user to act first, got #{inspect(battle_state["currentPlayerId"])}"
end

IO.puts(accepted_match.id)
'
