import { REVIEW_PROTOCOL_VERSION } from "@xiazi/contracts";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    status: "ok",
    protocolVersion: REVIEW_PROTOCOL_VERSION,
    deploymentVersion: process.env.REVIEW_DEPLOYMENT_VERSION || "local",
  });
}
