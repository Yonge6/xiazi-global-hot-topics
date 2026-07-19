import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(process.cwd(), "../../supabase/migrations/20260718230000_future_release_safety.sql");
const hardeningMigrationPath = path.resolve(process.cwd(), "../../supabase/migrations/20260719010000_release_safety_hardening.sql");

describe("future release migration", () => {
  it("contains the atomic pointer, lease, idempotency and rollback primitives", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("publication_releases_future_only_check");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("for update");
    expect(sql).toContain("activate_publication_release");
    expect(sql).toContain("rollback_publication_release");
    expect(sql).toContain("publication_activation_requests");
    expect(sql).toContain("RELEASE_VALIDATION_NOT_PASSED");
    expect(sql).toContain("IMMUTABLE_RELEASE_PAYLOAD");
  });

  it("does not update any legacy issue, archive or story-pool table", async () => {
    const sql = `${await readFile(migrationPath, "utf8")}\n${await readFile(hardeningMigrationPath, "utf8")}`;
    expect(sql).not.toMatch(/update\s+public\.issues\b/i);
    expect(sql).not.toMatch(/insert\s+into\s+public\.issues\b/i);
    expect(sql).not.toMatch(/story_pool/i);
  });

  it("hardens complete identity, lease ownership, heartbeat and truthful idempotency", async () => {
    const sql = await readFile(hardeningMigrationPath, "utf8");
    expect(sql).toContain("release_hash");
    expect(sql).toContain("RELEASE_PAYLOAD_CONFLICT");
    expect(sql).toContain("renew_publication_lease");
    expect(sql).toContain("lease_owner <> p_lease_owner");
    expect(sql).toContain("lease_expires_at <= now()");
    expect(sql).toContain("claim_results");
    expect(sql).toContain("perceptual_hash");
    expect(sql).toContain("saved.validation_report is distinct from p_validation");
    expect(sql).toContain("source.claim_results = source_item->'claimResults'");
    expect(sql).toContain("poster.batch_comparison_hash = poster_item->>'batchComparisonHash'");
    expect(sql).toContain("currentActiveReleaseId");
    expect(sql).not.toMatch(/'status',\s*'active',\s*'idempotent',\s*true/i);
  });
});
