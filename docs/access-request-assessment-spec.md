# Access Request Assessment Technical Specification

Status: Approved for implementation on 2026-08-16

## Purpose

Give superadmins better evidence when manually approving or rejecting a pending access request. The feature produces one of two independent assessment results:

- a Google Test Lab Classification for a request from a matched Test Lab environment; or
- a Trustworthiness Confidence percentage for any other assessable request.

Both outputs are advisory. Neither output automatically approves, rejects, blocks, rate-limits, or otherwise changes an access request.

## Goals

- Establish the request's canonical client IP address without trusting arbitrary client-supplied forwarding headers.
- Calculate an explainable Trustworthiness Confidence percentage from first-party evidence and external IP-reputation intelligence.
- Verify Android app and device evidence server-side with Google Play Integrity.
- Classify whether the canonical client IP belongs to a published Firebase Test Lab network range.
- Show the score, classification, evidence, freshness, and uncertainty in the existing superadmin access-review interface.
- Preserve enough assessment history to explain what the superadmin saw when making a decision.

## Non-goals

- Automatic access approval or rejection.
- Proving that a person is honest or that an identity is legally verified.
- Treating Google ownership of an IP address as proof of Play Store validation.
- Treating a Firebase Test Lab match as proof that a specific request came from a Play pre-launch report.
- Blocking requests based on a score or Play Integrity verdict.

## Existing System

The Phoenix accounts flow already stores the last IP address and recent authentication-attempt IP addresses for pending access requests. It also records provider, user-agent, locale, app version, build number, installation hash, and an attestation-status string. The admin API and Expo admin screen already expose most of this attribution data.

The existing evidence has important limitations:

- `AdventureTimeApiWeb.RequestMetadata` accepts the first value in `X-Forwarded-For` or `X-Real-IP` without establishing that the header came from a trusted proxy.
- Caddy is the production reverse proxy, so Phoenix's socket peer is normally the local proxy rather than the public client.
- The rate limiter keys directly on `conn.remote_ip`, while stored request attribution uses the forwarded header. The two paths can therefore disagree about the client's address.
- `x-adventure-time-attestation` is currently only a client-provided string. It is not a verified Play Integrity verdict and must not contribute positive trust evidence.

## Canonical Client IP

Install the canonical-address plug before router dispatch and every rate limiter. It preserves the transport peer separately, then establishes one canonical address:

1. If the transport peer is not inside a configured trusted-proxy CIDR, ignore all forwarded-address headers and use the peer address.
2. If the peer is trusted, parse `X-Forwarded-For` right-to-left, validate every considered IPv4 or IPv6 value, skip trusted proxy hops, and select the first untrusted address.
3. Reject oversized or multiply ambiguous header input from assessment use, emit structured telemetry, and expose an unknown canonical address rather than guessing.
4. Store the canonical address in normalized network-byte form for matching and PostgreSQL `inet` form for persistence; format text only at API/display boundaries.

The plug becomes the only module allowed to interpret forwarding headers. `RequestMetadata`, auth-attempt capture, access-request attribution, rate limiting, Test Lab matching, IPQualityScore, and request telemetry consume its result. Tests and direct development connections use their transport peer when no trusted proxy is present.

Caddy remains the only public production ingress and Phoenix's published host port remains loopback-bound. Caddy's default behavior of ignoring client-supplied forwarding values when constructing upstream `X-Forwarded-*` headers is part of the deployment contract. Any future CDN or proxy hop requires an explicit trusted-proxy configuration review at both boundaries.

## Approved Product Decisions

