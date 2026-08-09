import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApiClient, ApiNetworkError } from "../src/index.ts";

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
        new Promise((resolve) => setTimeout(() => resolve("still-pending"), 100)),
      ]);

      assert.ok(outcome instanceof ApiNetworkError);
      assert.equal(outcome.message, "Request timed out");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
