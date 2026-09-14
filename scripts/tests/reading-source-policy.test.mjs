import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertReadingSourceUrl, assertReadingSourceResponse } from '../reading-source-policy.mjs';

test('reject feed, aggregator and search addresses before publication', () => {
  for (const url of ['https://news.google.com/rss/search?q=AI', 'https://news.google.com/articles/id', 'https://example.com/feed/', 'https://example.com/a.xml', 'https://example.com/search?q=AI', 'https://example.com/?feed=rss2']) {
    assert.throws(() => assertReadingSourceUrl(url), /ARTICLE_REQUIRED/);
  }
  assert.doesNotThrow(() => assertReadingSourceUrl('https://www.nfib.com/news/press-release/report/'));
});
test('reject XML response and feed redirects even when original URL looks valid', () => {
  const response = { finalUrl: 'https://example.com/news/report', headers: { 'content-type': 'text/html' }, body: '<html><body>Article</body></html>' };
  assert.doesNotThrow(() => assertReadingSourceResponse(response));
  assert.throws(() => assertReadingSourceResponse({ ...response, body: '<?xml version="1.0"?><rss/>' }));
  assert.throws(() => assertReadingSourceResponse({ ...response, headers: { 'content-type': 'application/rss+xml' } }));
  assert.throws(() => assertReadingSourceResponse({ ...response, finalUrl: 'https://example.com/rss' }));
});
