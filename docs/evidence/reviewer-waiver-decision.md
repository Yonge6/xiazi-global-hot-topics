# Release V2 Reviewer waiver decision

## Decision

- Change record: `owner-risk-acceptance-2026-07`
- Decision date: 2026-07-21
- Configured by: project owner
- Scope: initial Release V2 semantic and visual Reviewer only
- Real Reviewer status: `not-executed`
- Protected Reviewer rehearsal: `waived`
- Production enablement: authorized
- Automatic publishing: authorized after phased production gates
- Asset topology: Direct COS Origin; CDN not applicable

The owner accepts the risk that semantic claims, poster OCR, visual theme and IP identity are not externally reviewed during the waiver period. This record does not state or imply that those checks passed.

## Required production configuration

```text
RELEASE_ENVIRONMENT=production
RELEASE_REVIEW_MODE=waived
RELEASE_REVIEW_WAIVER_ID=owner-risk-acceptance-2026-07
RELEASE_REVIEW_WAIVER_REASON=Owner explicitly accepts semantic and visual reviewer risk for initial Release V2 launch
RELEASE_REVIEW_WAIVER_CONFIGURED_BY=project-owner
RELEASE_REVIEW_WAIVER_CONFIGURED_AT=<immutable ISO-8601 decision timestamp>
```

The default remains `RELEASE_REVIEW_MODE=enforced`. Missing or invalid waiver fields fail closed.

## Controls not waived

- Future-only cutoff after 2026-07-18.
- Safe source URL, manual redirects, DNS/IP SSRF checks, bounded body, snapshot hash and correction/retraction marker blocking.
- Complete 18-slot bilingual manifest, immutable COS metadata, PNG format, dimensions, SHA-256, exact duplicate and perceptual duplicate gates.
- COS create-only/deny-overwrite policy and object reread proof.
- Complete release identity, payload conflict, owner lease and heartbeat.
- Atomic pointer activation, truthful idempotency, rollback and explicit 503/degraded semantics.
- Audit fields for waiver and automatic activation.

## Reversal

Provisioning a real Reviewer requires changing `RELEASE_REVIEW_MODE` back to `enforced` and configuring the existing Reviewer service credentials. No release schema rewrite is required.
