type ReviewLog = {
  requestId: string | null;
  candidateId: string | null;
  provider: string | null;
  model: string | null;
  rulesetVersion: string | null;
  inputHash: string | null;
  status: "passed" | "failed";
  durationMs: number;
  errorCode: string | null;
  failClosed: boolean;
};

export function logReview(event: ReviewLog) {
  const line = JSON.stringify({ event: "review_request", ...event });
  if (event.status === "failed") console.error(line);
  else console.info(line);
}
