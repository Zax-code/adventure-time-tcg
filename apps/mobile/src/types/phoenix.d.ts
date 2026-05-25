declare module "phoenix" {
  export interface Channel {
    on(event: string, callback: (payload: unknown) => void): void;
    join(): unknown;
    leave(): void;
  }

  export interface SocketOptions {
    params?: Record<string, unknown>;
  }

  export class Socket {
    constructor(endPoint: string, opts?: SocketOptions);
    connect(): void;
    disconnect(callback?: () => void, code?: number, reason?: string): void;
    channel(topic: string, chanParams?: Record<string, unknown>): Channel;
  }
}