1. The assessment is advisory; a superadmin always approves or rejects manually.
2. Trustworthiness Confidence evaluates the overall access request, not the IP address alone.
3. The score uses an explainable hybrid model combining first-party evidence and external IP-reputation intelligence.
4. Android app/device evidence uses Play Integrity tokens decoded and verified by the Phoenix backend. Missing or unevaluated evidence is neutral so iOS, web, Test Lab, and temporary service failures are not penalized merely for lacking a verdict.
5. A request matched to a current Firebase Test Lab range does not receive Trustworthiness Confidence. The UI presents it as an automated test environment instead.
6. IPQualityScore is the initial external IP-intelligence provider. Phoenix accesses it through an application-owned provider interface so provider responses do not leak into the scoring or API contracts and the vendor remains replaceable.
7. Normalized IPQualityScore evidence has a maximum 25% weight in Trustworthiness Confidence. First-party evidence supplies the remaining 75%, so external IP intelligence cannot determine the result by itself.
8. Canonical client-IP resolution and Test Lab matching run locally during request capture. Phoenix persists the access request before an Oban job performs IPQualityScore enrichment and scoring.
9. Incomplete assessments expose Trustworthiness Confidence together with a separate Evidence Coverage percentage and missing-signal reasons. Missing evidence is neither positive nor negative.
10. First-party scoring uses explicit Android, iOS, and web profiles. Each profile supplies 75 available points from evidence applicable to that platform and is independently versioned for auditability.
11. IPQualityScore receives the canonical IP address, user agent, Accept-Language, and provider-scoped pseudonyms for identity and installation continuity. It never receives raw account or device identifiers.
12. Initial first-party weights use balanced platform profiles: Android emphasizes Play Integrity, while iOS and web shift that weight to identity, continuity/behavior, and corroborated client evidence.
13. Every available evidence component starts at a neutral value of 50. Verified positive evidence raises it, negative or contradictory evidence lowers it, and missing evidence is omitted rather than assigned a value.
14. The admin UI groups finalized percentages into three textual evidence bands: stronger, mixed, and concerning. It always shows the exact score and Evidence Coverage with the band.
15. Assessment data uses privacy-balanced retention: exact IP for 30 days after review, detailed normalized evidence for 90 days, and the assessment/review snapshot for one year. Account deletion purges associated assessment data immediately.
16. The superadmin UI masks exact IP addresses by default. Revealing an address requires a deliberate action and creates an audit event.
17. Firebase Test Lab CIDRs live in a versioned repository data file and are refreshed through explicit tooling backed by Google's `gcloud beta firebase test ip-blocks list` command. Production warns when the reviewed data is older than 90 days.
18. A single trusted-proxy-aware Phoenix resolver establishes the canonical client IP for assessment, auth attribution, rate limiting, and request telemetry.
19. Negative evidence is component-local. A hard failure may set its component to zero and receive prominent UI treatment, but no single signal caps, replaces, or overrides the weighted overall score.
20. Manual approval and rejection outcomes feed aggregate calibration reports only. Scoring weights never change automatically, and Phoenix does not send review outcomes to IPQualityScore.
21. Production launches in a two-week shadow phase. Assessments are collected but hidden from manual review until a documented superadmin evaluation enables the advisory UI feature flag.
22. Android Play Integrity uses a two-step best-effort submission: the completed access request returns a short-lived opaque challenge, and a dedicated endpoint verifies the bound integrity token without ever persisting it.

## Output Model

### Trustworthiness Confidence

A percentage from 0 through 100 estimating how likely a non-Test-Lab access request is to be genuine and non-abusive. The response must include the individual evidence contributions that produced it; the percentage must never be returned without explanations and evidence freshness.

The percentage is an initial heuristic confidence score, not a statistically calibrated probability. The UI must say this until production outcomes are sufficient to calibrate it against manual review decisions.

### Evidence Coverage

A separate percentage from 0 through 100 describing how much applicable weighted evidence was available when Trustworthiness Confidence was calculated. It is not a trust signal and must never be combined with or averaged into Trustworthiness Confidence.

The assessment lifecycle is:

- `assessing`: remote enrichment is queued or running; no score is shown;
- `complete`: all applicable evidence is available;
- `partial`: scoring finished with unavailable evidence; both percentages and every missing reason are shown;
- `unavailable`: there is not enough trustworthy evidence to calculate any meaningful score; and
- `test_lab`: the Test Lab classification replaces scoring.

For a partial result, available component weights are normalized for score calculation while Evidence Coverage retains the original available-weight percentage. This can produce a high Trustworthiness Confidence with low Evidence Coverage, so the UI must give both values equal prominence and must not render the score without its coverage.

### Scoring Profiles

Every finalized assessment stores its platform profile and scoring-model version. A profile defines which evidence is applicable and how the 75 first-party points are distributed. IPQualityScore contributes the remaining 25 points under every profile.

| Evidence component                                              | Android | iOS | Web |
| --------------------------------------------------------------- | ------: | --: | --: |
| Server-verified Play Integrity                                  |      30 | n/a | n/a |
| Verified identity ownership                                     |      20 |  30 |  35 |
| Installation/session continuity and request behavior            |      15 |  25 |  25 |
| Corroborated client, platform, and recognized-build consistency |      10 |  20 |  15 |
| First-party total                                               |      75 |  75 |  75 |
| Normalized IPQualityScore intelligence                          |      25 |  25 |  25 |
| Assessment total                                                |     100 | 100 | 100 |

- The Android profile includes server-verified Play Integrity evidence.
- The iOS profile does not reserve unavailable points for Play Integrity; it uses iOS-applicable identity, client, continuity, and behavior evidence.
- The web profile uses web-applicable identity, session, client, continuity, and behavior evidence.
- Unknown or contradictory platform metadata uses a conservative unknown-client profile rather than allowing a caller to choose the most favorable profile.

Profile selection must be based on trusted or corroborated evidence. A client-supplied platform header alone is insufficient. Changing weights creates a new scoring-model version and never rewrites historical assessments.

### Score Calculation

Each applicable component has a configured weight and produces an integer value from 0 through 100. An available but inconclusive component starts at 50. Its versioned signal rules move that value toward 100 for corroborated positive evidence or toward 0 for corroborated negative evidence. A component with no usable evidence is missing, not neutral.

For non-Test-Lab results:

