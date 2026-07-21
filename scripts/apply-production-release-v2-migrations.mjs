import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF;
const expectedProjectRef = process.env.EXPECTED_SUPABASE_PROJECT_REF;
const productionMainSha = process.env.PRODUCTION_MAIN_SHA;
const requiredMainSha = "6da43753c01400da0e7fc1599f1cbc9ca3237e32";
if (!accessToken || !projectRef || !expectedProjectRef || !productionMainSha) {
  throw new Error("Missing required production migration configuration");
}
if (projectRef !== expectedProjectRef) throw new Error("Production project ref mismatch");
if (productionMainSha !== requiredMainSha) throw new Error("Production main SHA mismatch");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrations = [
  {
    version: "20260718230000",
    name: "future_release_safety",
    file: "20260718230000_future_release_safety.sql",
    sha256: "5f039f066351cd813b3412a283f0609284c9b2918ad91ab53f69f9e4b2728665",
  },
  {
    version: "20260719010000",
    name: "release_safety_hardening",
    file: "20260719010000_release_safety_hardening.sql",
    sha256: "66e34b8fa96c13e42fe97058e62779c6e1c76a0b80b6ffa97284824f4166a212",
  },
  {
    version: "20260720010000",
    name: "reviewer_replay_nonce_store",
    file: "20260720010000_reviewer_replay_nonce_store.sql",
    sha256: "81bd157da1805923d6f381c6a5781876caee4d31b0a9cf726bd66ff04b1ced26",
  },
  {
    version: "20260721030000",
    name: "release_review_waiver_and_automatic_approval",
    file: "20260721030000_release_review_waiver_and_automatic_approval.sql",
    sha256: "8c3d3c090cb053323e6899b047859635bbcbdab0465c644ba9bb1f4f0279a821",
  },
];

async function query(sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Management query failed (${response.status}): ${body}`);
  return body ? JSON.parse(body) : [];
}

const beforeHistory = await query("select version,name from supabase_migrations.schema_migrations order by version");
const existing = new Set(beforeHistory.map((item) => item.version));
const partiallyApplied = migrations.filter((item) => existing.has(item.version));
if (partiallyApplied.length > 0 && partiallyApplied.length !== migrations.length) {
  throw new Error(`Partial target migration state: ${partiallyApplied.map((item) => item.version).join(",")}`);
}

const applied = [];
if (partiallyApplied.length === 0) {
  for (const migration of migrations) {
    const migrationPath = path.join(root, "supabase", "migrations", migration.file);
    const sql = await readFile(migrationPath, "utf8");
    const actualHash = createHash("sha256").update(sql).digest("hex");
    if (actualHash !== migration.sha256) throw new Error(`Migration hash mismatch: ${migration.file}`);
    const auditStatement = `applied via authorized Management API; sha256=${migration.sha256}`;
    const escapedName = migration.name.replaceAll("'", "''");
    const escapedAudit = auditStatement.replaceAll("'", "''");
    await query(`
      begin;
      ${sql}
      insert into supabase_migrations.schema_migrations(version, name, statements)
      values ('${migration.version}', '${escapedName}', array['${escapedAudit}']);
      commit;
    `);
    applied.push({ version: migration.version, name: migration.name, sha256: migration.sha256 });
  }
}

const afterHistory = await query("select version,name from supabase_migrations.schema_migrations order by version");
for (const migration of migrations) {
  const recorded = afterHistory.find((item) => item.version === migration.version);
  if (!recorded || recorded.name !== migration.name) {
    throw new Error(`Migration history verification failed: ${migration.version}`);
  }
}

console.log(JSON.stringify({
  projectRefHash: createHash("sha256").update(projectRef).digest("hex").slice(0, 16),
  productionMainSha,
  beforeMigrationCount: beforeHistory.length,
  afterMigrationCount: afterHistory.length,
  applied,
  alreadyApplied: partiallyApplied.length === migrations.length,
  verifiedAt: new Date().toISOString(),
}, null, 2));
