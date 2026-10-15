// -----------------------------------------------------------------------------
// Dashboard widgets (manifest `widgets`, Gladys 5.1+):
//
// - `now_listening`: who listens to what, at a glance on the wall tablet: one
//   row per open session (cover, title, user and progress, "Listening" or
//   "Paused" badge), every user or the one chosen in the widget settings,
//   and the minutes listened today;
// - `recently_added`: a cover grid of the last audiobooks and podcast
//   episodes added to the server, the library counts, and a direct button to
//   look for new episodes.
//
// The figures are sent as values, not bound to device features, so the
// widgets work before the devices are added to Gladys.
//
// Covers: the content declares a key per item, Gladys asks for its bytes
// through onWidgetGetImage, and the hub reads them from the server, resized
// to 240 px by Audiobookshelf: the browser never loads a third-party URL.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS, validateWidgetImage } from '@gladysassistant/integration-sdk';
import { MEDIA_TYPES } from './abs/model.js';
import { WIDGET_KEYS, percent, titleOf } from './hub.js';
import { DONE_TEXT, everyLanguage, pick } from './texts.js';

// Action keys of the buttons: permanent once published.
export const ACTIONS = Object.freeze({
  CHECK_EPISODES: 'check_new_episodes',
});

const MAX_ROWS = 8;
const MAX_CARDS = 12;
const MAX_IMAGE_BYTES = 300 * 1024;
const COVER_KEY = /^cover-([a-z0-9-]{1,58})$/;

export const TEXT = {
  configure: {
    en: 'Enter the address of your Audiobookshelf server and an API key in the configuration of the integration.',
    fr: "Saisissez l'adresse de votre serveur Audiobookshelf et une clé d'API dans la configuration de l'intégration.",
    de: 'Gib die Adresse deines Audiobookshelf-Servers und einen API-Schlüssel in der Konfiguration der Integration ein.',
    es: 'Introduzca la dirección de su servidor Audiobookshelf y una clave de API en la configuración de la integración.',
  },
  unreachable: {
    en: 'The Audiobookshelf server does not answer: see the status of the integration.',
    fr: "Le serveur Audiobookshelf ne répond pas : voyez l'état de l'intégration.",
    de: 'Der Audiobookshelf-Server antwortet nicht: Sieh dir den Status der Integration an.',
    es: 'El servidor Audiobookshelf no responde: consulte el estado de la integración.',
  },
  unknown: {
    en: 'This user is no longer on the server: choose another one in the widget settings.',
    fr: "Cet utilisateur n'est plus sur le serveur : choisissez-en un autre dans les réglages du widget.",
    de: 'Dieser Benutzer ist nicht mehr auf dem Server: Wähle einen anderen in den Widget-Einstellungen.',
    es: 'Este usuario ya no está en el servidor: elija otro en la configuración del widget.',
  },
  nobody: {
    en: 'Nobody is listening right now.',
    fr: "Personne n'écoute en ce moment.",
    de: 'Gerade hört niemand zu.',
    es: 'Nadie está escuchando ahora mismo.',
  },
  empty: {
    en: 'Nothing has been added to the libraries yet.',
    fr: "Rien n'a encore été ajouté aux bibliothèques.",
    de: 'Den Bibliotheken wurde noch nichts hinzugefügt.',
    es: 'Todavía no se ha añadido nada a las bibliotecas.',
  },
  listeningNow: { en: 'Listening now', fr: 'En écoute', de: 'Hört gerade', es: 'Escuchando' },
  today: { en: 'Today', fr: "Aujourd'hui", de: 'Heute', es: 'Hoy' },
  books: { en: 'Audiobooks', fr: 'Livres audio', de: 'Hörbücher', es: 'Audiolibros' },
  podcasts: { en: 'Podcasts', fr: 'Podcasts', de: 'Podcasts', es: 'Pódcasts' },
  playing: { en: 'Listening', fr: 'En écoute', de: 'Läuft', es: 'Escuchando' },
  paused: { en: 'Paused', fr: 'En pause', de: 'Pausiert', es: 'En pausa' },
  book: { en: 'Book', fr: 'Livre', de: 'Buch', es: 'Libro' },
  episode: { en: 'Episode', fr: 'Épisode', de: 'Episode', es: 'Episodio' },
  checkEpisodes: {
    en: 'Check new episodes',
    fr: 'Chercher des épisodes',
    de: 'Episoden suchen',
    es: 'Buscar episodios',
  },
};

const t = (text, language) => pick(text, language);
const fit = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

function message(text, language) {
  return {
    ttl_seconds: 300,
    components: [{ type: 'text', variant: 'body', text: t(text, language) }],
  };
}

/** Image key of the cover of a library item (Audiobookshelf ids are UUIDs). */
export const coverKey = (itemId) => {
  const key = `cover-${String(itemId).toLowerCase()}`;
  return COVER_KEY.test(key) ? key : null;
};

// Only for an item that has a cover: the server answers 404 otherwise.
const withCover = (itemId, cover) => {
  const image = itemId && cover ? coverKey(itemId) : null;
  return image ? { image } : {};
};

/** The minutes listened today, by the chosen user or by every user. */
function todayMinutes(hub, userId) {
  const records = userId ? [hub.users.get(userId)] : [...hub.users.values()];
  return records.reduce((total, record) => total + (record?.snapshot.today ?? 0), 0);
}

