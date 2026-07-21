import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/staging/openai-fixture/chat/completions/route";

const original = { ...process.env };
const token = "staging-fault-provider-token-long-enough";

function semanticBody(id = "fault-supported") {
  return {
    model: "fault-provider",
    messages: [{
      role: "user",
      content: JSON.stringify({
        releaseCandidateId: id,
        source: {
          sourceId: "source-1",
          topicId: "topic-1",
          correctionMarkerDetected: false,
          retractionMarkerDetected: false,
          claims: [
            { field: "headlineFact", locale: "zh-CN", text: "中文标题" },
            { field: "intro", locale: "zh-CN", text: "中文简介" },
            { field: "headlineFact", locale: "en-US", text: "English headline" },
            { field: "intro", locale: "en-US", text: "English intro" },
          ],
        },
      }),
    }],
  };
}

function visualBody(mode = "supported") {
  return {
    model: "fault-provider",
    messages: [{
      role: "user",
      content: [{
        type: "text",
        text: JSON.stringify({
          assetBatchId: `asset-fault-${mode}`,
          posters: Array.from({ length: 18 }, (_, index) => ({
            topicId: `topic-${Math.floor(index / 2) + 1}`,
            locale: index % 2 === 0 ? "zh" : "en",
            expectedNumber: Math.floor(index / 2) + 1,
            expectedTitle: `Expected ${index}`,
          })),
        }),
      }],
    }],
  };
}

async function call(body: unknown, authorization = `Bearer ${token}`) {
  return POST(new Request("https://staging.example/api/staging/openai-fixture/chat/completions", {
    method: "POST",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

describe("staging OpenAI fault provider", () => {
  beforeEach(() => {
    process.env.RELEASE_ENVIRONMENT = "staging";
    process.env.STAGING_FAULT_PROVIDER_ENABLED = "true";
    process.env.STAGING_FAULT_PROVIDER_TOKEN = token;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("is hidden outside the explicitly enabled staging environment", async () => {
    process.env.RELEASE_ENVIRONMENT = "production";
    expect((await call(semanticBody())).status).toBe(404);
  });

  it("requires the protected bearer token", async () => {
    expect((await call(semanticBody(), "Bearer wrong")).status).toBe(404);
  });

  it("returns an OpenAI-compatible supported semantic result", async () => {
    const response = await call(semanticBody());
    const body = await response.json();
    const result = JSON.parse(body.choices[0].message.content);
    expect(response.status).toBe(200);
    expect(result.claimResults).toHaveLength(4);
    expect(result.claimResults.every((claim: { status: string }) => claim.status === "supported")).toBe(true);
  });

  it.each([401, 429, 500])("returns controlled provider status %s", async (status) => {
    expect((await call(semanticBody(`fault-${status}`))).status).toBe(status);
  });

  it("returns a deliberately malformed provider response", async () => {
    const response = await call(semanticBody("fault-malformed"));
    expect(response.status).toBe(200);
    await expect(response.json()).rejects.toThrow();
  });

  it.each(["unsupported", "uncertain"])("returns controlled %s claim results", async (mode) => {
    const response = await call(semanticBody(`fault-${mode}`));
    const body = await response.json();
    const result = JSON.parse(body.choices[0].message.content);
    expect(result.claimResults.every((claim: { status: string }) => claim.status === mode)).toBe(true);
  });

  it("returns 18 reviews and all 153 comparisons for a controlled visual request", async () => {
    const response = await call(visualBody());
    const body = await response.json();
    const result = JSON.parse(body.choices[0].message.content);
    expect(result.reviews).toHaveLength(18);
    expect(result.comparisons).toHaveLength(153);
  });

  it("can deterministically remove a visual comparison for fail-closed testing", async () => {
    const response = await call(visualBody("visual-incomplete"));
    const body = await response.json();
    const result = JSON.parse(body.choices[0].message.content);
    expect(result.comparisons).toHaveLength(152);
  });
});