```text
trustworthiness_confidence =
  round(sum(component_value * component_weight) / sum(available_component_weights))

evidence_coverage =
  round(100 * sum(available_component_weights) / sum(applicable_profile_weights))
```

The applicable profile weights total 100, including the 25-point IPQualityScore component. Every stored contribution includes its component key, weight, value, signed effect from neutral, stable reason codes, human-readable admin explanations, evidence timestamps, and model version.

No contribution has veto semantics. Examples such as an unrecognized Android binary, failed device-integrity verdict, contradictory verified identity, or confirmed high-risk IP activity may set the relevant component to `0`, but they do not mutate another component or impose a total-score ceiling. The admin UI elevates hard-failure reason codes independently from the score so the warning is visible without turning it into an automatic decision.

### Display Bands

- `70..100`: Stronger trust signals
- `40..69`: Mixed trust signals
- `0..39`: Concerning trust signals

Bands are navigation aids for manual review, not decisions. The UI must not use color alone, must not label a request or person as trusted/untrusted, and must keep Trustworthiness Confidence and Evidence Coverage adjacent to the band label.

### Google Test Lab Classification

A classification evaluated before Trustworthiness Confidence. It uses Google's published Firebase Test Lab network ranges rather than generic Google ownership.

The classification must distinguish at least:

- matched current Test Lab range;
- did not match current Test Lab range; and
- unknown because no trustworthy canonical client IP was available.

When the result is `matched`, scoring stops and the response contains no Trustworthiness Confidence percentage. This prevents an automated environment from being described with human-oriented trust language. A Test Lab match remains advisory and does not automatically approve the access request.

## External IP Intelligence

The initial provider is the IPQualityScore Proxy Detection API. The provider adapter normalizes only the evidence the scoring model needs, such as provider risk score, proxy/VPN/Tor classifications, bot status, recent abuse, ASN, organization, connection type, lookup timestamp, and provider request identifier.

Raw IPQualityScore payloads and vendor-specific field names must not cross the adapter boundary into account, scoring, admin API, or mobile UI code. Provider errors, quota exhaustion, and timeouts produce unavailable evidence rather than a low score.

The normalized IP-intelligence component has a weight of 25 out of 100. The scoring model must retain the provider's reasons rather than reducing its response to a single opaque number. VPN or shared-network use alone is not proof of abuse and must not produce a zero component without corroborating high-risk evidence.

Phoenix may send IPQualityScore:

- the canonical client IP address required for the lookup;
- the captured user agent as `user_agent`;
- the captured Accept-Language value as `user_language`; and
- distinct provider-scoped pseudonyms representing the verified identity and installation, using configured custom tracking variables.

Each pseudonym is an HMAC-SHA-256 over a namespace, identifier type, and normalized source identifier using a dedicated, versioned IPQS pseudonym secret. Phoenix must not send the repository's existing unkeyed SHA-256 identity or installation hashes. Secret rotation creates a new pseudonym version; the secret and raw HMAC inputs are never stored in assessment evidence.

Phoenix must not send IPQualityScore an email address, name, raw OAuth subject, raw or internally stored identifier hash, raw installation ID, Phoenix request ID, access/refresh token, verification code, or Play Integrity token. The adapter must use the least-strict vendor settings suitable for advisory review, allow public access points, and retain vendor reason fields so VPN use alone is not treated as abuse.

## Processing Model

1. Phoenix resolves the canonical client IP from the connection and trusted-proxy boundary.
2. Phoenix matches the canonical address against the locally configured Test Lab CIDR set.
3. Phoenix persists or updates the access request and its local evidence without waiting on an external service.
4. For a Test Lab match, Phoenix records the classification and does not enqueue Trustworthiness Confidence scoring.
5. For any other result, Phoenix enqueues an idempotent Oban assessment job keyed to the access request and evidence version.
6. The job obtains normalized IPQualityScore evidence, calculates the available assessment, and stores the explainable result.
7. When Android later submits a valid challenge-bound Play Integrity token, Phoenix stores only normalized verdicts and recalculates the same request with a newer evidence revision.
8. Retries and late integrity submissions must not duplicate assessment history or overwrite a newer evidence revision with stale results.

The access-request API succeeds once the request and local evidence are durable. IPQualityScore, Google, timeout, quota, and Oban failures must not change that response into a signup failure.

## Android Play Integrity Flow

Use Play Integrity standard requests. The Expo Android app prepares a standard token provider during normal startup using the linked Google Cloud project number, but failure to prepare does not block authentication.

For a non-Test-Lab Android access request with collection enabled:

1. Phoenix creates a cryptographically random, one-use challenge after the access request is durable.
2. Phoenix stores only the challenge digest, access-request ID, expected request hash, evidence version, and an expiry no more than five minutes in the future.
3. The registration response, or the structured pending-access error for Google/Apple auth, includes the opaque challenge, expected request hash, and expiry.
4. Android requests a standard integrity token using that exact request hash.
5. Android posts the opaque challenge and integrity token to a dedicated unauthenticated-but-challenge-authorized endpoint.
6. Phoenix atomically consumes the challenge, sends the token to Google's `decodeIntegrityToken` API, validates package name, request hash, token timestamp, app recognition, licensing, and device verdicts, and stores only a normalized evidence record.
7. Phoenix recalculates the assessment and returns `204` regardless of the normalized verdict. Invalid, expired, reused, or mismatched challenges return a generic error and contribute no evidence.

