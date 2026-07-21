const RETRYABLE_STATUS = new Set([408, 425, 429]);

function isRetryableStatus(status) {
  return RETRYABLE_STATUS.has(status) || status >= 500;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function fetchBufferWithRetry(url, options = {}) {
  const {
    attempts = 3,
    timeoutMs = 90_000,
    maxBytes = 50 * 1024 * 1024,
    init = {},
  } = options;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error("remote body timeout")), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (!response.ok) {
        const error = new Error(`Remote file returned HTTP ${response.status}`);
        error.retryable = isRetryableStatus(response.status);
        throw error;
      }

      const declaredLength = Number(response.headers.get("content-length") || 0);
      if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        const error = new Error(`Remote file exceeds ${maxBytes} bytes`);
        error.retryable = false;
        throw error;
      }
      if (!response.body) throw new Error("Remote file response has no body");

      const reader = response.body.getReader();
      const chunks = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel("remote file exceeds byte limit");
          const error = new Error(`Remote file exceeds ${maxBytes} bytes`);
          error.retryable = false;
          throw error;
        }
        chunks.push(Buffer.from(value));
      }

      return {
        status: response.status,
        headers: response.headers,
        buffer: Buffer.concat(chunks, total),
        attemptsUsed: attempt,
      };
    } catch (cause) {
      lastError = cause;
      if (cause?.retryable === false || attempt === attempts) break;
      await wait(Math.min(4_000, 500 * (2 ** (attempt - 1))));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}
