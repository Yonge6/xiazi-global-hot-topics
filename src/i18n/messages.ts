export function nestMessages(flatMessages: Record<string, string>) {
  const nested: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(flatMessages)) {
    const path = key.split(".");
    let cursor = nested;

    for (const segment of path.slice(0, -1)) {
      const next = cursor[segment];
      if (!next || typeof next !== "object") {
        cursor[segment] = {};
      }
      cursor = cursor[segment] as Record<string, unknown>;
    }

    cursor[path.at(-1)!] = value;
  }

  return nested;
}
