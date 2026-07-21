# Release V2 evidence index

This index separates implemented controls, unexecuted Reviewer evidence and the project owner's explicit production authorization.

| Hard gate | Evidence | Current status |
| --- | --- | --- |
| Versioned semantic and visual Reviewer protocol | `reviewer-services.md` | Code and ordinary CI passed; real staging Reviewer not executed |
| Direct COS Origin immutability | `storage-immutability.md` and `storage/` | Passed for approved Direct COS Origin scope |
| Isolated staging guards and database invariants | `staging-rehearsal/status.sanitized.json` | Passed |
| Persistent replay store | `staging-rehearsal/README.md` | Verified in isolated staging Supabase |
| Real Reviewer deployment and pinned-model calls | `staging-rehearsal/environment-versions.md` | `not-executed` |
| Reviewer risk acceptance | `reviewer-waiver-decision.md` | Authorized; does not assert Reviewer pass |
| Waiver and automatic approval code/database gates | migration, unit tests and RPC suite | Local code, Build, E2E and real local Postgres suite passed |
| Protected Release A/B lifecycle | `staging-rehearsal/` | Reviewer portion waived; production A/B execution still pending |
| Live fault injection, rollback, and reactivation | `staging-rehearsal/` | Not executed |
| Production deployment and rollback | `production-deployment.md` | Authorized; execution evidence pending |

Current formal state:

```json
{
  "realReviewerStatus": "not-executed",
  "protectedReviewerRehearsal": "waived",
  "workPackageThree": "accepted-with-reviewer-waiver",
  "productionEnablement": "authorized"
}
```
