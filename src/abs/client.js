// -----------------------------------------------------------------------------
// Audiobookshelf REST API client. One API key (Settings → API Keys, since
// Audiobookshelf 2.26; the token of a user on older servers), sent as a
// Bearer token: never in the URL, never in the logs.
//
// The open listening sessions (/api/users/online) and the progress of the
// other users (/api/users/:id) are admin endpoints: a key of a plain user is
// reported as such (FORBIDDEN) instead of failing on every request.
// -----------------------------------------------------------------------------

import { httpRequest } from './http.js';

export const ERROR_KINDS = Object.freeze({
  UNREACHABLE: 'unreachable', // no answer: down, wrong address, firewall
  TLS: 'tls', // the certificate does not verify
  AUTH: 'auth', // API key refused (401)
  FORBIDDEN: 'forbidden', // the key works but is not an administrator's (403)
  NOT_ABS: 'not_abs', // something answers, not an Audiobookshelf server
  REDIRECT: 'redirect', // the address redirects (HTTP to HTTPS, a login page)
  HTTP: 'http', // any other HTTP error
});

export class AbsError extends Error {
  /**
   * @param {string} kind one of ERROR_KINDS
   * @param {string} message English, for the logs (never contains a secret)
   * @param {object} [extra] { status }
   */
  constructor(kind, message, extra = {}) {
    super(message);
    this.name = 'AbsError';
    this.kind = kind;
    Object.assign(this, extra);
  }
}

const TLS_CODES = new Set([
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

// Size of the covers asked for the widgets: a grid poster renders under 300 px.
export const COVER_WIDTH = 240;

const id = (value) => encodeURIComponent(String(value));

export class AbsClient {
  /**
   * @param {object} options
   * @param {string} options.url base URL, with the path of a reverse proxy if any
   * @param {string} options.apiKey
   * @param {Function} [options.request] HTTP seam (src/abs/http.js)
   */
  constructor({ url, apiKey, request = httpRequest }) {
    this.url = url;
    this.apiKey = apiKey;
    this.request = request;
  }

  async call(path, { method = 'GET', binary = false, timeoutMs } = {}) {
    let answer;
    try {
      answer = await this.request(`${this.url}${path}`, {
        method,
        binary,
        headers: { Authorization: `Bearer ${this.apiKey}` },
        ...(timeoutMs ? { timeoutMs } : {}),
      });
    } catch (err) {
      if (TLS_CODES.has(err.code)) {
        throw new AbsError(ERROR_KINDS.TLS, `Certificate refused (${err.code})`);
      }
      throw new AbsError(ERROR_KINDS.UNREACHABLE, err.code ? `${err.code}` : err.message);
    }
    const route = path.split('?')[0];
    const { status, headers = {}, body } = answer;
    if (status === 401) {
      throw new AbsError(ERROR_KINDS.AUTH, 'API key refused', { status });
    }
    if (status === 403) {
      throw new AbsError(ERROR_KINDS.FORBIDDEN, `${route}: not an administrator key`, { status });
    }
    if (status >= 300 && status < 400) {
      throw new AbsError(ERROR_KINDS.REDIRECT, `Redirected (HTTP ${status})`, { status });
    }
    if (status < 200 || status >= 300) {
      throw new AbsError(ERROR_KINDS.HTTP, `${route} answered HTTP ${status}`, { status });
    }
    if (binary) {
      return { body, contentType: String(headers['content-type'] ?? '') };
    }
    try {
      return body === '' ? null : JSON.parse(body);
    } catch {
      // A reverse proxy's login page, another web application...
      throw new AbsError(ERROR_KINDS.NOT_ABS, `${route} did not answer JSON`);
    }
  }

  /** /status (public): the application name and the server version. */
  async status() {
    let status;
    try {
      status = await this.call('/status');
    } catch (err) {
      if (err.kind === ERROR_KINDS.HTTP && err.status === 404) {
        throw new AbsError(ERROR_KINDS.NOT_ABS, 'No Audiobookshelf status at this address');
      }
      throw err;
    }
    if (status?.app !== 'audiobookshelf' || typeof status.serverVersion !== 'string') {
      throw new AbsError(ERROR_KINDS.NOT_ABS, 'No Audiobookshelf status at this address');
    }
    return status;
  }

  /** The open listening sessions of every user (admin). */
  online() {
    return this.call('/api/users/online');
  }

  /** Every user (admin). */
  users() {
    return this.call('/api/users');
  }

  /** One user, with the progress of every book and episode started (admin). */
  user(userId) {
    return this.call(`/api/users/${id(userId)}`);
  }

  /** Listening time of a user: `today` in seconds (day of the server). */
  listeningStats(userId) {
    return this.call(`/api/users/${id(userId)}/listening-stats`);
  }

  libraries() {
    return this.call('/api/libraries');
  }

  libraryStats(libraryId) {
    return this.call(`/api/libraries/${id(libraryId)}/stats`);
  }

  /** The last episodes downloaded in a podcast library. */
  recentEpisodes(libraryId, limit = 25) {
    return this.call(`/api/libraries/${id(libraryId)}/recent-episodes?limit=${limit}`);
  }

  /** The items of a library, the last added first. */
  items(libraryId, limit) {
    return this.call(
      `/api/libraries/${id(libraryId)}/items?sort=addedAt&desc=1&limit=${limit}&minified=1`,
    );
  }

  /** One library item (a book, or a podcast with its episodes). */
  item(itemId) {
    return this.call(`/api/items/${id(itemId)}`);
  }

  /**
   * Look for new episodes of a podcast; Audiobookshelf downloads the ones it
   * finds. The feed is read by the server: give it time.
   */
  checkNewEpisodes(podcastItemId) {
    return this.call(`/api/podcasts/${id(podcastItemId)}/checknew`, { timeoutMs: 30_000 });
  }

  /** The cover of an item, resized by the server (JPEG). */
  cover(itemId) {
    return this.call(`/api/items/${id(itemId)}/cover?width=${COVER_WIDTH}&format=jpeg`, {
      binary: true,
    });
  }
}
