// -----------------------------------------------------------------------------
// Texts the integration sends to Gladys outside the widgets (src/widgets.js):
// connection status, errors, the "Test the connection" report, the scene
// action errors and the "where am I" sentence. Four languages, the four of the
// Gladys interface; German says "du", Spanish "usted". test/i18n.test.js
// checks every table.
// -----------------------------------------------------------------------------

import { ERROR_KINDS } from './abs/client.js';

export const INIT_FAILED = {
  en: 'Initialization failed, check the integration logs.',
  fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
  de: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
  es: 'La inicialización ha fallado, consulte los registros de la integración.',
};

export const CONNECTION_TEXT = {
  noServer: {
    en: 'Enter the address of your Audiobookshelf server and an API key in the configuration.',
    fr: "Saisissez l'adresse de votre serveur Audiobookshelf et une clé d'API dans la configuration.",
    de: 'Gib die Adresse deines Audiobookshelf-Servers und einen API-Schlüssel in der Konfiguration ein.',
    es: 'Introduzca la dirección de su servidor Audiobookshelf y una clave de API en la configuración.',
  },
  invalid: {
    en: 'The configuration is incomplete: address (e.g. http://192.168.1.2:13378) and API key.',
    fr: "La configuration est incomplète : adresse (ex. http://192.168.1.2:13378) et clé d'API.",
    de: 'Die Konfiguration ist unvollständig: Adresse (z. B. http://192.168.1.2:13378) und API-Schlüssel.',
    es: 'La configuración está incompleta: dirección (p. ej. http://192.168.1.2:13378) y clave de API.',
  },
};

// One short explanation per error kind (src/abs/client.js).
export const ERROR_TEXT = {
  [ERROR_KINDS.UNREACHABLE]: {
    en: 'the server does not answer',
    fr: 'le serveur ne répond pas',
    de: 'der Server antwortet nicht',
    es: 'el servidor no responde',
  },
  [ERROR_KINDS.TLS]: {
    en: 'certificate refused: use the http:// address on your network',
    fr: 'certificat refusé : utilisez l’adresse en http:// de votre réseau',
    de: 'Zertifikat abgelehnt: Verwende die http://-Adresse in deinem Netzwerk',
    es: 'certificado rechazado: use la dirección http:// de su red',
  },
  [ERROR_KINDS.AUTH]: {
    en: 'API key refused',
    fr: "clé d'API refusée",
    de: 'API-Schlüssel abgelehnt',
    es: 'clave de API rechazada',
  },
  [ERROR_KINDS.FORBIDDEN]: {
    en: 'this API key is not an administrator’s: create one for an admin user',
    fr: "cette clé d'API n'est pas celle d'un administrateur : créez-en une pour un admin",
    de: 'dieser API-Schlüssel gehört keinem Administrator: Erstelle einen für einen Admin',
    es: 'esta clave de API no es de un administrador: cree una para un usuario admin',
  },
  [ERROR_KINDS.NOT_ABS]: {
    en: 'no Audiobookshelf server at this address',
    fr: 'aucun serveur Audiobookshelf à cette adresse',
    de: 'kein Audiobookshelf-Server unter dieser Adresse',
    es: 'no hay ningún servidor Audiobookshelf en esta dirección',
  },
  [ERROR_KINDS.REDIRECT]: {
    en: 'the address redirects: enter the final address, with its path',
    fr: "l'adresse redirige : saisissez l'adresse finale, avec son chemin",
    de: 'die Adresse leitet um: Gib die endgültige Adresse mit ihrem Pfad ein',
    es: 'la dirección redirige: introduzca la dirección final, con su ruta',
  },
  [ERROR_KINDS.HTTP]: {
    en: 'unexpected answer, see the logs',
    fr: 'réponse inattendue, voir les logs',
    de: 'unerwartete Antwort, sieh in den Protokollen nach',
    es: 'respuesta inesperada, consulte los registros',
  },
};

// The "Test the connection" report.
export const REPORT_TEXT = {
  en: {
    ok: (version) => `Audiobookshelf ${version}: connected`,
    library: (books, podcasts) => `${books} audiobook(s), ${podcasts} podcast(s)`,
    users: (count) => `${count} user(s)`,
    playing: (count) => `${count} listening now`,
  },
  fr: {
    ok: (version) => `Audiobookshelf ${version} : connecté`,
    library: (books, podcasts) => `${books} livre(s) audio, ${podcasts} podcast(s)`,
    users: (count) => `${count} utilisateur(s)`,
    playing: (count) => `${count} en écoute`,
  },
  de: {
    ok: (version) => `Audiobookshelf ${version}: verbunden`,
    library: (books, podcasts) => `${books} Hörbuch/Hörbücher, ${podcasts} Podcast(s)`,
    users: (count) => `${count} Benutzer`,
    playing: (count) => `${count} hört/hören gerade`,
  },
  es: {
    ok: (version) => `Audiobookshelf ${version}: conectado`,
    library: (books, podcasts) => `${books} audiolibro(s), ${podcasts} pódcast(s)`,
    users: (count) => `${count} usuario(s)`,
    playing: (count) => `${count} escuchando ahora`,
  },
};