The request hash is a base64url SHA-256 digest over a versioned canonical serialization containing the challenge digest, access-request ID, assessment evidence version, expected Android package name, and intended action. It contains no plaintext email or other personal data. Automatic replay protection from standard Play Integrity requests is supplemented by Phoenix's one-use challenge consumption.

The endpoint never queues or logs the raw integrity token and never includes it in exception metadata. Google timeout, quota, credentials, decode, or unevaluated-verdict failures leave Play Integrity evidence missing and trigger no access decision. Test Lab matches do not receive a challenge, avoiding unnecessary quota use.

## Data Retention And Privacy

- While an access request is pending, retain its canonical IP and normalized assessment evidence so the superadmin can review them.
- Thirty days after approval or rejection, delete the exact canonical IP from the request assessment and related assessment events.
- Ninety days after approval or rejection, delete normalized IPQualityScore details, normalized Play Integrity details, pseudonymous linkage values, and individual evidence contributions.
- One year after approval or rejection, delete the remaining score, coverage, band, reason-code summary, model version, and manual-review audit snapshot.
- Deleting an account immediately purges assessment data associated with that account. A rejected request with no account follows the time-based policy.
- Never persist raw Play Integrity tokens, raw IPQualityScore payloads, the IPQS API credential, or the HMAC pseudonym secret.
- A scheduled Oban retention job performs deletions idempotently and records aggregate counts without logging deleted values.

The public privacy disclosure must be updated before enabling production enrichment. It must describe IP/device/app integrity processing, the external fraud-prevention service, purposes, and retention at an appropriate user-facing level.

## Admin Experience

The existing pending-access-request card gains an assessment summary above its current attribution details. It displays one lifecycle state: assessing, complete, partial, unavailable, or Test Lab.

For complete and partial scores, show the Trustworthiness Confidence percentage, textual evidence band, Evidence Coverage percentage, model version, assessment age, and expandable positive, negative, and missing evidence. For Test Lab, replace the scoring surface with an automated-test-environment classification, matched network range, range-set version, and a warning that the match does not prove a Play pre-launch report.

Show network organization, ASN, country, and IPQS privacy/risk classifications without an exact address. Render the canonical address masked while preserving address-family recognition. A `Reveal IP` action requires superadmin authorization, returns the address through a dedicated endpoint, and records actor, access request, timestamp, and request ID without copying the address into the audit log. Do not load exact IPs in the ordinary request-list payload.

Manual Approve and Reject controls remain unchanged and never derive their enabled state or default choice from assessment results.

## Calibration

Persist the assessment snapshot and scoring-model version visible at manual review. Aggregate reporting may compare evidence bands and reason codes with later approval/rejection outcomes, but must enforce minimum cohort sizes and omit exact IPs, emails, identifiers, and individual-level drill-down after their retention windows.

The initial heuristic must not be presented as a statistically calibrated probability. Before changing that language, evaluate a documented sample for calibration, false-positive patterns, false-negative patterns, platform disparities, provider outages, and reviewer disagreement. Weight or threshold changes create a new reviewed model version; historical assessments remain unchanged.

Do not train or automatically tune on manual decisions, and do not call IPQualityScore postback/conversion endpoints with approval or rejection outcomes.

## Rollout

Use separate server-side flags for assessment collection and admin display. Deployment initially enables collection only. During a minimum two-week shadow window, monitor completion and partial-result rates, provider errors and latency, score distributions by platform, Test Lab matches, hard-failure reasons, Evidence Coverage, and disagreement with later manual outcomes.

At the end of the window, a superadmin reviews a written shadow report. Enabling admin display requires an explicit configuration change after that review; elapsed time alone does not enable it. Keep the UI labeled as heuristic during the initial model version. Either flag can be disabled without removing stored data or affecting access-request submission and review.

## Test Lab Range Management

Store IPv4 and IPv6 Test Lab CIDRs in a reviewable data file with source URL, retrieval timestamp, checksum, and range-set version. A Mix task imports machine-readable output from `gcloud beta firebase test ip-blocks list`, normalizes addresses, rejects invalid or overlapping entries, summarizes additions/removals, and updates the metadata. The task does not deploy or activate changes by itself.

Application startup validates the bundled range set. Readiness remains healthy when the list is stale, but structured telemetry and the superadmin UI warn after 90 days. An invalid data file fails startup rather than silently disabling classification. Generic Google, Google Cloud, Googlebot, ASN-owner, or reverse-DNS ranges must never be substituted for the specific Firebase Test Lab list.

Every stored Test Lab classification includes the range-set version and matched CIDR so historical results remain explainable after updates.

## Google Network Ownership

