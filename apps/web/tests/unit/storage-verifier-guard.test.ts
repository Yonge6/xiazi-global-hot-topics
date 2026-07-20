import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

const script = path.resolve(process.cwd(), "../../scripts/verify-storage-immutability.mjs");
const base = {
  STORAGE_APP_SECRET_ID: "app-id",
  STORAGE_APP_SECRET_KEY: "DO_NOT_PRINT_THIS_APP_SECRET",
  STORAGE_AUDIT_SECRET_ID: "audit-id",
  STORAGE_AUDIT_SECRET_KEY: "DO_NOT_PRINT_THIS_AUDIT_SECRET",
  STORAGE_READER_SECRET_ID: "reader-id",
  STORAGE_READER_SECRET_KEY: "DO_NOT_PRINT_THIS_READER_SECRET",
  STORAGE_FIXTURE_SECRET_ID: "fixture-id",
  STORAGE_FIXTURE_SECRET_KEY: "DO_NOT_PRINT_THIS_FIXTURE_SECRET",
  COS_BUCKET: "xiazi-staging-assets-0000000000",
  COS_REGION: "ap-hongkong",
  STORAGE_CDN_BASE_URL: "https://assets-staging.example.com/",
};

function run(env: Record<string, string>) {
  return spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: { ...process.env, ...base, ...env },
  });
}

describe("staging storage verifier safety guards", () => {
  it("refuses production before any network request and never prints secrets", () => {
    const result = run({ STORAGE_ENV: "production" });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("STORAGE_ENV_MUST_BE_STAGING");
    expect(`${result.stdout}${result.stderr}`).not.toContain("DO_NOT_PRINT_THIS");
  });

  it("refuses a bucket name without an explicit staging marker", () => {
    const result = run({ STORAGE_ENV: "staging", COS_BUCKET: "xiazi-assets-0000000000" });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("STAGING_BUCKET_NAME_REQUIRED");
  });

  it("refuses a legacy VileSaint bucket even when its name contains staging", () => {
    const result = run({ STORAGE_ENV: "staging", COS_BUCKET: "vilesaint-staging-assets-1258992379" });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("STAGING_BUCKET_NAME_REQUIRED");
  });

  it("refuses a mutable or traversal test prefix", () => {
    const result = run({
      STORAGE_ENV: "staging",
      STORAGE_TEST_PREFIX: "release-assets/immutability-verification/../current",
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("STAGING_TEST_PREFIX_INVALID");
  });

  it("requires an explicit valid CDN verification mode", () => {
    const result = run({ STORAGE_ENV: "staging", STORAGE_CDN_VERIFICATION: "later" });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("STORAGE_CDN_VERIFICATION_INVALID");
  });
});
