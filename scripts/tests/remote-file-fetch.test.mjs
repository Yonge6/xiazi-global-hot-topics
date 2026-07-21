import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { fetchBufferWithRetry } from "../lib/remote-file-fetch.mjs";

async function withServer(handler, run) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("retries when a response body terminates after headers", async () => {
  const expected = Buffer.from("complete-image-bytes");
  let requests = 0;
  await withServer((request, response) => {
    requests += 1;
    response.writeHead(200, {
      "content-type": "image/png",
      "content-length": expected.length,
    });
    if (requests === 1) {
      response.write(expected.subarray(0, 3));
      response.destroy();
      return;
    }
    response.end(expected);
  }, async (origin) => {
    const result = await fetchBufferWithRetry(`${origin}/poster.png`, {
      attempts: 3,
      timeoutMs: 2_000,
      maxBytes: 1_024,
    });
    assert.equal(requests, 2);
    assert.equal(result.attemptsUsed, 2);
    assert.deepEqual(result.buffer, expected);
  });
});

test("rejects a declared response above the byte limit without retrying", async () => {
  let requests = 0;
  await withServer((_request, response) => {
    requests += 1;
    response.writeHead(200, {
      "content-type": "image/png",
      "content-length": 2_048,
    });
    response.end(Buffer.alloc(2_048));
  }, async (origin) => {
    await assert.rejects(
      fetchBufferWithRetry(`${origin}/oversized.png`, {
        attempts: 3,
        timeoutMs: 2_000,
        maxBytes: 1_024,
      }),
      /exceeds 1024 bytes/,
    );
    assert.equal(requests, 1);
  });
});