Test Lab classification and general Google network ownership are separate facts. The admin network summary should answer both:

- `googleNetwork`: `matched`, `not_matched`, or `unknown`; and
- `testLab`: `matched`, `not_matched`, or `unknown`.

Use Google's machine-readable `goog.json` and `cloud.json` range publications for the general ownership hint, with repository metadata and reviewable refresh tooling similar to the Test Lab data. A generic Google match displays `Google network` but never changes the Test Lab result and never suppresses Trustworthiness Confidence. IPQualityScore organization/ASN data may corroborate the label but is not its source of truth.

The UI wording is deliberately asymmetric:

- Test Lab match: `Firebase Test Lab environment` and no trust score;
- generic Google match only: `Google-owned network; not a published Test Lab range` and normal trust scoring; and
- no match: display the normalized network owner without drawing a Google conclusion.

## Initial Signal Rules

Model version `access-request-v1` uses the following deterministic rules. Every rule produces stable reason codes; translated UI prose is derived from those codes. Rules within one component are applied in the listed order and the result is clamped to `0..100`. A hard failure sets only that component to zero.

### IPQualityScore Component

Start from `round(100 - fraud_score)` for a successful, current lookup.

- `high_risk_attacks=true`: set to 0 with `ip.confirmed_high_risk_attacks`.
- `frequent_abuser=true`: cap at 15 with `ip.frequent_abuser`.
- `bot_status=true` or corroborated recent abuse: cap at 25 with the matching reason.
- `active_tor=true`: cap at 35 with `ip.active_tor`.
- If VPN, proxy, hosting, shared-connection, or public-access-point classification is the only adverse evidence, floor the component at 40 and report the classification without an abuse claim.
- Provider failure, invalid response, timeout, or stale cache entry makes the component missing.

Use `strictness=0`, `allow_public_access_points=true`, and `lighter_penalties=true` initially. Any settings change creates a new scoring-model version.

### Android Play Integrity Component

A valid request binding and fresh Google decode response are prerequisites. A package-name, request-hash, certificate, or recognized-version mismatch sets the component to 0 with a hard-failure reason. A wholly unevaluated verdict makes the component missing.

Starting at 50:

- `PLAY_RECOGNIZED`: +25; `UNRECOGNIZED_VERSION`: hard failure.
- Expected package, certificate digest, and released version code all agree: +10.
- `LICENSED`: +10; `UNLICENSED`: -20; `UNEVALUATED`: no change.
- `MEETS_STRONG_INTEGRITY`: +15.
- Otherwise `MEETS_DEVICE_INTEGRITY`: +10.
- Otherwise `MEETS_BASIC_INTEGRITY`: no change.
- No device-integrity label in an otherwise evaluated verdict: -30.

Do not request optional environment verdicts in v1. They can be added only through a model-version change after reviewing quota, latency, device coverage, and privacy impact.

### Verified Identity Component

- Server-verified Google or Apple token with a stable provider-subject mapping and no identity contradiction: 90.
- The same verified provider subject has previously mapped to the same normalized email: 100.
- Completed six-digit email verification for the current signup: 90.
- Email verification is still pending: 50.
- Provider token is valid but its email-verification claim is absent or false: 40.
- A verified provider subject conflicts with an existing different identity or normalized email: 0 with a hard-failure reason.
- Provider outage or a flow with no identity proof makes the component missing rather than failed.

Email verification completion and later pending-login attempts increment the access request's evidence revision and enqueue debounced rescoring.

### Continuity And Request Behavior Component

Start at 50 and evaluate retained access-request/auth-attempt evidence only:

- Same installation pseudonym observed on two or more non-abusive attempts for the same identity: +10.
- Same verified provider identity across attempts: +10.
- No more than three request/auth attempts in 24 hours and no failed-credential burst: +5.
- More than five attempts for the same request in 24 hours: -10.
- One installation pseudonym associated with three or more distinct requested identities in 24 hours: -20.
- One canonical IP associated with five or more distinct requested identities in one hour: -20.
- Twenty or more relevant attempts in ten minutes from the same IP, installation, or provider subject: -30.

Do not award points merely because an IP, country, or ASN remains stable. Carrier NAT, travel, accessibility tooling, relays, and household sharing are not inherently abusive. Threshold queries must use retained, scoped evidence and must not resurrect data past its deletion window.

### Client And Build Consistency Component

Client-supplied headers never earn full trust by themselves. Starting at 50:

- App version and native build occur in the server's versioned released-build registry: +20.
- Platform, user agent, and request shape agree: +10.
- A well-formed installation identifier is present and continuous for the same request: +10.
- Android Play Integrity version/package evidence corroborates the claimed build: +10.
- A claimed native platform conflicts with the user agent or request shape: -25.
- A claimed production-native build is absent from the released-build registry: -25.
- Installation identifier is malformed or changes repeatedly during the same request: -15.

The web profile substitutes same-site Origin/Host consistency and ordinary browser request shape for native build/installation checks. Those facts remain weak evidence and cannot raise the web client component above 80. The iOS component cannot exceed 90 without a future server-verified Apple attestation signal.

