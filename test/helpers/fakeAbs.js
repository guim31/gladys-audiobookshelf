// -----------------------------------------------------------------------------
// An in-memory Audiobookshelf server behind the `request` seam of the client
// (src/abs/http.js). Answers come from a real 2.37 server (test/fixtures/abs/),
// with the behaviors that matter: the API key, the admin-only routes, sessions
// that open, synchronize and close, progress that reaches the end, episodes
// that get downloaded, covers, a server that does not answer.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

export const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/abs/${name}.json`, import.meta.url), 'utf8'));

// A real 240 × 240 JPEG cover, resized by the server.
export const COVER = readFileSync(new URL('../fixtures/abs/cover-240.jpg', import.meta.url));

export const IDS = Object.freeze({
  BOOKS: '3ba8f359-82ff-4f9f-9c52-73f0d009143b',
  PODCASTS: '151bcf1f-5f58-4558-9968-bce97203ca35',
  ALICE: '4f941f99-2136-4542-aacf-7f59e425429b',
  ROOT: 'ef8f0b89-812a-488f-9ab4-adc770f8c3c5',
  QUIET_MORNING: '8bdb9b23-23f1-419e-ac24-f7a20723e579',
  LONG_EVENING: '5386bc98-c3d7-4da7-980a-36013b0a3cc4',
  PODCAST: 'ee595e9c-fa92-45d8-be45-a6df00306eb2',
  EPISODE_TWO: '430adaf8-65ee-486a-b559-c42616f293f1',
});

const json = (status, body) => ({
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});

const ADMIN_ROUTES = /^\/api\/(users|podcasts\/[^/]+\/checknew)/;

export class FakeAbs {
  constructor({ apiKey = 'key-1', admin = true, urlBase = '' } = {}) {
    this.apiKey = apiKey;
    this.admin = admin;
    this.urlBase = urlBase;
    this.online = true;
    this.status = fixture('status');
    this.libraries = fixture('libraries');
    this.stats = {
      [IDS.BOOKS]: fixture('stats-books'),
      [IDS.PODCASTS]: fixture('stats-podcasts'),
    };
    this.recentEpisodes = { [IDS.PODCASTS]: fixture('recent-episodes') };
    this.items = { [IDS.BOOKS]: fixture('items-recent') };
    this.podcastItems = {
      [IDS.PODCASTS]: { results: [{ id: IDS.PODCAST, media: {} }], total: 1 },
    };
    this.itemDetails = {
      [IDS.QUIET_MORNING]: fixture('item-book'),
      [IDS.PODCAST]: fixture('item-podcast'),
    };
    this.users = fixture('users');
    this.userDetails = {
      [IDS.ALICE]: fixture('user-alice'),
      [IDS.ROOT]: fixture('user-root'),
    };
    this.listening = {
      [IDS.ALICE]: fixture('listening-stats'),
      [IDS.ROOT]: { ...fixture('listening-stats'), today: 0, recentSessions: [] },
    };
    this.openSessions = [];
    this.checkNew = { [IDS.PODCAST]: fixture('checknew') };
    this.requests = [];
    this.failNext = null;
  }

  /** A user opens a session on a book (alice, Quiet Morning by default). */
  play({
    userId = IDS.ALICE,
    itemId = IDS.QUIET_MORNING,
    at,
    currentTime = 150,
    episode = false,
  } = {}) {
    const [book] = fixture('online-playing').openSessions;
    const template = episode
      ? fixture('online-two').openSessions.find((session) => session.episodeId)
      : book;
    const session = {
      ...template,
      id: `session-${this.openSessions.length + 1}-${Math.round(at)}`,
      userId,
      libraryItemId: episode ? IDS.PODCAST : itemId,
      currentTime,
      timeListening: currentTime,
      updatedAt: at,
    };
    this.openSessions.push(session);
    return session.id;
  }

  /** The player synchronizes: position and listening time move on. */
  sync(sessionId, { at, seconds = 15 }) {
    const session = this.openSessions.find((entry) => entry.id === sessionId);
    session.currentTime += seconds;
    session.timeListening += seconds;
    session.updatedAt = at;
  }

  close(sessionId) {
    this.openSessions = this.openSessions.filter((entry) => entry.id !== sessionId);
  }

  /** The progress of alice on Quiet Morning reaches the end at `at`. */
  finish(at, userId = IDS.ALICE) {
    const detail = this.userDetails[userId];
    const [finished] = fixture('user-alice-finished').mediaProgress;
    detail.mediaProgress = [{ ...finished, userId, finishedAt: at, lastUpdate: at }];
  }

  /** Audiobookshelf downloads a new episode at `at`. */
  addEpisode(at, title = 'Episode Four') {
    const list = this.recentEpisodes[IDS.PODCASTS].episodes;
    const [template] = list;
    list.unshift({ ...template, id: `episode-${list.length + 1}`, title, addedAt: at });
  }

  /** The `request` function given to the client. */
  handle(url, { method = 'GET', headers = {}, binary } = {}) {
    const { pathname, searchParams } = new URL(url);
    this.requests.push({ method, path: pathname, query: Object.fromEntries(searchParams) });
    if (!this.online) {
      const error = new Error('connect ECONNREFUSED');
      error.code = 'ECONNREFUSED';
      throw error;
    }
    if (this.failNext) {
      const status = this.failNext;
      this.failNext = null;
      return { status, headers: {}, body: '' };
    }
    if (!pathname.startsWith(this.urlBase)) {
      return { status: 404, headers: { 'content-type': 'text/html' }, body: 'Not found' };
    }
    const path = pathname.slice(this.urlBase.length);
    if (path === '/status') {
      return json(200, this.status);
    }
    if (headers.Authorization !== `Bearer ${this.apiKey}`) {
      return { status: 401, headers: { 'content-type': 'text/plain' }, body: 'Unauthorized' };
    }
    if (!this.admin && ADMIN_ROUTES.test(path)) {
      return { status: 403, headers: { 'content-type': 'text/plain' }, body: 'Forbidden' };
    }
    return this.route(path, binary);
  }

  route(path, binary) {
    let match;
    if (path === '/api/users/online') {
      return json(200, { usersOnline: [], openSessions: this.openSessions });
    }
    if (path === '/api/users') {
      return json(200, this.users);
    }
    if ((match = /^\/api\/users\/([^/]+)\/listening-stats$/.exec(path))) {
      return json(200, this.listening[match[1]] ?? { today: 0 });
    }
    if ((match = /^\/api\/users\/([^/]+)$/.exec(path))) {
      const detail = this.userDetails[match[1]];
      return detail ? json(200, detail) : json(404, { error: 'not found' });
    }
    if (path === '/api/libraries') {
      return json(200, this.libraries);
    }
    if ((match = /^\/api\/libraries\/([^/]+)\/stats$/.exec(path))) {
      return json(200, this.stats[match[1]]);
    }
    if ((match = /^\/api\/libraries\/([^/]+)\/recent-episodes$/.exec(path))) {
      return json(200, this.recentEpisodes[match[1]]);
    }
    if ((match = /^\/api\/libraries\/([^/]+)\/items$/.exec(path))) {
      return json(200, this.items[match[1]] ?? this.podcastItems[match[1]]);
    }
    if (/^\/api\/items\/[^/]+\/cover$/.test(path)) {
      if (!binary) {
        return json(400, {});
      }
      return { status: 200, headers: { 'content-type': 'image/jpeg' }, body: COVER };
    }
    if ((match = /^\/api\/items\/([^/]+)$/.exec(path))) {
      const detail = this.itemDetails[match[1]];
      return detail ? json(200, detail) : { status: 404, headers: {}, body: 'Not Found' };
    }
    if ((match = /^\/api\/podcasts\/([^/]+)\/checknew$/.exec(path))) {
      const answer = this.checkNew[match[1]] ?? { episodes: [] };
      this.checkNew[match[1]] = { episodes: [] };
      return json(200, answer);
    }
    return { status: 404, headers: { 'content-type': 'text/plain' }, body: 'Not Found' };
  }
}

/** A network of fake servers by base URL, as the `request` seam. */
export function createNetwork(servers) {
  return {
    servers,
    async request(url, options) {
      const base = Object.keys(servers).find((prefix) => url.startsWith(prefix));
      if (!base) {
        const error = new Error('getaddrinfo ENOTFOUND');
        error.code = 'ENOTFOUND';
        throw error;
      }
      return servers[base].handle(url, options);
    },
  };
}
