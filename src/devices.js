// -----------------------------------------------------------------------------
// The Gladys devices of the integration:
//
// - one "Audiobookshelf" server device (identity `server:main`: moving the
//   server to another address keeps the device and its history):
//     online (input/binary), sessions (listening now), books, podcasts,
//     episodes (counter-sensor/integer), version (text/text);
// - one device per active Audiobookshelf user (identity: the user id of
//   Audiobookshelf, never the username, which can be renamed):
//     listening (input/binary, 1 while a player of the user plays),
//     title (text/text: the book or episode playing, else the last one),
//     progress (counter-sensor/integer, %), remaining (duration/integer,
//     minutes left in that book or episode), today (duration/integer,
//     minutes listened today).
//
// Every feature is read-only (category/type couples of the core table, see
// test/gladys-rules.test.js). should_poll: false: the integration reads the
// server on its own timer (src/hub.js).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';

export const SERVER_TYPE = 'server';
export const SERVER_ID = 'main';
export const USER_TYPE = 'user';
export const URL_PARAM = 'AUDIOBOOKSHELF_URL';
export const USERNAME_PARAM = 'AUDIOBOOKSHELF_USERNAME';

// Suffixes of the feature external ids: permanent once published.
export const SERVER_KEYS = Object.freeze({
  ONLINE: 'online',
  SESSIONS: 'sessions',
  BOOKS: 'books',
  PODCASTS: 'podcasts',
  EPISODES: 'episodes',
  VERSION: 'version',
});

export const USER_KEYS = Object.freeze({
  LISTENING: 'listening',
  TITLE: 'title',
  PROGRESS: 'progress',
  REMAINING: 'remaining',
  TODAY: 'today',
});

// Feature names, per language (Gladys does not tell a device integration the
// user's language). Frozen at creation in Gladys.
export const NAMES = {
  en: {
    [SERVER_KEYS.ONLINE]: 'Online',
    [SERVER_KEYS.SESSIONS]: 'Listening now',
    [SERVER_KEYS.BOOKS]: 'Audiobooks',
    [SERVER_KEYS.PODCASTS]: 'Podcasts',
    [SERVER_KEYS.EPISODES]: 'Podcast episodes',
    [SERVER_KEYS.VERSION]: 'Version',
    [USER_KEYS.LISTENING]: 'Listening',
    [USER_KEYS.TITLE]: 'Current title',
    [USER_KEYS.PROGRESS]: 'Progress',
    [USER_KEYS.REMAINING]: 'Time left',
    [USER_KEYS.TODAY]: 'Listened today',
  },
  fr: {
    [SERVER_KEYS.ONLINE]: 'En ligne',
    [SERVER_KEYS.SESSIONS]: 'Écoutes en cours',
    [SERVER_KEYS.BOOKS]: 'Livres audio',
    [SERVER_KEYS.PODCASTS]: 'Podcasts',
    [SERVER_KEYS.EPISODES]: 'Épisodes de podcasts',
    [SERVER_KEYS.VERSION]: 'Version',
    [USER_KEYS.LISTENING]: 'En écoute',
    [USER_KEYS.TITLE]: 'Titre en cours',
    [USER_KEYS.PROGRESS]: 'Progression',
    [USER_KEYS.REMAINING]: 'Temps restant',
    [USER_KEYS.TODAY]: "Écouté aujourd'hui",
  },
  de: {
    [SERVER_KEYS.ONLINE]: 'Online',
    [SERVER_KEYS.SESSIONS]: 'Laufende Wiedergaben',
    [SERVER_KEYS.BOOKS]: 'Hörbücher',
    [SERVER_KEYS.PODCASTS]: 'Podcasts',
    [SERVER_KEYS.EPISODES]: 'Podcast-Episoden',
    [SERVER_KEYS.VERSION]: 'Version',
    [USER_KEYS.LISTENING]: 'Hört gerade',
    [USER_KEYS.TITLE]: 'Aktueller Titel',
    [USER_KEYS.PROGRESS]: 'Fortschritt',
    [USER_KEYS.REMAINING]: 'Restzeit',
    [USER_KEYS.TODAY]: 'Heute gehört',
  },
  es: {
    [SERVER_KEYS.ONLINE]: 'En línea',
    [SERVER_KEYS.SESSIONS]: 'Escuchas en curso',
    [SERVER_KEYS.BOOKS]: 'Audiolibros',
    [SERVER_KEYS.PODCASTS]: 'Pódcasts',
    [SERVER_KEYS.EPISODES]: 'Episodios de pódcasts',
    [SERVER_KEYS.VERSION]: 'Versión',
    [USER_KEYS.LISTENING]: 'Escuchando',
    [USER_KEYS.TITLE]: 'Título actual',
    [USER_KEYS.PROGRESS]: 'Progreso',
    [USER_KEYS.REMAINING]: 'Tiempo restante',
    [USER_KEYS.TODAY]: 'Escuchado hoy',
  },
};

