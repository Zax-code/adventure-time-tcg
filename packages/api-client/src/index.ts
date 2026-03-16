import {
  adminAbilitiesResponseSchema,
  adminAbilityEditSchema,
  adminCardsResponseSchema,
  adminCardDetailSchema,
  adminCardAbilityAssignSchema,
  adminCardSummarySchema,
  adminUsersResponseSchema,
  allowedEmailsResponseSchema,
  emailAccessRequestsResponseSchema,
  featuredCardsResponseSchema,
  raritiesResponseSchema,
  pvpSpectateResponseSchema,
  updateDisplayNameSchema,
  updateLanguageSchema,
  adminCoinAdjustSchema,
  adminAllowedEmailSchema,
  adminEmailRequestActionSchema,
  authUserSchema,
  authResponseSchema,
  claimQuestResponseSchema,
  claimQuestSchema,
  collectionResponseSchema,
  craftRecycleResponseSchema,
  dailyClaimResponseSchema,
  dailyClaimStatusSchema,
  dustActionSchema,
  giftsResponseSchema,
  googleAuthSchema,
  healthStepsResponseSchema,
  homeResponseSchema,
  loginSchema,
  openPackResponseSchema,
  openPackSchema,
  packsResponseSchema,
  pvpHistoryResponseSchema,
  pvpLoadoutMutationSchema,
  pvpLoadoutsResponseSchema,
  pvpMatchDetailResponseSchema,
  pvpInviteSchema,
  pvpInvitesResponseSchema,
  questsResponseSchema,
  refreshTokenSchema,
  registerSchema,
  processGiftSchema,
  sendGiftSchema,
  speedAnswerSchema,
  speedFinishSchema,
  speedRunStateSchema,
  syncStepsSchema,
  updateStepSourceSchema,
  usersResponseSchema,
  wordleStateResponseSchema,
  wordleSubmitResponseSchema,
  wordleSubmitSchema,
  type AdminAbilitiesResponse,
  type AdminCardsResponse,
  type AdminUsersResponse,
  type AllowedEmailsResponse,
  type EmailAccessRequestsResponse,
  type FeaturedCardsResponse,
  type RaritiesResponse,
  type PvpSpectateResponse,
  type AuthResponse,
  type ClaimQuestInput,
  type ClaimQuestResponse,
  type CollectionResponse,
  type DailyClaimResponse,
  type DailyClaimStatus,
  type HealthStepsResponse,
  type HomeResponse,
  type GoogleAuthInput,
  type LoginInput,
  type OpenPackInput,
  type OpenPackResponse,
  type PacksResponse,
  type PvpMatch,
  type QuestsResponse,
  type RefreshTokenInput,
  type RegisterInput,
  type SpeedRunState,
  type SyncStepsInput,
  type UpdateStepSourceInput,
  type UpdateLanguageInput,
  type WordleStateResponse,
  type WordleSubmitInput,
  type WordleSubmitResponse,
} from "@adventure-time/shared";

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null | Promise<string | null>;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  private async request<T>(
    path: string,
    init: RequestInit,
    parser: (data: unknown) => T,
  ): Promise<T> {
    const accessToken = await this.options.getAccessToken?.();
    const response = await fetch(`${this.options.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        code?: string;
      } | null;
      throw new ApiClientError(
        payload?.error ?? `Request failed with status ${response.status}`,
        response.status,
        payload?.code,
      );
    }

    return parser(await response.json());
  }

  private async upload<T>(
    path: string,
    formData: FormData,
    parser: (data: unknown) => T,
  ): Promise<T> {
    const accessToken = await this.options.getAccessToken?.();
    const response = await fetch(`${this.options.baseUrl}${path}`, {
      method: "POST",
      body: formData,
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        code?: string;
      } | null;
      throw new ApiClientError(
        payload?.error ?? `Request failed with status ${response.status}`,
        response.status,
        payload?.code,
      );
    }

    return parser(await response.json());
  }

  async register(input: RegisterInput): Promise<AuthResponse> {
    const body = registerSchema.parse(input);
    return this.request(
      "/auth/register",
      { method: "POST", body: JSON.stringify(body) },
      (data) => authResponseSchema.parse(data),
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

  async claimQuest(input: ClaimQuestInput): Promise<ClaimQuestResponse> {
    const body = claimQuestSchema.parse(input);
    return this.request(
      "/quests/claim",
      { method: "POST", body: JSON.stringify(body) },
      (data) => claimQuestResponseSchema.parse(data),
    );
  }

  async wordleState(): Promise<WordleStateResponse> {
    return this.request("/wordle", { method: "GET" }, (data) =>
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
      { method: "POST" },
      (data) => speedRunStateSchema.parse(data),
    );
  }

  async answerSpeedCalculus(runId: string, answer: number) {
    const body = speedAnswerSchema.parse({ runId, answer });
    return this.request(
      "/quests/speed-calculus/answer",
      { method: "POST", body: JSON.stringify(body) },
      (data) => data as { ok: boolean; activeRun: SpeedRunState["activeRun"] },
    );
  }

  async finishSpeedCalculus(runId: string): Promise<SpeedRunState> {
    const body = speedFinishSchema.parse({ runId });
    return this.request(
      "/quests/speed-calculus/finish",
      { method: "POST", body: JSON.stringify(body) },
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

  async pvpMatch(matchId: string) {
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

  async acceptPvpMatch(matchId: string, loadout: string[]) {
    return this.request(
      `/pvp/matches/${matchId}/accept`,
      { method: "POST", body: JSON.stringify({ loadout }) },
      (data) => data as PvpMatch,
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

  async actPvpMatch(matchId: string) {
    return this.request(
      `/pvp/matches/${matchId}/action`,
      { method: "POST", body: JSON.stringify({ actionType: "attack" }) },
      (data) =>
        data as { match: PvpMatch; battleState: unknown; events: unknown[] },
    );
  }

  async endTurnPvpMatch(matchId: string) {
    return this.request(
      `/pvp/matches/${matchId}/end-turn`,
      { method: "POST", body: JSON.stringify({}) },
      (data) =>
        data as { match: PvpMatch; battleState: unknown; events: unknown[] },
    );
  }

  async adminCards(): Promise<AdminCardsResponse> {
    return this.request("/admin/cards", { method: "GET" }, (data) =>
      adminCardsResponseSchema.parse(data),
    );
  }

  async adminAbilities(): Promise<AdminAbilitiesResponse> {
    return this.request("/admin/abilities", { method: "GET" }, (data) =>
      adminAbilitiesResponseSchema.parse(data),
    );
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

  async adjustAdminUserCoins(userId: string, delta: number) {
    const body = adminCoinAdjustSchema.parse({ delta });
    return this.request(
      `/admin/users/${userId}/coins`,
      { method: "PATCH", body: JSON.stringify(body) },
      (data) => data as { id: string; coins: number },
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
    const body = adminAllowedEmailSchema.parse({ email: "", isAdmin });
    return this.request(
      `/admin/emails/${id}`,
      { method: "PATCH", body: JSON.stringify({ isAdmin: body.isAdmin }) },
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

  async pvpSpectateMatch(matchId: string) {
    return this.request(
      `/pvp/spectate/${matchId}`,
      { method: "GET" },
      (data) => data as { match: PvpMatch; battleState: unknown },
    );
  }
}
