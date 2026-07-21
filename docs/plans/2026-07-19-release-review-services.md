# Future Release V2 Reviewer Services Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a versioned, authenticated, fail-closed semantic and visual reviewer service for Future Release V2, integrate it with the main application, and remove `pluto.hk` from every active share URL without changing historical issue data or production configuration.

**Architecture:** Add Zod request/response schemas to `@xiazi/contracts`, canonical hashing/signing helpers to `@xiazi/domain`, and an independently deployable `apps/reviewer` service. The web application signs each review request, verifies the echoed input hash and full response contract, and rejects all incomplete, mismatched, timed-out, replayed, or non-success responses. The reviewer service uses a real model provider outside tests, keeps mock behavior test-only, protects requests with HMAC plus timestamp/nonce replay checks, applies body/concurrency/time limits, and emits structured metadata-only logs.

**Tech Stack:** TypeScript, Zod, Next.js route handlers, Web Crypto/Node crypto, Vitest, existing Turborepo workspaces, OpenAI-compatible Chat Completions structured output adapter configured only through server-side environment variables.

---

## Design decisions

- Protocol version is `xiazi-review-v1`; ruleset versions are explicit per semantic and visual service.
- `inputHash` covers the complete review input payload but excludes transport metadata and the hash field itself. Responses must echo it exactly.
- Authentication uses a bearer identifier plus HMAC-SHA256 over timestamp, nonce, method, path, and raw body. A replay store must atomically reserve the nonce; production/staging cannot use the in-memory test store.
- Semantic review is one request per source snapshot and requires exactly four unique claim results.
- Visual review is one request for all 18 posters and requires exactly 18 unique slot results plus all 153 unique unordered pairs.
- The model name and version are mandatory configuration. There is no production model default and no production mock mode.
- Reviewer URLs remain server-only. The browser bundle never receives service URLs or secrets.
- Active share/canonical links use `https://xiazishuo.com`; historical archive JSON is intentionally untouched.

### Task 1: Lock active sharing to xiazishuo.com

**Files:**
- Modify: `packages/config/src/index.ts`
- Modify: `packages/domain/src/share.ts`
- Modify: `packages/domain/tests/issues.test.ts`
- Modify: active routes/components under `apps/web/src/` that hard-code `pluto.hk`
- Modify: corresponding active-route tests under `apps/web/tests/`
- Do not modify: `data/archive/**`, `apps/web/**/data/archive/**`, historical reports, or production configuration.

1. Add a failing test proving generated topic share URLs contain `xiazishuo.com` and never `pluto.hk`.
2. Set the canonical product URL fallback to `https://xiazishuo.com` and make topic sharing reject any configured non-Xiazi origin.
3. Replace active user-facing Pluto URLs with Xiazi URLs, keeping retired-domain fixtures and historical issue records unchanged.
4. Run domain and web unit tests for sharing, metadata, and active auxiliary routes.

### Task 2: Add shared review protocol contracts

**Files:**
- Create: `packages/contracts/src/review.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/contracts/tests/review.test.ts`
- Create: `packages/domain/src/review-protocol.ts`
- Modify: `packages/domain/src/index.ts`
- Create: `packages/domain/tests/review-protocol.test.ts`

1. Define strict Zod schemas for request metadata, semantic inputs/results, visual inputs/results, common response metadata, and error responses.
2. Enforce exactly four unique semantic claims, 18 unique visual slots, and 153 unique unordered comparison pairs.
3. Add canonical JSON hashing and request-signing helpers with timing-safe verification.
4. Test missing, duplicate, unknown, reordered, malformed, and hash-mismatched payloads.

### Task 3: Build the independent reviewer service

**Files:**
- Create: `apps/reviewer/package.json`
- Create: `apps/reviewer/tsconfig.json`
- Create: `apps/reviewer/next.config.ts`
- Create: `apps/reviewer/src/app/api/health/route.ts`
- Create: `apps/reviewer/src/app/api/version/route.ts`
- Create: `apps/reviewer/src/app/api/review/semantic/route.ts`
- Create: `apps/reviewer/src/app/api/review/visual/route.ts`
- Create: `apps/reviewer/src/server/**`
- Create: `apps/reviewer/tests/**`
- Create: `apps/reviewer/.env.example`
- Create: `apps/reviewer/vercel.json`

1. Implement bounded streaming JSON-body parsing, HMAC authentication, timestamp skew validation, atomic nonce reservation, concurrency limits, provider timeouts, and sanitized structured logs.
2. Implement a real OpenAI-compatible model provider with strict JSON-schema output and mandatory server-only provider/model/version settings.
3. Reject mock mode whenever `NODE_ENV=production`; use injected deterministic providers only in tests.
4. Add health and version endpoints that expose deployment/protocol/ruleset versions but no secrets.
5. Cover 2xx, 401, 403, 413, 429, timeout, 500, malformed provider JSON, replay, and response-shape failures.

### Task 4: Integrate fail-closed reviewer clients into the web application

**Files:**
- Create: `apps/web/src/server/releases/reviewer-client.ts`
- Modify: `apps/web/src/server/releases/source-gate.ts`
- Modify: `apps/web/src/server/releases/poster-gate.ts`
- Modify: `apps/web/src/server/releases/release-service.ts`
- Modify: `apps/web/tests/unit/release-source-gate.test.ts`
- Modify: `apps/web/tests/unit/release-poster-gate.test.ts`
- Create: `apps/web/tests/unit/reviewer-client.test.ts`
- Modify: `turbo.json`

1. Sign request envelopes with request ID, release candidate/asset batch ID, timestamp, nonce, ruleset version, and canonical input hash.
2. Apply abort timeouts and validate status, JSON shape, protocol/ruleset, request ID, and echoed input hash.
3. Reject missing/duplicate/replaced claims, missing/duplicate slots, missing/duplicate pairs, unknown slots, correction/retraction mismatches, and reviewer unavailability.
4. Include reviewer protocol/provider/model/ruleset evidence in validation artifacts without logging source bodies or secrets.
5. Prove that any reviewer failure prevents the staging RPC and leaves the active pointer untouched.

### Task 5: CI, staging templates, and evidence

**Files:**
- Create: `.github/workflows/reviewer-services-ci.yml`
- Create: `docs/evidence/reviewer-services.md`
- Modify: `docs/release-safety-remediation.md`

1. Add an independent CI job for contracts, reviewer service, web integration, build, and a local fail-closed smoke test.
2. Document protocol/ruleset/deployment variables, sanitized test output, monitoring query examples, and the exact staging deployment checklist.
3. Inspect available staging credentials without printing values. If a dedicated staging project, replay store, or model credential is unavailable, stop before external deployment and record the blocking human steps.
4. Run `npm ci`, targeted tests, `npm run check`, `npm run build`, and relevant E2E tests.

### Task 6: Publish a stacked Draft PR

1. Review the diff for production configuration, secrets, historical issue changes, and forbidden feature-flag changes.
2. Commit on `codex/release-review-services` and push the branch.
3. Create a Draft PR with base `codex/future-release-safety`, include architecture, tests, evidence, deployment boundary, and remaining risks.
4. Verify the PR remains Draft and wait for remote CI. Do not merge it or change PR #11 readiness.
