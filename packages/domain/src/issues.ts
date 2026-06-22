import type { Topic } from "@xiazi/contracts";

function isWorldCupTopic(topic: Topic) {
  return topic.category === "sports" && topic.slug.includes("world-cup");
}

export function sortTopicsForIssue(topics: readonly Topic[]) {
  return [...topics].sort((a, b) => {
    if (isWorldCupTopic(a) && !isWorldCupTopic(b)) return -1;
    if (!isWorldCupTopic(a) && isWorldCupTopic(b)) return 1;
    return a.rank - b.rank;
  });
}
