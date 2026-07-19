import {
  REVIEW_PROTOCOL_VERSION,
  SEMANTIC_REVIEW_RULESET_VERSION,
  VISUAL_REVIEW_RULESET_VERSION,
} from "@xiazi/contracts";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    protocolVersion: REVIEW_PROTOCOL_VERSION,
    semanticRulesetVersion: SEMANTIC_REVIEW_RULESET_VERSION,
    visualRulesetVersion: VISUAL_REVIEW_RULESET_VERSION,
    deploymentVersion: process.env.REVIEW_DEPLOYMENT_VERSION || "local",
    provider: process.env.REVIEW_PROVIDER_NAME || "unconfigured",
    modelVersion: process.env.REVIEW_MODEL_VERSION || "unconfigured",
  });
}
