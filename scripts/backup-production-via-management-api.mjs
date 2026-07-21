import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF;
const expectedProjectRef = process.env.EXPECTED_SUPABASE_PROJECT_REF;
const outputPath = process.env.BACKUP_OUTPUT;
const mainSha = process.env.PRODUCTION_MAIN_SHA;

if (!accessToken || !projectRef || !expectedProjectRef || !outputPath || !mainSha) {
  throw new Error("Missing required production backup configuration");
}
if (projectRef !== expectedProjectRef) throw new Error("Production project ref mismatch");
if (!path.isAbsolute(outputPath) || !outputPath.startsWith("/Users/yongyuan/Documents/xiazi-release-v2-backups/")) {
  throw new Error("Backup output must be an absolute path in the dedicated backup directory");
}
if (!/^[a-f0-9]{40}$/.test(mainSha)) throw new Error("Invalid production main SHA");

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
  return JSON.parse(body);
}

const tableRows = await query(`
  select table_name
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
  order by table_name
`);
const tableNames = tableRows.map((row) => row.table_name);
const identifier = (value) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw new Error(`Unsafe database identifier: ${value}`);
  return `"${value.replaceAll('"', '""')}"`;
};

const tableData = {};
for (const tableName of tableNames) {
  tableData[tableName] = await query(`select * from public.${identifier(tableName)}`);
}

const [
  databaseIdentity,
  columns,
  constraints,
  indexes,
  policies,
  triggers,
  functions,
  enums,
  migrationHistory,
] = await Promise.all([
  query("select current_database() as database_name, now() as captured_at"),
  query(`
    select table_name, column_name, ordinal_position, data_type, udt_name,
           is_nullable, column_default, character_maximum_length
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, ordinal_position
  `),
  query(`
    select c.conrelid::regclass::text as table_name, c.conname as constraint_name,
           c.contype as constraint_type, pg_get_constraintdef(c.oid, true) as definition
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public'
    order by table_name, constraint_name
  `),
  query(`
    select schemaname, tablename, indexname, indexdef
    from pg_indexes
    where schemaname = 'public'
    order by tablename, indexname
  `),
  query(`
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
    order by tablename, policyname
  `),
  query(`
    select event_object_table as table_name, trigger_name, action_timing,
           event_manipulation, action_statement
    from information_schema.triggers
    where trigger_schema = 'public'
    order by table_name, trigger_name, event_manipulation
  `),
  query(`
    select p.oid::regprocedure::text as identity, pg_get_functiondef(p.oid) as definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
    order by identity
  `),
  query(`
    select n.nspname as schema_name, t.typname as type_name, e.enumsortorder, e.enumlabel
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
    order by type_name, e.enumsortorder
  `),
  query(`
    select version, name, statements
    from supabase_migrations.schema_migrations
    order by version
  `),
]);

const payload = {
  backupFormat: "xiazi-management-api-logical-backup-v1",
  createdAt: new Date().toISOString(),
  projectRef,
  productionMainSha: mainSha,
  databaseIdentity,
  catalog: { columns, constraints, indexes, policies, triggers, functions, enums },
  migrationHistory,
  tableData,
};
const serialized = `${JSON.stringify(payload, null, 2)}\n`;
await writeFile(outputPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o600 });

console.log(JSON.stringify({
  backupFormat: payload.backupFormat,
  outputPath,
  tableCount: tableNames.length,
  rowCounts: Object.fromEntries(tableNames.map((name) => [name, tableData[name].length])),
  migrationCount: migrationHistory.length,
  sha256: createHash("sha256").update(serialized).digest("hex"),
  bytes: Buffer.byteLength(serialized),
}, null, 2));
