import { readFile } from "node:fs/promises";

import { stagePublicationReleaseSchema } from "@xiazi/contracts";

import { stageFuturePublication } from "../apps/web/src/server/releases/release-service";

const CANONICAL_ORIGIN = "https://xiazishuo.com";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`PRODUCTION_LOCAL_STAGE_CONFIG_MISSING:${name}`);
  return value;
}

async function main() {
  if (process.env.RELEASE_ENVIRONMENT !== "production") throw new Error("PRODUCTION_RELEASE_ENVIRONMENT_REQUIRED");
  if (new URL(required("PRODUCTION_WEB_URL")).origin !== CANONICAL_ORIGIN) {
    throw new Error("PRODUCTION_RELEASE_ORIGIN_MISMATCH");
  }
  const payload = stagePublicationReleaseSchema.parse(JSON.parse(
    await readFile(required("PRODUCTION_RELEASE_PAYLOAD_INPUT"), "utf8"),
  ));
  if (payload.issue.issueDate <= "2026-07-18") throw new Error("HISTORICAL_RELEASE_OUT_OF_SCOPE");
  if (JSON.stringify(payload).toLowerCase().includes("pluto.hk")) {
    throw new Error("RETIRED_DOMAIN_IN_PRODUCTION_RELEASE");
  }
  const result = await stageFuturePublication(payload);
  if (result.status !== "ready_for_approval" || !result.releaseId || !result.validationReport?.passed) {
    throw new Error(`PRODUCTION_RELEASE_NOT_READY:${result.status}`);
  }
  console.log(JSON.stringify({
    status: result.status,
    releaseId: result.releaseId,
    issueDate: result.issueDate,
    contentHash: result.contentHash,
    validationReport: {
      passed: result.validationReport.passed,
      reviewStatus: result.validationReport.reviewStatus,
      reviewPassed: result.validationReport.reviewPassed,
      reviewWaived: result.validationReport.reviewWaived,
      waiverId: result.validationReport.waiverId,
      sourceCount: result.validationReport.sourceCount,
      posterCount: result.validationReport.posterCount,
      storageVerification: {
        provider: result.validationReport.storageVerification?.provider,
        policyVersion: result.validationReport.storageVerification?.policyVersion,
        policyVerified: result.validationReport.storageVerification?.policyVerified,
        overwriteDenied: result.validationReport.storageVerification?.overwriteDenied,
        deleteDenied: result.validationReport.storageVerification?.deleteDenied,
        objectManifestHash: result.validationReport.storageVerification?.objectManifestHash,
      },
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
