# Reviewer services evidence

## Scope and status

This evidence applies only to future issues after `2026-07-18`. No historical issue, poster, archive or Story Pool record is changed. Production Supabase, Vercel settings, DNS, `RELEASE_V2_ENABLED` and the production active pointer are outside this work package and remain untouched.

Repository implementation is complete; dedicated staging deployment evidence remains pending until staging-only model, replay-store and hosting credentials are available. The service and main application fail closed when that deployment is absent.

This work package must remain a stacked Draft pull request against `codex/future-release-safety`. It is not approved for merge, production migration, production configuration changes or enabling Release V2.

## Versioned protocol

| Component | Version |
|---|---|
| Protocol | `xiazi-review-v1` |
| Semantic ruleset | `semantic-2026-07-19.1` |
| Visual ruleset | `visual-2026-07-19.1` |
| Shared contract | `packages/contracts/src/review.ts` |
| Reviewer service | `apps/reviewer` |
| Main application client | `apps/web/src/server/releases/reviewer-client.ts` |

Every request contains `requestId`, candidate/batch identity, `inputHash`, timestamp and nonce. The client signs timestamp, nonce, HTTP method, path and the exact raw request body with HMAC-SHA256. The service recomputes `inputHash`, atomically reserves the nonce and echoes the same request/hash identity in its response. Any mismatch fails closed.

## Semantic hard gate

The semantic service receives final URL, title, bounded source snapshot, correction/retraction markers and exactly four factual claims: Chinese headline, Chinese intro, English headline and English intro. It requires four unique result slots, exact claim-text equality, per-claim status/rationale/evidence and correct correction/retraction marking. The publication source gate accepts only `supported`; `unsupported` and `uncertain` block staging.

## Visual hard gate

The visual service receives one batch containing all 18 immutable poster URLs and expected topic/language/number/title/date/site values. It requires 18 unique poster results and all 153 unique unordered comparisons. The publication poster gate blocks missing or unknown slots, duplicate/missing pairs, OCR/IP/language/number/title/date/site/theme mismatch, near duplicates, bilingual theme mismatch and any human-review flag.

## Service security

- Bearer authentication plus body-bound HMAC signature.
- Five-minute timestamp window and atomic nonce reservation through a Redis-compatible REST store.
- In-memory replay storage is development/test only and rejected in production.
- Streaming request and provider-response byte limits.
- Provider and main-application timeouts.
- Per-instance concurrency limit with `429` fail-closed behavior.
- HTTPS required for provider and reviewer endpoints in production.
- Reviewer and model configuration is server-only; production mock provider is rejected.
- Poster origins are allowlisted before images are sent to the model provider.
- Logs contain request/candidate/provider/model/ruleset/hash/status/latency/error/fail-closed fields, never secrets or full source bodies.
- `/api/health` and `/api/version` expose protocol/deployment metadata without credentials.

## Local machine-verifiable results

Executed in the isolated `codex/release-review-services` worktree on 2026-07-19.

| Command | Result |
|---|---|
| `npm run check -w @xiazi/contracts` | Passed: TypeScript and 6 contract tests |
| `npm run check -w @xiazi/domain` | Passed: TypeScript and 8 domain tests |
| `npm run check -w @xiazi/reviewer` | Passed: ESLint, TypeScript, config audit and 20 service tests |
| `npm run check -w @xiazi/web` | Passed: ESLint, TypeScript, config audit and 101 application tests |
| `npm run build -w @xiazi/reviewer` | Passed: health, version, semantic and visual routes compiled |
| `npm run build -w @xiazi/web` | Passed; the pre-existing Turbopack NFT trace warning remains |
| `npm run test:e2e -w @xiazi/web` | Passed: 21 browser tests, 7 staging-only tests skipped without a staging URL |
| Local production server smoke | Passed: `/api/health` and `/api/version` returned protocol and ruleset versions without secrets |

## Remote CI evidence

- Draft PR: [#12 Release V2: versioned reviewer services](https://github.com/Yonge6/xiazi-global-hot-topics/pull/12)
- Stacked base: `codex/future-release-safety`
- Validated head: `7b792f454843c2cca32e9dd94ac561eebda759db`
- Final CI Run: [Reviewer services CI #29684581022](https://github.com/Yonge6/xiazi-global-hot-topics/actions/runs/29684581022)
- `Protocol and reviewer service`: **SUCCESS**. The job checked shared contracts (6 tests), the release domain (8 tests), reviewer service lint/type/config and 20 tests, then built the reviewer service.
- `Main application fail-closed integration`: **SUCCESS**. The job checked the web application (101 tests), independently reran the 7-test release-service fail-closed smoke suite, built the web application and ran browser E2E (21 passed, 7 staging-only skipped).

The skipped staging-only cases require real hosted reviewer, replay-store and staging Supabase resources. Their absence is not treated as a passing deployment result; it keeps this work package conditional and the PR Draft.

## Required staging-only deployment values

Reviewer service:

- `REVIEW_BEARER_SECRET`
- `REVIEW_HMAC_SECRET`
- `REVIEW_REPLAY_STORE_URL`
- `REVIEW_REPLAY_STORE_TOKEN`
- `REVIEW_PROVIDER_NAME`
- `REVIEW_MODEL`
- `REVIEW_MODEL_VERSION`
- `OPENAI_API_KEY`
- `REVIEW_ALLOWED_ASSET_ORIGINS`
- `REVIEW_DEPLOYMENT_VERSION`

Staging main application:

- `SOURCE_SEMANTIC_REVIEW_URL`
- `POSTER_VISION_REVIEW_URL`
- `RELEASE_REVIEW_BEARER_SECRET`
- `RELEASE_REVIEW_SIGNING_SECRET`
- `RELEASE_REVIEW_TIMEOUT_MS`

All credentials must be staging-only and different from production. Neither PR code nor evidence may contain a reusable secret or signed asset URL.

## Staging deployment and monitoring checklist

1. Create a dedicated reviewer service project; do not attach it to the production Xiazi Vercel project.
2. Create a staging-only durable replay store and verify duplicate `SET NX` returns no reservation.
3. Configure a version-locked, vision-capable model and staging-only provider key.
4. Deploy the reviewer commit and verify `/api/health` and `/api/version` over HTTPS.
5. Configure the two reviewer URLs and two distinct client secrets only in the staging web project.
6. Send one signed semantic request and one signed 18-poster request; export sanitized logs showing request ID, input hash, ruleset, model version, latency and pass/fail.
7. Stop the reviewer deployment and prove staging records `fail_publication_job`, never calls `stage_publication_release`, and leaves the active pointer unchanged.
8. Export monitoring evidence for request rate, latency, `401/403/413/429/5xx`, provider timeout, malformed response and fail-closed count.

## Remaining evidence boundary

The local credential audit found no `VERCEL_TOKEN`, model API key, durable replay-store URL/token, staging Supabase URL/service role, staging environment file or linked Vercel project in this worktree. The implementation branch is published for Draft review only; no third-party project was created and no deployment was attempted.

The following cannot be claimed from repository tests alone and must remain unchecked until real staging resources are supplied: public staging service reachability, deployed model/ruleset version, durable replay behavior across instances, external monitoring screenshots/exports, and active-pointer invariance against a real staging Supabase project. Their absence keeps production enablement failed and does not authorize a mock deployment.
