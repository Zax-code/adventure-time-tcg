defmodule AdventureTimeApiWeb.SocialControllerTest do
  use AdventureTimeApiWeb.ConnCase, async: true

  alias AdventureTimeApi.Accounts.{EmailCredential, User}
  alias AdventureTimeApi.Catalog.{Card, Rarity}
  alias AdventureTimeApi.Inventory.OwnedCard
  alias AdventureTimeApi.Repo
  alias AdventureTimeApi.Social.CardGift

  test "GET /users excludes the current user", _context do
    current_user = create_user_with_password("current@example.com", "password123")
    other_user = create_user_with_password("other@example.com", "password123")
    access_token = login_access_token(current_user.email, "password123")

    response = access_token |> auth_conn() |> get(~p"/users") |> json_response(200)

    assert response == %{
             "users" => [
               %{
                 "id" => other_user.id,
                 "email" => other_user.email,
                 "displayName" => "Tester"
               }
             ]
           }
  end

  test "gift endpoints preserve mobile contract", _context do
    sender = create_user_with_password("sender-http@example.com", "password123")
    recipient = create_user_with_password("recipient-http@example.com", "password123")
    third_party = create_user_with_password("third@example.com", "password123")
    sender_token = login_access_token(sender.email, "password123")
    recipient_token = login_access_token(recipient.email, "password123")
    third_token = login_access_token(third_party.email, "password123")

    rarity =
      Repo.insert!(
        Rarity.changeset(%Rarity{}, %{name: "Common", drop_rate: 60.0, color: "#9CA3AF"})
      )

    card =
      Repo.insert!(
        Card.changeset(%Card{}, %{
          name: "Jake",
          character: "Jake",
          description: "Stretchy hero.",
          hp: 16,
          attack: 7,
          defense: 6,
          speed: 48,
          type: "Hero",
          rarity_id: rarity.id
        })
      )

    Repo.insert!(
      OwnedCard.changeset(%OwnedCard{}, %{
        quantity: 2,
        obtained_at: DateTime.utc_now() |> DateTime.truncate(:second)
      })
      |> Ecto.Changeset.put_change(:user_id, sender.id)
      |> Ecto.Changeset.put_change(:card_id, card.id)
    )

    send_response =
      sender_token
      |> auth_conn()
      |> post(~p"/gifts", %{
        "cardId" => card.id,
        "toUserId" => recipient.id,
        "quantity" => 1,
        "message" => "enjoy"
      })
      |> json_response(200)

    gift_id = get_in(send_response, ["gift", "id"])
    assert is_binary(gift_id)

    gifts_response = recipient_token |> auth_conn() |> get(~p"/gifts") |> json_response(200)
    assert gifts_response["pendingCount"] == 1
    assert [%{"id" => ^gift_id, "status" => "pending"}] = gifts_response["gifts"]

    forbidden =
      third_token
      |> auth_conn()
      |> patch(~p"/gifts", %{"giftId" => gift_id, "action" => "accept"})
      |> json_response(403)

    assert forbidden["error"] == "This gift is not for you"

    accepted =
      recipient_token
      |> auth_conn()
      |> patch(~p"/gifts", %{"giftId" => gift_id, "action" => "accept"})
      |> json_response(200)

    assert accepted == %{"success" => true, "status" => "accepted"}

    repeated =
      recipient_token
      |> auth_conn()
      |> patch(~p"/gifts", %{"giftId" => gift_id, "action" => "reject"})
      |> json_response(400)

    assert repeated["error"] == "This gift has already been processed"
  end

  test "POST /gifts preserves validation errors", _context do
    sender = create_user_with_password("gift-errors@example.com", "password123")
    recipient = create_user_with_password("gift-errors-recipient@example.com", "password123")
    sender_token = login_access_token(sender.email, "password123")

    self_error =
      sender_token
      |> auth_conn()
      |> post(~p"/gifts", %{
        "cardId" => Ecto.UUID.generate(),
        "toUserId" => sender.id,
        "quantity" => 1
      })
      |> json_response(400)

    assert self_error["error"] == "Cannot send a gift to yourself"

    missing_recipient =
      sender_token
      |> auth_conn()
      |> post(~p"/gifts", %{
        "cardId" => Ecto.UUID.generate(),
        "toUserId" => Ecto.UUID.generate(),
        "quantity" => 1
      })
      |> json_response(404)

    assert missing_recipient["error"] == "Recipient not found"

    rarity =
      Repo.insert!(
        Rarity.changeset(%Rarity{}, %{name: "Rare", drop_rate: 10.0, color: "#3B82F6"})
      )

    card =
      Repo.insert!(
        Card.changeset(%Card{}, %{
          name: "Marceline",
          character: "Marceline",
          description: "Vampire rocker.",
          hp: 15,
          attack: 9,
          defense: 4,
          speed: 58,
          type: "Undead",
          rarity_id: rarity.id
        })
      )

    not_owned =
      sender_token
      |> auth_conn()
      |> post(~p"/gifts", %{"cardId" => card.id, "toUserId" => recipient.id, "quantity" => 1})
      |> json_response(400)

    assert not_owned["error"] == "You do not own enough of this card to gift"

    Repo.insert!(
      OwnedCard.changeset(%OwnedCard{}, %{
        quantity: 1,
        obtained_at: DateTime.utc_now() |> DateTime.truncate(:second)
      })
      |> Ecto.Changeset.put_change(:user_id, sender.id)
      |> Ecto.Changeset.put_change(:card_id, card.id)
    )

    too_many =
      sender_token
      |> auth_conn()
      |> post(~p"/gifts", %{"cardId" => card.id, "toUserId" => recipient.id, "quantity" => 2})
      |> json_response(400)

    assert too_many["error"] == "You do not own enough of this card to gift"

    missing_gift =
      sender_token
      |> auth_conn()
      |> patch(~p"/gifts", %{"giftId" => Ecto.UUID.generate(), "action" => "accept"})
      |> json_response(404)

    assert missing_gift["error"] == "Gift not found"
  end

  defp create_user_with_password(email, password) do
    user =
      Repo.insert!(
        User.registration_changeset(%User{}, %{email: email, display_name: "Tester"})
        |> User.access_changeset(%{role: :user, access_status: :approved})
      )

    Repo.insert!(
      EmailCredential.changeset(%EmailCredential{}, %{
        password_hash: Bcrypt.hash_pwd_salt(password),
        email_verified_at: DateTime.utc_now() |> DateTime.truncate(:second)
      })
      |> Ecto.Changeset.put_change(:user_id, user.id)
    )

    user
  end

  defp login_access_token(email, password) do
    build_conn()
    |> post(~p"/auth/login", %{email: email, password: password})
    |> json_response(200)
    |> get_in(["tokens", "accessToken"])
  end

  defp auth_conn(access_token) do
    build_conn()
    |> put_req_header("authorization", "Bearer #{access_token}")
  end
end
