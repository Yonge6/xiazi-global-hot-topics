import { type AppLanguage, type Source, type Topic } from "@xiazi/contracts";
import { topicShareDetails } from "@xiazi/domain";

export function safeHttpUrl(value: string | undefined) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export function primarySource(sources: Source[]) {
  return sources.find((source) => source.isPrimary && safeHttpUrl(source.url))
    ?? sources.find((source) => safeHttpUrl(source.url))
    ?? null;
}

export function buildShareDetails(
  topic: Topic,
  locale: AppLanguage,
  poster: string,
) {
  return {
    ...topicShareDetails(topic, locale),
    poster,
  };
}
