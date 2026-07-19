import type { SemanticReviewPayload, VisualReviewPayload } from "@xiazi/contracts";

import type { ReviewerConfig } from "./config";

export type ReviewerProvider = {
  semantic: (payload: SemanticReviewPayload) => Promise<unknown>;
  visual: (payload: VisualReviewPayload) => Promise<unknown>;
};

async function boundedProviderText(response: Response, maxBytes = 2 * 1024 * 1024) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new Error("REVIEW_PROVIDER_RESPONSE_TOO_LARGE");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("REVIEW_PROVIDER_RESPONSE_TOO_LARGE");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

function textContent(value: unknown) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item && typeof item === "object" && "text" in item && typeof item.text === "string") return item.text;
      return "";
    }).join("");
  }
  return "";
}

export class OpenAICompatibleReviewerProvider implements ReviewerProvider {
  constructor(private readonly config: ReviewerConfig) {}

  private async complete(messages: unknown[]) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.providerTimeoutMs);
    let response: Response;
    try {
      response = await fetch(`${this.config.providerBaseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.providerApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          response_format: { type: "json_object" },
        }),
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("REVIEW_PROVIDER_TIMEOUT");
      throw new Error("REVIEW_PROVIDER_UNAVAILABLE");
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new Error(`REVIEW_PROVIDER_FAILED:${response.status}`);
    let envelope: unknown;
    try {
      envelope = JSON.parse(await boundedProviderText(response));
    } catch (error) {
      if (error instanceof Error && error.message === "REVIEW_PROVIDER_RESPONSE_TOO_LARGE") throw error;
      throw new Error("REVIEW_PROVIDER_MALFORMED_RESPONSE");
    }
    const detail = envelope as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = textContent(detail.choices?.[0]?.message?.content);
    if (!content) throw new Error("REVIEW_PROVIDER_EMPTY_RESPONSE");
    try {
      return JSON.parse(content) as unknown;
    } catch {
      throw new Error("REVIEW_PROVIDER_MALFORMED_JSON");
    }
  }

  semantic(payload: SemanticReviewPayload) {
    return this.complete([
      {
        role: "system",
        content: `You are a fail-closed news source auditor. Return JSON only. Review each exact claim separately against only the supplied source snapshot. Never infer unsupported details. Use status supported, unsupported, or uncertain. Detect corrections and retractions. Return exactly: {sourceId, topicId, correctionStatus, rationale, claimResults:[{field,locale,text,status,rationale,evidenceExcerpt or evidenceLocator}]}. Copy every claim text exactly.`,
      },
      { role: "user", content: JSON.stringify(payload) },
    ]);
  }

  visual(payload: VisualReviewPayload) {
    const allowed = new Set(this.config.allowedAssetOrigins);
    for (const poster of payload.posters) {
      const origin = new URL(poster.url).origin;
      if (!allowed.has(origin)) throw new Error(`REVIEW_ASSET_ORIGIN_NOT_ALLOWED:${origin}`);
    }
    return this.complete([
      {
        role: "system",
        content: `You are a fail-closed bilingual poster auditor. Return JSON only. Review all 18 supplied posters as one batch. Return exactly assetBatchId, 18 unique reviews, and all 153 unique unordered pair comparisons. Each review must include topicId, locale, OCR text, detected number and language, title/date/site/theme/IP matches, nearDuplicate, needsHumanReview, and rationale. Every pair must include both slots, semanticSimilarity 0..1, sameTheme, nearDuplicate, needsHumanReview, and rationale. The two IP characters are Xiazi (red robed shrimp) and Doudoulong (orange dragon in blue wizard costume).`,
      },
      {
        role: "user",
        content: [
          { type: "text", text: JSON.stringify(payload) },
          ...payload.posters.map((poster) => ({
            type: "image_url",
            image_url: { url: poster.url, detail: "high" },
          })),
        ],
      },
    ]);
  }
}
