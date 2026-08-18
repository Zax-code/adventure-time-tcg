import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  accessAssessmentChallengeSchema,
  accessAssessmentSchema,
  accessRequestIpRevealResponseSchema,
} from "../src/index.ts";

const network = {
  maskedIpAddress: null,
  googleNetwork: "unknown",
  testLab: "unknown",
  testLabMatchedCidr: null,
  testLabRangeVersion: null,
  googleMatchedCidr: null,
  googleRangeVersion: null,
  testLabRangeStale: null,
  googleRangeStale: null,
  organization: null,
  asn: null,
  countryCode: null,
  connectionType: null,
  vpn: null,
  proxy: null,
  hosting: null,
  tor: null,
};

describe("access assessment contracts", () => {
  it("parses a complete assessment with versioned, explained contributions", () => {
    const assessment = accessAssessmentSchema.parse({
      state: "complete",
      heuristic: true,
      modelVersion: "access-request-v1",
      platformProfile: "android",
      confidence: 66,
      coverage: 45,
      band: "mixed",
      contributions: [
        {
          key: "identity",
          weight: 20,
          value: 90,
          effectFromNeutral: 8,
          reasonCodes: ["identity.provider_verified"],
          explanations: ["Identity provider verified the account"],
          observedAt: "2026-08-16T12:00:00Z",
          hardFailure: false,
          modelVersion: "access-request-v1",
        },
      ],
      missingReasons: ["integrity.not_submitted"],
      hardFailureReasons: [],
      network: {
        maskedIpAddress: "203.0.113.x",
        googleNetwork: "matched",
        testLab: "not_matched",
        testLabMatchedCidr: null,
        testLabRangeVersion: "firebase-test-lab-2026-08-13",
        googleMatchedCidr: "203.0.113.0/24",
        googleRangeVersion: "google-ip-ranges-1",
        testLabRangeStale: false,
        googleRangeStale: false,
        organization: "Example Network",
        asn: 64500,
        countryCode: "US",
        connectionType: "Corporate",
        vpn: false,
        proxy: false,
        hosting: false,
        tor: false,
      },
      assessedAt: "2026-08-16T12:00:00Z",
    });

    assert.equal(assessment.state, "complete");
    assert.equal(
      assessment.contributions[0].modelVersion,
      assessment.modelVersion,
    );
  });

  it("requires a fully structured Play Integrity challenge", () => {
    assert.equal(
      accessAssessmentChallengeSchema.safeParse({
        kind: "play_integrity_standard",
        token: "challenge-token",
        requestHash: "request-hash",
        expiresAt: "2026-08-16T12:05:00Z",
      }).success,
      true,
    );

    assert.equal(
      accessAssessmentChallengeSchema.safeParse({
        kind: "play_integrity_standard",
        token: "challenge-token",
      }).success,
      false,
    );
  });

  it("parses every non-scored lifecycle state and an audited reveal response", () => {
    const base = {
      heuristic: true,
      modelVersion: "access-request-v1",
      platformProfile: "unknown",
      network,
      assessedAt: null,
    };

    for (const value of [
      {
        ...base,
        state: "assessing",
        coverage: null,
        missingReasons: ["ip.enrichment_pending"],
        hardFailureReasons: [],
      },
      {
        ...base,
        state: "unavailable",
        coverage: 35,
        missingReasons: ["integrity.provider_timeout"],
        hardFailureReasons: [],
      },
      { ...base, state: "test_lab" },
    ]) {
      assert.equal(accessAssessmentSchema.safeParse(value).success, true);
    }

    assert.deepEqual(
      accessRequestIpRevealResponseSchema.parse({
        ipAddress: "203.0.113.10",
        retainedUntil: "2026-09-15T12:00:00Z",
      }),
      {
        ipAddress: "203.0.113.10",
        retainedUntil: "2026-09-15T12:00:00Z",
      },
    );
  });
});