// Display bounds (the core never applies them on write).
const COUNTER_MAX = 1_000_000;
const DAY_MINUTES = 24 * 60;

const readOnly = { read_only: true, has_feedback: false };

const binary = (key, value) => ({
  key,
  definition: {
    ...readOnly,
    category: DEVICE_FEATURE_CATEGORIES.INPUT,
    type: DEVICE_FEATURE_TYPES.SENSOR.BINARY,
    keep_history: true,
    min: 0,
    max: 1,
  },
  value,
});

const counter = (key, value, extra = {}) => ({
  key,
  definition: {
    ...readOnly,
    category: DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
    type: DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
    keep_history: true,
    min: 0,
    max: COUNTER_MAX,
    ...extra,
  },
  value,
});

const minutes = (key, value, max) => ({
  key,
  definition: {
    ...readOnly,
    category: DEVICE_FEATURE_CATEGORIES.DURATION,
    type: DEVICE_FEATURE_TYPES.DURATION.INTEGER,
    unit: DEVICE_FEATURE_UNITS.MINUTES,
    keep_history: true,
    min: 0,
    max,
  },
  value,
});

const textFeature = (key, value, keepHistory) => ({
  key,
  text: true,
  definition: {
    ...readOnly,
    category: DEVICE_FEATURE_CATEGORIES.TEXT,
    type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
    keep_history: keepHistory,
    min: 0,
    max: 0,
  },
  value,
});

// Order = display order in Gladys. `value` reads the snapshot of the hub.
export const SERVER_FEATURES = [
  binary(SERVER_KEYS.ONLINE, (s) => (s.reachable === null ? null : s.reachable ? 1 : 0)),
  counter(SERVER_KEYS.SESSIONS, (s) => s.playing ?? null, { max: 1000 }),
  counter(SERVER_KEYS.BOOKS, (s) => s.counts?.books ?? null),
  counter(SERVER_KEYS.PODCASTS, (s) => s.counts?.podcasts ?? null),
  counter(SERVER_KEYS.EPISODES, (s) => s.counts?.episodes ?? null),
  textFeature(SERVER_KEYS.VERSION, (s) => s.version || null, false),
];

export const USER_FEATURES = [
  binary(USER_KEYS.LISTENING, (u) => (u.listening === null ? null : u.listening ? 1 : 0)),
  textFeature(USER_KEYS.TITLE, (u) => u.title || null, true),
  counter(USER_KEYS.PROGRESS, (u) => u.progress ?? null, {
    unit: DEVICE_FEATURE_UNITS.PERCENT,
    max: 100,
  }),
  // A long audiobook lasts days: bound at 1,000 hours.
  minutes(USER_KEYS.REMAINING, (u) => u.remaining ?? null, 60_000),
  minutes(USER_KEYS.TODAY, (u) => u.today ?? null, DAY_MINUTES),
];

export const serverIds = (gladys) => gladys.externalIds(SERVER_TYPE, SERVER_ID);
export const userIds = (gladys, userId) => gladys.externalIds(USER_TYPE, userId);

const namesOf = (language) => NAMES[language] ?? NAMES.en;

const features = (list, ids, language) =>
  list.map(({ key, definition }) => ({
    ...definition,
    name: namesOf(language)[key],
    external_id: ids.feature(key),
  }));

/** The discovery payload of the server. */
export function buildServerDevice(gladys, { url, name }, language = 'en') {
  return {
    name: name || 'Audiobookshelf',
    external_id: serverIds(gladys).device,
    should_poll: false,
    params: [{ name: URL_PARAM, value: url }],
    features: features(SERVER_FEATURES, serverIds(gladys), language),
  };
}

/** The discovery payload of a user. */
export function buildUserDevice(gladys, user, language = 'en') {
  const ids = userIds(gladys, user.id);
  return {
    name: `Audiobookshelf ${user.username}`.slice(0, 60),
    external_id: ids.device,
    should_poll: false,
    params: [{ name: USERNAME_PARAM, value: user.username }],
    features: features(USER_FEATURES, ids, language),
  };
}

/**
 * The value of every feature of a device (null: nothing to publish).
 * @returns {Array<{ key: string, externalId: string, value: number|string|null, text: boolean }>}
 */
export function featureValues(list, ids, snapshot) {
  return list.map(({ key, value, text = false }) => ({
    key,
    externalId: ids.feature(key),
    value: value(snapshot),
    text,
  }));
}
