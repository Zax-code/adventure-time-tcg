import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApiClient, ApiClientError, ApiNetworkError } from "../src/index.ts";

describe("ApiClient request deadlines", () => {
  it("rejects a fetch that never settles instead of loading forever", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      })) as typeof fetch;

    try {
      const client = new ApiClient({
        baseUrl: "https://example.test",
        requestTimeoutMs: 20,
      });
      const outcome = await Promise.race([
        client.quests().catch((error: unknown) => error),
        new Promise((resolve) =>
          setTimeout(() => resolve("still-pending"), 100),
        ),
      ]);

      assert.ok(outcome instanceof ApiNetworkError);
      assert.equal(outcome.message, "Request timed out");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("ApiClient pending access errors", () => {
  it("preserves a structured Play Integrity challenge for the native client", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          error: "Access request pending",
          code: "ACCESS_REQUEST_PENDING",
          assessmentChallenge: {
            kind: "play_integrity_standard",
            token: "challenge-token",
            requestHash: "request-hash",
            expiresAt: "2026-08-16T12:05:00Z",
          },
        }),
        { status: 403, headers: { "content-type": "application/json" } },
      )) as typeof fetch;

    try {
      const client = new ApiClient({ baseUrl: "https://example.test" });
      const error = await client
        .login({ email: "finn@example.com", password: "mathematical" })
        .catch((reason: unknown) => reason);

      assert.ok(error instanceof ApiClientError);
      assert.equal(error.code, "ACCESS_REQUEST_PENDING");
      assert.deepEqual(error.details?.assessmentChallenge, {
        kind: "play_integrity_standard",
        token: "challenge-token",
        requestHash: "request-hash",
        expiresAt: "2026-08-16T12:05:00Z",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
