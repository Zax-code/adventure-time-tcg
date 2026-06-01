import {
  adminAbilitySchema,
  adminAbilitiesResponseSchema,
  adminAbilityEditSchema,
  adminImageAssetSchema,
  adminImageAssetsResponseSchema,
  adminPackDetailSchema,
  adminPackEditSchema,
  adminPacksResponseSchema,
  adminCardAbilityAssignmentSchema,
  adminCardsResponseSchema,
  adminCardDetailSchema,
  adminCardAbilityAssignSchema,
  adminCardSummarySchema,
  cardTypeSchema,
  adminUserDeleteResponseSchema,
  adminUserDetailSchema,
  adminUserQuestResetInputSchema,
  adminUserQuestResetResponseSchema,
  adminUserRoleUpdateSchema,
  adminUsersResponseSchema,
  allowedEmailsResponseSchema,
  emailAccessRequestsResponseSchema,
  featuredCardsResponseSchema,
  raritiesResponseSchema,
  pvpSpectateResponseSchema,
  pvpSpectateDetailResponseSchema,
  updateDisplayNameSchema,
  updateLanguageSchema,
  updateNotificationPreferencesSchema,
  updateTimezoneSchema,
  adminCoinAdjustSchema,
  adminAllowedEmailSchema,
  adminAllowedEmailUpdateSchema,
  adminEmailRequestActionSchema,
  authUserSchema,
  authResponseSchema,
  claimQuestResponseSchema,
  claimQuestSchema,
  collectionResponseSchema,
  craftRecycleResponseSchema,
  dailyClaimResponseSchema,
  dailyClaimStatusSchema,
  fitbitAuthorizeResponseSchema,
  fitbitAuthorizeSchema,
  fitbitDisconnectResponseSchema,
  fitbitStatusResponseSchema,
  dustActionSchema,
  giftsResponseSchema,
  googleAuthSchema,
  healthStepsResponseSchema,
  homeResponseSchema,
  loginSchema,
  openPackResponseSchema,
  openPackSchema,
  packsResponseSchema,
  pvpActionSchema,
  pvpEndTurnSchema,
  pvpHistoryResponseSchema,
  pvpLoadoutMutationSchema,
  pvpLoadoutsResponseSchema,
  pvpMatchDetailResponseSchema,
  pvpMatchMutationResponseSchema,
  pvpInviteSchema,
  pvpInvitesResponseSchema,
  questsResponseSchema,
  registerNotificationDeviceSchema,
  refreshTokenSchema,
  requestPasswordResetResponseSchema,
  requestPasswordResetSchema,
  registerSchema,
  registerResponseSchema,
  processGiftSchema,
  resetPasswordResponseSchema,
  resetPasswordSchema,
  resendVerificationSchema,
  sendGiftSchema,
  speedAnswerSchema,
  speedAnswerResponseSchema,
  speedFinishSchema,
  speedRunStateSchema,
  syncStepsSchema,
  updateStepSourceSchema,
  usersResponseSchema,
  verifyEmailResponseSchema,
  verifyEmailSchema,
  wordleStateResponseSchema,
  wordleSubmitResponseSchema,
  wordleSubmitSchema,
  type AdminAbilitiesResponse,
  type AdminCardsResponse,
  type AdminImageAsset,
  type AdminImageAssetsResponse,
  type AdminPackDetail,
  type AdminPackEditInput,
  type AdminPacksResponse,
  type AdminUserDeleteResponse,
  type AdminUserDetail,
  type AdminUserQuestResetInput,
  type AdminUserQuestResetResponse,
  type AdminUserRoleUpdateInput,
  type AdminUsersResponse,
  type AllowedEmailsResponse,
  type EmailAccessRequestsResponse,
  type FeaturedCardsResponse,
  type RaritiesResponse,
  type PvpSpectateResponse,
  type PvpSpectateDetailResponse,
  type AuthResponse,
  type ClaimQuestInput,
  type ClaimQuestResponse,
  type CollectionResponse,
  type DailyClaimResponse,
  type DailyClaimStatus,
  type FitbitAuthorizeInput,
  type FitbitAuthorizeResponse,
  type FitbitDisconnectResponse,
  type FitbitStatusResponse,
  type HealthStepsResponse,
  type HomeResponse,
  type GoogleAuthInput,
  type LoginInput,
  type OpenPackInput,
  type OpenPackResponse,
  type PacksResponse,
  type PvpAction,
  type PvpEndTurnInput,
  type PvpBattleState,
  type PvpMatch,
  type PvpMatchDetailResponse,
  type QuestsResponse,
  type RegisterNotificationDeviceInput,
  type RefreshTokenInput,
  type RequestPasswordResetInput,
  type RequestPasswordResetResponse,
  type RegisterInput,
  type RegisterResponse,
  type ResetPasswordInput,
  type ResetPasswordResponse,
  type ResendVerificationInput,
  type SpeedRunAnswerResponse,
  type SpeedRunState,
  type SyncStepsInput,
  type UpdateStepSourceInput,
  type UpdateLanguageInput,
  type UpdateNotificationPreferencesInput,
  type UpdateTimezoneInput,
  type VerifyEmailInput,
  type VerifyEmailResponse,
  type WordleStateResponse,
  type WordleSubmitInput,
  type WordleSubmitResponse,
} from "@adventure-time/contracts";
import { z } from "zod";