### Minimum Evidence

An applicable profile needs at least 40% Evidence Coverage to display Trustworthiness Confidence. Below that threshold the state is `unavailable`, with available and missing reasons shown but no trust percentage. This threshold is part of `access-request-v1` and must be evaluated during shadow rollout.

## Persistence Design

Add assessment-owned tables rather than continuing to grow `email_access_requests`:

### `access_request_assessments`

One mutable current row per email access request, deleted with its parent. It contains lifecycle state, evidence revision, scoring-model version, platform profile, score, coverage, band, canonical `inet` address, masked display address, Google/Test Lab classifications and range-set versions, normalized network facts, normalized IPQS evidence, normalized Play Integrity evidence, contribution/reason maps, missing reason codes, assessment timestamps, and lock version.

The row is updated only when the worker or integrity endpoint still targets its current evidence revision. JSON evidence fields use Ecto embedded schemas with explicit validation; arbitrary vendor payloads are forbidden.

### `access_request_assessment_snapshots`

Append one immutable snapshot when a superadmin approves or rejects. Store the score/classification state, evidence coverage, model/range versions, stable reason codes, and review actor/outcome needed for calibration. Do not copy the exact IP or raw external payloads into the snapshot.

### `access_request_integrity_challenges`

Store a unique challenge digest, access-request ID, expected request hash, evidence revision, expiry, consumed timestamp, and inserted timestamp. Never store the opaque challenge or integrity token. Expired/consumed rows are pruned daily.

### `access_request_ip_reveal_audits`

Store access-request ID, superadmin actor ID, Phoenix request ID, and timestamp. Do not store the revealed address. Retain under the one-year review-audit policy.

Add a nullable `email_access_request_id` foreign key and canonical `inet` column to new auth-attempt records so relevant behavior can be queried and pruned without joining indefinitely on email text. Existing `last_ip_address` and `auth_attempts.ip_address` text fields remain readable during migration, stop feeding the new assessment, and are nulled by the same 30-day retention job. Backfill only syntactically valid addresses for pending requests; do not call external providers during migration.

Required indexes include unique current assessment per request, assessment lifecycle/update time, challenge digest, challenge expiry, auth-attempt request/time, auth-attempt canonical IP/time, installation hash/time, provider subject/time, and snapshot review time.

## Context And Module Boundaries

Keep the scoring engine pure and provider-neutral:

- `AdventureTimeApi.AccessAssessment`: public context API for capture, enqueue, integrity submission, read models, review snapshot, and retention.
- `AccessAssessment.Score`: pure versioned component and weighted-score calculation.
- `AccessAssessment.ClientAddress`: normalized IP/CIDR parsing and trusted-proxy resolution helpers.
- `AccessAssessment.NetworkRanges`: Google and Test Lab range loading/matching.
- `AccessAssessment.IpIntelligence` behaviour with an IPQualityScore adapter implemented using `Req`.
- `AccessAssessment.PlayIntegrity` behaviour with a Google decode adapter implemented using `Req`.
- `AccessAssessment.Challenges`: challenge issue/consume and request-hash canonicalization.
- `AssessAccessRequestWorker`: idempotent IP enrichment and scoring in a dedicated `assessments` Oban queue.
- `PruneAccessAssessmentDataWorker`: daily retention enforcement in `maintenance`.

`Accounts` owns access-request creation and manual review but calls this context after the relevant transaction is durable. Provider HTTP details, weights, CIDR parsing, and admin serialization do not belong in `Accounts` or controllers.

## Wire Contract Changes

Extend `@adventure-time/contracts` and re-export through `@adventure-time/api-client`.

### Integrity challenge

Android-capable register responses and structured `ACCESS_REQUEST_PENDING` errors may contain:

```json
{
  "assessmentChallenge": {
    "kind": "play_integrity_standard",
    "token": "opaque-one-use-value",
    "requestHash": "base64url-sha256",
    "expiresAt": "2026-08-16T12:00:00Z"
  }
}
```

The field is optional for backward compatibility, absent when collection is disabled or Test Lab matched, and ignored by iOS/web clients.

Add `submitAccessRequestIntegrity({challengeToken, integrityToken})`, calling `POST /auth/access-request-assessment/play-integrity`. Rate-limit by canonical IP and challenge digest. The response is `204`; normalized verdicts are visible only through superadmin contracts.

### Admin assessment union

Replace raw attribution expansion with an optional discriminated `assessment` union on each existing email-request response:

- `assessing`: timestamps and missing/pending reason codes;
- `complete` or `partial`: score, coverage, band, model/profile versions, masked network summary, Google-network classification, normalized contributions, hard failures, missing reasons, and assessed timestamp;
- `unavailable`: coverage, reasons, and model/profile versions without a score; or
- `test_lab`: Test Lab classification, Google-network classification, matched CIDR, range-set version, and assessed timestamp without a score.

