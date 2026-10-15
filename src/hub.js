// -----------------------------------------------------------------------------
// The hub: reads the Audiobookshelf server on a timer of the container,
// publishes the states of the server and user devices when they change, fires
// the scene events, and serves the scene actions and the widgets.
//
// Two rhythms:
// - every `pollIntervalMs` (15 to 60 s, configuration): the open listening
//   sessions (/api/users/online), one request. A session stays open while
//   its player is paused, so "playing" means: its `updatedAt` moved (the
//   player synchronizes every 10 to 15 s while it plays) less than
//   `activeMs` ago, measured on the clock of the container;
// - every `libraryMs` (5 min), and at once for a user whose session starts or
//   stops: the libraries and their counts, the last downloaded episodes, the
//   users, and the progress and listening time of each user.
//
// No socket.io: it would add a dependency and a second connection to keep
// alive, for events the polling sees within the interval.
//
// The cursors of the scene events (last finished book per user, last episode
// per podcast library) live under /data: an event is announced once, also
// across restarts, and nothing older than `eventMaxAgeMs` is announced.
//
// Gladys never polls these devices (should_poll: false): the scene events
// must fire even for a user whose device was not added.
// -----------------------------------------------------------------------------

import { DEVICE_TRANSPORTS, createLogger } from '@gladysassistant/integration-sdk';
import { AbsClient, ERROR_KINDS } from './abs/client.js';
import {
  MEDIA_TYPES,
  describeItem,
  parseItems,
  parseLibraries,
  parsePodcastIds,
  parseProgress,
  parseRecentEpisodes,
  parseSessions,
  parseStats,
  parseToday,
  parseUsers,
} from './abs/model.js';
import {
  SERVER_FEATURES,
  USER_FEATURES,
  buildServerDevice,
  buildUserDevice,
  featureValues,
  serverIds,
  userIds,
} from './devices.js';
import {
  ACTION_TEXT,
  CONNECTION_TEXT,
  ERROR_TEXT,
  PROGRESS_TEXT,
  REPORT_TEXT,
  everyLanguage,
  labelled,
  pick,
  spokenDuration,
} from './texts.js';

const logger = createLogger({ name: 'abs-hub' });

// Widget keys (manifest `widgets`): permanent once published.
export const WIDGET_KEYS = Object.freeze({
  NOW_LISTENING: 'now_listening',
  RECENTLY_ADDED: 'recently_added',
});

// Scene trigger keys (manifest `scene_triggers`): permanent once published.
export const TRIGGERS = Object.freeze({
  STARTED: 'listening_started',
  STOPPED: 'listening_stopped',
  FINISHED: 'item_finished',
  EPISODE: 'episode_downloaded',
});

export const HUB_TIMINGS = {
  // A session whose player has not synchronized for this long is paused.
  activeMs: 90_000,
  // The "now listening" widget still shows a paused session this long.
  pausedShownMs: 30 * 60_000,
  // Libraries, users and progress.
  libraryMs: 5 * 60_000,
  // The version changes with an update: read it hourly.
  statusMs: 60 * 60_000,
  // Finished books and downloaded episodes older than this are not announced.
  eventMaxAgeMs: 24 * 60 * 60_000,
  // At most this many scene events of one kind per reading.
  maxEventsPerRead: 10,
  // Republish an unchanged value this often (Gladys flags a value older than 48 h).
  heartbeatMs: 12 * 60 * 60_000,
  // After "check new episodes", read the episodes again this soon (the
  // server downloads them in the background).
  recheckAfterMs: 45_000,
  // Additions kept for the widget.
  recentCount: 12,
};

const MAX_STATES_PER_REQUEST = 100;
const MAX_DESCRIPTIONS = 500;

const signature = (config) => JSON.stringify([config.url, config.apiKey]);

const emptyServer = () => ({ reachable: null, version: null, playing: null, counts: null });
const emptyUser = () => ({
  listening: null,
  title: null,
  progress: null,
  remaining: null,
  today: null,
});