// The sentence of the "Read where I am" scene action, one per user.
export const PROGRESS_TEXT = {
  en: {
    book: (title, author) => (author ? `${title} by ${author}` : title),
    episode: (title, podcast) => (podcast ? `${title} (${podcast})` : title),
    at: (user, what, percent, left) => `${user} is at ${percent}% of ${what}, ${left} left.`,
    finished: (user, what) => `${user} has finished ${what}.`,
    nothing: (user) => `${user} has nothing in progress.`,
  },
  fr: {
    book: (title, author) => (author ? `${title} de ${author}` : title),
    episode: (title, podcast) => (podcast ? `${title} (${podcast})` : title),
    at: (user, what, percent, left) => `${user} en est à ${percent} % de ${what}, reste ${left}.`,
    finished: (user, what) => `${user} a terminé ${what}.`,
    nothing: (user) => `${user} n'a rien en cours.`,
  },
  de: {
    book: (title, author) => (author ? `${title} von ${author}` : title),
    episode: (title, podcast) => (podcast ? `${title} (${podcast})` : title),
    at: (user, what, percent, left) => `${user} ist bei ${percent} % von ${what}, noch ${left}.`,
    finished: (user, what) => `${user} hat ${what} beendet.`,
    nothing: (user) => `${user} hört gerade nichts.`,
  },
  es: {
    book: (title, author) => (author ? `${title} de ${author}` : title),
    episode: (title, podcast) => (podcast ? `${title} (${podcast})` : title),
    at: (user, what, percent, left) => `${user} va por el ${percent} % de ${what}, quedan ${left}.`,
    finished: (user, what) => `${user} ha terminado ${what}.`,
    nothing: (user) => `${user} no tiene nada en curso.`,
  },
};

/** A duration in minutes, spoken: "2 h 05 min", "12 min". */
export function spokenDuration(minutes) {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return hours ? `${hours} h ${String(rest).padStart(2, '0')} min` : `${rest} min`;
}

// Errors of the scene actions and widget buttons (shown in Gladys).
export const ACTION_TEXT = {
  noServer: {
    en: 'No Audiobookshelf server is configured.',
    fr: "Aucun serveur Audiobookshelf n'est configuré.",
    de: 'Kein Audiobookshelf-Server ist konfiguriert.',
    es: 'No hay ningún servidor Audiobookshelf configurado.',
  },
  unknownUser: {
    en: 'This user is no longer on the Audiobookshelf server.',
    fr: "Cet utilisateur n'est plus sur le serveur Audiobookshelf.",
    de: 'Dieser Benutzer ist nicht mehr auf dem Audiobookshelf-Server.',
    es: 'Este usuario ya no está en el servidor Audiobookshelf.',
  },
  noPodcast: {
    en: 'There is no podcast library on the server.',
    fr: "Il n'y a aucune bibliothèque de podcasts sur le serveur.",
    de: 'Auf dem Server gibt es keine Podcast-Bibliothek.',
    es: 'No hay ninguna biblioteca de pódcasts en el servidor.',
  },
};

// Toast of the "Check new episodes" widget button (≤ 200 characters).
export const DONE_TEXT = {
  en: {
    checked: (podcasts, episodes) => `${podcasts} podcast(s) checked, ${episodes} new episode(s).`,
  },
  fr: {
    checked: (podcasts, episodes) =>
      `${podcasts} podcast(s) vérifié(s), ${episodes} nouvel(s) épisode(s).`,
  },
  de: {
    checked: (podcasts, episodes) => `${podcasts} Podcast(s) geprüft, ${episodes} neue Episode(n).`,
  },
  es: {
    checked: (podcasts, episodes) =>
      `${podcasts} pódcast(s) comprobado(s), ${episodes} episodio(s) nuevo(s).`,
  },
};

export const LANGUAGE_FALLBACK = 'en';

/** "Name: text", with the space French puts before a colon. */
export const labelled = (name, text, language) =>
  `${name}${language === 'fr' ? ' : ' : ': '}${text}`;
export const pick = (text, language) => text[language] ?? text[LANGUAGE_FALLBACK];

/** Every language of a table, rendered by `render(table[language], language)`. */
export const everyLanguage = (table, render) =>
  Object.fromEntries(
    Object.entries(table).map(([language, text]) => [language, render(text, language)]),
  );
