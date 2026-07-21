# Isolated staging environment inventory

| Component | Isolated staging identity | Version/status |
| --- | --- | --- |
| Git branch | `codex/release-v2-staging-rehearsal` | Draft PR #14 |
| Supabase | `xiazi-release-v2-staging` / `ardermdcrzzwzbmlszez` | PostgreSQL 17, `ap-southeast-1` |
| Reviewer | `xiazi-release-v2-reviewer-staging` | Project created; deployment and real calls not executed |
| Web | `xiazi-release-v2-web-staging` | Project created; protected live deployment not executed |
| Semantic ruleset | shared contracts | `semantic-2026-07-19.1` |
| Visual ruleset | shared contracts | `visual-2026-07-19.1` |
| Model | OpenAI vision-capable snapshot configuration | `gpt-4o-2024-11-20`; no real model credential or call |
| Replay store | Supabase atomic RPC | Remote duplicate reservation rejected |
| Storage | Tencent COS staging | Direct COS Origin; policy `xiazi-cos-immutable-v3` |
| CDN | none | `not-applicable-for-direct-cos-origin` |

No production project, domain, service role, storage object, or publication was used or modified.

Formal execution state:

- `realReviewerStatus: not-executed`
- `protectedStagingRehearsal: blocked`
- `workPackageThree: conditional-pass`
- `productionEnablementReview: failed`

The Supabase replay-store result is real isolated staging evidence. Reviewer deployment, model behavior, Release A/B, the live fault matrix, rollback, and reactivation are not executed and are not inferred from local or controlled-provider tests.
