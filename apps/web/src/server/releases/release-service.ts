import type { SupabaseClient } from "@supabase/supabase-js";
import {
  approvePublicationReleaseSchema,
  parseIssue,
  rollbackPublicationReleaseSchema,
  stagePublicationReleaseSchema,
  type ActivePublication,
  type PosterCheck,
  type PublicationValidationReport,
  type SourceSnapshot,
} from "@xiazi/contracts";
import {
  assertFutureReleaseDate,
  PUBLICATION_RELEASE_SCHEMA_VERSION,
  publicationReleaseId,
} from "@xiazi/domain";

import { canonicalIssueBundle } from "../publishing/canonical-issue";
import { createSupabaseServiceClientFromEnv } from "../content-sync/supabase-service-client";
import { stableHash } from "./release-hash";
import { verifyReleasePosters } from "./poster-gate";
import { verifyReleaseSources } from "./source-gate";

type StageDependencies = {
  client?: SupabaseClient | null;
  sourceGate?: typeof verifyReleaseSources;
  posterGate?: typeof verifyReleasePosters;
  now?: () => Date;
  leaseSeconds?: number;
  heartbeatIntervalMs?: number;
};

type LeaseResult = {
  acquired: boolean;
  status: "leased" | "validating" | "staged" | "activated" | "failed";
  releaseId?: string | null;
  leaseOwner: string;
  leaseExpiresAt: string;
};

function requiredClient(client?: SupabaseClient | null) {
  const value = client === undefined ? createSupabaseServiceClientFromEnv() : client;
  if (!value) throw new Error("RELEASE_STORE_UNAVAILABLE");
  return value;
}

async function rpc<T>(client: SupabaseClient, name: string, params: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, params);
  if (error) throw new Error(`${name}:${error.message}`);
  return data as T;
}

