defmodule AdventureTimeApi.Social do
  @moduledoc """
  Social boundary for gifting and lightweight user discovery.
  """

  import Ecto.Query

  alias AdventureTimeApi.Accounts.User
  alias AdventureTimeApi.Catalog.Card
  alias AdventureTimeApi.Inventory.OwnedCard
  alias AdventureTimeApi.Notifications
  alias AdventureTimeApi.Repo
  alias AdventureTimeApi.Social.CardGift
  alias AdventureTimeApi.Workers.ExpirePendingGiftWorker

  def list_giftable_users(%{id: user_id}) do
    users =
      User
      |> where([user], user.id != ^user_id and user.access_status == :approved)
      |> order_by([user], asc: user.email)
      |> Repo.all()
      |> Enum.map(&to_user_summary/1)

    {:ok, %{users: users}}
  end

  def gifts_for_user(%{id: user_id}) do
    settle_expired_gifts_for_user(user_id)

    gifts =
      CardGift
      |> where([gift], gift.to_user_id == ^user_id or gift.from_user_id == ^user_id)
      |> preload([:from_user, :to_user, card: [:rarity]])
      |> order_by([gift], desc: gift.inserted_at)
      |> Repo.all()

    {:ok,
     %{
       gifts: Enum.map(gifts, &to_gift_payload/1),
       pendingCount: Enum.count(gifts, &(&1.to_user_id == user_id and &1.status == :pending))
     }}
  end

  def send_gift(attrs, %{id: from_user_id}) do
    to_user_id = attrs["toUserId"]
    card_id = attrs["cardId"]
    quantity = attrs["quantity"] || 1
    expires_at = gift_expires_at()

    with :ok <- validate_recipient(from_user_id, to_user_id),
         {:ok, quantity} <- validate_quantity(quantity),
         {:ok, to_user} <- fetch_user(to_user_id, "Recipient not found"),
         {:ok, card} <- fetch_card(card_id),
         {:ok, owned_card} <- fetch_owned_card(from_user_id, card_id, quantity) do
      result =
        Repo.transaction(fn ->
          update_owned_card_quantity!(owned_card, -quantity)

          %CardGift{}
          |> CardGift.changeset(%{
            quantity: quantity,
            message: attrs["message"],
            status: :pending,
            expires_at: expires_at
          })
          |> Ecto.Changeset.put_change(:card_id, card.id)
          |> Ecto.Changeset.put_change(:from_user_id, from_user_id)
          |> Ecto.Changeset.put_change(:to_user_id, to_user.id)
          |> Repo.insert!()
          |> tap(&schedule_gift_expiry!/1)
        end)

      case result do
        {:ok, %CardGift{id: id}} ->
          dispatch_notification(fn ->
            sender_name = sender_display_name(from_user_id)
            _ = Notifications.send_gift_received(to_user.id, sender_name)
          end)

          {:ok, %{gift: %{id: id}}}

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  def process_gift(attrs, %{id: user_id}) do
    gift_id = attrs["giftId"]

    settle_expired_gifts_for_user(user_id)

    with {:ok, action} <- parse_action(attrs["action"]),
         {:ok, gift} <- fetch_gift(gift_id),
         :ok <- authorize_gift_recipient(gift, user_id),
         :ok <- ensure_gift_pending(gift) do
      Repo.transaction(fn ->
        case action do
          :accept -> accept_gift!(gift)
          :reject -> reject_gift!(gift)
        end
      end)

      {:ok, %{success: true, status: Atom.to_string(action_to_status(action))}}
    end
  end

  defp validate_recipient(from_user_id, to_user_id) when from_user_id == to_user_id,
    do: {:error, :bad_request, "Cannot send a gift to yourself"}

  defp validate_recipient(_from_user_id, to_user_id)
       when is_binary(to_user_id) and to_user_id != "", do: :ok

  defp validate_recipient(_, _), do: {:error, :bad_request, "Recipient not found"}

  defp validate_quantity(quantity) when is_integer(quantity) and quantity > 0, do: {:ok, quantity}

  defp validate_quantity(quantity) when is_binary(quantity) do
    case Integer.parse(quantity) do
      {parsed, ""} when parsed > 0 -> {:ok, parsed}
      _ -> {:error, :bad_request, "quantity must be a positive integer"}
    end
  end

  defp validate_quantity(_), do: {:error, :bad_request, "quantity must be a positive integer"}

  defp fetch_user(user_id, not_found_message) do
    case Repo.get(User, user_id) do
      %User{} = user -> {:ok, user}
      nil -> {:error, :not_found, not_found_message}
    end
  end

  defp fetch_card(card_id) do
    case Card |> Repo.get(card_id) do
      %Card{} = card -> {:ok, card}
      nil -> {:error, :not_found, "Card not found"}
    end
  end

  defp fetch_owned_card(user_id, card_id, quantity) do
    query =
      OwnedCard
      |> where([owned_card], owned_card.user_id == ^user_id and owned_card.card_id == ^card_id)
      |> lock("FOR UPDATE")

    case Repo.one(query) do
      %OwnedCard{quantity: owned_quantity} = owned_card when owned_quantity >= quantity ->
        {:ok, owned_card}

      _ ->
        {:error, :bad_request, "You do not own enough of this card to gift"}
    end
  end

  defp fetch_gift(gift_id) do
    case Repo.get(CardGift, gift_id) do
      %CardGift{} = gift -> {:ok, gift}
      nil -> {:error, :not_found, "Gift not found"}
    end
  end

  defp authorize_gift_recipient(%CardGift{to_user_id: user_id}, user_id), do: :ok
  defp authorize_gift_recipient(_, _), do: {:error, :forbidden, "This gift is not for you"}

  defp ensure_gift_pending(%CardGift{status: :pending}), do: :ok

  defp ensure_gift_pending(%CardGift{status: :expired}),
    do: {:error, :bad_request, "This gift has expired"}

  defp ensure_gift_pending(_gift),
    do: {:error, :bad_request, "This gift has already been processed"}

  def expire_gift(gift_id) do
    Repo.transaction(fn ->
      query = from(gift in CardGift, where: gift.id == ^gift_id, lock: "FOR UPDATE")

      case Repo.one(query) do
        nil ->
          Repo.rollback(:not_found)

        %CardGift{} = gift ->
          cond do
            gift.status != :pending ->
              :noop

            not gift_expired?(gift) ->
              :noop

            true ->
              add_owned_card_quantity!(gift.from_user_id, gift.card_id, gift.quantity)
              update_gift_status!(gift, :expired)
              :expired
          end
      end
    end)
    |> case do
      {:ok, result} -> {:ok, result}
      {:error, :not_found} -> {:error, :not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  defp parse_action("accept"), do: {:ok, :accept}
  defp parse_action("reject"), do: {:ok, :reject}
  defp parse_action(_), do: {:error, :bad_request, "action must be accept or reject"}

  defp accept_gift!(gift) do
    add_owned_card_quantity!(gift.to_user_id, gift.card_id, gift.quantity)
    update_gift_status!(gift, :accepted)
  end

  defp reject_gift!(gift) do
    add_owned_card_quantity!(gift.from_user_id, gift.card_id, gift.quantity)
    update_gift_status!(gift, :rejected)
  end

  defp action_to_status(:accept), do: :accepted
  defp action_to_status(:reject), do: :rejected

  defp update_gift_status!(gift, status) do
    gift
    |> Ecto.Changeset.change(status: status)
    |> Repo.update!()
  end

  defp settle_expired_gifts_for_user(user_id) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    CardGift
    |> where(
      [gift],
      (gift.to_user_id == ^user_id or gift.from_user_id == ^user_id) and gift.status == :pending and
        not is_nil(gift.expires_at) and gift.expires_at <= ^now
    )
    |> select([gift], gift.id)
    |> Repo.all()
    |> Enum.each(fn gift_id ->
      _ = expire_gift(gift_id)
    end)
  end

  defp gift_expires_at do
    days =
      Application.get_env(:adventure_time_api, __MODULE__, []) |> Keyword.get(:gift_ttl_days, 7)

    DateTime.add(DateTime.utc_now() |> DateTime.truncate(:second), days * 24 * 60 * 60, :second)
  end

  defp dispatch_notification(fun) when is_function(fun, 0) do
    if sandbox_repo?() do
      fun.()
      :ok
    else
      Task.start(fun)
      :ok
    end
  end

  defp sandbox_repo? do
    Application.get_env(:adventure_time_api, AdventureTimeApi.Repo, [])
    |> Keyword.get(:pool) == Ecto.Adapters.SQL.Sandbox
  end

  defp sender_display_name(user_id) do
    case Repo.get(User, user_id) do
      %User{} = user -> user.display_name || user.email
      nil -> "Someone"
    end
  end

  defp gift_expired?(%CardGift{expires_at: %DateTime{} = expires_at}) do
    DateTime.compare(expires_at, DateTime.utc_now() |> DateTime.truncate(:second)) != :gt
  end

  defp gift_expired?(_gift), do: false

  defp schedule_gift_expiry!(%CardGift{id: gift_id, expires_at: expires_at})
       when not is_nil(expires_at) do
    %{"gift_id" => gift_id}
    |> ExpirePendingGiftWorker.new(scheduled_at: expires_at)
    |> Oban.insert!()
  end

  defp schedule_gift_expiry!(_gift), do: :ok

  defp add_owned_card_quantity!(user_id, card_id, quantity) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    query =
      OwnedCard
      |> where([owned_card], owned_card.user_id == ^user_id and owned_card.card_id == ^card_id)
      |> lock("FOR UPDATE")

    case Repo.one(query) do
      nil ->
        %OwnedCard{}
        |> OwnedCard.changeset(%{quantity: quantity, obtained_at: now})
        |> Ecto.Changeset.put_change(:user_id, user_id)
        |> Ecto.Changeset.put_change(:card_id, card_id)
        |> Repo.insert!()

      %OwnedCard{} = owned_card ->
        owned_card
        |> Ecto.Changeset.change(quantity: owned_card.quantity + quantity)
        |> Repo.update!()
    end
  end

  defp update_owned_card_quantity!(owned_card, quantity_delta) do
    next_quantity = owned_card.quantity + quantity_delta

    if next_quantity <= 0 do
      Repo.delete!(owned_card)
    else
      owned_card
      |> Ecto.Changeset.change(quantity: next_quantity)
      |> Repo.update!()
    end
  end

  defp to_user_summary(user) do
    %{
      id: user.id,
      email: user.email,
      displayName: user.display_name || hd(String.split(user.email, "@"))
    }
  end

  defp to_gift_payload(gift) do
    %{
      id: gift.id,
      cardId: gift.card_id,
      quantity: gift.quantity,
      message: gift.message,
      status: Atom.to_string(gift.status),
      expiresAt: if(gift.expires_at, do: DateTime.to_iso8601(gift.expires_at), else: nil),
      createdAt: DateTime.to_iso8601(gift.inserted_at),
      fromUser: to_user_summary(gift.from_user),
      toUser: to_user_summary(gift.to_user),
      card: %{
        id: gift.card.id,
        name: gift.card.name,
        character: gift.card.character,
        description: gift.card.description,
        hp: gift.card.hp,
        attack: gift.card.attack,
        defense: gift.card.defense,
        speed: gift.card.speed,
        type: gift.card.type,
        imageAssetId: gift.card.image_asset_id,
        rarity: %{
          id: gift.card.rarity.id,
          name: gift.card.rarity.name,
          dropRate: gift.card.rarity.drop_rate,
          color: gift.card.rarity.color
        }
      }
    }
  end
end
