import {
  adminCardsResponseSchema,
  adminCardSummarySchema,
  authUserSchema,
  authResponseSchema,
  claimQuestResponseSchema,
  claimQuestSchema,
  collectionResponseSchema,
  dailyClaimResponseSchema,
  dailyClaimStatusSchema,
  healthStepsResponseSchema,
  homeResponseSchema,
  loginSchema,
  openPackResponseSchema,
  openPackSchema,
  packsResponseSchema,
  pvpHistoryResponseSchema,
  pvpMatchDetailResponseSchema,
  pvpInviteSchema,
  pvpInvitesResponseSchema,
  questsResponseSchema,
  refreshTokenSchema,
  registerSchema,
  speedAnswerSchema,
  speedFinishSchema,
  speedRunStateSchema,
  syncStepsSchema,
  updateStepSourceSchema,
  wordleStateResponseSchema,
  wordleSubmitResponseSchema,
  wordleSubmitSchema,
  type AdminCardsResponse,
  type AuthResponse,
  type ClaimQuestInput,
  type ClaimQuestResponse,
  type CollectionResponse,
  type DailyClaimResponse,
  type DailyClaimStatus,
  type HealthStepsResponse,
  type HomeResponse,
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
  type WordleStateResponse,
  type WordleSubmitInput,
  type WordleSubmitResponse,
} from "@adventure-time/shared";

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null | Promise<string | null>;
}

