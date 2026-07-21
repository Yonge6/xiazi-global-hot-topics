import { handleReviewRequest } from "@/server/handler";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handleReviewRequest(request, "visual");
}