export class AbsHub {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
   * @param {object} options.store persistence (src/store.js)
   * @param {Function} [options.request] HTTP seam (src/abs/http.js)
   * @param {boolean} [options.timers] periodic timer (off in tests)
   * @param {object} [options.timings] HUB_TIMINGS overrides
   * @param {() => number} [options.now]
   */
  constructor({ gladys, store, request, timers = true, timings, now }) {
    this.gladys = gladys;
    this.store = store;
    this.request = request;
    this.timersEnabled = timers;
    this.timings = { ...HUB_TIMINGS, ...timings };
    this.now = now ?? (() => Date.now());
    this.config = null;
    this.client = null;
    this.signature = null;
    this.server = emptyServer();
    this.error = null;
    /** @type {Map<string, object>} by Audiobookshelf user id */
    this.users = new Map();
    /** @type {Map<string, object>} open sessions, by session id */
    this.sessions = new Map();
    this.sessionsRead = false;
    this.libraries = [];
    this.recent = [];
    this.statusAt = 0;
    this.libraryAt = 0;
    this.libraryDueAt = 0;
    this.descriptions = new Map();
    /** Last value published per feature external id: { value, at }. */
    this.published = new Map();
    this.transports = new Map();
    this.connection = null;
    this.devicesKey = null;
    this.saved = { url: null, finished: {}, episodes: {} };
    this.timer = null;
    this.running = null;
    this.stopped = false;
    /** Problems already logged, by key: repeats go to debug. */
    this.warned = new Set();
  }

  // --- Logs ------------------------------------------------------------------

  /** Log a problem once (`level` warn or error), its repeats at debug. */
  problem(key, message, err, level = 'warn') {
    const args = err === undefined ? [message] : [message, err];
    if (this.warned.has(key)) {
      logger.debug(...args);
      return;
    }
    this.warned.add(key);
    logger[level](...args);
  }

  /** The problem `key` is gone: the next occurrence is logged again. */
  resolved(key, message) {
    if (this.warned.delete(key) && message) {
      logger.info(message);
    }
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(config) {
    const saved = await this.store.load();
    const object = (value) => (value && typeof value === 'object' ? value : {});
    this.saved = {
      url: typeof saved.url === 'string' ? saved.url : null,
      finished: object(saved.finished),
      episodes: object(saved.episodes),
    };
    await this.reconfigure(config);
  }

  /** Gladys reconnected (it restarted): send everything again. */
  async resync(config) {
    this.published.clear();
    this.transports.clear();
    this.connection = null;
    this.devicesKey = null;
    await this.reconfigure(config);
  }

  async reconfigure(config) {
    this.config = config;
    if (signature(config) !== this.signature) {
      this.signature = signature(config);
      this.reset();
      this.client = config.url
        ? new AbsClient({ url: config.url, apiKey: config.apiKey, request: this.request })
        : null;
      // Another server: its cursors start again from now.
      if (config.url && this.saved.url !== config.url) {
        this.saved = { url: config.url, finished: {}, episodes: {} };
        this.store.save(this.saved);
      }
    }
    await this.publishDevices();
    await this.refresh({ library: true });
    this.schedule();
  }

  reset() {
    this.published.clear();
    this.server = emptyServer();
    this.error = null;
    this.users.clear();
    this.sessions.clear();
    this.sessionsRead = false;
    this.libraries = [];
    this.recent = [];
    this.statusAt = 0;
    this.libraryAt = 0;
    this.libraryDueAt = 0;
    this.descriptions.clear();
  }

  async stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    await this.running?.catch(() => {});
    await this.store.flush();
  }

  schedule() {
    clearTimeout(this.timer);
    if (!this.timersEnabled || this.stopped || !this.client) {
      return;
    }
    this.timer = setTimeout(async () => {
      try {
        await this.refresh();
        this.resolved('poll');
      } catch (err) {
        this.problem('poll', 'Reading failed', err, 'error');
      }
      this.schedule();
    }, this.config.pollIntervalMs);
  }

