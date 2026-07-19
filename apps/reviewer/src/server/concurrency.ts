let activeRequests = 0;

export async function withConcurrencyLimit<T>(limit: number, operation: () => Promise<T>) {
  if (activeRequests >= limit) throw new Error("REVIEWER_CONCURRENCY_LIMIT");
  activeRequests += 1;
  try {
    return await operation();
  } finally {
    activeRequests -= 1;
  }
}
