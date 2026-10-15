// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
//
// One Audiobookshelf server: its address and the API key of an administrator
// (the open listening sessions and the progress of every user are admin
// endpoints).
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Reading intervals of the listening sessions offered in the configuration, in seconds.
export const POLL_INTERVALS = ['15', '30', '60'];

export const DEFAULT_CONFIG = {
  server_url: '',
  api_key: '',
  poll_interval: '30',
  language: 'fr',
};

/**
 * Parse the address typed by the user into a base URL: a bare host or IP
 * (`192.0.2.10:13378`), or the URL copied from the browser, with the path of
 * a server behind a reverse proxy (`https://example.org/audiobookshelf/`).
 * HTTP by default; the query, the fragment, a trailing slash and the page of
 * the web client dropped.
 * @param {unknown} raw
 * @returns {string|null} `http(s)://host[:port][/base]`, null when unusable
 */
export function parseServerUrl(raw) {
  if (typeof raw !== 'string') {
    return null;
  }
  const text = raw.trim();
  if (!text) {
    return null;
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    return null;
  }
  // Credentials in the address would end up in the logs and the device params.
  if (url.username || url.password) {
    return null;
  }
  // A page of the web client copied from the browser: keep the base, drop the page.
  const path = url.pathname
    .replace(/\/(audiobookshelf\/)?(library|item|config|login|account|author|series)(\/.*)?$/i, '')
    .replace(/\/+$/, '');
  return `${url.origin}${path}`;
}

/** Host part shown to the user (no scheme). */
export const hostOf = (url) => url.replace(/^https?:\/\//, '');

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const text = (key) => (typeof source[key] === 'string' ? source[key].trim() : '');
  const pick = (key, list) => {
    const value = source[key] === undefined || source[key] === null ? '' : String(source[key]);
    return list.includes(value) ? value : DEFAULT_CONFIG[key];
  };
  const typed = text('server_url');
  const url = parseServerUrl(typed);
  // A key pasted with its "Bearer " prefix still works.
  const apiKey = text('api_key').replace(/^bearer\s+/i, '');
  return {
    url: url && apiKey ? url : null,
    apiKey: url && apiKey ? apiKey : null,
    // Something typed, but not usable: the status says so.
    incomplete: Boolean(typed || apiKey) && !(url && apiKey),
    pollIntervalMs: Number(pick('poll_interval', POLL_INTERVALS)) * 1000,
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
  };
}