  // --- Reading the server ------------------------------------------------------

  /**
   * One reading: the sessions, and the library part when it is due (or asked).
   * Concurrent calls share the reading in progress.
   */
  refresh({ library = false } = {}) {
    if (library) {
      this.libraryDueAt = 0;
    }
    this.running ??= this.read().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  async read() {
    if (!this.client) {
      await this.afterChanges(new Set());
      return;
    }
    const client = this.client;
    const changed = new Set();
    try {
      const now = this.now();
      const libraryDue = now >= this.libraryDueAt || now - this.libraryAt >= this.timings.libraryMs;
      if (libraryDue) {
        await this.readLibrary(client, changed);
      }
      const touched = await this.readSessions(client, changed);
      // Users whose listening started or stopped: their progress now.
      const users = libraryDue ? [...this.users.values()] : touched.map((id) => this.users.get(id));
      for (const record of users.filter(Boolean)) {
        await this.readUser(client, record, changed);
      }
      if (client !== this.client) {
        return; // reconfigured meanwhile
      }
      if (this.error) {
        logger.info(`Audiobookshelf: connection restored`);
      } else if (this.server.reachable === null) {
        logger.info(`Audiobookshelf: connected, version ${this.server.version}`);
      }
      this.error = null;
      this.server.reachable = true;
      await this.publishAll();
    } catch (err) {
      if (!err.kind) {
        throw err;
      }
      if (client !== this.client) {
        return;
      }
      await this.applyFailure(err, changed);
    }
    await this.afterChanges(changed);
  }

  async applyFailure(err, changed) {
    const wasError = this.error?.kind;
    this.error = { kind: err.kind, message: err.message };
    if (this.server.reachable !== false) {
      changed.add(WIDGET_KEYS.NOW_LISTENING);
    }
    this.server.reachable = false;
    // One warning when the problem starts (or changes), not one per reading.
    if (wasError !== err.kind) {
      logger.warn(`Audiobookshelf: ${err.message}`);
    } else {
      logger.debug(`Audiobookshelf: ${err.message} (again)`);
    }
    // The next good reading reads everything again.
    this.libraryDueAt = 0;
    await this.publishServer();
  }

  async readLibrary(client, changed) {
    const now = this.now();
    if (!this.server.version || now - this.statusAt >= this.timings.statusMs) {
      const status = await client.status();
      this.server.version = status.serverVersion;
      this.statusAt = now;
    }
    const libraries = parseLibraries(await client.libraries());
    const counts = { books: 0, podcasts: 0, episodes: 0 };
    const recent = [];
    for (const library of libraries) {
      const stats = parseStats(await client.libraryStats(library.id));
      if (library.mediaType === MEDIA_TYPES.PODCAST) {
        counts.podcasts += stats.items;
        counts.episodes += stats.tracks;
        const episodes = parseRecentEpisodes(await client.recentEpisodes(library.id), library);
        await this.announceEpisodes(library, episodes);
        recent.push(...episodes);
      } else {
        counts.books += stats.items;
        recent.push(
          ...parseItems(await client.items(library.id, this.timings.recentCount), library),
        );
      }
    }
    recent.sort((a, b) => b.addedAt - a.addedAt || a.title.localeCompare(b.title));
    const latest = recent.slice(0, this.timings.recentCount);
    if (JSON.stringify(latest) !== JSON.stringify(this.recent)) {
      changed.add(WIDGET_KEYS.RECENTLY_ADDED);
    }
    this.recent = latest;
    this.libraries = libraries;
    this.server.counts = counts;
    await this.readUsers(client);
    this.libraryAt = now;
    this.libraryDueAt = now + this.timings.libraryMs;
  }

  async readUsers(client) {
    const users = parseUsers(await client.users());
    const seen = new Set();
    for (const user of users) {
      seen.add(user.id);
      const record = this.users.get(user.id);
      if (record) {
        record.user = user; // a new name only
      } else {
        this.users.set(user.id, { user, snapshot: emptyUser(), progress: [] });
      }
    }
    for (const id of [...this.users.keys()]) {
      if (!seen.has(id)) {
        this.users.delete(id);
      }
    }
    await this.publishDevices();
  }

  /**
   * The open sessions: who plays what, the start and stop events.
   * @returns {Promise<string[]>} the users whose listening started or stopped
   */
  async readSessions(client, changed) {
    const now = this.now();
    const sessions = parseSessions(await client.online());
    const baseline = !this.sessionsRead;
    const next = new Map();
    const started = [];
    const stopped = [];
    for (const session of sessions) {
      const previous = this.sessions.get(session.id);
      let lastChangeAt;
      if (!previous) {
        // First sight: playing if synchronized lately (the clocks of the
        // server and of the container may differ a little), else paused
        // since its last synchronization.
        const age = session.updatedAt === null ? Infinity : Math.abs(now - session.updatedAt);
        lastChangeAt = age < this.timings.activeMs ? now : now - age;
      } else if (
        previous.session.updatedAt !== session.updatedAt ||
        previous.session.currentTime !== session.currentTime
      ) {
        lastChangeAt = now;
      } else {
        lastChangeAt = previous.lastChangeAt;
      }
      const active = now - lastChangeAt < this.timings.activeMs;
      next.set(session.id, { session, lastChangeAt, active });
      if (active && !previous?.active) {
        started.push(session);
      } else if (!active && previous?.active) {
        stopped.push(session);
      }
    }
    for (const [id, previous] of this.sessions) {
      if (!next.has(id) && previous.active) {
        stopped.push(previous.session);
      }
    }
    const shown = (map) =>
      JSON.stringify(
        [...map.values()]
          .filter((entry) => now - entry.lastChangeAt < this.timings.pausedShownMs)
          .map((entry) => [entry.session.id, entry.active, entry.session.title]),
      );
    if (shown(next) !== shown(this.sessions)) {
      changed.add(WIDGET_KEYS.NOW_LISTENING);
    }
    this.sessions = next;
    this.sessionsRead = true;
    this.server.playing = [...next.values()].filter((entry) => entry.active).length;

    // A session of a user created since the last reading of the users.
    if (sessions.some((session) => !this.users.has(session.userId))) {
      await this.readUsers(client);
    }
    for (const record of this.users.values()) {
      this.applySessions(record);
    }
    if (baseline) {
      return [];
    }
    for (const session of started) {
      logger.debug(`Listening started: ${this.userName(session.userId)}, "${session.title}"`);
      await this.fire(TRIGGERS.STARTED, session.userId, this.sessionData(session));
    }
    for (const session of stopped) {
      logger.debug(`Listening stopped: ${this.userName(session.userId)}, "${session.title}"`);
      await this.fire(TRIGGERS.STOPPED, session.userId, {
        ...this.sessionData(session),
        minutes: Math.round(session.timeListening / 60),
      });
    }
    return [...new Set([...started, ...stopped].map((session) => session.userId))];
  }

  sessionData(session) {
    return {
      title: session.title,
      author: session.author,
      podcast: session.podcast,
      media_type: session.mediaType,
      progress: percent(session.currentTime, session.duration),
    };
  }

  /** The playing session of a user (the last one to move), or null. */
  playingSession(userId) {
    const entries = [...this.sessions.values()].filter(
      (entry) => entry.active && entry.session.userId === userId,
    );
    entries.sort((a, b) => b.lastChangeAt - a.lastChangeAt);
    return entries[0]?.session ?? null;
  }

  /** The user's features from the playing session, else from the last progress. */
  applySessions(record) {
    const session = this.playingSession(record.user.id);
    const snapshot = record.snapshot;
    snapshot.listening = this.sessionsRead ? Boolean(session) : snapshot.listening;
    if (session) {
      snapshot.title = titleOf(session);
      snapshot.progress = percent(session.currentTime, session.duration);
      snapshot.remaining = minutesLeft(session.currentTime, session.duration);
      return;
    }
    const last = record.last;
    if (last) {
      snapshot.title = titleOf(last);
      snapshot.progress = last.isFinished ? 100 : percent(last.currentTime, last.duration);
      snapshot.remaining = last.isFinished ? 0 : minutesLeft(last.currentTime, last.duration);
    }
  }

  /** Progress (finished books, last title) and time listened today of a user. */
  async readUser(client, record, changed) {
    const userId = record.user.id;
    const progress = parseProgress(await client.user(userId));
    const today = Math.round(parseToday(await client.listeningStats(userId)) / 60);
    record.snapshot.today = Math.min(today, 24 * 60);
    record.progress = progress;
    const latest = [...progress].sort((a, b) => b.lastUpdate - a.lastUpdate)[0];
    if (latest) {
      const description = await this.describe(client, latest);
      record.last = { ...latest, ...description };
    } else {
      record.last = null;
    }
    this.applySessions(record);
    await this.announceFinished(client, record);
    if (changed && record.snapshot.listening) {
      changed.add(WIDGET_KEYS.NOW_LISTENING);
    }
  }

  /** Title, author, podcast of a progress entry (cached: they rarely change). */
  async describe(client, entry) {
    const key = `${entry.itemId}:${entry.episodeId ?? ''}`;
    if (!this.descriptions.has(key)) {
      if (this.descriptions.size >= MAX_DESCRIPTIONS) {
        this.descriptions.clear();
      }
      let description;
      try {
        description = describeItem(await client.item(entry.itemId), entry.episodeId);
      } catch (err) {
        // An item deleted since: keep what the progress says.
        if (err.kind !== ERROR_KINDS.HTTP) {
          throw err;
        }
        description = {
          title: entry.title ?? '?',
          author: null,
          podcast: null,
          mediaType: entry.episodeId ? MEDIA_TYPES.PODCAST : MEDIA_TYPES.BOOK,
        };
      }
      this.descriptions.set(key, description);
    }
    return this.descriptions.get(key);
  }

  /**
   * Announce each book or episode finished since the cursor of the user. The
   * first reading of a user is the starting point, not news.
   */
  async announceFinished(client, record) {
    const userId = record.user.id;
    const finished = record.progress
      .filter((entry) => entry.isFinished && entry.finishedAt !== null)
      .sort((a, b) => a.finishedAt - b.finishedAt);
    const newest = finished.at(-1)?.finishedAt ?? 0;
    const cursor = this.saved.finished[userId];
    if (!Number.isFinite(cursor)) {
      this.saved.finished[userId] = newest;
      this.store.save(this.saved);
      return;
    }
    const minAt = this.now() - this.timings.eventMaxAgeMs;
    const fresh = finished.filter((entry) => entry.finishedAt > cursor);
    if (fresh.length === 0) {
      return;
    }
    this.saved.finished[userId] = Math.max(cursor, newest);
    this.store.save(this.saved);
    for (const entry of fresh
      .filter((item) => item.finishedAt >= minAt)
      .slice(-this.timings.maxEventsPerRead)) {
      const description = await this.describe(client, entry);
      logger.debug(`Finished: ${record.user.username}, "${description.title}"`);
      await this.fire(TRIGGERS.FINISHED, userId, {
        title: description.title,
        author: description.author,
        podcast: description.podcast,
        media_type: description.mediaType,
      });
    }
  }

  /** Announce the episodes downloaded since the cursor of the library. */
  async announceEpisodes(library, episodes) {
    const newest = episodes.reduce((max, episode) => Math.max(max, episode.addedAt), 0);
    const cursor = this.saved.episodes[library.id];
    if (!Number.isFinite(cursor)) {
      this.saved.episodes[library.id] = newest;
      this.store.save(this.saved);
      return;
    }
    const fresh = episodes
      .filter((episode) => episode.addedAt > cursor)
      .sort((a, b) => a.addedAt - b.addedAt);
    if (fresh.length === 0) {
      return;
    }
    this.saved.episodes[library.id] = Math.max(cursor, newest);
    this.store.save(this.saved);
    const minAt = this.now() - this.timings.eventMaxAgeMs;
    const announced = fresh
      .filter((episode) => episode.addedAt >= minAt)
      .slice(-this.timings.maxEventsPerRead);
    for (const episode of announced) {
      logger.debug(`New episode: "${episode.podcast}", "${episode.title}"`);
      await this.fire(TRIGGERS.EPISODE, null, {
        podcast: episode.podcast,
        title: episode.title,
        library: library.name,
        minutes: episode.duration === null ? null : Math.round(episode.duration / 60),
      });
    }
  }

  userName(userId) {
    return this.users.get(userId)?.user.username ?? '?';
  }

  /** Fire a scene event: on a user device, or on the server device (userId null). */
  async fire(key, userId, data) {
    const user = userId
      ? { device: userIds(this.gladys, userId).device, user: this.userName(userId) }
      : { device: serverIds(this.gladys).device };
    try {
      await this.gladys.publishSceneEvent(key, { ...user, ...data });
      this.resolved('scene-event');
    } catch (err) {
      this.problem('scene-event', `Scene event ${key} refused: ${err.message}`);
    }
  }

  // --- Publishing to Gladys ----------------------------------------------------------

  async publishDevices() {
    const devices = [];
    if (this.config?.url) {
      devices.push(buildServerDevice(this.gladys, { url: this.config.url }, this.config.language));
      for (const record of this.users.values()) {
        devices.push(buildUserDevice(this.gladys, record.user, this.config.language));
      }
    }
    const key = JSON.stringify(devices);
    if (key === this.devicesKey) {
      return;
    }
    // Even an empty list: the Discovery tab then shows no stale device.
    await this.gladys.publishDiscoveredDevices(devices);
    this.devicesKey = key;
  }

  /** "Search" in the Discovery tab: publish the devices again, read the server. */
  async rediscover() {
    this.devicesKey = null;
    await this.publishDevices();
    await this.refresh({ library: true });
  }

  /** The user added a device: its states sent before were dropped by Gladys. */
  async onDeviceCreated(device) {
    if (device.external_id === serverIds(this.gladys).device) {
      await this.publishServer({ force: true });
    } else {
      const record = this.userOf(device.external_id);
      if (!record) {
        return;
      }
      await this.publishUser(record, { force: true });
    }
    for (const key of Object.values(WIDGET_KEYS)) {
      this.gladys.requestWidgetRefresh(key);
    }
  }

  userOf(deviceExternalId) {
    if (!deviceExternalId) {
      return null;
    }
    for (const record of this.users.values()) {
      if (userIds(this.gladys, record.user.id).device === deviceExternalId) {
        return record;
      }
    }
    return null;
  }

  async publishAll() {
    await this.publishServer();
    for (const record of this.users.values()) {
      await this.publishUser(record);
    }
  }

  publishServer(options) {
    return this.publishValues(
      featureValues(SERVER_FEATURES, serverIds(this.gladys), this.server),
      this.server.reachable === false,
      options,
    );
  }

  publishUser(record, options) {
    return this.publishValues(
      featureValues(USER_FEATURES, userIds(this.gladys, record.user.id), record.snapshot),
      this.server.reachable === false,
      options,
    );
  }

  async publishValues(values, stale, { force = false } = {}) {
    const now = this.now();
    const states = [];
    for (const { key, externalId, value, text } of values) {
      if (value === null) {
        continue;
      }
      const last = this.published.get(externalId);
      // While the server is down, the last values are not republished as fresh.
      const frozen = stale && key !== 'online';
      const fresh =
        last && last.value === value && (frozen || now - last.at < this.timings.heartbeatMs);
      if (!force && fresh) {
        continue;
      }
      states.push(
        text
          ? { device_feature_external_id: externalId, text: String(value) }
          : { device_feature_external_id: externalId, state: value },
      );
    }
    for (let at = 0; at < states.length; at += MAX_STATES_PER_REQUEST) {
      const batch = states.slice(at, at + MAX_STATES_PER_REQUEST);
      try {
        await this.gladys.publishStates(batch);
        for (const state of batch) {
          this.published.set(state.device_feature_external_id, {
            value: state.text ?? state.state,
            at: now,
          });
        }
        this.resolved('states');
      } catch (err) {
        this.problem('states', `States refused: ${err.message}`);
      }
    }
  }

  async afterChanges(changed) {
    await this.publishTransports();
    await this.publishConnectionStatus();
    for (const key of changed) {
      this.gladys.requestWidgetRefresh(key);
    }
  }

  async publishTransports() {
    if (this.server.reachable === null) {
      return;
    }
    const transport = this.server.reachable
      ? DEVICE_TRANSPORTS.LOCAL
      : DEVICE_TRANSPORTS.UNREACHABLE;
    const entries = [serverIds(this.gladys).device]
      .concat([...this.users.values()].map((record) => userIds(this.gladys, record.user.id).device))
      .filter((externalId) => this.transports.get(externalId) !== transport)
      .map((externalId) => ({ external_id: externalId, transport }));
    if (entries.length === 0) {
      return;
    }
    try {
      await this.gladys.publishTransports(entries);
      for (const entry of entries) {
        this.transports.set(entry.external_id, entry.transport);
      }
      this.resolved('transports');
    } catch (err) {
      this.problem('transports', `Transports refused: ${err.message}`);
    }
  }

  /** The status under the integration name. */
  connectionStatus() {
    if (!this.config?.url) {
      return {
        connected: false,
        message: this.config?.incomplete ? CONNECTION_TEXT.invalid : CONNECTION_TEXT.noServer,
      };
    }
    if (this.error) {
      return {
        connected: false,
        message: everyLanguage(ERROR_TEXT[this.error.kind], (text) =>
          `Audiobookshelf: ${text}`.slice(0, 200),
        ),
      };
    }
    return { connected: true };
  }

  async publishConnectionStatus() {
    const status = this.connectionStatus();
    const key = JSON.stringify(status);
    if (key === this.connection) {
      return;
    }
    try {
      await this.gladys.setConnectionStatus(status.connected, status.message);
      this.connection = key;
      this.resolved('connection-status');
    } catch (err) {
      this.problem('connection-status', `Connection status refused: ${err.message}`);
    }
  }

  // --- Commands --------------------------------------------------------------------------

  requireClient() {
    if (!this.client) {
      throw new Error(pick(ACTION_TEXT.noServer, this.config?.language));
    }
    return this.client;
  }

  /** The error of an action, in the language of the configuration. */
  actionError(err) {
    if (!err.kind) {
      return err;
    }
    const text = pick(ERROR_TEXT[err.kind], this.config.language);
    return new Error(labelled('Audiobookshelf', text, this.config.language));
  }

  /**
   * Ask the server to look for new episodes of every podcast (it downloads
   * the ones it finds), then read the episodes again shortly after.
   * @returns {Promise<{ podcasts: number, episodes: number }>}
   */
  async checkNewEpisodes() {
    const client = this.requireClient();
    try {
      if (this.libraries.length === 0) {
        this.libraries = parseLibraries(await client.libraries());
      }
      const podcastLibraries = this.libraries.filter(
        (library) => library.mediaType === MEDIA_TYPES.PODCAST,
      );
      if (podcastLibraries.length === 0) {
        throw new Error(pick(ACTION_TEXT.noPodcast, this.config.language));
      }
      let podcasts = 0;
      let episodes = 0;
      for (const library of podcastLibraries) {
        for (const podcastId of parsePodcastIds(await client.items(library.id, 500))) {
          const answer = await client.checkNewEpisodes(podcastId);
          podcasts += 1;
          episodes += Array.isArray(answer?.episodes) ? answer.episodes.length : 0;
        }
      }
      logger.info(`Checked ${podcasts} podcast(s) for new episodes: ${episodes} found`);
      if (episodes > 0) {
        this.libraryDueAt = this.now() + this.timings.recheckAfterMs;
      }
      return { podcasts, episodes };
    } catch (err) {
      if (err.kind) {
        logger.warn(`Checking new episodes failed: ${err.message}`);
      }
      throw this.actionError(err);
    }
  }

  /**
   * "Where am I": the sentence of one user, or of every user with something
   * in progress. Reads the server now.
   */
  async whereAmI(deviceExternalId) {
    const client = this.requireClient();
    let records;
    if (deviceExternalId) {
      if (this.users.size === 0) {
        await this.refresh({ library: true });
      }
      const record = this.userOf(deviceExternalId);
      if (!record) {
        throw new Error(pick(ACTION_TEXT.unknownUser, this.config.language));
      }
      records = [record];
    } else {
      if (this.users.size === 0) {
        await this.refresh({ library: true });
      }
      records = [...this.users.values()];
    }
    try {
      await this.refresh();
      for (const record of records) {
        await this.readUser(client, record, null);
      }
    } catch (err) {
      throw this.actionError(err);
    }
    if (!deviceExternalId) {
      const busy = records.filter((record) => record.snapshot.listening || isInProgress(record));
      records = busy.length ? busy : records.slice(0, 1);
    }
    const sentence = everyLanguage(PROGRESS_TEXT, (text) =>
      records
        .map((record) => sentenceOf(record, this.playingSession(record.user.id), text))
        .join(' ')
        .slice(0, 1000),
    );
    const [first] = records;
    return {
      sentence,
      title: first?.snapshot.title ?? '',
      progress: first?.snapshot.progress ?? 0,
    };
  }

  /** "Test the connection": read the server now, one line. */
  async testConnection() {
    await this.refresh({ library: true });
    const status = this.connectionStatus();
    if (!status.connected) {
      return status.message;
    }
    return everyLanguage(REPORT_TEXT, (text) =>
      [
        text.ok(this.server.version),
        text.library(this.server.counts?.books ?? 0, this.server.counts?.podcasts ?? 0),
        text.users(this.users.size),
        text.playing(this.server.playing ?? 0),
      ].join(', '),
    );
  }

  /** The sessions the widget shows: playing ones, then paused for a while. */
  shownSessions(userId = null) {
    const now = this.now();
    return [...this.sessions.values()]
      .filter((entry) => now - entry.lastChangeAt < this.timings.pausedShownMs)
      .filter((entry) => !userId || entry.session.userId === userId)
      .sort((a, b) => Number(b.active) - Number(a.active) || b.lastChangeAt - a.lastChangeAt);
  }
}

/** Percentage (0 to 100, integer) of a position in a duration. */
export function percent(currentTime, duration) {
  if (!(duration > 0) || currentTime === null) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round((currentTime / duration) * 100)));
}

/** Whole minutes left (rounded up: "1 min" until the very end). */
export function minutesLeft(currentTime, duration) {
  if (!(duration > 0) || currentTime === null) {
    return 0;
  }
  return Math.max(0, Math.ceil((duration - currentTime) / 60));
}

/** "Title — Author" of a book, "Episode — Podcast" of an episode. */
export function titleOf({ title, author, podcast, mediaType }) {
  const by = mediaType === MEDIA_TYPES.PODCAST ? podcast : author;
  return (by ? `${title} — ${by}` : title || '?').slice(0, 200);
}

const isInProgress = (record) => Boolean(record.last && !record.last.isFinished);

function sentenceOf(record, session, text) {
  const name = record.user.username;
  const last = session ?? record.last;
  if (!last) {
    return text.nothing(name);
  }
  const what =
    last.mediaType === MEDIA_TYPES.PODCAST
      ? text.episode(last.title, last.podcast)
      : text.book(last.title, last.author);
  if (!session && last.isFinished) {
    return text.finished(name, what);
  }
  return text.at(name, what, record.snapshot.progress, spokenDuration(record.snapshot.remaining));
}
