defmodule AdventureTimeApi.SocialTest do
  use AdventureTimeApi.DataCase, async: true

  alias AdventureTimeApi.Accounts.{EmailCredential, User}
  alias AdventureTimeApi.Catalog.{Card, Rarity}
  alias AdventureTimeApi.Inventory.OwnedCard
  alias AdventureTimeApi.Repo
  alias AdventureTimeApi.Social
  alias AdventureTimeApi.Social.CardGift
  alias AdventureTimeApi.Workers.ExpirePendingGiftWorker

  test "send_gift moves inventory into a pending gift" do
    sender = create_user_with_password("sender@example.com", "password123")
    recipient = create_user_with_password("recipient@example.com", "password123")
    rarity = create_rarity("Common")
    card = create_card("Finn", rarity.id)

    insert_owned_card(sender.id, card.id, 2)

    assert {:ok, %{gift: %{id: gift_id}}} =
             Social.send_gift(
               %{
                 "cardId" => card.id,
                 "toUserId" => recipient.id,
                 "quantity" => 1,
                 "message" => "For you"
               },
               %{id: sender.id}
             )

    assert Repo.get!(CardGift, gift_id).status == :pending
    assert Repo.get_by!(OwnedCard, user_id: sender.id, card_id: card.id).quantity == 1
  end

  test "process_gift accept and reject update inventories correctly" do
    sender = create_user_with_password("gift-sender@example.com", "password123")
    recipient = create_user_with_password("gift-recipient@example.com", "password123")
    rarity = create_rarity("Rare")
    card = create_card("Marceline", rarity.id)

    accepted = create_pending_gift(sender.id, recipient.id, card.id, 1)
    rejected = create_pending_gift(sender.id, recipient.id, card.id, 2)

    assert {:ok, %{success: true, status: "accepted"}} =
             Social.process_gift(%{"giftId" => accepted.id, "action" => "accept"}, %{
               id: recipient.id
             })

    assert Repo.get!(CardGift, accepted.id).status == :accepted
    assert Repo.get_by!(OwnedCard, user_id: recipient.id, card_id: card.id).quantity == 1

    assert {:ok, %{success: true, status: "rejected"}} =
             Social.process_gift(%{"giftId" => rejected.id, "action" => "reject"}, %{
               id: recipient.id
             })

    assert Repo.get!(CardGift, rejected.id).status == :rejected
    assert Repo.get_by!(OwnedCard, user_id: sender.id, card_id: card.id).quantity == 2
  end

  test "expired pending gift restores sender inventory and blocks processing" do
    sender = create_user_with_password("expired-sender@example.com", "password123")
    recipient = create_user_with_password("expired-recipient@example.com", "password123")
    rarity = create_rarity("Epic")
    card = create_card("BMO", rarity.id)

    insert_owned_card(sender.id, card.id, 1)

    assert {:ok, %{gift: %{id: gift_id}}} =
             Social.send_gift(
               %{
                 "cardId" => card.id,
                 "toUserId" => recipient.id,
                 "quantity" => 1,
                 "message" => "Will expire"
               },
               %{id: sender.id}
             )

    gift =
      CardGift
      |> Repo.get!(gift_id)
      |> Ecto.Changeset.change(
        expires_at: DateTime.add(DateTime.utc_now() |> DateTime.truncate(:second), -60, :second)
      )
      |> Repo.update!()

    assert Repo.get_by(OwnedCard, user_id: sender.id, card_id: card.id) == nil

    assert :ok = ExpirePendingGiftWorker.perform(%Oban.Job{args: %{"gift_id" => gift.id}})

    assert Repo.get!(CardGift, gift.id).status == :expired
    assert Repo.get_by!(OwnedCard, user_id: sender.id, card_id: card.id).quantity == 1

    assert {:error, :bad_request, "This gift has expired"} =
             Social.process_gift(%{"giftId" => gift.id, "action" => "accept"}, %{id: recipient.id})

    assert {:ok, %{gifts: gifts, pendingCount: 0}} = Social.gifts_for_user(%{id: recipient.id})
    assert Enum.any?(gifts, &(&1.status == "expired" and &1.id == gift.id))
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

  defp create_rarity(name) do
    Repo.insert!(Rarity.changeset(%Rarity{}, %{name: name, drop_rate: 10.0, color: "#3B82F6"}))
  end

  defp create_card(name, rarity_id) do
    Repo.insert!(
      Card.changeset(%Card{}, %{
        name: name,
        character: name,
        description: "#{name} description.",
        hp: 15,
        attack: 7,
        defense: 5,
        speed: 50,
        type: "Hero",
        rarity_id: rarity_id
      })
    )
  end

  defp insert_owned_card(user_id, card_id, quantity) do
    Repo.insert!(
      OwnedCard.changeset(%OwnedCard{}, %{
        quantity: quantity,
        obtained_at: DateTime.utc_now() |> DateTime.truncate(:second)
      })
      |> Ecto.Changeset.put_change(:user_id, user_id)
      |> Ecto.Changeset.put_change(:card_id, card_id)
    )
  end

  defp create_pending_gift(from_user_id, to_user_id, card_id, quantity) do
    Repo.insert!(
      CardGift.changeset(%CardGift{}, %{
        quantity: quantity,
        status: :pending,
        expires_at:
          DateTime.add(
            DateTime.utc_now() |> DateTime.truncate(:second),
            7 * 24 * 60 * 60,
            :second
          )
      })
      |> Ecto.Changeset.put_change(:from_user_id, from_user_id)
      |> Ecto.Changeset.put_change(:to_user_id, to_user_id)
      |> Ecto.Changeset.put_change(:card_id, card_id)
    )
  end
end