export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  private async request<T>(path: string, init: RequestInit, parser: (data: unknown) => T): Promise<T> {
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
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? `Request failed with status ${response.status}`);
    }

    return parser(await response.json());
  }

  async register(input: RegisterInput): Promise<AuthResponse> {
    const body = registerSchema.parse(input);
    return this.request("/auth/register", { method: "POST", body: JSON.stringify(body) }, (data) => authResponseSchema.parse(data));
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const body = loginSchema.parse(input);
    return this.request("/auth/login", { method: "POST", body: JSON.stringify(body) }, (data) => authResponseSchema.parse(data));
  }

  async refresh(input: RefreshTokenInput): Promise<AuthResponse> {
    const body = refreshTokenSchema.parse(input);
    return this.request("/auth/refresh", { method: "POST", body: JSON.stringify(body) }, (data) => authResponseSchema.parse(data));
  }

  async me() {
    return this.request("/me", { method: "GET" }, (data) => authUserSchema.parse(data));
  }

  async home(): Promise<HomeResponse> {
    return this.request("/home", { method: "GET" }, (data) => homeResponseSchema.parse(data));
  }

  async collection(): Promise<CollectionResponse> {
    return this.request("/collection", { method: "GET" }, (data) => collectionResponseSchema.parse(data));
  }

  async packs(): Promise<PacksResponse> {
    return this.request("/packs", { method: "GET" }, (data) => packsResponseSchema.parse(data));
  }

  async openPack(input: OpenPackInput): Promise<OpenPackResponse> {
    const body = openPackSchema.parse(input);
    return this.request("/packs/open", { method: "POST", body: JSON.stringify(body) }, (data) => openPackResponseSchema.parse(data));
  }

  async getDailyClaimStatus(): Promise<DailyClaimStatus> {
    return this.request("/daily-claim", { method: "GET" }, (data) => dailyClaimStatusSchema.parse(data));
  }

  async claimDailyReward(): Promise<DailyClaimResponse> {
    return this.request("/daily-claim", { method: "POST" }, (data) => dailyClaimResponseSchema.parse(data));
  }

  async quests(): Promise<QuestsResponse> {
    return this.request("/quests", { method: "GET" }, (data) => questsResponseSchema.parse(data));
  }

  async claimQuest(input: ClaimQuestInput): Promise<ClaimQuestResponse> {
    const body = claimQuestSchema.parse(input);
    return this.request("/quests/claim", { method: "POST", body: JSON.stringify(body) }, (data) => claimQuestResponseSchema.parse(data));
  }

  async wordleState(): Promise<WordleStateResponse> {
    return this.request("/wordle", { method: "GET" }, (data) => wordleStateResponseSchema.parse(data));
  }

  async submitWordle(input: WordleSubmitInput): Promise<WordleSubmitResponse> {
    const body = wordleSubmitSchema.parse(input);
    return this.request("/wordle", { method: "POST", body: JSON.stringify(body) }, (data) => wordleSubmitResponseSchema.parse(data));
  }

  async speedCalculusState(): Promise<SpeedRunState> {
    return this.request("/quests/speed-calculus", { method: "GET" }, (data) => speedRunStateSchema.parse(data));
  }

  async startSpeedCalculus(): Promise<SpeedRunState> {
    return this.request("/quests/speed-calculus/start", { method: "POST" }, (data) => speedRunStateSchema.parse(data));
  }

  async answerSpeedCalculus(runId: string, answer: number) {
    const body = speedAnswerSchema.parse({ runId, answer });
    return this.request("/quests/speed-calculus/answer", { method: "POST", body: JSON.stringify(body) }, (data) => data as { ok: boolean; activeRun: SpeedRunState["activeRun"] });
  }

  async finishSpeedCalculus(runId: string): Promise<SpeedRunState> {
    const body = speedFinishSchema.parse({ runId });
    return this.request("/quests/speed-calculus/finish", { method: "POST", body: JSON.stringify(body) }, (data) => speedRunStateSchema.parse(data));
  }

  async pvpInvites() {
    return this.request("/pvp/invites", { method: "GET" }, (data) => pvpInvitesResponseSchema.parse(data));
  }

  async createPvpInvite(inviteeEmail: string, loadout: string[]) {
    const body = pvpInviteSchema.parse({ inviteeEmail, loadout });
    return this.request("/pvp/invites", { method: "POST", body: JSON.stringify(body) }, (data) => data as { success: boolean });
  }

  async pvpMatches() {
    return this.request("/pvp/matches", { method: "GET" }, (data) => pvpHistoryResponseSchema.parse(data));
  }

  async pvpMatch(matchId: string) {
    return this.request(`/pvp/matches/${matchId}`, { method: "GET" }, (data) => pvpMatchDetailResponseSchema.parse(data));
  }

  async pvpHistory() {
    return this.request("/pvp/history", { method: "GET" }, (data) => pvpHistoryResponseSchema.parse(data));
  }

  async pvpHistoryDetail(matchId: string) {
    return this.request(`/pvp/history/${matchId}`, { method: "GET" }, (data) => pvpMatchDetailResponseSchema.parse(data));
  }

  async acceptPvpMatch(matchId: string, loadout: string[]) {
    return this.request(`/pvp/matches/${matchId}/accept`, { method: "POST", body: JSON.stringify({ loadout }) }, (data) => data as PvpMatch);
  }

  async declinePvpMatch(matchId: string) {
    return this.request(`/pvp/matches/${matchId}/decline`, { method: "POST" }, (data) => data as { success: boolean });
  }

  async concedePvpMatch(matchId: string) {
    return this.request(`/pvp/matches/${matchId}/concede`, { method: "POST" }, (data) => data as { success: boolean });
  }

  async actPvpMatch(matchId: string) {
    return this.request(`/pvp/matches/${matchId}/action`, { method: "POST", body: JSON.stringify({ actionType: "attack" }) }, (data) => data as { match: PvpMatch; battleState: unknown; events: unknown[] });
  }

  async endTurnPvpMatch(matchId: string) {
    return this.request(`/pvp/matches/${matchId}/end-turn`, { method: "POST", body: JSON.stringify({}) }, (data) => data as { match: PvpMatch; battleState: unknown; events: unknown[] });
  }

  async adminCards(): Promise<AdminCardsResponse> {
    return this.request("/admin/cards", { method: "GET" }, (data) => adminCardsResponseSchema.parse(data));
  }

  async updateAdminCard(cardId: string, input: { isFeatured?: boolean; isArchived?: boolean }) {
    return this.request(`/admin/cards/${cardId}`, { method: "PATCH", body: JSON.stringify(input) }, (data) => adminCardSummarySchema.parse(data));
  }

  async getHealthSteps(): Promise<HealthStepsResponse> {
    return this.request("/health/steps", { method: "GET" }, (data) => healthStepsResponseSchema.parse(data));
  }

  async syncSteps(input: SyncStepsInput) {
    const body = syncStepsSchema.parse(input);
    return this.request("/health/steps", { method: "POST", body: JSON.stringify(body) }, (data) => data);
  }

  async updateStepSource(input: UpdateStepSourceInput) {
    const body = updateStepSourceSchema.parse(input);
    return this.request("/settings/step-source", { method: "PATCH", body: JSON.stringify(body) }, (data) => authUserSchema.parse(data));
  }
}