export async function stageFuturePublication(input: unknown, dependencies: StageDependencies = {}) {
  const request = stagePublicationReleaseSchema.parse(input);
  const bundle = canonicalIssueBundle(request.issue);
  assertFutureReleaseDate(bundle.issue.issueDate);
  const client = requiredClient(dependencies.client);
  const now = dependencies.now || (() => new Date());
  const leaseSeconds = dependencies.leaseSeconds || 180;
  const heartbeatIntervalMs = dependencies.heartbeatIntervalMs || Math.min(45_000, Math.floor(leaseSeconds * 1000 / 3));
  const releaseCandidateId = `candidate-${bundle.issue.issueDate}-${bundle.checksum.slice(0, 16)}`;

  const lease = await rpc<LeaseResult>(client, "acquire_publication_lease", {
    p_issue_date: bundle.issue.issueDate,
    p_idempotency_key: request.idempotencyKey,
    p_lease_owner: request.leaseOwner,
    p_lease_seconds: leaseSeconds,
  });
  if (!lease.acquired) {
    return {
      published: lease.status === "activated",
      status: lease.status === "staged"
        ? "ready_for_approval" as const
        : lease.status === "activated"
          ? "already_active" as const
          : "in_progress" as const,
      releaseId: lease.releaseId || null,
      issueDate: bundle.issue.issueDate,
      contentHash: bundle.checksum,
      reused: true,
    };
  }

  let sources: SourceSnapshot[] = [];
  let posters: PosterCheck[] = [];
  let heartbeatFailure: unknown;
  let heartbeatInFlight = Promise.resolve();
  const renewLease = async () => {
    await rpc(client, "renew_publication_lease", {
      p_issue_date: bundle.issue.issueDate,
      p_idempotency_key: request.idempotencyKey,
      p_lease_owner: request.leaseOwner,
      p_lease_seconds: leaseSeconds,
    });
  };
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  try {
    await renewLease();
    heartbeat = setInterval(() => {
      heartbeatInFlight = heartbeatInFlight
        .then(renewLease)
        .catch((error) => { heartbeatFailure = error; });
    }, heartbeatIntervalMs);
    [sources, posters] = await Promise.all([
      (dependencies.sourceGate || verifyReleaseSources)(bundle.issue, { releaseCandidateId }),
      (dependencies.posterGate || verifyReleasePosters)(bundle.issue, request.assetBatchId, request.posters),
    ]);
    await heartbeatInFlight;
    if (heartbeatFailure) throw heartbeatFailure;
    await renewLease();
    const sourceSnapshotHash = stableHash(sources);
    const posterManifestHash = stableHash(posters);
    const releaseHash = stableHash({
      schemaVersion: PUBLICATION_RELEASE_SCHEMA_VERSION,
      contentHash: bundle.checksum,
      sourceSnapshotHash,
      posterManifestHash,
    });
    const releaseId = publicationReleaseId(bundle.issue.issueDate, releaseHash);
    const validationReport: PublicationValidationReport = {
      passed: true,
      schemaVersion: PUBLICATION_RELEASE_SCHEMA_VERSION,
      checkedAt: now().toISOString(),
      sourceSnapshotHash,
      posterManifestHash,
      sourceCount: sources.length,
      posterCount: posters.length,
      failures: [],
    };
    const staged = await rpc<Record<string, unknown>>(client, "stage_publication_release", {
      payload: {
        releaseId,
        releaseHash,
        schemaVersion: PUBLICATION_RELEASE_SCHEMA_VERSION,
        issueDate: bundle.issue.issueDate,
        contentHash: bundle.checksum,
        idempotencyKey: request.idempotencyKey,
        leaseOwner: request.leaseOwner,
        issue: bundle.issue,
        sources,
        posters,
        sourceSnapshotHash,
        posterManifestHash,
        validationReport,
      },
    });
    return {
      published: false,
      status: "ready_for_approval" as const,
      releaseId,
      issueDate: bundle.issue.issueDate,
      contentHash: bundle.checksum,
      validationReport,
      staged,
    };
  } catch (error) {
    try {
      await client.rpc("fail_publication_job", {
        p_issue_date: bundle.issue.issueDate,
        p_idempotency_key: request.idempotencyKey,
        p_lease_owner: request.leaseOwner,
        p_error_code: error instanceof Error ? error.message : "RELEASE_VALIDATION_FAILED",
      });
    } catch {
      // Preserve the original hard-gate failure even if audit recording is unavailable.
    }
    throw error;
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
}

export async function approveFuturePublication(
  releaseId: string,
  input: unknown,
  approver: string,
  client?: SupabaseClient | null,
) {
  const request = approvePublicationReleaseSchema.parse(input);
  return rpc<Record<string, unknown>>(requiredClient(client), "activate_publication_release", {
    p_release_id: releaseId,
    p_approver: approver,
    p_activation_key: request.activationKey,
  });
}

export async function rollbackFuturePublication(
  releaseId: string,
  input: unknown,
  actor: string,
  client?: SupabaseClient | null,
) {
  const request = rollbackPublicationReleaseSchema.parse(input);
  return rpc<Record<string, unknown>>(requiredClient(client), "rollback_publication_release", {
    p_release_id: releaseId,
    p_actor: actor,
    p_activation_key: request.activationKey,
    p_reason: request.reason,
  });
}

export async function loadActivePublication(client?: SupabaseClient | null): Promise<ActivePublication | null> {
  const data = await rpc<unknown>(requiredClient(client), "get_active_publication_release", {});
  if (!data || typeof data !== "object") return null;
  const detail = data as { issue?: unknown; metadata?: Record<string, unknown> };
  if (!detail.issue || !detail.metadata) throw new Error("ACTIVE_RELEASE_PAYLOAD_INVALID");
  const issue = parseIssue(detail.issue);
  const metadata = detail.metadata;
  if (typeof metadata.releaseId !== "string"
    || typeof metadata.releaseSchemaVersion !== "string"
    || typeof metadata.contentHash !== "string"
    || metadata.dataSource !== "supabase-release"
    || metadata.publicationHealth !== "healthy"
    || metadata.stale !== false) {
    throw new Error("ACTIVE_RELEASE_METADATA_INVALID");
  }
  return {
    issue: { ...issue, assetVersion: metadata.releaseId },
    metadata: {
      releaseId: metadata.releaseId,
      releaseSchemaVersion: metadata.releaseSchemaVersion,
      contentHash: metadata.contentHash,
      dataSource: "supabase-release",
      deployedAt: typeof metadata.deployedAt === "string" ? metadata.deployedAt : null,
      publicationHealth: "healthy",
      stale: false,
    },
  };
}

type StoredReleaseRow = {
  release_id: string;
  content_hash: string;
  issue: unknown;
  status: "active" | "superseded";
  deployed_at: string | null;
  schema_version: string;
};

function publicationFromRow(row: StoredReleaseRow): ActivePublication {
  const issue = parseIssue(row.issue);
  return {
    issue: { ...issue, assetVersion: row.release_id },
    metadata: {
      releaseId: row.release_id,
      releaseSchemaVersion: row.schema_version,
      contentHash: row.content_hash,
      dataSource: "supabase-release",
      deployedAt: row.deployed_at,
      publicationHealth: "healthy",
      stale: false,
    },
  };
}

export async function loadPublicationByReleaseId(
  releaseId: string,
  client?: SupabaseClient | null,
): Promise<ActivePublication | null> {
  const { data, error } = await requiredClient(client)
    .from("publication_releases")
    .select("release_id, content_hash, issue, status, deployed_at, schema_version")
    .eq("release_id", releaseId)
    .in("status", ["active", "superseded"])
    .maybeSingle();
  if (error) throw new Error(`RELEASE_READ_FAILED:${error.message}`);
  return data ? publicationFromRow(data as StoredReleaseRow) : null;
}

export async function loadPublicationByDate(
  issueDate: string,
  client?: SupabaseClient | null,
): Promise<ActivePublication | null> {
  const { data, error } = await requiredClient(client)
    .from("publication_releases")
    .select("release_id, content_hash, issue, status, deployed_at, schema_version")
    .eq("issue_date", issueDate)
    .in("status", ["active", "superseded"])
    .order("activated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`RELEASE_ARCHIVE_READ_FAILED:${error.message}`);
  return data ? publicationFromRow(data as StoredReleaseRow) : null;
}

export async function listPublishedPublications(client?: SupabaseClient | null) {
  const { data, error } = await requiredClient(client)
    .from("publication_releases")
    .select("release_id, issue_date, content_hash, issue, status, deployed_at, schema_version")
    .in("status", ["active", "superseded"])
    .order("issue_date", { ascending: false })
    .order("activated_at", { ascending: false });
  if (error) throw new Error(`RELEASE_ARCHIVE_LIST_FAILED:${error.message}`);

  const latestByDate = new Map<string, ActivePublication>();
  for (const row of (data || [])) {
    if (!latestByDate.has(row.issue_date)) {
      latestByDate.set(row.issue_date, publicationFromRow(row as StoredReleaseRow));
    }
  }
  return [...latestByDate.values()];
}

export async function loadVerifiedPoster(
  releaseId: string,
  topicId: string,
  locale: "zh" | "en",
  client?: SupabaseClient | null,
) {
  const publication = await loadPublicationByReleaseId(releaseId, client);
  if (!publication) return null;
  const { data, error } = await requiredClient(client)
    .from("publication_poster_checks")
    .select("url, content_hash, format")
    .eq("release_id", releaseId)
    .eq("topic_id", topicId)
    .eq("locale", locale)
    .maybeSingle();
  if (error) throw new Error(`RELEASE_POSTER_READ_FAILED:${error.message}`);
  if (!data || data.format !== "png") return null;
  return { url: data.url as string, contentHash: data.content_hash as string };
}

export async function listPendingPublications(client?: SupabaseClient | null) {
  const { data, error } = await requiredClient(client)
    .from("publication_releases")
    .select("release_id, issue_date, content_hash, status, ready_at, validation_report")
    .eq("status", "ready_for_approval")
    .order("issue_date", { ascending: false });
  if (error) throw new Error(`PENDING_RELEASES_READ_FAILED:${error.message}`);
  return (data || []).map((row) => ({
    releaseId: row.release_id,
    issueDate: row.issue_date,
    contentHash: row.content_hash,
    status: row.status,
    readyAt: row.ready_at,
    validationReport: row.validation_report,
  }));
}