export * from "@adventure-time/contracts";

const adminAbilitiesEnvelopeSchema = z.object({
  abilities: z.array(z.unknown()),
  cardAbilities: z.array(z.unknown()),
  cards: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      character: z.string(),
      type: cardTypeSchema,
    }),
  ),
});

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null | Promise<string | null>;
  refreshAccessToken?: () => Promise<string | null>;
  onAuthFailure?: () => void | Promise<void>;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export class ApiNetworkError extends Error {
  constructor(
    message = "Network request failed",
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ApiNetworkError";
  }
}

export function isNetworkError(error: unknown): error is ApiNetworkError {
  if (error instanceof ApiNetworkError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return /network request failed|failed to fetch|load failed/i.test(
    error.message,
  );
}

export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  private async execute<T>(
    path: string,
    init: RequestInit,
    parser: (data: unknown) => T,
    opts: { allowRefresh: boolean; isJson: boolean },
  ): Promise<T> {
    const accessToken = await this.options.getAccessToken?.();
    const headers: Record<string, string> = {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...((init.headers as Record<string, string> | undefined) ?? {}),
    };

    if (
      opts.isJson &&
      init.body !== undefined &&
      init.body !== null &&
      !("Content-Type" in headers)
    ) {
      headers["Content-Type"] = "application/json";
    }

    let response: Response;

    try {
      response = await fetch(`${this.options.baseUrl}${path}`, {
        ...init,
        headers,
      });
    } catch (error) {
      throw new ApiNetworkError(
        error instanceof Error && error.message
          ? error.message
          : "Network request failed",
        error,
      );
    }

    if (
      response.status === 401 &&
      opts.allowRefresh &&
      this.options.refreshAccessToken
    ) {
      const refreshedToken = await this.options.refreshAccessToken();

      if (refreshedToken) {
        return this.execute(path, init, parser, {
          ...opts,
          allowRefresh: false,
        });
      }

      await this.options.onAuthFailure?.();
    }

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | ({
            error?: string;
            code?: string;
          } & Record<string, unknown>)
        | null;
      throw new ApiClientError(
        payload?.error ?? `Request failed with status ${response.status}`,
        response.status,
        payload?.code,
        payload ?? undefined,
      );
    }

    return parser(await response.json());
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    parser: (data: unknown) => T,
  ): Promise<T> {
    return this.execute(path, init, parser, {
      allowRefresh: !path.startsWith("/auth/"),
      isJson: true,
    });
  }

  private async upload<T>(
    path: string,
    formData: FormData,
    parser: (data: unknown) => T,
  ): Promise<T> {
    return this.execute(path, { method: "POST", body: formData }, parser, {
      allowRefresh: !path.startsWith("/auth/"),
      isJson: false,
    });
  }

  async register(input: RegisterInput): Promise<RegisterResponse> {
    const body = registerSchema.parse(input);
    return this.request(
      "/auth/register",
      { method: "POST", body: JSON.stringify(body) },
      (data) => registerResponseSchema.parse(data),
    );
  }

  async verifyEmail(input: VerifyEmailInput): Promise<VerifyEmailResponse> {
    const body = verifyEmailSchema.parse(input);
    return this.request(
      "/auth/verify-email",
      { method: "POST", body: JSON.stringify(body) },
      (data) => verifyEmailResponseSchema.parse(data),
    );
  }

  async resendVerification(
    input: ResendVerificationInput,
  ): Promise<VerifyEmailResponse> {
    const body = resendVerificationSchema.parse(input);
    return this.request(
      "/auth/resend-verification",
      { method: "POST", body: JSON.stringify(body) },
      (data) => verifyEmailResponseSchema.parse(data),
    );
  }

  async requestPasswordReset(
    input: RequestPasswordResetInput,
  ): Promise<RequestPasswordResetResponse> {
    const body = requestPasswordResetSchema.parse(input);
    return this.request(
      "/auth/request-password-reset",
      { method: "POST", body: JSON.stringify(body) },
      (data) => requestPasswordResetResponseSchema.parse(data),
    );
  }

  async resetPassword(input: ResetPasswordInput): Promise<ResetPasswordResponse> {
    const body = resetPasswordSchema.parse(input);
    return this.request(
      "/auth/reset-password",
      { method: "POST", body: JSON.stringify(body) },
      (data) => resetPasswordResponseSchema.parse(data),
    );
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const body = loginSchema.parse(input);
    return this.request(
      "/auth/login",
      { method: "POST", body: JSON.stringify(body) },
      (data) => authResponseSchema.parse(data),
    );
  }

  async googleAuth(input: GoogleAuthInput): Promise<AuthResponse> {
    const body = googleAuthSchema.parse(input);
    return this.request(
      "/auth/google",
      { method: "POST", body: JSON.stringify(body) },
      (data) => authResponseSchema.parse(data),
    );
  }

  async refresh(input: RefreshTokenInput): Promise<AuthResponse> {
    const body = refreshTokenSchema.parse(input);
    return this.request(
      "/auth/refresh",
      { method: "POST", body: JSON.stringify(body) },
      (data) => authResponseSchema.parse(data),
    );
  }

  async me() {
    return this.request("/me", { method: "GET" }, (data) =>
      authUserSchema.parse(data),
    );
  }

  async home(): Promise<HomeResponse> {
    return this.request("/home", { method: "GET" }, (data) =>
      homeResponseSchema.parse(data),
    );
  }

  async collection(): Promise<CollectionResponse> {
    return this.request("/collection", { method: "GET" }, (data) =>
      collectionResponseSchema.parse(data),
    );
  }

  async users() {
    return this.request("/users", { method: "GET" }, (data) =>
      usersResponseSchema.parse(data),
    );
  }

  async gifts() {
    return this.request("/gifts", { method: "GET" }, (data) =>
      giftsResponseSchema.parse(data),
    );
  }

  async sendGift(input: {
    cardId: string;
    toUserId: string;
    quantity?: number;
    message?: string;
  }) {
    const body = sendGiftSchema.parse(input);
    return this.request(
      "/gifts",
      { method: "POST", body: JSON.stringify(body) },
      (data) => data as { gift: { id: string } },
    );
  }

  async processGift(input: { giftId: string; action: "accept" | "reject" }) {
    const body = processGiftSchema.parse(input);
    return this.request(
      "/gifts",
      { method: "PATCH", body: JSON.stringify(body) },
      (data) => data as { success: boolean; status: string },
    );
  }

  async craftCard(cardId: string, quantity = 1) {
    const body = dustActionSchema.parse({ cardId, quantity });
    return this.request(
      "/collection/craft",
      { method: "POST", body: JSON.stringify(body) },
      (data) => craftRecycleResponseSchema.parse(data),
    );
  }

  async recycleCard(cardId: string, quantity = 1) {
    const body = dustActionSchema.parse({ cardId, quantity });
    return this.request(
      "/collection/recycle",
      { method: "POST", body: JSON.stringify(body) },
      (data) => craftRecycleResponseSchema.parse(data),
    );
  }

  async packs(): Promise<PacksResponse> {
    return this.request("/packs", { method: "GET" }, (data) =>
      packsResponseSchema.parse(data),
    );
  }

  async openPack(input: OpenPackInput): Promise<OpenPackResponse> {
    const body = openPackSchema.parse(input);
    return this.request(
      "/packs/open",
      { method: "POST", body: JSON.stringify(body) },
      (data) => openPackResponseSchema.parse(data),
    );
  }

  async getDailyClaimStatus(): Promise<DailyClaimStatus> {
    return this.request("/daily-claim", { method: "GET" }, (data) =>
      dailyClaimStatusSchema.parse(data),
    );
  }

  async claimDailyReward(): Promise<DailyClaimResponse> {
    return this.request("/daily-claim", { method: "POST" }, (data) =>
      dailyClaimResponseSchema.parse(data),
    );
  }

  async quests(): Promise<QuestsResponse> {
    return this.request("/quests", { method: "GET" }, (data) =>
      questsResponseSchema.parse(data),
    );
  }

  async fitbitStatus(): Promise<FitbitStatusResponse> {
    return this.request("/fitbit/status", { method: "GET" }, (data) =>
      fitbitStatusResponseSchema.parse(data),
    );
  }

  async createFitbitAuthorizeUrl(
    input: FitbitAuthorizeInput,
  ): Promise<FitbitAuthorizeResponse> {
    const body = fitbitAuthorizeSchema.parse(input);
    return this.request(
      "/fitbit/authorize",
      { method: "POST", body: JSON.stringify(body) },
      (data) => fitbitAuthorizeResponseSchema.parse(data),
    );
  }

  async disconnectFitbit(): Promise<FitbitDisconnectResponse> {
    return this.request("/fitbit/disconnect", { method: "POST" }, (data) =>
      fitbitDisconnectResponseSchema.parse(data),
    );
  }

  async claimQuest(input: ClaimQuestInput): Promise<ClaimQuestResponse> {
    const body = claimQuestSchema.parse(input);
    return this.request(
      "/quests/claim",
      { method: "POST", body: JSON.stringify(body) },
      (data) => claimQuestResponseSchema.parse(data),
    );
  }

  async wordleState(locale?: "fr" | "en"): Promise<WordleStateResponse> {
    const query = locale ? `?locale=${encodeURIComponent(locale)}` : "";
    return this.request(`/wordle${query}`, { method: "GET" }, (data) =>
      wordleStateResponseSchema.parse(data),
    );
  }

  async submitWordle(input: WordleSubmitInput): Promise<WordleSubmitResponse> {
    const body = wordleSubmitSchema.parse(input);
    return this.request(
      "/wordle",
      { method: "POST", body: JSON.stringify(body) },
      (data) => wordleSubmitResponseSchema.parse(data),
    );
  }

  async speedCalculusState(): Promise<SpeedRunState> {
    return this.request("/quests/speed-calculus", { method: "GET" }, (data) =>
      speedRunStateSchema.parse(data),
    );
  }

  async startSpeedCalculus(): Promise<SpeedRunState> {
    return this.request(
      "/quests/speed-calculus/start",
      { method: "POST", body: JSON.stringify({}) },
      (data) => speedRunStateSchema.parse(data),
    );
  }

  async answerSpeedCalculus(
    runId: string,
    answer: number,
    questVersion?: string,
  ): Promise<SpeedRunAnswerResponse> {
    const body = speedAnswerSchema.parse({ runId, answer, questVersion });
    return this.request(
      "/quests/speed-calculus/answer",
      { method: "POST", body: JSON.stringify(body) },
      (data) => speedAnswerResponseSchema.parse(data),
    );
  }

  async resumeSpeedCalculus(): Promise<SpeedRunState> {
    return this.request(
      "/quests/speed-calculus/resume",
      { method: "POST", body: JSON.stringify({}) },
      (data) => speedRunStateSchema.parse(data),
    );
  }

  async pauseSpeedCalculus(): Promise<SpeedRunState> {
    return this.request(
      "/quests/speed-calculus/pause",
      { method: "POST", body: JSON.stringify({}) },
      (data) => speedRunStateSchema.parse(data),
    );
  }

  async finishSpeedCalculus(
    runId: string,
    questVersion?: string,
  ): Promise<SpeedRunState & { correctAnswers?: number; reward?: number }> {
    const body = speedFinishSchema.parse({ runId, questVersion });
    return this.request(
      "/quests/speed-calculus/finish",
      { method: "POST", body: JSON.stringify(body) },
      (data) => {
        const parsed = speedRunStateSchema.parse(data);
        const raw = data as Record<string, unknown>;
        return {
          ...parsed,
          correctAnswers:
            typeof raw.correctAnswers === "number"
              ? raw.correctAnswers
              : undefined,
          reward:
            typeof raw.reward === "number" ? raw.reward : parsed.rewardPreview,
        };
      },
    );
  }

  async cashoutSpeedCalculus(): Promise<SpeedRunState> {
    return this.request(
      "/quests/speed-calculus/cashout",
      { method: "POST", body: JSON.stringify({}) },
      (data) => speedRunStateSchema.parse(data),
    );
  }

  async pvpInvites() {
    return this.request("/pvp/invites", { method: "GET" }, (data) =>
      pvpInvitesResponseSchema.parse(data),
    );
  }

  async createPvpInvite(inviteeEmail: string, loadout: string[]) {
    const body = pvpInviteSchema.parse({ inviteeEmail, loadout });
    return this.request(
      "/pvp/invites",
      { method: "POST", body: JSON.stringify(body) },
      (data) => data as { success: boolean },
    );
  }

  async pvpLoadouts() {
    return this.request("/pvp/loadouts", { method: "GET" }, (data) =>
      pvpLoadoutsResponseSchema.parse(data),
    );
  }

  async createPvpLoadout(name: string, cardIds: string[]) {
    const body = pvpLoadoutMutationSchema.parse({ name, cardIds });
    return this.request(
      "/pvp/loadouts",
      { method: "POST", body: JSON.stringify(body) },
      (data) => data as { loadout: unknown },
    );
  }

  async updatePvpLoadout(loadoutId: string, name: string, cardIds: string[]) {
    const body = pvpLoadoutMutationSchema.parse({ name, cardIds });
    return this.request(
      `/pvp/loadouts/${loadoutId}`,
      { method: "PUT", body: JSON.stringify(body) },
      (data) => data as { loadout: unknown },
    );
  }

  async deletePvpLoadout(loadoutId: string) {
    return this.request(
      `/pvp/loadouts/${loadoutId}`,
      { method: "DELETE" },
      (data) => data as { success: boolean },
    );
  }

  async pvpMatches() {
    return this.request("/pvp/matches", { method: "GET" }, (data) =>
      pvpHistoryResponseSchema.parse(data),
    );
  }

  async pvpMatch(matchId: string): Promise<PvpMatchDetailResponse> {
    return this.request(`/pvp/matches/${matchId}`, { method: "GET" }, (data) =>
      pvpMatchDetailResponseSchema.parse(data),
    );
  }

  async pvpHistory() {
    return this.request("/pvp/history", { method: "GET" }, (data) =>
      pvpHistoryResponseSchema.parse(data),
    );
  }

  async pvpHistoryDetail(matchId: string) {
    return this.request(`/pvp/history/${matchId}`, { method: "GET" }, (data) =>
      pvpMatchDetailResponseSchema.parse(data),
    );
  }

  async cancelPvpInvite(matchId: string) {
    return this.request(
      `/pvp/invites?matchId=${encodeURIComponent(matchId)}`,
      { method: "DELETE" },
      (data) => data as { success: boolean },
    );
  }

  async acceptPvpMatch(matchId: string, loadout: string[]) {
    return this.request(
      `/pvp/matches/${matchId}/accept`,
      { method: "POST", body: JSON.stringify({ loadout }) },
      (data) => pvpMatchDetailResponseSchema.parse(data),
    );
  }

  async declinePvpMatch(matchId: string) {
    return this.request(
      `/pvp/matches/${matchId}/decline`,
      { method: "POST" },
      (data) => data as { success: boolean },
    );
  }

  async concedePvpMatch(matchId: string) {
    return this.request(
      `/pvp/matches/${matchId}/concede`,
      { method: "POST" },
      (data) => data as { success: boolean },
    );
  }

  async actPvpMatch(
    matchId: string,
    action: PvpAction,
  ): Promise<{
    match: PvpMatch;
    battleState: PvpBattleState | null;
    events: unknown[];
  }> {
    const body = pvpActionSchema.parse(action);
    return this.request(
      `/pvp/matches/${matchId}/action`,
      { method: "POST", body: JSON.stringify(body) },
      (data) => {
        const parsed = pvpMatchMutationResponseSchema.parse(data);
        return { ...parsed, events: parsed.events ?? [] };
      },
    );
  }

  async endTurnPvpMatch(
    matchId: string,
    input?: PvpEndTurnInput,
  ): Promise<{
    match: PvpMatch;
    battleState: PvpBattleState | null;
    events: unknown[];
  }> {
    const body = pvpEndTurnSchema.parse(input ?? {});
    return this.request(
      `/pvp/matches/${matchId}/end-turn`,
      { method: "POST", body: JSON.stringify(body) },
      (data) => {
        const parsed = pvpMatchMutationResponseSchema.parse(data);
        return { ...parsed, events: parsed.events ?? [] };
      },
    );
  }

  async adminCards(): Promise<AdminCardsResponse> {
    return this.request("/admin/cards", { method: "GET" }, (data) =>
      adminCardsResponseSchema.parse(data),
    );
  }

  async adminPacks(): Promise<AdminPacksResponse> {
    return this.request("/admin/packs", { method: "GET" }, (data) =>
      adminPacksResponseSchema.parse(data),
    );
  }

  async createAdminPack(input: AdminPackEditInput): Promise<AdminPackDetail> {
    const body = adminPackEditSchema.parse(input);
    return this.request(
      "/admin/packs",
      { method: "POST", body: JSON.stringify(body) },
      (data) => adminPackDetailSchema.parse(data),
    );
  }

  async updateAdminPack(
    packId: string,
    input: Partial<AdminPackEditInput>,
  ): Promise<AdminPackDetail> {
    return this.request(
      `/admin/packs/${packId}`,
      { method: "PATCH", body: JSON.stringify(input) },
      (data) => adminPackDetailSchema.parse(data),
    );
  }

  async adminImageAssets(): Promise<AdminImageAssetsResponse> {
    return this.request("/admin/image-assets", { method: "GET" }, (data) =>
      adminImageAssetsResponseSchema.parse(data),
    );
  }

  async uploadAdminImageAsset(formData: FormData): Promise<AdminImageAsset> {
    return this.upload("/admin/image-assets", formData, (data) =>
      adminImageAssetSchema.parse(data),
    );
  }

  async adminAbilities(): Promise<AdminAbilitiesResponse> {
    return this.request("/admin/abilities", { method: "GET" }, (data) => {
      const parsed = adminAbilitiesResponseSchema.safeParse(data);
      if (parsed.success) {
        return parsed.data;
      }

      const envelope = adminAbilitiesEnvelopeSchema.parse(data);

      return {
        abilities: envelope.abilities.flatMap((ability) => {
          const parsedAbility = adminAbilitySchema.safeParse(ability);
          return parsedAbility.success ? [parsedAbility.data] : [];
        }),
        cardAbilities: envelope.cardAbilities.flatMap((assignment) => {
          const parsedAssignment =
            adminCardAbilityAssignmentSchema.safeParse(assignment);
          return parsedAssignment.success ? [parsedAssignment.data] : [];
        }),
        cards: envelope.cards,
      };
    });
  }

  async createAdminAbility(input: Record<string, unknown>) {
    const body = adminAbilityEditSchema.parse(input);
    return this.request(
      "/admin/abilities",
      { method: "POST", body: JSON.stringify(body) },
      (data) => data as { ability: unknown },
    );
  }

  async updateAdminAbility(id: string, input: Record<string, unknown>) {
    const body = adminAbilityEditSchema.parse(input);
    return this.request(
      `/admin/abilities/${id}`,
      { method: "PATCH", body: JSON.stringify(body) },
      (data) => data as { ability: unknown },
    );
  }

  async deleteAdminAbility(id: string) {
    return this.request(
      `/admin/abilities/${id}`,
      { method: "DELETE" },
      (data) => data as { success: boolean },
    );
  }

  async assignAdminCardAbility(input: {
    cardId: string;
    passiveId?: string | null;
    skillId?: string | null;
    ultimateId?: string | null;
  }) {
    const body = adminCardAbilityAssignSchema.parse(input);
    return this.request(
      "/admin/abilities/assign",
      { method: "POST", body: JSON.stringify(body) },
      (data) => data as { cardAbility: unknown },
    );
  }

  async deleteAdminCardAbility(cardId: string) {
    return this.request(
      `/admin/abilities/assign/${cardId}`,
      { method: "DELETE" },
      (data) => data as { success: boolean },
    );
  }

  async updateAdminCard(
    cardId: string,
    input: { isFeatured?: boolean; isArchived?: boolean },
  ) {
    return this.request(
      `/admin/cards/${cardId}`,
      { method: "PATCH", body: JSON.stringify(input) },
      (data) => adminCardSummarySchema.parse(data),
    );
  }

  async adminCard(cardId: string) {
    return this.request(`/admin/cards/${cardId}`, { method: "GET" }, (data) =>
      adminCardDetailSchema.parse(data),
    );
  }

  async saveAdminCard(cardId: string, input: Record<string, unknown>) {
    return this.request(
      `/admin/cards/${cardId}`,
      { method: "PUT", body: JSON.stringify(input) },
      (data) => adminCardDetailSchema.parse(data),
    );
  }

  async getHealthSteps(): Promise<HealthStepsResponse> {
    return this.request("/health/steps", { method: "GET" }, (data) =>
      healthStepsResponseSchema.parse(data),
    );
  }

  async syncSteps(input: SyncStepsInput) {
    const body = syncStepsSchema.parse(input);
    return this.request(
      "/health/steps",
      { method: "POST", body: JSON.stringify(body) },
      (data) => data,
    );
  }

  async updateStepSource(input: UpdateStepSourceInput) {
    const body = updateStepSourceSchema.parse(input);
    return this.request(
      "/settings/step-source",
      { method: "PATCH", body: JSON.stringify(body) },
      (data) => authUserSchema.parse(data),
    );
  }

  async updateDisplayName(displayName: string) {
    const body = updateDisplayNameSchema.parse({ displayName });
    return this.request(
      "/settings/display-name",
      { method: "PATCH", body: JSON.stringify(body) },
      (data) => authUserSchema.parse(data),
    );
  }

  async updateLanguage(input: UpdateLanguageInput) {
    const body = updateLanguageSchema.parse(input);
    return this.request(
      "/settings/language",
      { method: "PATCH", body: JSON.stringify(body) },
      (data) => authUserSchema.parse(data),
    );
  }

  async updateTimezone(input: UpdateTimezoneInput) {
    const body = updateTimezoneSchema.parse(input);
    return this.request(
      "/settings/timezone",
      { method: "PATCH", body: JSON.stringify(body) },
      (data) => authUserSchema.parse(data),
    );
  }

  async updateNotificationPreferences(input: UpdateNotificationPreferencesInput) {
    const body = updateNotificationPreferencesSchema.parse(input);
    return this.request(
      "/settings/notification-preferences",
      { method: "PATCH", body: JSON.stringify(body) },
      (data) => authUserSchema.parse(data),
    );
  }

  async registerNotificationDevice(input: RegisterNotificationDeviceInput) {
    const body = registerNotificationDeviceSchema.parse(input);
    return this.request(
      "/notifications/device",
      { method: "POST", body: JSON.stringify(body) },
      () => undefined,
    );
  }

  async unregisterNotificationDevice(installationId: string) {
    return this.request(
      `/notifications/device/${encodeURIComponent(installationId)}`,
      { method: "DELETE" },
      () => undefined,
    );
  }

  async uploadProfileImage(formData: FormData) {
    return this.upload(
      "/settings/upload",
      formData,
      (data) => data as { assetId: string },
    );
  }

  async rarities(): Promise<RaritiesResponse> {
    return this.request("/rarities", { method: "GET" }, (data) =>
      raritiesResponseSchema.parse(data),
    );
  }

  async featuredCards(): Promise<FeaturedCardsResponse> {
    return this.request("/featured-cards", { method: "GET" }, (data) =>
      featuredCardsResponseSchema.parse(data),
    );
  }

  async createAdminCard(input: Record<string, unknown>) {
    return this.request(
      "/admin/cards",
      { method: "POST", body: JSON.stringify(input) },
      (data) => data as Record<string, unknown>,
    );
  }

  async uploadAdminCardImage(cardId: string, formData: FormData) {
    return this.upload(
      `/admin/cards/${cardId}/image`,
      formData,
      (data) => data as { assetId: string },
    );
  }

  async adminUsers(): Promise<AdminUsersResponse> {
    return this.request("/admin/users", { method: "GET" }, (data) =>
      adminUsersResponseSchema.parse(data),
    );
  }

  async adminUserDetail(userId: string): Promise<AdminUserDetail> {
    return this.request(`/admin/users/${userId}`, { method: "GET" }, (data) =>
      adminUserDetailSchema.parse(data),
    );
  }

  async adjustAdminUserCoins(userId: string, delta: number) {
    const body = adminCoinAdjustSchema.parse({ delta });
    return this.request(
      `/admin/users/${userId}/coins`,
      { method: "PATCH", body: JSON.stringify(body) },
      (data) => data as { id: string; coins: number },
    );
  }

  async updateAdminUserRole(userId: string, input: AdminUserRoleUpdateInput) {
    const body = adminUserRoleUpdateSchema.parse(input);
    return this.request(
      `/admin/users/${userId}/role`,
      { method: "PATCH", body: JSON.stringify(body) },
      (data) => data as { id: string; isAdmin: boolean; isSuperAdmin: boolean },
    );
  }

  async resetAdminUserDailyQuests(
    userId: string,
    input: AdminUserQuestResetInput,
  ): Promise<AdminUserQuestResetResponse> {
    const body = adminUserQuestResetInputSchema.parse(input);
    return this.request(
      `/admin/users/${userId}/reset-daily-quests`,
      { method: "POST", body: JSON.stringify(body) },
      (data) => adminUserQuestResetResponseSchema.parse(data),
    );
  }

  async deleteAdminUser(userId: string): Promise<AdminUserDeleteResponse> {
    return this.request(
      `/admin/users/${userId}`,
      { method: "DELETE" },
      (data) => adminUserDeleteResponseSchema.parse(data),
    );
  }

  async adminAllowedEmails(): Promise<AllowedEmailsResponse> {
    return this.request("/admin/emails", { method: "GET" }, (data) =>
      allowedEmailsResponseSchema.parse(data),
    );
  }

  async addAdminAllowedEmail(email: string, isAdmin?: boolean) {
    const body = adminAllowedEmailSchema.parse({ email, isAdmin });
    return this.request(
      "/admin/emails",
      { method: "POST", body: JSON.stringify(body) },
      (data) => data as Record<string, unknown>,
    );
  }

  async updateAdminAllowedEmail(id: string, isAdmin: boolean) {
    const body = adminAllowedEmailUpdateSchema.parse({ isAdmin });
    return this.request(
      `/admin/emails/${id}`,
      { method: "PATCH", body: JSON.stringify(body) },
      (data) => data as Record<string, unknown>,
    );
  }

  async deleteAdminAllowedEmail(id: string) {
    return this.request(
      `/admin/emails/${id}`,
      { method: "DELETE" },
      (data) => data as { success: boolean },
    );
  }

  async adminEmailRequests(): Promise<EmailAccessRequestsResponse> {
    return this.request("/admin/email-requests", { method: "GET" }, (data) =>
      emailAccessRequestsResponseSchema.parse(data),
    );
  }

  async reviewAdminEmailRequest(id: string, status: "approved" | "rejected") {
    const body = adminEmailRequestActionSchema.parse({ status });
    return this.request(
      `/admin/email-requests/${id}`,
      { method: "PATCH", body: JSON.stringify(body) },
      (data) => data as { id: string; status: string },
    );
  }

  async pvpSpectate(): Promise<PvpSpectateResponse> {
    return this.request("/pvp/spectate", { method: "GET" }, (data) =>
      pvpSpectateResponseSchema.parse(data),
    );
  }

  async pvpSpectateMatch(matchId: string): Promise<PvpSpectateDetailResponse> {
    return this.request(
      `/pvp/spectate/${matchId}`,
      { method: "GET" },
      (data) => pvpSpectateDetailResponseSchema.parse(data),
    );
  }
}