async function getNowListening(hub, { settings, language = 'en' }) {
  if (!hub.client) {
    return message(TEXT.configure, language);
  }
  if (hub.error) {
    return message(TEXT.unreachable, language);
  }
  let userId = null;
  if (settings?.device) {
    const record = hub.userOf(settings.device);
    if (!record) {
      return message(TEXT.unknown, language);
    }
    userId = record.user.id;
  }
  const entries = hub.shownSessions(userId);
  const playing = entries.filter((entry) => entry.active).length;
  const components = [
    {
      type: 'value',
      value: playing,
      label: t(TEXT.listeningNow, language),
      icon: 'headphones',
      color: playing ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.NEUTRAL,
    },
    {
      type: 'value',
      value: todayMinutes(hub, userId),
      unit: 'min',
      label: t(TEXT.today, language),
      icon: 'clock',
    },
  ];
  if (entries.length === 0) {
    components.push({ type: 'text', variant: 'body', text: t(TEXT.nobody, language) });
  } else {
    components.push({
      type: 'card-list',
      display: 'list',
      items: entries.slice(0, MAX_ROWS).map(({ session, active }) => {
        const by = session.mediaType === MEDIA_TYPES.PODCAST ? session.podcast : session.author;
        const progress = percent(session.currentTime, session.duration);
        return {
          title: fit(session.title, 60),
          subtitle: fit(
            [hub.userName(session.userId), by, `${progress} %`].filter(Boolean).join(' · '),
            120,
          ),
          ...withCover(session.itemId, session.cover),
          badge: active
            ? { text: t(TEXT.playing, language), color: WIDGET_COLORS.SUCCESS }
            : { text: t(TEXT.paused, language), color: WIDGET_COLORS.NEUTRAL },
        };
      }),
    });
  }
  return { ttl_seconds: 60, components };
}

async function getRecentlyAdded(hub, { language = 'en' }) {
  if (!hub.client) {
    return message(TEXT.configure, language);
  }
  if (hub.error && hub.recent.length === 0) {
    return message(TEXT.unreachable, language);
  }
  const counts = hub.server.counts;
  const components = [];
  if (counts) {
    components.push(
      { type: 'value', value: counts.books, label: t(TEXT.books, language), icon: 'book' },
      { type: 'value', value: counts.podcasts, label: t(TEXT.podcasts, language), icon: 'mic' },
    );
  }
  if (hub.recent.length === 0) {
    components.push({ type: 'text', variant: 'body', text: t(TEXT.empty, language) });
  } else {
    components.push({
      type: 'card-list',
      display: 'grid',
      items: hub.recent.slice(0, MAX_CARDS).map((item) => {
        const episode = item.mediaType === MEDIA_TYPES.PODCAST;
        const description = [titleOf(item), item.library].filter(Boolean).join('\n');
        return {
          title: fit(item.title, 60),
          ...(item.addedAt ? { date: new Date(item.addedAt).toISOString() } : {}),
          ...withCover(item.itemId, item.cover),
          badge: {
            text: t(episode ? TEXT.episode : TEXT.book, language),
            color: episode ? WIDGET_COLORS.INFO : WIDGET_COLORS.NEUTRAL,
          },
          description: fit(description, 2000),
        };
      }),
    });
  }
  if (hub.libraries.some((library) => library.mediaType === MEDIA_TYPES.PODCAST)) {
    components.push({
      type: 'button',
      label: t(TEXT.checkEpisodes, language),
      icon: 'refresh-cw',
      style: 'secondary',
      action: { key: ACTIONS.CHECK_EPISODES },
    });
  }
  return { ttl_seconds: 300, components };
}

async function recentlyAddedAction(hub, { actionKey }) {
  if (actionKey === ACTIONS.CHECK_EPISODES) {
    const { podcasts, episodes } = await hub.checkNewEpisodes();
    return { message: everyLanguage(DONE_TEXT, (text) => text.checked(podcasts, episodes)) };
  }
  throw new Error(`Unknown action ${actionKey}`);
}

async function noAction(hub, { actionKey }) {
  throw new Error(`Unknown action ${actionKey}`);
}

/**
 * Bytes of a cover, as raw base64 (onWidgetGetImage). Only the keys these
 * widgets declare, only from the configured server.
 */
export async function getImage(hub, imageKey) {
  const match = COVER_KEY.exec(String(imageKey));
  if (!match) {
    throw new Error(`Unknown image ${imageKey}`);
  }
  const client = hub.requireClient();
  const { body } = await client.cover(match[1]);
  if (!Buffer.isBuffer(body) || body.length === 0 || body.length > MAX_IMAGE_BYTES) {
    throw new Error(`Cover ${imageKey} is empty or too large`);
  }
  const image = body.toString('base64');
  // The checks of the core (format, header, size): refused here, explained in the logs.
  const problems = validateWidgetImage(image);
  if (problems.length > 0) {
    throw new Error(`Cover ${imageKey} refused: ${problems.join('; ')}`);
  }
  return image;
}

export const WIDGETS = {
  [WIDGET_KEYS.NOW_LISTENING]: { get: getNowListening, action: noAction },
  [WIDGET_KEYS.RECENTLY_ADDED]: { get: getRecentlyAdded, action: recentlyAddedAction },
};
