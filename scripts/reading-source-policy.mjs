// Editorial ingestion is not reader navigation: feeds/search pages must never
// be published as recommended reading. Preserve historical data on rollback.
export function assertReadingSourceUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('READING_SOURCE_HTTPS_REQUIRED');
  if (url.hostname === 'news.google.com' || /(^|\.)(google|bing)\.com$/.test(url.hostname)
    || /\/(rss|feeds?|search)(\/|\.|$)/i.test(url.pathname)
    || /\.(xml|rss|atom)$/i.test(url.pathname)
    || ['rss', 'feed', 'atom'].some((key) => url.searchParams.has(key))) {
    throw new Error('READING_SOURCE_ARTICLE_REQUIRED');
  }
}

export function assertReadingSourceResponse(response) {
  assertReadingSourceUrl(response.finalUrl);
  const type = response.headers['content-type'] || '';
  if (/xml|rss|atom|json/i.test(type) || /^\s*(<\?xml|<rss\b|<feed\b|\{)/i.test(response.body)) {
    throw new Error('READING_SOURCE_NOT_HTML_ARTICLE');
  }
}