Do not return exact IPs, provider tracking pseudonyms, raw external fields, integrity details that enable fingerprinting, or secrets in `GET /admin/email-requests`.

Add `POST /admin/email-requests/:id/reveal-ip`, restricted to superadmins. It returns `{ipAddress, retainedUntil}` with `Cache-Control: no-store`, creates the audit row transactionally, and returns `410` after address retention expires. Never place the address in the URL.

## Mobile And Web Changes

Android needs a small local Expo native module wrapping Google's Standard Play Integrity API. It prepares the token provider after startup, exposes an on-demand token request for a supplied request hash, and never writes tokens to JavaScript storage, logs, analytics, or crash metadata. The auth form performs the best-effort follow-up only after receiving a challenge. Integrity failure must not replace or obscure the existing pending-approval message.

iOS and web preserve their current auth flows and ignore absent challenges. All admin surfaces consume the shared assessment contracts. Mobile translations remain under `apps/mobile/src/i18n/locales/en/admin.ts` and the matching French file; the website uses its local admin copy.

The server maintains a versioned released-build registry sourced from mobile release metadata. Client headers select candidate evidence only; Android's verified version code corroborates the selection.

## Runtime Configuration And Secrets

Add validated runtime configuration for:

- `ACCESS_ASSESSMENT_COLLECTION_ENABLED`;
- `ACCESS_ASSESSMENT_ADMIN_DISPLAY_ENABLED`;
- `ACCESS_ASSESSMENT_TRUSTED_PROXY_CIDRS` (production initially loopback only because Caddy and Phoenix use host networking);
- `IPQS_API_KEY`, timeout, endpoint, and pseudonym-secret version/path;
- Play Integrity package name, Cloud project number, expected certificate digests, decode timeout, and mounted service-account credential path; and
- scoring-model and range-data versions.

When collection is disabled, provider credentials may be absent. Enabling collection with invalid proxy CIDRs, invalid range files, absent IPQS credentials, or absent Play Integrity configuration fails configuration validation before serving traffic. Secrets are mounted/read at runtime, redacted by logger parameter filtering, and never included in health output.

## Failure And Concurrency Behavior

- Access-request persistence always wins over enrichment. Provider failures never roll it back.
- Oban jobs are unique by access-request ID and evidence revision, retry transient IPQS failures with bounded exponential backoff, and discard stale revisions.
- A later valid integrity submission increments the evidence revision and recalculates without waiting for another IPQS lookup when the cached lookup is still fresh.
- Reopened or repeated requests create a new evidence revision and may reuse IP intelligence only when the canonical IP, provider settings, and freshness window agree.
- Provider timeouts, quota exhaustion, invalid payloads, and Google `UNEVALUATED` verdicts become explicit missing reasons.
- Assessment write failures emit telemetry and remain retryable; they never mutate access status.
- Concurrent manual review snapshots the assessment row visible inside the review transaction. A late worker may update current evidence but cannot rewrite the immutable review snapshot.
- Disabling collection stops new jobs/challenges and leaves access review operational. Disabling display hides assessments without deleting them.

## Telemetry And Operations

Emit counts and duration histograms for capture, Test Lab/Google classification, worker completion, partial/unavailable outcomes, challenge issue/consume/failure, IPQS/Google latency and error class, stale-job discard, IP reveal, and retention deletions. Labels must be bounded enums; never attach IPs, email addresses, identifiers, tokens, user agents, or provider payloads.

Add a release-safe Mix inspection task that reports aggregate lifecycle counts, coverage/score distributions, platform profile distribution, provider availability, range-data age, and shadow/manual-outcome disagreement. It must enforce minimum cohort sizes and produce no row-level personal data.

Existing Caddy JSON access logs retain network addresses for 30 days, matching the selected exact-IP window. The implementation must confirm this production setting and must not extend it as part of this feature.

Production confirmation (2026-08-16): a read-only inspection of the live VPS Caddy configuration found `roll_keep_for 720h` and `roll_keep 10`. This feature did not change the logging configuration or retention period.

## Verification Plan

### Phoenix

- Canonical-address plug tests for direct peers, trusted/untrusted proxy chains, spoofed leftmost entries, IPv4, IPv6, mapped addresses, malformed/oversized headers, and unknown results.
- Rate-limit tests proving canonical address parity with request attribution.
- CIDR loader/matcher tests using current Test Lab, generic Google, non-Google, boundary, overlap, invalid, and stale fixtures.
- Golden scoring tests for each platform profile, neutral baselines, component-local hard failures, partial normalization, coverage threshold, bands, and model-version stability.
- IPQualityScore adapter tests through Bypass for settings, allowed fields, normalization, timeouts, invalid data, VPN-only handling, and secret redaction.
- Play Integrity tests through Bypass for challenge expiry/replay, binding mismatch, package/certificate/version mismatch, verdict normalization, Google failures, and proof that tokens never enter persisted rows or logs.
- Worker tests for uniqueness, retries, stale revisions, cached IP evidence, and late integrity rescoring.
- Retention tests for pending exemptions, 30/90/365-day deletion stages, account deletion, and audit behavior.
- Admin controller tests for each union state, superadmin authorization, no exact IP in lists, reveal audit/no-store response, and `410` after expiry.
- Run focused tests, `mix format`, and `mix precommit`.

