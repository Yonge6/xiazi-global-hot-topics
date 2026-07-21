# Release V2 evidence index

This index separates implemented controls from evidence obtained against isolated external services. No item here authorizes production enablement.

| Hard gate | Evidence | Current status |
| --- | --- | --- |
| Versioned semantic and visual Reviewer protocol | `reviewer-services.md` | Code and ordinary CI passed; real staging Reviewer not executed |
| Direct COS Origin immutability | `storage-immutability.md` and `storage/` | Passed for approved Direct COS Origin scope |
| Isolated staging guards and database invariants | `staging-rehearsal/status.sanitized.json` | Passed |
| Persistent replay store | `staging-rehearsal/README.md` | Verified in isolated staging Supabase |
| Real Reviewer deployment and pinned-model calls | `staging-rehearsal/environment-versions.md` | `not-executed` |
| Protected Release A/B lifecycle | `staging-rehearsal/` | Blocked by absent staging-only model credential |
| Live fault injection, rollback, and reactivation | `staging-rehearsal/` | Not executed |
| Production enablement review | `staging-rehearsal/status.sanitized.json` | Failed |

Current formal state:

```json
{
  "realReviewerStatus": "not-executed",
  "protectedStagingRehearsal": "blocked",
  "workPackageThree": "conditional-pass",
  "productionEnablementReview": "failed"
}
```
