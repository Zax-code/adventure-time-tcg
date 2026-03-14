import {
  authResponseSchema,
  collectionResponseSchema,
  homeResponseSchema,
  loginSchema,
  registerSchema,
  type AuthResponse,
  type CollectionResponse,
  type HomeResponse,
  type LoginInput,
  type RegisterInput,
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

  async home(): Promise<HomeResponse> {
    return this.request("/home", { method: "GET" }, (data) => homeResponseSchema.parse(data));
  }

  async collection(): Promise<CollectionResponse> {
    return this.request("/collection", { method: "GET" }, (data) => collectionResponseSchema.parse(data));
  }
}
