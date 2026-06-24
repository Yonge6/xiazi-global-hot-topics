import type { Topic } from "@xiazi/contracts";

export function sortTopicsForIssue(topics: readonly Topic[]) {
  return [...topics].sort((a, b) => a.rank - b.rank);
}
