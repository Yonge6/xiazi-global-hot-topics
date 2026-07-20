# Isolated staging environment inventory

| Component | Isolated staging identity | Version/status |
| --- | --- | --- |
| Git branch | `codex/release-v2-staging-rehearsal` | Draft PR #14 |
| Supabase | `xiazi-release-v2-staging` / `ardermdcrzzwzbmlszez` | PostgreSQL 17, `ap-southeast-1` |
| Reviewer | `xiazi-release-v2-reviewer-staging` | Created, deployment pending |
| Web | `xiazi-release-v2-web-staging` | Created, deployment pending |
| Semantic ruleset | shared contracts | `semantic-2026-07-19.1` |
| Visual ruleset | shared contracts | `visual-2026-07-19.1` |
| Model | OpenAI vision-capable snapshot | `gpt-4o-2024-11-20`, credential pending |
| Replay store | Supabase atomic RPC | Remote duplicate reservation rejected |
| Storage | Tencent COS staging | Direct COS Origin; policy `xiazi-cos-immutable-v3` |
| CDN | none | `not-applicable-for-direct-cos-origin` |

No production project, domain, service role, storage object, or publication was used or modified.
