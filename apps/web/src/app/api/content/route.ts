import { NextResponse } from "next/server";

import { CONTENT_CACHE_CONTROL } from "@/lib/cache/public-cache";
import {
  loadCurrentProductionReleaseManifest,
  loadLatestProductionIssue,
} from "@/server/json/production-json-source";
import { contentChecksum } from "@/server/content-sync/issue-bundle";
import { loadActivePublication } from "@/server/releases/release-service";
import { explicitDegradedFallbackEnabled, releaseV2Enabled } from "@/server/releases/release-runtime";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  if (releaseV2Enabled()) {
    try {
      const active = await loadActivePublication();
      if (!active) throw new Error("ACTIVE_RELEASE_NOT_CONFIGURED");
      return NextResponse.json({
        ...active.issue,
        assetVersion: active.issue.assetVersion || active.metadata.releaseId,
        ...active.metadata,
      }, {
        headers: {
          "Cache-Control": CONTENT_CACHE_CONTROL,
          "X-Content-Source": active.metadata.dataSource,
          "X-Release-Id": active.metadata.releaseId,
          "X-Content-Hash": active.metadata.contentHash,
          "X-Publication-Health": active.metadata.publicationHealth,
          "X-Review-Status": active.metadata.reviewStatus,
        },
      });
    } catch (error) {
      if (!explicitDegradedFallbackEnabled()) {
        return NextResponse.json({
          message: "Active release unavailable",
          publicationHealth: "degraded",
          stale: true,
          degradationReason: error instanceof Error ? error.message : "ACTIVE_RELEASE_UNAVAILABLE",
        }, {
          status: 503,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "X-Publication-Health": "degraded",
            "X-Content-Stale": "true",
          },
        });
      }
      try {
        const legacy = await loadLatestProductionIssue();
        const hash = contentChecksum(legacy.issue);
        const reason = error instanceof Error ? error.message : "ACTIVE_RELEASE_UNAVAILABLE";
        return NextResponse.json({
          ...legacy.issue,
          assetVersion: legacy.issue.assetVersion || legacy.issue.beijingTimestamp || legacy.issue.issueDate,
          releaseId: `legacy_${legacy.issue.issueDate.replaceAll("-", "")}_${hash.slice(0, 16)}`,
          contentHash: hash,
          dataSource: legacy.source,
          deployedAt: null,
          publicationHealth: "degraded",
          stale: true,
          degradationReason: reason,
        }, {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "X-Content-Source": legacy.source,
            "X-Content-Hash": hash,
            "X-Publication-Health": "degraded",
            "X-Content-Stale": "true",
          },
        });
      } catch (fallbackError) {
        return NextResponse.json({
          message: fallbackError instanceof Error ? fallbackError.message : "Current issue unavailable",
          publicationHealth: "degraded",
          stale: true,
        }, { status: 503, headers: { "Cache-Control": "no-store" } });
      }
    }
  }
  try {
    const { issue, source } = await loadLatestProductionIssue();
    const manifest = await loadCurrentProductionReleaseManifest(issue);
    const hash = manifest ? contentChecksum(issue) : null;

    return NextResponse.json({
      ...issue,
      assetVersion: manifest?.releaseId || issue.assetVersion || issue.beijingTimestamp || issue.issueDate,
      ...(manifest ? {
        releaseId: manifest.releaseId,
        contentHash: hash,
        dataSource: `${source}-release-manifest`,
        publicationHealth: "healthy",
        stale: false,
      } : {}),
    }, {
      headers: {
        "Cache-Control": CONTENT_CACHE_CONTROL,
        "X-Content-Source": source,
        ...(manifest ? {
          "X-Release-Id": manifest.releaseId,
          "X-Content-Hash": hash || "",
          "X-Publication-Health": "healthy",
        } : {}),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Current issue unavailable" },
      { status: 500, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  }
}
