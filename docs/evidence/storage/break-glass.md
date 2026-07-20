# Storage break-glass procedure

Scope: dedicated Xiazi Release V2 staging storage only. This procedure does not authorize changes to production COS, DNS, CDN, Supabase, Vercel or historical issues.

## Owner and approval

- Account owner: the Tencent Cloud root-account owner for the Xiazi staging account (`Yonge6`; credentials withheld).
- Change owner: the Xiazi Release V2 maintainer responsible for PR #13.
- Break-glass credentials are not stored in application runtime or ordinary GitHub Actions.
- A break-glass change requires a written change reason, named target bucket/key/policy, rollback plan, root-account MFA and a linked PR/audit record.
- Destructive deletion of retained proof objects is not an approved operation for this work package.

## Procedure

1. Confirm the target contains both `xiazi` and `staging`; reject production or VileSaint targets.
2. Record the requested operation, reason, expected blast radius and rollback method.
3. Capture current bucket policy, encryption, versioning and CloudAudit state.
4. Obtain account-owner MFA approval immediately before the operation.
5. Perform only the named operation in the Tencent Cloud console.
6. Re-run the protected storage verification if policy or identity grants changed.
7. Export and sanitize CloudAudit events; attach them to the evidence update.
8. Revoke any temporary credential and confirm application credentials still cannot delete or overwrite.

## Recovery rule

If versioning is ever enabled or suspended, the bucket is permanently disqualified from this protocol. Do not attempt to repair or reuse it. Create a new dedicated staging bucket, reapply the reviewed policy, rerun the full protected verification and retain the old bucket for audit.

If a policy change unexpectedly grants overwrite or deletion, stop Release V2 staging, restore the last reviewed policy using root MFA, rotate affected staging credentials and rerun all cloud verification before further use.
