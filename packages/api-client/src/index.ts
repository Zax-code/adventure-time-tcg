import {
  authUserSchema,
  authResponseSchema,
  collectionResponseSchema,
  healthStepsResponseSchema,
  homeResponseSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  syncStepsSchema,
  updateStepSourceSchema,
  type AuthResponse,
  type CollectionResponse,
  type HealthStepsResponse,
  type HomeResponse,
  type LoginInput,
  type RefreshTokenInput,
  type RegisterInput,
  type SyncStepsInput,
  type UpdateStepSourceInput,
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