### Shared, Mobile, And Web

- Contract/API-client tests for optional challenges, structured pending errors, assessment unions, and reveal response.
- Android native-module tests for provider preparation, token request, cancellation/failure, and no persistence/logging.
- Mobile and web admin rendering tests for all lifecycle states, bands, coverage, hard failures, Test Lab wording, masked/revealed IP, and accessibility without color.
- A focused Android Maestro flow using a deterministic backend assessment fixture; do not depend on live IPQS or Google during E2E.
- Run `npm run typecheck`, targeted web/mobile tests, and `cd apps/mobile && npx expo-doctor`.

### Production Shadow Validation

- Compare a sampled canonical address against Caddy's corresponding access-log address without exporting either value.
- Trigger a Play pre-launch report and confirm its request matches a published Test Lab CIDR, shows no trust score, and records the range-set version.
- Confirm generic Google traffic outside Test Lab receives the Google-network hint and a normal score.
- Confirm access requests still succeed during simulated IPQS, Google, and Oban failures.
- Confirm list APIs and telemetry contain no exact IP or raw token.

## Implementation Slices

1. Canonical client-IP plug, trusted-proxy configuration, storage type, and rate-limit unification.
2. Range datasets/import tasks plus generic Google and Test Lab classification.
3. Assessment schemas, pure scoring model, evidence revisions, and unit tests.
4. IPQualityScore provider adapter, pseudonyms, Oban worker, and failure telemetry.
5. Play Integrity challenge endpoint, Google decode adapter, Android Expo module, and auth follow-up.
6. Shared contracts, admin API read model, reveal endpoint/audit, and mobile/web UI.
7. Retention worker, privacy disclosure, calibration report, feature flags, and operational runbook.
8. Production shadow rollout, written evaluation, and separate display-flag decision.

Each slice is independently reviewable and keeps access-request approval behavior unchanged. Database migrations precede code that writes their fields; compatible API additions precede mobile use.

## Acceptance Criteria

- A spoofed forwarding header from an untrusted peer cannot influence canonical IP, rate limiting, classification, or assessment.
- A published Test Lab CIDR produces `test_lab`, no Trustworthiness Confidence, and no Play Integrity challenge.
- A generic Google-owned range outside Test Lab is labeled accurately and still receives normal scoring.
- Non-Test-Lab assessments expose an explainable score only at 40% or greater Evidence Coverage.
- IPQualityScore contributes no more than 25 weighted points and receives only the approved fields/pseudonyms.
- Raw Play Integrity tokens and raw IPQS payloads never enter PostgreSQL, Oban args, logs, telemetry, analytics, or API responses.
- Missing provider/device evidence is explicit and never treated as suspicious by itself.
- No individual signal caps the total score or changes access status.
- Exact IPs are absent from normal admin payloads, revealable only by a superadmin with an audit record, and removed on schedule.
- Auth registration/social-access-request responses remain successful or retain their existing pending semantics during all assessment failures.
- Shadow collection and admin display can be disabled independently without redeploying clients.
- Approve and Reject remain manual and behaviorally unchanged.

## Approval

Product approval of this document authorizes implementation planning and code changes on a fresh feature branch. It does not authorize production enablement, external-provider account purchase, secret creation, privacy-policy publication, or enabling the post-shadow display flag without their normal operational approvals.

## Sources

- Google Play pre-launch reports are powered by Firebase Test Lab and may be detected using the documented Test Lab IP blocks: <https://support.google.com/googleplay/android-developer/answer/9842757>
- Firebase publishes the Test Lab source CIDRs and states that backend traffic from Firebase-hosted test devices can be identified against them: <https://firebase.google.com/docs/test-lab/ios/get-started#ip-addresses>
- Play Integrity verdict definitions and server-side evaluation requirements: <https://developer.android.com/google/play/integrity/verdicts>
- Play Integrity standard request binding, server decode, and replay protection: <https://developer.android.com/google/play/integrity/standard>
- Play Integrity setup and current quota guidance: <https://developer.android.com/google/play/integrity/setup>
- IPQualityScore Proxy Detection request options and custom tracking variables: <https://www.ipqualityscore.com/documentation/proxy-detection-api/advanced-options>
- IPQualityScore response fields and risk semantics: <https://www.ipqualityscore.com/documentation/proxy-detection-api/response-parameters>
- Caddy forwarding-header and trusted-proxy behavior: <https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#headers>
- Google's explanation of `goog.json` and `cloud.json` ownership/range semantics: <https://docs.cloud.google.com/vpc/docs/configure-private-google-access#ip-addr-defaults>
- Google's machine-readable network-range publications: <https://www.gstatic.com/ipranges/goog.json> and <https://www.gstatic.com/ipranges/cloud.json>
