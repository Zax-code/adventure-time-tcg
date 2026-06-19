defmodule AdventureTimeApi.Accounts do
  @moduledoc """
  Accounts boundary for users, email credentials, sessions, access requests, and roles.
  """

  import Ecto.Query
  require Logger

  alias Ecto.Multi
  alias AdventureTimeApi.Auth
  alias AdventureTimeApi.Repo

  alias AdventureTimeApi.Accounts.{
    AuthError,
    EmailAccessRequest,
    EmailCredential,
    EmailDelivery,
    EmailVerificationCode,
    GoogleAuth,
    Session,
    User
  }

  alias AdventureTimeApi.Catalog.ImageAsset
  alias AdventureTimeApi.Health.StepSnapshot
  alias AdventureTimeApi.Inventory.OwnedCard
  alias AdventureTimeApi.Pvp.{Loadout, Match}
  alias AdventureTimeApi.Quests
  alias AdventureTimeApi.Quests.{DailyQuest, SpeedCalculusDailyRun, WordleDailyAttempt}
  alias AdventureTimeApi.Social.CardGift

  @signup_purpose :signup
  @password_reset_purpose :password_reset
  @verification_ttl_minutes 15
  @verification_max_attempts 5
  @default_timezone "Europe/Paris"

  def user_module, do: User
  def email_credential_module, do: EmailCredential
  def session_module, do: Session

  def register(attrs, _metadata) do
    normalized_email = normalize_email(attrs["email"])

    with {:ok, preferred_language} <- parse_preferred_language(attrs["preferredLanguage"]),
         {:ok, _display_name} <- validate_display_name(attrs["displayName"]),
         {:ok, _password} <- validate_password(attrs["password"]),
         {:ok, existing_user} <- fetch_registration_user(normalized_email) do
      now = now_utc()
      password_hash = Bcrypt.hash_pwd_salt(attrs["password"])
      verification_code = generate_verification_code()

      verification_hash =
        hash_verification_code(normalized_email, @signup_purpose, verification_code)

      expires_at = DateTime.add(now, @verification_ttl_minutes * 60, :second)

      Multi.new()
      |> Multi.run(:user, fn repo, _changes ->
        upsert_registration_user(
          repo,
          existing_user,
          normalized_email,
          attrs["displayName"],
          preferred_language
        )
      end)
      |> Multi.run(:credential, fn repo, %{user: user} ->
        upsert_email_credential(repo, user, password_hash)
      end)
      |> Multi.run(:request, fn repo, %{user: user} ->
        ensure_pending_access_request(repo, user)
      end)
      |> Multi.delete_all(
        :clear_codes,
        from(code in EmailVerificationCode,
          where:
            code.email == ^normalized_email and code.purpose == ^@signup_purpose and
              is_nil(code.used_at)
        )
      )
      |> Multi.insert(
        :verification_code,
        EmailVerificationCode.changeset(%EmailVerificationCode{}, %{
          email: normalized_email,
          code_hash: verification_hash,
          purpose: @signup_purpose,
          expires_at: expires_at,
          attempt_count: 0
        })
      )
      |> Repo.transaction()
      |> case do
        {:ok, %{user: user}} ->
          with :ok <-
                 EmailDelivery.send_verification_code(normalized_email, verification_code,
                   locale: preferred_language
                 ) do
            {:ok, registration_response(user, verification_code)}
          else
            {:error, message} -> {:error, :delivery, message}
          end

        {:error, _step, %Ecto.Changeset{} = changeset, _changes} ->
          {:error, :validation, first_error(changeset)}

        {:error, _step, %AuthError{} = error, _changes} ->
          {:error, error}

        {:error, _step, reason, _changes} when is_binary(reason) ->
          {:error, :validation, reason}
      end
    else
      {:error, :conflict, message} -> {:error, :conflict, message}
      {:error, message} -> {:error, :validation, message}
    end
  end

  def verify_email(attrs) do
    normalized_email = normalize_email(attrs["email"])
    code = normalize_code(attrs["code"])

    with {:ok, _email} <- validate_email(normalized_email),
         {:ok, _code} <- validate_code(code),
         %User{} = user <- Repo.get_by(User, email: normalized_email),
         %EmailCredential{} = credential <- Repo.get_by(EmailCredential, user_id: user.id) do
      case verification_lookup(normalized_email, @signup_purpose, code) do
        {:ok, verification} ->
          now = now_utc()

          Multi.new()
          |> Multi.update(
            :verification_code,
            Ecto.Changeset.change(verification,
              used_at: now,
              attempt_count: verification.attempt_count + 1
            )
          )
          |> Multi.update(
            :credential,
            Ecto.Changeset.change(credential, email_verified_at: now)
          )
          |> Multi.run(:user, fn repo, _changes ->
            refresh_user_access_state(repo, user)
          end)
          |> Repo.transaction()
          |> case do
            {:ok, %{user: updated_user}} ->
              {:ok, verification_response(updated_user)}

            {:error, _step, %Ecto.Changeset{} = changeset, _changes} ->
              {:error, :validation, first_error(changeset)}

            {:error, _step, reason, _changes} when is_binary(reason) ->
              {:error, :validation, reason}
          end

        {:error, :invalid_code} ->
          register_failed_attempt(normalized_email, @signup_purpose)
          {:error, :invalid_code, "Invalid verification code"}

        {:error, :expired} ->
          {:error, :expired, "Verification code expired"}

        {:error, :not_found} ->
          {:error, :not_found, "No pending email verification"}
      end
    else
      nil -> {:error, :not_found, "No pending email verification"}
      {:error, message} -> {:error, :validation, message}
    end
  end

  def resend_verification(attrs) do
    normalized_email = normalize_email(attrs["email"])

    with {:ok, _email} <- validate_email(normalized_email),
         %User{} = user <- Repo.get_by(User, email: normalized_email),
         %EmailCredential{} = credential <- Repo.get_by(EmailCredential, user_id: user.id),
         true <- is_nil(credential.email_verified_at) do
      now = now_utc()
      verification_code = generate_verification_code()

      verification_hash =
        hash_verification_code(normalized_email, @signup_purpose, verification_code)

      expires_at = DateTime.add(now, @verification_ttl_minutes * 60, :second)

      Multi.new()
      |> Multi.run(:user, fn repo, _changes -> refresh_user_access_state(repo, user) end)
      |> Multi.delete_all(
        :clear_codes,
        from(code in EmailVerificationCode,
          where:
            code.email == ^normalized_email and code.purpose == ^@signup_purpose and
              is_nil(code.used_at)
        )
      )
      |> Multi.insert(
        :verification_code,
        EmailVerificationCode.changeset(%EmailVerificationCode{}, %{
          email: normalized_email,
          code_hash: verification_hash,
          purpose: @signup_purpose,
          expires_at: expires_at,
          attempt_count: 0
        })
      )
      |> Repo.transaction()
      |> case do
        {:ok, %{user: refreshed_user}} ->
          with :ok <-
                 EmailDelivery.send_verification_code(normalized_email, verification_code,
                   locale: user.preferred_language
                 ) do
            {:ok, resend_response(refreshed_user, verification_code)}
          else
            {:error, message} -> {:error, :delivery, message}
          end

        {:error, _step, %Ecto.Changeset{} = changeset, _changes} ->
          {:error, :validation, first_error(changeset)}
      end
    else
      nil -> {:error, :not_found, "No pending email verification"}
      false -> {:error, :conflict, "Email is already verified."}
      {:error, message} -> {:error, :validation, message}
    end
  end

  def login(attrs, metadata) do
    normalized_email = normalize_email(attrs["email"])

    with {:ok, _password} <- validate_password(attrs["password"]),
         %User{} = user <- Repo.get_by(User, email: normalized_email),
         %EmailCredential{} = credential <- Repo.get_by(EmailCredential, user_id: user.id),
         true <- Bcrypt.verify_pass(attrs["password"], credential.password_hash),
         :ok <- ensure_email_verified(credential),
         :ok <- ensure_user_approved(user),
         {:ok, response} <- issue_session(user, metadata) do
      {:ok, response}
    else
      nil -> {:error, :invalid_credentials, "Invalid email or password."}
      false -> {:error, :invalid_credentials, "Invalid email or password."}
      {:error, %AuthError{} = error} -> {:error, error}
      {:error, message} -> {:error, :validation, message}
    end
  end

  def request_password_reset(attrs) do
    normalized_email = normalize_email(attrs["email"])

    with {:ok, _email} <- validate_email(normalized_email) do
      response =
        case resettable_email_account(normalized_email) do
          {:ok, %{user: user, credential: credential}} ->
            maybe_send_password_reset_email(user, credential)

          :ignore ->
            password_reset_request_response(nil)
        end

      {:ok, response}
    else
      {:error, message} ->
        {:error, :validation, message}
    end
  end

  def reset_password(attrs) do
    normalized_email = normalize_email(attrs["email"])
    code = normalize_code(attrs["code"])

    with {:ok, _email} <- validate_email(normalized_email),
         {:ok, _code} <- validate_code(code),
         {:ok, password} <- validate_password(attrs["password"]),
         %User{} = user <- Repo.get_by(User, email: normalized_email),
         %EmailCredential{} = credential <- Repo.get_by(EmailCredential, user_id: user.id) do
      case verification_lookup(normalized_email, @password_reset_purpose, code) do
        {:ok, verification} ->
          now = now_utc()

          Multi.new()
          |> Multi.update(
            :verification_code,
            Ecto.Changeset.change(verification,
              used_at: now,
              attempt_count: verification.attempt_count + 1
            )
          )
          |> Multi.update(
            :credential,
            EmailCredential.changeset(credential, %{
              password_hash: Bcrypt.hash_pwd_salt(password),
              email_verified_at: credential.email_verified_at
            })
          )
          |> Multi.update_all(
            :revoke_sessions,
            from(session in Session,
              where: session.user_id == ^user.id and is_nil(session.revoked_at)
            ),
            set: [revoked_at: now]
          )
          |> Repo.transaction()
          |> case do
            {:ok, _changes} ->
              {:ok, password_reset_response()}

            {:error, _step, %Ecto.Changeset{} = changeset, _changes} ->
              {:error, :validation, first_error(changeset)}

            {:error, _step, reason, _changes} when is_binary(reason) ->
              {:error, :validation, reason}
          end

        {:error, :invalid_code} ->
          register_failed_attempt(normalized_email, @password_reset_purpose)
          {:error, :invalid_code, "Invalid password reset code"}

        {:error, :expired} ->
          {:error, :expired, "Password reset code expired"}

        {:error, :not_found} ->
          {:error, :not_found, "No pending password reset"}
      end
    else
      nil -> {:error, :not_found, "No pending password reset"}
      {:error, message} -> {:error, :validation, message}
    end
  end

  def login_with_google(attrs, metadata) do
    with {:ok, preferred_language} <- parse_preferred_language(attrs["preferredLanguage"]),
         {:ok, profile} <-
           GoogleAuth.verify(%{id_token: attrs["idToken"], access_token: attrs["accessToken"]}),
         {:ok, response} <- login_google_profile(profile, metadata, preferred_language) do
      {:ok, response}
    end
  end

  def refresh(refresh_token, metadata) do
    with {:ok, claims} <- Auth.verify_refresh_token(refresh_token),
         %Session{} = session <- active_session(claims["sid"], claims["sub"]),
         true <- Bcrypt.verify_pass(refresh_token, session.refresh_token_hash),
         %User{} = user <- Repo.get(User, claims["sub"]),
         :ok <- ensure_user_approved(user),
         {:ok, _revoked} <- revoke_session(session),
         {:ok, response} <- issue_session(user, metadata) do
      {:ok, response}
    else
      {:error, %AuthError{} = error} ->
        {:error, error.code || :invalid_refresh_token, error.message}

      {:error, :invalid_token} ->
        {:error, :invalid_refresh_token, "Invalid refresh token."}

      nil ->
        {:error, :invalid_refresh_token, "Session not found."}

      false ->
        {:error, :invalid_refresh_token, "Invalid refresh token."}

      {:error, reason} when is_binary(reason) ->
        {:error, :invalid_refresh_token, reason}
    end
  end

  def logout(refresh_token) do
    with {:ok, claims} <- Auth.verify_refresh_token(refresh_token),
         %Session{} = session <- Repo.get(Session, claims["sid"]) do
      revoke_session(session)
      :ok
    else
      _ -> :ok
    end
  end

  def fetch_auth_user_from_access_token(token) do
    with {:ok, claims} <- Auth.verify_access_token(token),
         {:ok, auth_user} <- auth_user_for_id(claims["sub"]) do
      {:ok, auth_user}
    else
      _ -> {:error, :unauthorized}
    end
  end

  def auth_user_for_id(user_id) do
    case Repo.get(User, user_id) do
      %User{} = user ->
        with :ok <- ensure_user_approved(user) do
          build_auth_user(user)
        end

      nil ->
        {:error, :not_found}
    end
  end

  def update_display_name(user_id, display_name) do
    with %User{} = user <- Repo.get(User, user_id),
         {:ok, updated} <-
           user
           |> User.profile_changeset(%{display_name: display_name})
           |> Repo.update() do
      build_auth_user(updated)
    else
      nil -> {:error, :not_found}
      {:error, %Ecto.Changeset{} = cs} -> {:error, :validation, first_error(cs)}
    end
  end

  def update_preferred_language(user_id, lang) do
    with %User{} = user <- Repo.get(User, user_id),
         {:ok, updated} <-
           user
           |> User.profile_changeset(%{preferred_language: lang})
           |> Repo.update() do
      build_auth_user(updated)
    else
      nil -> {:error, :not_found}
      {:error, %Ecto.Changeset{} = cs} -> {:error, :validation, first_error(cs)}
    end
  end

  def update_preferred_step_source(user_id, source) do
    with %User{} = user <- Repo.get(User, user_id),
         {:ok, updated} <-
           user
           |> User.profile_changeset(%{preferred_step_source: source})
           |> Repo.update() do
      build_auth_user(updated)
    else
      nil -> {:error, :not_found}
      {:error, %Ecto.Changeset{} = cs} -> {:error, :validation, first_error(cs)}
    end
  end

  def update_timezone(user_id, timezone) do
    with %User{} = user <- Repo.get(User, user_id),
         {:ok, normalized_timezone} <- parse_timezone(timezone),
         {:ok, updated} <-
           user
           |> User.profile_changeset(%{timezone: normalized_timezone})
           |> Repo.update() do
      build_auth_user(updated)
    else
      nil -> {:error, :not_found}
      {:error, %Ecto.Changeset{} = cs} -> {:error, :validation, first_error(cs)}
      {:error, message} -> {:error, :validation, message}
    end
  end

  def update_notification_preferences(user_id, preferences) when is_map(preferences) do
    with %User{} = user <- Repo.get(User, user_id),
         attrs <- %{
           notify_daily_reset:
             Map.get(preferences, "dailyReset", Map.get(preferences, :dailyReset)),
           notify_step_goal: Map.get(preferences, "stepGoal", Map.get(preferences, :stepGoal)),
           notify_pvp_invite: Map.get(preferences, "pvpInvite", Map.get(preferences, :pvpInvite)),
           notify_pvp_turn: Map.get(preferences, "pvpTurn", Map.get(preferences, :pvpTurn)),
           notify_gift_received:
             Map.get(preferences, "giftReceived", Map.get(preferences, :giftReceived))
         },
         {:ok, updated} <-
           user
           |> User.profile_changeset(attrs)
           |> Repo.update() do
      build_auth_user(updated)
    else
      nil -> {:error, :not_found}
      {:error, %Ecto.Changeset{} = cs} -> {:error, :validation, first_error(cs)}
    end
  end

  def list_admin_users do
    User
    |> order_by([user], asc: user.email)
    |> Repo.all()
    |> Enum.map(&admin_user_payload/1)
  end

  def admin_users(viewer) do
    with :ok <- ensure_admin(viewer) do
      {:ok, %{users: list_admin_users()}}
    end
  end

  def admin_user_detail(user_id, viewer) do
    with :ok <- ensure_admin(viewer) do
      case Repo.get(User, user_id) do
        %User{} = user ->
          {:ok, quest_payload} = Quests.list_quests_for_user(user.id)

          {:ok,
           admin_user_payload(user)
           |> Map.merge(%{
             "todayDate" =>
               Quests.current_reset_date(user.timezone || @default_timezone) |> Date.to_iso8601(),
             "dailyQuests" => quest_payload.quests,
             "viewerPermissions" => %{
               "canManageCoins" => super_admin?(viewer),
               "canManageAdminRights" => super_admin?(viewer),
               "canResetDailyQuests" => super_admin?(viewer),
               "canDeleteUser" => super_admin?(viewer)
             }
           })}

        nil ->
          {:error, :not_found}
      end
    end
  end

  def adjust_user_coins(user_id, delta, actor) do
    with :ok <- ensure_super_admin(actor),
         %User{} = user <- Repo.get(User, user_id) do
      new_balance = max(user.coins + delta, 0)

      case user |> Ecto.Changeset.change(coins: new_balance) |> Repo.update() do
        {:ok, updated_user} -> {:ok, %{id: updated_user.id, coins: updated_user.coins}}
        {:error, %Ecto.Changeset{} = changeset} -> {:error, :validation, first_error(changeset)}
      end
    else
      nil -> {:error, :not_found, "User not found"}
      {:error, %AuthError{} = error} -> {:error, error}
    end
  end

  def update_user_role(user_id, attrs, actor) do
    with :ok <- ensure_super_admin(actor),
         %User{} = user <- Repo.get(User, user_id),
         {:ok, role} <- parse_target_role(attrs),
         :ok <- prevent_self_demote(actor, user, role),
         {:ok, updated_user} <-
           user
           |> User.access_changeset(%{role: role, access_status: user.access_status})
           |> Repo.update() do
      {:ok, admin_user_payload(updated_user)}
    else
      nil -> {:error, :not_found, "User not found"}
      {:error, %AuthError{} = error} -> {:error, error}
      {:error, %Ecto.Changeset{} = changeset} -> {:error, :validation, first_error(changeset)}
      {:error, message} -> {:error, :validation, message}
    end
  end

  def reset_daily_quests_for_admin(user_id, attrs, actor) do
    with :ok <- ensure_super_admin(actor),
         %User{} <- Repo.get(User, user_id),
         {:ok, result} <- reset_daily_quests_for_user(user_id, attrs, actor) do
      {:ok, Map.put(result, :success, true)}
    else
      nil -> {:error, :not_found, "User not found"}
      {:error, %AuthError{} = error} -> {:error, error}
      {:error, message} -> {:error, :validation, message}
    end
  end

  def delete_user(user_id, actor) do
    with :ok <- ensure_super_admin(actor),
         %User{} = user <- Repo.get(User, user_id),
         :ok <- prevent_self_delete(actor, user) do
      normalized_email = normalize_email(user.email)

      Multi.new()
      |> Multi.delete_all(
        :delete_pvp_matches,
        from(match in Match, where: match.inviter_id == ^user.id or match.invitee_id == ^user.id)
      )
      |> Multi.delete_all(
        :delete_pvp_loadouts,
        from(loadout in Loadout, where: loadout.owner_id == ^user.id)
      )
      |> Multi.delete_all(
        :delete_daily_quests,
        from(quest in DailyQuest, where: quest.user_id == ^user.id)
      )
      |> Multi.delete_all(
        :delete_wordle_attempts,
        from(attempt in WordleDailyAttempt, where: attempt.user_id == ^user.id)
      )
      |> Multi.delete_all(
        :delete_speed_runs,
        from(run in SpeedCalculusDailyRun, where: run.user_id == ^user.id)
      )
      |> Multi.delete_all(
        :delete_step_snapshots,
        from(snapshot in StepSnapshot, where: snapshot.user_id == ^user.id)
      )
      |> Multi.delete_all(
        :delete_card_gifts,
        from(gift in CardGift,
          where: gift.from_user_id == ^user.id or gift.to_user_id == ^user.id
        )
      )
      |> Multi.delete_all(
        :delete_owned_cards,
        from(owned in OwnedCard, where: owned.user_id == ^user.id)
      )
      |> Multi.delete_all(
        :delete_sessions,
        from(session in Session, where: session.user_id == ^user.id)
      )
      |> Multi.delete_all(
        :delete_credentials,
        from(credential in EmailCredential, where: credential.user_id == ^user.id)
      )
      |> Multi.delete_all(
        :delete_access_requests,
        from(request in EmailAccessRequest, where: request.email == ^normalized_email)
      )
      |> Multi.delete_all(
        :delete_verification_codes,
        from(code in EmailVerificationCode, where: code.email == ^normalized_email)
      )
      |> Multi.delete(:delete_user, user)
      |> maybe_delete_avatar_asset(user.avatar_asset_id)
      |> Repo.transaction()
      |> case do
        {:ok, _changes} ->
          {:ok, %{success: true, deletedUserId: user.id}}

        {:error, _step, %Ecto.Changeset{} = changeset, _changes} ->
          {:error, :validation, first_error(changeset)}
      end
    else
      nil -> {:error, :not_found, "User not found"}
      {:error, %AuthError{} = error} -> {:error, error}
      {:error, message} -> {:error, :validation, message}
    end
  end

  def list_pending_access_requests(actor) do
    with :ok <- ensure_super_admin(actor) do
      user_emails =
        User
        |> select([user], user.email)
        |> Repo.all()
        |> MapSet.new()

      requests =
        EmailAccessRequest
        |> where([request], request.status in [:pending, :approved])
        |> order_by([request], asc: request.inserted_at)
        |> Repo.all()
        |> Enum.filter(fn request ->
          request.status == :pending ||
            (request.status == :approved && !MapSet.member?(user_emails, request.email))
        end)
        |> Enum.map(fn request ->
          %{
            "id" => request.id,
            "email" => request.email,
            "status" => Atom.to_string(request.status),
            "hasAccount" => MapSet.member?(user_emails, request.email),
            "createdAt" => request.inserted_at |> DateTime.to_iso8601()
          }
        end)

      {:ok, %{requests: requests}}
    end
  end

  def review_access_request(request_id, attrs, actor) do
    with :ok <- ensure_super_admin(actor),
         %EmailAccessRequest{} = request <- Repo.get(EmailAccessRequest, request_id),
         :pending <- request.status,
         {:ok, status} <- parse_request_status(attrs["status"]),
         {:ok, result} <- apply_request_review(request, status, actor) do
      {:ok, result}
    else
      nil -> {:error, :not_found, "Access request not found"}
      :approved -> {:error, :validation, "This request has already been reviewed"}
      :rejected -> {:error, :validation, "This request has already been reviewed"}
      {:error, %AuthError{} = error} -> {:error, error}
      {:error, %Ecto.Changeset{} = changeset} -> {:error, :validation, first_error(changeset)}
      {:error, message} -> {:error, :validation, message}
    end
  end

  defp apply_request_review(request, status, actor) do
    now = now_utc()

    Multi.new()
    |> Multi.run(:user, fn repo, _changes ->
      case repo.get_by(User, email: request.email) do
        nil when status == :approved ->
          repo.insert(
            User.access_changeset(
              User.registration_changeset(%User{}, %{
                email: request.email,
                preferred_language: request.requested_locale
              }),
              %{role: :user, access_status: :approved}
            )
          )

        nil ->
          {:ok, nil}

        %User{} = user ->
          next_access_status = if status == :approved, do: :approved, else: :rejected

          repo.update(
            User.access_changeset(user, %{role: user.role, access_status: next_access_status})
          )
      end
    end)
    |> Multi.update(
      :request,
      EmailAccessRequest.changeset(request, %{
        status: status,
        reviewed_by: actor.email,
        reviewed_at: now
      })
    )
    |> Repo.transaction()
    |> case do
      {:ok, %{request: updated_request}} ->
        {:ok, %{"id" => updated_request.id, "status" => Atom.to_string(updated_request.status)}}

      {:error, _step, reason, _changes} ->
        {:error, reason}
    end
  end

  defp login_google_profile(profile, metadata, preferred_language) do
    case Repo.get_by(User, email: profile.email) do
      nil ->
        ensure_pending_access_request(profile.email, preferred_language)

        {:error,
         %AuthError{
           message:
             "This Google account is not approved yet. An access request has been submitted.",
           status_code: 403,
           code: "ACCESS_REQUEST_PENDING"
         }}

      %User{} = user ->
        user = maybe_update_google_profile(user, profile)

        case user.access_status do
          :approved -> issue_session(user, metadata)
          :pending -> pending_access_error(user.email, true)
          :rejected -> pending_access_error(user.email, true)
        end
    end
  end

  defp maybe_update_google_profile(user, profile) do
    display_name =
      if is_binary(profile.name) and String.trim(profile.name) != "",
        do: String.trim(profile.name),
        else: user.display_name

    if display_name != user.display_name do
      case user |> User.profile_changeset(%{display_name: display_name}) |> Repo.update() do
        {:ok, updated_user} -> updated_user
        _ -> user
      end
    else
      user
    end
  end

  defp issue_session(user, metadata, now \\ nil) do
    now = now || now_utc()

    with session_id <- Ecto.UUID.generate(),
         {:ok, refresh_token} <- Auth.sign_refresh_token(session_id, user.id),
         {:ok, access_token} <-
           Auth.sign_access_token(%{
             "sub" => user.id,
             "email" => user.email,
             "isAdmin" => admin_role?(user.role),
             "isSuperAdmin" => super_admin_role?(user.role)
           }),
         {:ok, _session} <- create_session(session_id, user.id, refresh_token, metadata, now),
         {:ok, auth_user} <- build_auth_user(user) do
      {:ok,
       %{
         user: auth_user,
         tokens: %{
           accessToken: access_token,
           refreshToken: refresh_token,
           expiresInSeconds: Auth.ttl_seconds()
         }
       }}
    end
  end

  defp create_session(session_id, user_id, refresh_token, metadata, now) do
    expires_at = DateTime.add(now, Auth.refresh_ttl_days() * 24 * 60 * 60, :second)

    %Session{}
    |> Session.changeset(%{
      id: session_id,
      refresh_token_hash: Bcrypt.hash_pwd_salt(refresh_token),
      user_agent: metadata[:user_agent],
      ip_address: metadata[:ip_address],
      expires_at: expires_at
    })
    |> Ecto.Changeset.put_change(:user_id, user_id)
    |> Repo.insert()
  end

  defp revoke_session(session) do
    session
    |> Ecto.Changeset.change(revoked_at: now_utc())
    |> Repo.update()
  end

  defp active_session(session_id, user_id) do
    Session
    |> where(
      [session],
      session.id == ^session_id and session.user_id == ^user_id and is_nil(session.revoked_at)
    )
    |> Repo.one()
  end

  defp build_auth_user(user) do
    {:ok,
     %{
       id: user.id,
       email: user.email,
       displayName: user.display_name,
       avatarAssetId: user.avatar_asset_id,
       coins: user.coins,
       dust: user.dust,
       isAdmin: admin_role?(user.role),
       isSuperAdmin: super_admin_role?(user.role),
       preferredStepSource: Atom.to_string(user.preferred_step_source),
       preferredLanguage: Atom.to_string(user.preferred_language),
       timezone: user.timezone || @default_timezone,
       notificationPreferences: %{
         dailyReset: user.notify_daily_reset,
         stepGoal: user.notify_step_goal,
         pvpInvite: user.notify_pvp_invite,
         pvpTurn: user.notify_pvp_turn,
         giftReceived: user.notify_gift_received
       }
     }}
  end

  defp fetch_registration_user(nil), do: {:error, "email is required"}

  defp fetch_registration_user(email) do
    case Repo.get_by(User, email: email) do
      nil ->
        {:ok, nil}

      %User{} = user ->
        credential = Repo.get_by(EmailCredential, user_id: user.id)

        if credential && credential.email_verified_at do
          {:error, :conflict, "Email account already exists. Please sign in."}
        else
          {:ok, user}
        end
    end
  end

  defp upsert_registration_user(repo, nil, email, display_name, preferred_language) do
    repo.insert(
      User.access_changeset(
        User.registration_changeset(%User{}, %{
          email: email,
          display_name: display_name,
          preferred_language: preferred_language
        }),
        %{role: :user, access_status: :pending}
      )
    )
  end

  defp upsert_registration_user(repo, %User{} = user, _email, display_name, preferred_language) do
    repo.update(
      User.access_changeset(
        User.registration_changeset(user, %{
          email: user.email,
          display_name: display_name || user.display_name,
          preferred_language: preferred_language
        }),
        %{role: user.role, access_status: next_pending_status(user.access_status)}
      )
    )
  end

  defp upsert_email_credential(repo, user, password_hash) do
    case repo.get_by(EmailCredential, user_id: user.id) do
      nil ->
        repo.insert(
          %EmailCredential{}
          |> EmailCredential.changeset(%{password_hash: password_hash})
          |> Ecto.Changeset.put_change(:user_id, user.id)
        )

      %EmailCredential{} = credential ->
        repo.update(
          EmailCredential.changeset(credential, %{
            password_hash: password_hash,
            email_verified_at: nil
          })
        )
    end
  end

  defp ensure_pending_access_request(email_or_repo, requested_locale_or_user \\ :en)

  defp ensure_pending_access_request(repo, %User{} = user) do
    case refresh_user_access_state(repo, user) do
      {:ok, updated_user} ->
        ensure_pending_access_request(updated_user.email, updated_user.preferred_language)
        {:ok, updated_user}

      error ->
        error
    end
  end

  defp ensure_pending_access_request(email, requested_locale) do
    normalized_email = normalize_email(email)

    case Repo.get_by(EmailAccessRequest, email: normalized_email) do
      nil ->
        %EmailAccessRequest{}
        |> EmailAccessRequest.changeset(%{
          email: normalized_email,
          requested_locale: requested_locale,
          status: :pending
        })
        |> Repo.insert()

      %EmailAccessRequest{status: :pending} = request ->
        request
        |> EmailAccessRequest.changeset(%{
          email: normalized_email,
          requested_locale: requested_locale,
          status: :pending
        })
        |> Repo.update()

      %EmailAccessRequest{} = request ->
        request
        |> EmailAccessRequest.changeset(%{
          email: normalized_email,
          requested_locale: requested_locale,
          status: :pending,
          reviewed_by: nil,
          reviewed_at: nil
        })
        |> Repo.update()
    end
  end

  defp refresh_user_access_state(repo, %User{} = user) do
    next_status = next_pending_status(user.access_status)

    if next_status == user.access_status do
      {:ok, user}
    else
      repo.update(User.access_changeset(user, %{role: user.role, access_status: next_status}))
    end
  end

  defp next_pending_status(:approved), do: :approved
  defp next_pending_status(_), do: :pending

  defp resettable_email_account(email) do
    case Repo.get_by(User, email: email) do
      %User{} = user ->
        case Repo.get_by(EmailCredential, user_id: user.id) do
          %EmailCredential{email_verified_at: %DateTime{}} = credential ->
            {:ok, %{user: user, credential: credential}}

          _ ->
            :ignore
        end

      nil ->
        :ignore
    end
  end

  defp maybe_send_password_reset_email(user, _credential) do
    now = now_utc()
    verification_code = generate_verification_code()

    verification_hash =
      hash_verification_code(user.email, @password_reset_purpose, verification_code)

    expires_at = DateTime.add(now, @verification_ttl_minutes * 60, :second)

    result =
      Multi.new()
      |> Multi.delete_all(
        :clear_codes,
        from(code in EmailVerificationCode,
          where:
            code.email == ^user.email and code.purpose == ^@password_reset_purpose and
              is_nil(code.used_at)
        )
      )
      |> Multi.insert(
        :verification_code,
        EmailVerificationCode.changeset(%EmailVerificationCode{}, %{
          email: user.email,
          code_hash: verification_hash,
          purpose: @password_reset_purpose,
          expires_at: expires_at,
          attempt_count: 0
        })
      )
      |> Repo.transaction()

    case result do
      {:ok, _changes} ->
        case EmailDelivery.send_password_reset_code(user.email, verification_code,
               locale: user.preferred_language
             ) do
          :ok ->
            password_reset_request_response(verification_code)

          {:error, message} ->
            Logger.error("Failed to deliver password reset email to #{user.email}: #{message}")

            password_reset_request_response(verification_code)
        end

      {:error, _step, %Ecto.Changeset{} = changeset, _changes} ->
        Logger.error(
          "Failed to create password reset request for #{user.email}: #{first_error(changeset)}"
        )

        password_reset_request_response(nil)
    end
  end

  defp active_verification_code(email, purpose) do
    now = now_utc()

    EmailVerificationCode
    |> where(
      [code],
      code.email == ^email and code.purpose == ^purpose and is_nil(code.used_at) and
        code.expires_at > ^now
    )
    |> order_by([code], desc: code.inserted_at)
    |> limit(1)
    |> Repo.one()
  end

  defp matching_verification_code(email, purpose, code) do
    code_hash = hash_verification_code(email, purpose, code)

    EmailVerificationCode
    |> where(
      [verification],
      verification.email == ^email and verification.purpose == ^purpose and
        verification.code_hash == ^code_hash
    )
    |> order_by([verification], desc: verification.inserted_at)
    |> limit(1)
    |> Repo.one()
  end

  defp latest_verification_code(email, purpose) do
    EmailVerificationCode
    |> where([verification], verification.email == ^email and verification.purpose == ^purpose)
    |> order_by([verification], desc: verification.inserted_at)
    |> limit(1)
    |> Repo.one()
  end

  defp verification_lookup(email, purpose, code) do
    now = now_utc()

    case matching_verification_code(email, purpose, code) do
      %EmailVerificationCode{} = verification ->
        cond do
          not is_nil(verification.used_at) -> {:error, :expired}
          DateTime.compare(verification.expires_at, now) != :gt -> {:error, :expired}
          true -> {:ok, verification}
        end

      nil ->
        case active_verification_code(email, purpose) do
          %EmailVerificationCode{} ->
            {:error, :invalid_code}

          nil ->
            if(latest_verification_code(email, purpose),
              do: {:error, :expired},
              else: {:error, :not_found}
            )
        end
    end
  end

  defp register_failed_attempt(%EmailVerificationCode{} = verification) do
    next_attempt_count = verification.attempt_count + 1

    attrs =
      if next_attempt_count >= @verification_max_attempts do
        %{attempt_count: next_attempt_count, used_at: now_utc()}
      else
        %{attempt_count: next_attempt_count}
      end

    verification
    |> Ecto.Changeset.change(attrs)
    |> Repo.update()
  end

  defp register_failed_attempt(email, purpose) do
    case active_verification_code(email, purpose) do
      %EmailVerificationCode{} = verification -> register_failed_attempt(verification)
      nil -> :ok
    end
  end

  defp ensure_email_verified(%EmailCredential{email_verified_at: %DateTime{}}), do: :ok

  defp ensure_email_verified(_credential) do
    {:error,
     %AuthError{
       message: "Email verification required.",
       status_code: 403,
       code: "EMAIL_VERIFICATION_REQUIRED"
     }}
  end

  defp ensure_user_approved(%User{access_status: :approved}), do: :ok

  defp ensure_user_approved(%User{email: email, access_status: :pending}) do
    pending_access_error(email, false)
  end

  defp ensure_user_approved(%User{email: email, access_status: :rejected}) do
    {:error,
     %AuthError{
       message: "This account is not approved yet. A new access request has been submitted.",
       status_code: 403,
       code: "ACCESS_REQUEST_PENDING"
     }}
    |> tap(fn _ -> ensure_pending_access_request(email) end)
  end

  defp pending_access_error(email, maybe_reopen?) do
    if maybe_reopen?, do: ensure_pending_access_request(email)

    {:error,
     %AuthError{
       message: "This account is not approved yet. An access request has been submitted.",
       status_code: 403,
       code: "ACCESS_REQUEST_PENDING"
     }}
  end

  defp ensure_super_admin(auth_user) do
    if super_admin?(auth_user) do
      :ok
    else
      {:error,
       %AuthError{
         message: "Super admin access required",
         status_code: 403,
         code: "SUPER_ADMIN_REQUIRED"
       }}
    end
  end

  defp ensure_admin(auth_user) do
    if admin?(auth_user) do
      :ok
    else
      {:error,
       %AuthError{
         message: "Admin access required",
         status_code: 403,
         code: "ADMIN_REQUIRED"
       }}
    end
  end

  defp parse_preferred_language(nil), do: {:ok, :en}
  defp parse_preferred_language("en"), do: {:ok, :en}
  defp parse_preferred_language("fr"), do: {:ok, :fr}
  defp parse_preferred_language(:en), do: {:ok, :en}
  defp parse_preferred_language(:fr), do: {:ok, :fr}
  defp parse_preferred_language(_), do: {:error, "preferredLanguage must be en or fr"}

  defp parse_timezone(timezone) when is_binary(timezone) do
    normalized_timezone = String.trim(timezone)

    if normalized_timezone == "" do
      {:error, "timezone is required"}
    else
      case DateTime.shift_zone(DateTime.utc_now(), normalized_timezone) do
        {:ok, _} -> {:ok, normalized_timezone}
        {:error, _} -> {:error, "timezone must be a valid IANA timezone"}
      end
    end
  end

  defp parse_timezone(_), do: {:error, "timezone must be a valid IANA timezone"}

  defp prevent_self_demote(actor, target_user, next_role) do
    if actor.id == target_user.id and actor.isSuperAdmin and next_role != :super_admin do
      {:error, "Cannot remove your own super admin rights"}
    else
      :ok
    end
  end

  defp prevent_self_delete(actor, target_user) do
    if actor.id == target_user.id do
      {:error, "Cannot delete yourself"}
    else
      :ok
    end
  end

  defp reset_daily_quests_for_user(user_id, %{"mode" => "all"}, actor) do
    Quests.admin_reset_daily_quests(user_id, %{admin_id: actor.id})
  end

  defp reset_daily_quests_for_user(
         user_id,
         %{"mode" => "single", "questType" => quest_type},
         actor
       )
       when is_binary(quest_type) and quest_type != "" do
    with :ok <- validate_resettable_quest_type(quest_type) do
      Quests.admin_reset_daily_quests(user_id, %{quest_type: quest_type, admin_id: actor.id})
    end
  end

  defp reset_daily_quests_for_user(_user_id, %{"mode" => "single"}, _actor) do
    {:error, "questType is required"}
  end

  defp reset_daily_quests_for_user(_user_id, _attrs, _actor) do
    {:error, "mode must be all or single"}
  end

  defp validate_resettable_quest_type(quest_type)
       when quest_type in [
              "steps_10k",
              "wordle_daily",
              "speed_calculus_daily",
              "daily_numbers_classic",
              "daily_numbers_expert"
            ],
       do: :ok

  defp validate_resettable_quest_type(_quest_type), do: {:error, "Unknown quest type"}

  defp parse_target_role(%{"role" => role}) when is_binary(role) do
    case role do
      "user" -> {:ok, :user}
      "admin" -> {:ok, :admin}
      "super_admin" -> {:ok, :super_admin}
      _ -> {:error, "role must be one of user, admin, or super_admin"}
    end
  end

  defp parse_target_role(%{"isAdmin" => true}), do: {:ok, :admin}
  defp parse_target_role(%{"isAdmin" => false}), do: {:ok, :user}
  defp parse_target_role(_attrs), do: {:error, "role is required"}

  defp parse_request_status("approved"), do: {:ok, :approved}
  defp parse_request_status("rejected"), do: {:ok, :rejected}
  defp parse_request_status(_), do: {:error, "status must be approved or rejected"}

  defp admin_user_payload(user) do
    %{
      "id" => user.id,
      "email" => user.email,
      "displayName" => user.display_name,
      "coins" => user.coins,
      "role" => Atom.to_string(user.role),
      "accessStatus" => Atom.to_string(user.access_status),
      "isAdmin" => admin_role?(user.role),
      "isSuperAdmin" => super_admin_role?(user.role),
      "createdAt" => user.inserted_at |> DateTime.to_iso8601()
    }
  end

  defp registration_response(user, verification_code) do
    maybe_put_dev_code(
      %{
        success: true,
        message: "Verification code sent",
        authorized: approved?(user),
        accessRequestPending: not approved?(user)
      },
      verification_code
    )
  end

  defp verification_response(user) do
    %{
      success: true,
      message: "Email verified",
      authorized: approved?(user),
      accessRequestPending: not approved?(user)
    }
  end

  defp resend_response(user, verification_code) do
    maybe_put_dev_code(
      %{
        success: true,
        message: "A new verification code was sent.",
        authorized: approved?(user),
        accessRequestPending: not approved?(user)
      },
      verification_code
    )
  end

  defp password_reset_request_response(verification_code) do
    maybe_put_optional_dev_code(
      %{
        success: true,
        message: "If an account matches this email, a password reset code has been sent."
      },
      verification_code
    )
  end

  defp password_reset_response do
    %{
      success: true,
      message: "Password updated."
    }
  end

  defp maybe_put_dev_code(payload, verification_code) do
    if expose_dev_code?() do
      Map.put(payload, :devCode, verification_code)
    else
      payload
    end
  end

  defp maybe_put_optional_dev_code(payload, nil), do: payload

  defp maybe_put_optional_dev_code(payload, verification_code),
    do: maybe_put_dev_code(payload, verification_code)

  defp generate_verification_code do
    (100_000 + :rand.uniform(900_000) - 1)
    |> Integer.to_string()
  end

  defp hash_verification_code(email, purpose, code) do
    secret = verification_secret()

    :crypto.mac(:hmac, :sha256, secret, "#{email}:#{purpose}:#{code}")
    |> Base.encode16(case: :lower)
  end

  defp verification_secret do
    config()[:verification_secret] || raise "missing verification secret"
  end

  defp expose_dev_code?, do: config()[:expose_dev_code] == true

  defp config do
    Application.get_env(:adventure_time_api, __MODULE__, [])
  end

  defp admin_role?(:admin), do: true
  defp admin_role?(:super_admin), do: true
  defp admin_role?(_), do: false

  defp super_admin_role?(:super_admin), do: true
  defp super_admin_role?(_), do: false

  defp approved?(%User{access_status: :approved}), do: true
  defp approved?(_), do: false

  defp admin?(%{isAdmin: true}), do: true
  defp admin?(_), do: false

  defp super_admin?(%{isSuperAdmin: true}), do: true
  defp super_admin?(_), do: false

  defp maybe_delete_avatar_asset(multi, nil), do: multi

  defp maybe_delete_avatar_asset(multi, asset_id) do
    Multi.delete_all(
      multi,
      :delete_avatar_asset,
      from(asset in ImageAsset, where: asset.id == ^asset_id)
    )
  end

  defp normalize_email(nil), do: nil
  defp normalize_email(email), do: email |> String.trim() |> String.downcase()

  defp normalize_code(nil), do: nil
  defp normalize_code(code), do: code |> String.trim()

  defp validate_email(email) when is_binary(email) and email != "" do
    if Regex.match?(~r/^[^\s]+@[^\s]+$/, email) do
      {:ok, email}
    else
      {:error, "Invalid email format"}
    end
  end

  defp validate_email(_), do: {:error, "email is required"}

  defp validate_display_name(display_name) when is_binary(display_name) do
    trimmed = String.trim(display_name)

    if String.length(trimmed) in 1..64 do
      {:ok, trimmed}
    else
      {:error, "displayName should have between 1 and 64 characters"}
    end
  end

  defp validate_display_name(_), do: {:error, "displayName is required"}

  defp validate_password(password) when is_binary(password) do
    if String.length(password) >= 8 do
      {:ok, password}
    else
      {:error, "password should have at least 8 characters"}
    end
  end

  defp validate_password(_), do: {:error, "password is required"}

  defp validate_code(code) when is_binary(code) do
    if Regex.match?(~r/^\d{6}$/, code) do
      {:ok, code}
    else
      {:error, "Verification code must be 6 digits"}
    end
  end

  defp validate_code(_), do: {:error, "Verification code must be 6 digits"}

  defp first_error(changeset) do
    {field, {message, _opts}} = hd(changeset.errors)
    "#{field} #{message}"
  end

  defp now_utc, do: DateTime.utc_now() |> DateTime.truncate(:second)
end
