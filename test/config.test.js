// -----------------------------------------------------------------------------
// Normalization of the configuration: the address typed by the user, the key,
// the interval and the language.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig, parseServerUrl } from '../src/config.js';

test('the address: bare host, page of the web client, reverse proxy path', () => {
  assert.equal(parseServerUrl('192.0.2.10:13378'), 'http://192.0.2.10:13378');
  assert.equal(parseServerUrl(' http://192.0.2.10:13378/ '), 'http://192.0.2.10:13378');
  assert.equal(
    parseServerUrl('http://192.0.2.10:13378/audiobookshelf/library/abc/bookshelf'),
    'http://192.0.2.10:13378',
  );
  assert.equal(parseServerUrl('https://example.org/abs/item/123?x=1#y'), 'https://example.org/abs');
  assert.equal(parseServerUrl('https://example.org/abs/'), 'https://example.org/abs');
  assert.equal(parseServerUrl('ftp://192.0.2.10'), null);
  assert.equal(parseServerUrl('http://user:secret@192.0.2.10'), null, 'no credentials');
  assert.equal(parseServerUrl(''), null);
  assert.equal(parseServerUrl(42), null);
});

test('defaults, and an incomplete configuration is reported as such', () => {
  assert.deepEqual(normalizeConfig(), {
    url: null,
    apiKey: null,
    incomplete: false,
    pollIntervalMs: 30_000,
    language: DEFAULT_CONFIG.language,
  });
  assert.equal(normalizeConfig({ server_url: '192.0.2.10' }).incomplete, true);
  assert.equal(normalizeConfig({ api_key: 'k' }).incomplete, true);
  const config = normalizeConfig({
    server_url: '192.0.2.10:13378',
    api_key: ' Bearer abc ',
    poll_interval: '15',
    language: 'de',
  });
  assert.deepEqual(config, {
    url: 'http://192.0.2.10:13378',
    apiKey: 'abc',
    incomplete: false,
    pollIntervalMs: 15_000,
    language: 'de',
  });
  assert.equal(normalizeConfig({ poll_interval: '5', language: 'it' }).pollIntervalMs, 30_000);
  assert.equal(normalizeConfig({ language: 'it' }).language, 'fr');
});
