defmodule AdventureTimeApi.Accounts do
  @moduledoc """
  Accounts boundary for users, email credentials, sessions, access requests, and roles.
  """

  import Ecto.Query
  require Logger

  alias Ecto.Multi
  alias AdventureTimeApi.AccessAssessment
  alias AdventureTimeApi.Auth
  alias AdventureTimeApi.Notifications
  alias AdventureTimeApi.Repo

  alias AdventureTimeApi.Accounts.{
    AppleAuth,
    AuthError,
    AuthAttempt,
    AuthProviderIdentity,
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
  alias AdventureTimeApi.Leaderboards.SnapshotRow
  alias AdventureTimeApi.Notifications.Device, as: NotificationDevice
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

  def register(attrs, metadata) do
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
        ensure_pending_access_request(repo, user, metadata)
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
        {:ok, %{user: user, request: request}} ->
          assessment_challenge = capture_access_assessment(request, metadata)

          record_auth_attempt(%{
            event_type: "email_register_access_request",
            provider: "email",
            email: user.email,
            requested_locale: Atom.to_string(preferred_language),
            status_code: 201,
            metadata: metadata
          })

          with :ok <-
                 EmailDelivery.send_verification_code(normalized_email, verification_code,
                   locale: preferred_language
                 ) do
            {:ok,
             registration_response(user, verification_code)
             |> maybe_put_assessment_challenge(assessment_challenge)}
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
              maybe_rescore_verified_access_request(normalized_email)
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

    result =
      with {:ok, _password} <- validate_password(attrs["password"]),
           %User{} = user <- Repo.get_by(User, email: normalized_email),
           %EmailCredential{} = credential <- Repo.get_by(EmailCredential, user_id: user.id),
           true <- Bcrypt.verify_pass(attrs["password"], credential.password_hash),
           :ok <- ensure_email_verified(credential),
           :ok <- ensure_user_approved(user, metadata),
           {:ok, response} <- issue_session(user, metadata) do
        {:ok, response}
      else
        nil -> {:error, :invalid_credentials, "Invalid email or password."}
        false -> {:error, :invalid_credentials, "Invalid email or password."}
        {:error, %AuthError{} = error} -> {:error, error}
        {:error, message} -> {:error, :validation, message}
      end

    record_email_login_attempt(result, normalized_email, metadata)
    result
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
    result =
      with {:ok, preferred_language} <- parse_preferred_language(attrs["preferredLanguage"]),
           {:ok, profile} <-
             GoogleAuth.verify(%{id_token: attrs["idToken"], access_token: attrs["accessToken"]}),
           {:ok, response} <- login_google_profile(profile, metadata, preferred_language) do
        {:ok, response}
      end

    case result do
      {:error, %AuthError{} = error} ->
        if error.code in [
             "GOOGLE_AUTH_FAILED",
             "GOOGLE_AUTH_MISSING_TOKEN",
             "GOOGLE_EMAIL_UNVERIFIED"
           ] do
          record_auth_attempt(%{
            event_type: "google_login_failed",
            provider: "google",
            status_code: error.status_code,
            error_code: error.code,
            metadata: metadata
          })
        end

      _ ->
        :ok
    end

    result
  end

  def login_with_apple(attrs, metadata) do
    result =
      with {:ok, preferred_language} <- parse_preferred_language(attrs["preferredLanguage"]),
           {:ok, profile} <-
             AppleAuth.verify(%{
               identity_token: attrs["identityToken"],
               nonce: attrs["nonce"]
             }),
           {:ok, response} <-
             profile
             |> Map.put(:name, apple_display_name(attrs["fullName"]))
             |> login_apple_profile(metadata, preferred_language) do
        {:ok, response}
      end

    case result do
      {:error, %AuthError{} = error} ->
        if error.code in [
             "APPLE_AUTH_FAILED",
             "APPLE_AUTH_MISSING_TOKEN"
           ] do
          record_auth_attempt(%{
            event_type: "apple_login_failed",
            provider: "apple",
            status_code: error.status_code,
            error_code: error.code,
            metadata: metadata
          })
        end

      _ ->
        :ok
    end

    result
  end

  def refresh(refresh_token, metadata) do
    with {:ok, claims} <- Auth.verify_refresh_token(refresh_token),
         %Session{} = session <- active_session(claims["sid"], claims["sub"]),
         true <- Bcrypt.verify_pass(refresh_token, session.refresh_token_hash),
         %User{} = user <- Repo.get(User, claims["sub"]),
         :ok <- ensure_user_approved(user, metadata),
         {:ok, _session} <- extend_session(session, metadata),
         {:ok, response} <- issue_refresh_response(user, refresh_token) do
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

  def update_password(user_id, attrs) when is_map(attrs) do
    current_password = Map.get(attrs, "currentPassword", Map.get(attrs, :currentPassword))
    new_password = Map.get(attrs, "newPassword", Map.get(attrs, :newPassword))

    with %User{} = user <- Repo.get(User, user_id),
         {:ok, password} <- validate_password(new_password) do
      case Repo.get_by(EmailCredential, user_id: user.id) do
        %EmailCredential{email_verified_at: %DateTime{}} = credential ->
          change_existing_password(user, credential, current_password, password)

        %EmailCredential{} = credential ->
          set_initial_password(user, credential, password)

        nil ->
          set_initial_password(user, nil, password)
      end
    else
      nil -> {:error, :not_found, "User not found"}
      {:error, message} -> {:error, :validation, message}
    end
  end

  def update_password(_user_id, _attrs), do: {:error, :validation, "newPassword is required"}

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
      delete_user_record(user)
    else
      nil -> {:error, :not_found, "User not found"}
      {:error, %AuthError{} = error} -> {:error, error}
      {:error, message} -> {:error, :validation, message}
    end
  end

  def delete_own_account(user_id) do
    case Repo.get(User, user_id) do
      %User{} = user -> delete_user_record(user)
      nil -> {:error, :not_found, "User not found"}
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

      events_by_email = recent_auth_events_by_email(Enum.map(requests, & &1.email))
      assessments_by_request = AccessAssessment.admin_views(Enum.map(requests, & &1.id))

      requests =
        requests
        |> Enum.map(fn request ->
          %{
            "id" => request.id,
            "email" => request.email,
            "status" => Atom.to_string(request.status),
            "hasAccount" => MapSet.member?(user_emails, request.email),
            "createdAt" => request.inserted_at |> DateTime.to_iso8601(),
            "provider" => request.provider,
            "googleName" => request.google_name,
            "googlePictureUrl" => request.google_picture_url,
            "lastRequestId" => request.last_request_id,
            "lastUserAgent" => request.last_user_agent,
            "lastAcceptLanguage" => request.last_accept_language,
            "lastClientPlatform" => request.last_client_platform,
            "lastClientAppVersion" => request.last_client_app_version,
            "lastClientBuildNumber" => request.last_client_build_number,
            "lastAttestationStatus" => request.last_attestation_status,
            "lastSeenAt" => request.last_seen_at && DateTime.to_iso8601(request.last_seen_at),
            "attemptCount" => request.attempt_count || 0,
            "authEvents" => Map.get(events_by_email, request.email, []),
            "assessment" => Map.get(assessments_by_request, request.id)
          }
        end)

      {:ok, %{requests: requests}}
    end
  end

  defp recent_auth_events_by_email([]), do: %{}

  defp recent_auth_events_by_email(emails) do
    normalized_emails = Enum.map(emails, &normalize_email/1)

    AuthAttempt
    |> where([attempt], attempt.email in ^normalized_emails)
    |> order_by([attempt], desc: attempt.inserted_at)
    |> Repo.all()
    |> Enum.group_by(& &1.email, &auth_attempt_response/1)
    |> Map.new(fn {email, events} -> {email, Enum.take(events, 5)} end)
  end

  defp auth_attempt_response(%AuthAttempt{} = attempt) do
    %{
      "id" => attempt.id,
      "eventType" => attempt.event_type,
      "provider" => attempt.provider,
      "statusCode" => attempt.status_code,
      "errorCode" => attempt.error_code,
      "requestId" => attempt.request_id,
      "userAgent" => attempt.user_agent,
      "clientPlatform" => attempt.client_platform,
      "clientAppVersion" => attempt.client_app_version,
      "clientBuildNumber" => attempt.client_build_number,
      "attestationStatus" => attempt.attestation_status,
      "createdAt" => DateTime.to_iso8601(attempt.inserted_at)
    }
  end

  def reveal_access_request_ip(request_id, actor, audit_request_id) do
    with :ok <- ensure_super_admin(actor),
         %EmailAccessRequest{} <- Repo.get(EmailAccessRequest, request_id),
         {:ok, response} <- AccessAssessment.reveal_ip(request_id, actor.id, audit_request_id) do
      {:ok, response}
    else
      nil -> {:error, :not_found, "Access request not found"}
      {:error, :gone} -> {:error, :gone}
      {:error, %AuthError{} = error} -> {:error, error}
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
    |> Multi.run(:provider_identity, fn repo, %{user: user} ->
      maybe_upsert_provider_identity_from_request(repo, user, request, status)
    end)
    |> Multi.update(
      :request,
      EmailAccessRequest.changeset(request, %{
        status: status,
        reviewed_by: actor.email,
        reviewed_at: now
      })
    )
    |> Multi.run(:assessment_snapshot, fn repo, %{request: updated_request} ->
      AccessAssessment.snapshot_review(repo, updated_request, actor, status, now)
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{request: updated_request}} ->
        {:ok, %{"id" => updated_request.id, "status" => Atom.to_string(updated_request.status)}}

      {:error, _step, reason, _changes} ->
        {:error, reason}
    end
  end

  defp maybe_upsert_provider_identity_from_request(_repo, nil, _request, _status), do: {:ok, nil}

  defp maybe_upsert_provider_identity_from_request(_repo, _user, _request, status)
       when status != :approved,
       do: {:ok, nil}

  defp maybe_upsert_provider_identity_from_request(repo, user, request, :approved) do
    if request.provider in ["google", "apple"] &&
         is_binary(request.provider_subject_hash) &&
         request.provider_subject_hash != "" do
      attrs = %{
        provider: request.provider,
        provider_subject_hash: request.provider_subject_hash,
        email: request.email,
        display_name: request.google_name
      }

      case repo.get_by(AuthProviderIdentity,
             provider: request.provider,
             provider_subject_hash: request.provider_subject_hash
           ) do
        nil ->
          %AuthProviderIdentity{}
          |> AuthProviderIdentity.changeset(attrs)
          |> Ecto.Changeset.put_change(:user_id, user.id)
          |> repo.insert()

        %AuthProviderIdentity{} = identity ->
          identity
          |> AuthProviderIdentity.changeset(attrs)
          |> Ecto.Changeset.put_change(:user_id, user.id)
          |> repo.update()
      end
    else
      {:ok, nil}
    end
  end

  defp login_google_profile(profile, metadata, preferred_language) do
    case user_for_provider_identity("google", profile) do
      %User{} = user ->
        login_existing_social_user(
          user,
          profile,
          metadata,
          preferred_language,
          provider: "google",
          success_event: "google_login_success",
          failed_event: "google_login_failed"
        )

      nil ->
        case Repo.get_by(User, email: profile.email) do
          nil ->
            assessment_challenge =
              ensure_pending_access_request(profile.email, preferred_language, metadata, profile)
              |> capture_access_assessment_result(metadata)

            record_google_attempt(
              "google_access_request",
              profile,
              preferred_language,
              403,
              "ACCESS_REQUEST_PENDING",
              metadata
            )

            {:error,
             %AuthError{
               message:
                 "This Google account is not approved yet. An access request has been submitted.",
               status_code: 403,
               code: "ACCESS_REQUEST_PENDING",
               details: challenge_details(assessment_challenge)
             }}

          %User{} = user ->
            login_existing_social_user(
              user,
              profile,
              metadata,
              preferred_language,
              provider: "google",
              success_event: "google_login_success",
              failed_event: "google_login_failed"
            )
        end
    end
  end

  defp login_apple_profile(profile, metadata, preferred_language) do
    case user_for_provider_identity("apple", profile) do
      %User{} = user ->
        login_existing_social_user(
          user,
          profile,
          metadata,
          preferred_language,
          provider: "apple",
          success_event: "apple_login_success",
          failed_event: "apple_login_failed"
        )

      nil when is_nil(profile.email) ->
        record_apple_attempt(
          "apple_login_failed",
          profile,
          preferred_language,
          400,
          "APPLE_EMAIL_MISSING",
          metadata
        )

        {:error,
         %AuthError{
           message:
             "Apple did not return a verified email. Try again and share your email with the app.",
           status_code: 400,
           code: "APPLE_EMAIL_MISSING"
         }}

      nil ->
        case Repo.get_by(User, email: profile.email) do
          nil ->
            assessment_challenge =
              ensure_pending_access_request(profile.email, preferred_language, metadata, profile)
              |> capture_access_assessment_result(metadata)

            record_apple_attempt(
              "apple_access_request",
              profile,
              preferred_language,
              403,
              "ACCESS_REQUEST_PENDING",
              metadata
            )

            {:error,
             %AuthError{
               message:
                 "This Apple account is not approved yet. An access request has been submitted.",
               status_code: 403,
               code: "ACCESS_REQUEST_PENDING",
               details: challenge_details(assessment_challenge)
             }}

          %User{} = user ->
            login_existing_social_user(
              user,
              profile,
              metadata,
              preferred_language,
              provider: "apple",
              success_event: "apple_login_success",
              failed_event: "apple_login_failed"
            )
        end
    end
  end

  defp login_existing_social_user(user, profile, metadata, preferred_language, opts) do
    provider = Keyword.fetch!(opts, :provider)
    success_event = Keyword.fetch!(opts, :success_event)
    failed_event = Keyword.fetch!(opts, :failed_event)
    user = maybe_update_social_profile(user, profile)

    case user.access_status do
      :approved ->
        with :ok <- upsert_provider_identity(user, provider, profile),
             {:ok, _response} = result <- issue_session(user, metadata) do
          record_social_attempt(
            success_event,
            provider,
            profile,
            preferred_language,
            200,
            nil,
            metadata
          )

          result
        end

      :pending ->
        record_social_attempt(
          failed_event,
          provider,
          profile,
          preferred_language,
          403,
          "ACCESS_REQUEST_PENDING",
          metadata
        )

        pending_access_error(user.email, true, metadata, profile)

      :rejected ->
        record_social_attempt(
          failed_event,
          provider,
          profile,
          preferred_language,
          403,
          "ACCESS_REQUEST_PENDING",
          metadata
        )

        pending_access_error(user.email, true, metadata, profile)
    end
  end

  defp maybe_update_social_profile(user, profile) do
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

  defp user_for_provider_identity(provider, profile) do
    provider_subject_hash = provider_subject_hash(profile)

    if is_nil(provider_subject_hash) do
      nil
    else
      AuthProviderIdentity
      |> Repo.get_by(provider: provider, provider_subject_hash: provider_subject_hash)
      |> case do
        %AuthProviderIdentity{} = identity -> identity |> Repo.preload(:user) |> Map.get(:user)
        nil -> nil
      end
    end
  end

  defp upsert_provider_identity(%User{} = user, provider, profile) do
    provider_subject_hash = provider_subject_hash(profile)

    if is_nil(provider_subject_hash) do
      :ok
    else
      attrs = %{
        provider: provider,
        provider_subject_hash: provider_subject_hash,
        email: profile[:email],
        display_name: profile[:name]
      }

      case Repo.get_by(AuthProviderIdentity,
             provider: provider,
             provider_subject_hash: provider_subject_hash
           ) do
        nil ->
          %AuthProviderIdentity{}
          |> AuthProviderIdentity.changeset(attrs)
          |> Ecto.Changeset.put_change(:user_id, user.id)
          |> Repo.insert()

        %AuthProviderIdentity{} = identity ->
          identity
          |> AuthProviderIdentity.changeset(attrs)
          |> Ecto.Changeset.put_change(:user_id, user.id)
          |> Repo.update()
      end
      |> case do
        {:ok, _identity} ->
          :ok

        {:error, %Ecto.Changeset{} = changeset} ->
          Logger.warning("Failed to link #{provider} identity: #{inspect(changeset.errors)}")

          {:error,
           %AuthError{
             message: "Authentication failed.",
             status_code: 500,
             code: "PROVIDER_IDENTITY_LINK_FAILED"
           }}
      end
    end
  end

  defp issue_session(user, metadata, now \\ nil) do
    now = now || now_utc()

    with session_id <- Ecto.UUID.generate(),
         {:ok, refresh_token} <- Auth.sign_refresh_token(session_id, user.id),
         {:ok, response} <- issue_refresh_response(user, refresh_token),
         {:ok, _session} <- create_session(session_id, user.id, refresh_token, metadata, now) do
      {:ok, response}
    end
  end

  defp issue_refresh_response(user, refresh_token) do
    with {:ok, access_token} <-
           Auth.sign_access_token(%{
             "sub" => user.id,
             "email" => user.email,
             "isAdmin" => admin_role?(user.role),
             "isSuperAdmin" => super_admin_role?(user.role)
           }),
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

  defp extend_session(session, metadata) do
    next_expires_at = DateTime.add(now_utc(), Auth.refresh_ttl_days() * 24 * 60 * 60, :second)

    expires_at =
      case DateTime.compare(session.expires_at, next_expires_at) do
        :gt -> session.expires_at
        _ -> next_expires_at
      end

    session
    |> Session.changeset(%{
      user_agent: metadata[:user_agent],
      ip_address: metadata[:ip_address],
      expires_at: expires_at
    })
    |> Repo.update()
  end

  defp active_session(session_id, user_id) do
    now = now_utc()

    Session
    |> where(
      [session],
      session.id == ^session_id and session.user_id == ^user_id and is_nil(session.revoked_at) and
        session.expires_at > ^now
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
       authMethods: auth_methods_for_user(user),
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

  defp auth_methods_for_user(user) do
    %{
      password:
        Repo.exists?(
          from(credential in EmailCredential,
            where:
              credential.user_id == ^user.id and
                not is_nil(credential.email_verified_at)
          )
        ),
      google: provider_identity_exists?(user, "google"),
      apple: provider_identity_exists?(user, "apple")
    }
  end

  defp provider_identity_exists?(user, provider) do
    Repo.exists?(
      from(identity in AuthProviderIdentity,
        where: identity.user_id == ^user.id and identity.provider == ^provider
      )
    )
  end

  defp change_existing_password(user, credential, current_password, new_password) do
    with {:ok, password} <- validate_current_password(current_password),
         true <- Bcrypt.verify_pass(password, credential.password_hash),
         {:ok, _credential} <-
           credential
           |> EmailCredential.changeset(%{
             password_hash: Bcrypt.hash_pwd_salt(new_password),
             email_verified_at: credential.email_verified_at
           })
           |> Repo.update() do
      build_auth_user(user)
    else
      false ->
        {:error, :invalid_current_password, "Current password is incorrect."}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:error, :validation, first_error(changeset)}

      {:error, message} ->
        {:error, :validation, message}
    end
  end

  defp set_initial_password(user, nil, password) do
    %EmailCredential{}
    |> EmailCredential.changeset(%{
      password_hash: Bcrypt.hash_pwd_salt(password),
      email_verified_at: now_utc()
    })
    |> Ecto.Changeset.put_change(:user_id, user.id)
    |> Repo.insert()
    |> case do
      {:ok, _credential} -> build_auth_user(user)
      {:error, %Ecto.Changeset{} = changeset} -> {:error, :validation, first_error(changeset)}
    end
  end

  defp set_initial_password(user, credential, password) do
    credential
    |> EmailCredential.changeset(%{
      password_hash: Bcrypt.hash_pwd_salt(password),
      email_verified_at: now_utc()
    })
    |> Repo.update()
    |> case do
      {:ok, _credential} -> build_auth_user(user)
      {:error, %Ecto.Changeset{} = changeset} -> {:error, :validation, first_error(changeset)}
    end
  end

  defp fetch_registration_user(nil), do: {:error, "email is required"}

  defp fetch_registration_user(email) do
    case Repo.get_by(User, email: email) do
      nil ->
        case Repo.get_by(EmailAccessRequest, email: email) do
          %EmailAccessRequest{} ->
            {:error, :conflict,
             "An account or access request already exists for this email. Sign in with the original method or wait for approval."}

          nil ->
            {:ok, nil}
        end

      %User{} ->
        {:error, :conflict,
         "An account or access request already exists for this email. Sign in with the original method or wait for approval."}
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

  defp ensure_pending_access_request(repo, %User{} = user, metadata) do
    with {:ok, updated_user} <- refresh_user_access_state(repo, user),
         {:ok, request} <-
           upsert_pending_access_request(
             repo,
             updated_user.email,
             updated_user.preferred_language,
             metadata,
             %{
               provider: "email"
             }
           ) do
      {:ok, request}
    end
  end

  defp ensure_pending_access_request(email, requested_locale, metadata, profile) do
    upsert_pending_access_request(Repo, email, requested_locale, metadata, profile)
  end

  defp upsert_pending_access_request(repo, email, requested_locale, metadata, profile) do
    normalized_email = normalize_email(email)
    existing_request = repo.get_by(EmailAccessRequest, email: normalized_email)

    attrs =
      access_request_attrs(
        normalized_email,
        requested_locale,
        metadata,
        profile,
        existing_request
      )

    case existing_request do
      nil ->
        %EmailAccessRequest{}
        |> EmailAccessRequest.changeset(attrs)
        |> repo.insert()
        |> notify_access_request_created()

      %EmailAccessRequest{status: :pending} = request ->
        request
        |> EmailAccessRequest.changeset(attrs)
        |> repo.update()

      %EmailAccessRequest{} = request ->
        request
        |> EmailAccessRequest.changeset(Map.merge(attrs, %{reviewed_by: nil, reviewed_at: nil}))
        |> repo.update()
        |> notify_access_request_created()
    end
  end

  defp access_request_attrs(email, requested_locale, metadata, profile, existing_request) do
    %{
      email: email,
      requested_locale: requested_locale,
      status: :pending,
      provider: profile_provider(profile),
      provider_subject_hash: hash_identifier(profile[:subject]),
      google_name: profile[:name],
      google_picture_url: profile[:picture],
      last_request_id: metadata[:request_id],
      last_ip_address: metadata[:ip_address],
      last_user_agent: metadata[:user_agent],
      last_accept_language: metadata[:accept_language],
      last_client_platform: metadata[:client_platform],
      last_client_app_version: metadata[:client_app_version],
      last_client_build_number: metadata[:client_build_number],
      last_installation_id_hash: hash_identifier(metadata[:installation_id]),
      last_attestation_status: metadata[:attestation_status],
      last_seen_at: now_utc(),
      attempt_count: ((existing_request && existing_request.attempt_count) || 0) + 1
    }
  end

  defp record_email_login_attempt({:ok, _response}, email, metadata) do
    record_auth_attempt(%{
      event_type: "email_login_success",
      provider: "email",
      email: email,
      status_code: 200,
      metadata: metadata
    })
  end

  defp record_email_login_attempt({:error, %AuthError{} = error}, email, metadata) do
    record_auth_attempt(%{
      event_type: "email_login_failed",
      provider: "email",
      email: email,
      status_code: error.status_code,
      error_code: error.code,
      metadata: metadata
    })
  end

  defp record_email_login_attempt({:error, reason, _message}, email, metadata) do
    record_auth_attempt(%{
      event_type: "email_login_failed",
      provider: "email",
      email: email,
      status_code: if(reason == :invalid_credentials, do: 401, else: 400),
      error_code: reason |> to_string() |> String.upcase(),
      metadata: metadata
    })
  end

  defp record_google_attempt(
         event_type,
         profile,
         requested_locale,
         status_code,
         error_code,
         metadata
       ) do
    record_auth_attempt(%{
      event_type: event_type,
      provider: "google",
      email: profile[:email],
      provider_subject_hash: hash_identifier(profile[:subject]),
      google_email_verified: profile[:email_verified],
      google_name: profile[:name],
      google_picture_url: profile[:picture],
      requested_locale: Atom.to_string(requested_locale),
      status_code: status_code,
      error_code: error_code,
      metadata: metadata
    })
  end

  defp record_apple_attempt(
         event_type,
         profile,
         requested_locale,
         status_code,
         error_code,
         metadata
       ) do
    record_social_attempt(
      event_type,
      "apple",
      profile,
      requested_locale,
      status_code,
      error_code,
      metadata
    )
  end

  defp record_social_attempt(
         event_type,
         provider,
         profile,
         requested_locale,
         status_code,
         error_code,
         metadata
       ) do
    record_auth_attempt(%{
      event_type: event_type,
      provider: provider,
      email: profile[:email],
      provider_subject_hash: provider_subject_hash(profile),
      google_email_verified: profile[:email_verified],
      google_name: profile[:name],
      google_picture_url: profile[:picture],
      requested_locale: Atom.to_string(requested_locale),
      status_code: status_code,
      error_code: error_code,
      metadata: metadata
    })
  end

  defp record_auth_attempt(attrs) do
    metadata = Map.get(attrs, :metadata, %{}) || %{}

    access_request =
      case Map.get(attrs, :email) do
        email when is_binary(email) ->
          Repo.get_by(EmailAccessRequest, email: normalize_email(email), status: :pending)

        _missing_email ->
          nil
      end

    attrs =
      attrs
      |> Map.delete(:metadata)
      |> Map.put_new(:request_id, metadata[:request_id])
      |> Map.put_new(:ip_address, metadata[:ip_address])
      |> Map.put_new(:canonical_ip, metadata[:ip_address])
      |> Map.put_new(:email_access_request_id, access_request && access_request.id)
      |> Map.put_new(:user_agent, metadata[:user_agent])
      |> Map.put_new(:accept_language, metadata[:accept_language])
      |> Map.put_new(:client_platform, metadata[:client_platform])
      |> Map.put_new(:client_app_version, metadata[:client_app_version])
      |> Map.put_new(:client_build_number, metadata[:client_build_number])
      |> Map.put_new(:installation_id_hash, hash_identifier(metadata[:installation_id]))
      |> Map.put_new(:attestation_status, metadata[:attestation_status])
      |> Map.put(:metadata, %{})

    case %AuthAttempt{} |> AuthAttempt.changeset(attrs) |> Repo.insert() do
      {:ok, _attempt} ->
        :ok

      {:error, changeset} ->
        Logger.warning("Failed to record auth attempt: #{inspect(changeset.errors)}")
    end
  end

  defp profile_provider(%{provider: provider}) when is_binary(provider) and provider != "",
    do: provider

  defp profile_provider(%{subject: subject}) when is_binary(subject) and subject != "",
    do: "google"

  defp profile_provider(%{name: name}) when is_binary(name) and name != "", do: "google"

  defp profile_provider(%{picture: picture}) when is_binary(picture) and picture != "",
    do: "google"

  defp profile_provider(_profile), do: "email"

  defp hash_identifier(nil), do: nil
  defp hash_identifier(""), do: nil

  defp hash_identifier(identifier) when is_binary(identifier) do
    :sha256
    |> :crypto.hash(identifier)
    |> Base.encode16(case: :lower)
  end

  defp hash_identifier(identifier), do: identifier |> to_string() |> hash_identifier()

  defp provider_subject_hash(profile), do: hash_identifier(profile[:subject])

  defp apple_display_name(%{"givenName" => given_name, "familyName" => family_name}) do
    [given_name, family_name]
    |> Enum.filter(&(is_binary(&1) and String.trim(&1) != ""))
    |> Enum.map(&String.trim/1)
    |> Enum.join(" ")
    |> case do
      "" -> nil
      name -> name
    end
  end

  defp apple_display_name(_full_name), do: nil

  defp notify_access_request_created({:ok, %EmailAccessRequest{email: email}} = result) do
    _ = Notifications.send_access_request_created(email)
    result
  end

  defp notify_access_request_created(result), do: result

  defp capture_access_assessment_result({:ok, %EmailAccessRequest{} = request} = result, metadata) do
    _result = result
    capture_access_assessment(request, metadata)
  end

  defp capture_access_assessment_result(_result, _metadata), do: nil

  defp capture_access_assessment(%EmailAccessRequest{} = request, metadata) do
    case AccessAssessment.capture(request, metadata) do
      {:ok, nil} ->
        nil

      {:ok, assessment} ->
        case AdventureTimeApi.AccessAssessment.Challenges.issue(
               assessment.email_access_request_id
             ) do
          {:ok, challenge} -> challenge
          {:error, _reason} -> nil
        end

      {:error, changeset} ->
        Logger.warning(
          "Failed to capture access assessment for request #{request.id}: #{inspect(changeset.errors)}"
        )

        nil
    end
  end

  defp maybe_rescore_verified_access_request(email) do
    case Repo.get_by(EmailAccessRequest, email: email, status: :pending) do
      %EmailAccessRequest{id: request_id} ->
        _result = AccessAssessment.rescore(request_id)
        :ok

      nil ->
        :ok
    end
  end

  defp maybe_put_assessment_challenge(response, nil), do: response

  defp maybe_put_assessment_challenge(response, challenge),
    do: Map.put(response, :assessmentChallenge, challenge)

  defp challenge_details(nil), do: %{}
  defp challenge_details(challenge), do: %{assessmentChallenge: challenge}

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

  defp ensure_user_approved(user, metadata \\ %{})

  defp ensure_user_approved(%User{access_status: :approved}, _metadata), do: :ok

  defp ensure_user_approved(%User{email: email, access_status: :pending}, metadata) do
    pending_access_error(email, true, metadata)
  end

  defp ensure_user_approved(%User{email: email, access_status: :rejected}, metadata) do
    challenge =
      ensure_pending_access_request(email, :en, metadata, %{provider: "email"})
      |> capture_access_assessment_result(metadata)

    {:error,
     %AuthError{
       message: "This account is not approved yet. A new access request has been submitted.",
       status_code: 403,
       code: "ACCESS_REQUEST_PENDING",
       details: challenge_details(challenge)
     }}
  end

  defp pending_access_error(
         email,
         maybe_reopen?,
         metadata,
         profile \\ %{provider: "email"}
       ) do
    challenge =
      if maybe_reopen? do
        ensure_pending_access_request(email, :en, metadata, profile)
        |> capture_access_assessment_result(metadata)
      else
        existing_assessment_challenge(email)
      end

    {:error,
     %AuthError{
       message: "This account is not approved yet. An access request has been submitted.",
       status_code: 403,
       code: "ACCESS_REQUEST_PENDING",
       details: challenge_details(challenge)
     }}
  end

  defp existing_assessment_challenge(email) do
    case Repo.get_by(EmailAccessRequest, email: email, status: :pending) do
      %EmailAccessRequest{id: request_id} ->
        case AdventureTimeApi.AccessAssessment.Challenges.issue(request_id) do
          {:ok, challenge} -> challenge
          {:error, _reason} -> nil
        end

      nil ->
        nil
    end
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

  defp delete_user_record(%User{} = user) do
    normalized_email = normalize_email(user.email)
    anonymous_tombstone = Ecto.UUID.generate()

    Multi.new()
    |> Multi.update_all(
      :anonymize_leaderboard_rows,
      from(row in SnapshotRow, where: row.user_id == ^user.id),
      set: [
        user_id: nil,
        public_profile_id: nil,
        anonymous_tombstone: anonymous_tombstone,
        identity_audit: %{}
      ]
    )
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
      :delete_notification_devices,
      from(device in NotificationDevice, where: device.user_id == ^user.id)
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
      :delete_provider_identities,
      from(identity in AuthProviderIdentity, where: identity.user_id == ^user.id)
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
              "wordle_daily_fr",
              "wordle_daily_en",
              "speed_calculus_daily",
              "daily_numbers_1_5",
              "daily_numbers_2_4",
              "daily_numbers_3_3"
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
    daily_quest_completion = admin_daily_quest_completion(user)

    %{
      "id" => user.id,
      "email" => user.email,
      "displayName" => user.display_name,
      "coins" => user.coins,
      "authMethods" => auth_methods_for_user(user),
      "role" => Atom.to_string(user.role),
      "accessStatus" => Atom.to_string(user.access_status),
      "isAdmin" => admin_role?(user.role),
      "isSuperAdmin" => super_admin_role?(user.role),
      "createdAt" => user.inserted_at |> DateTime.to_iso8601(),
      "dailyQuestCompletion" => daily_quest_completion
    }
  end

  defp admin_daily_quest_completion(user) do
    date = Quests.current_reset_date(user.timezone || @default_timezone)
    Quests.materialize_daily_quests(user.id, date)

    quests =
      DailyQuest
      |> where([quest], quest.user_id == ^user.id and quest.date == ^date)
      |> Repo.all()

    total = length(quests)

    completed =
      Enum.count(quests, fn quest ->
        quest.claimed || quest.completed
      end)

    percentage =
      if total > 0 do
        completed
        |> Kernel.*(100)
        |> Kernel./(total)
        |> round()
      else
        0
      end

    %{
      "completed" => completed,
      "total" => total,
      "percentage" => percentage
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

  defp validate_current_password(password) when is_binary(password) do
    if String.trim(password) == "" do
      {:error, "currentPassword is required"}
    else
      {:ok, password}
    end
  end

  defp validate_current_password(_), do: {:error, "currentPassword is required"}

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
