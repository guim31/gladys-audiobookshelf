// -----------------------------------------------------------------------------
// Pure parsers of the Audiobookshelf answers (shapes checked against a real
// 2.37 server, see test/fixtures/abs/). Every function tolerates a missing or
// malformed field: the hub never sees `undefined`.
// -----------------------------------------------------------------------------

const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const number = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const list = (value) => (Array.isArray(value) ? value : []);

export const MEDIA_TYPES = Object.freeze({ BOOK: 'book', PODCAST: 'podcast' });

/**
 * The open listening sessions (/api/users/online → openSessions). A session
 * stays open while the player is paused: the hub tells playing from paused
 * by `updatedAt`, which moves at each synchronization of the player.
 */
export function parseSessions(answer) {
  return list(answer?.openSessions)
    .filter((session) => text(session?.id) && text(session.userId))
    .map((session) => {
      const podcast = session.mediaType === MEDIA_TYPES.PODCAST;
      return {
        id: session.id,
        userId: session.userId,
        itemId: text(session.libraryItemId),
        episodeId: text(session.episodeId),
        mediaType: podcast ? MEDIA_TYPES.PODCAST : MEDIA_TYPES.BOOK,
        title: text(session.displayTitle) ?? text(session.mediaMetadata?.title) ?? '?',
        author: text(session.displayAuthor),
        // For an episode, the title of the podcast.
        podcast: podcast ? text(session.mediaMetadata?.title) : null,
        duration: number(session.duration),
        currentTime: number(session.currentTime),
        timeListening: number(session.timeListening) ?? 0,
        updatedAt: number(session.updatedAt),
        client: text(session.deviceInfo?.clientName),
        cover: Boolean(text(session.coverPath)),
      };
    });
}

/** The active users (/api/users). */
export function parseUsers(answer) {
  return list(answer?.users)
    .filter((user) => text(user?.id) && text(user.username) && user.isActive !== false)
    .map((user) => ({ id: user.id, username: user.username.trim(), type: text(user.type) }));
}

/** The progress of a user on each book or episode (/api/users/:id → mediaProgress). */
export function parseProgress(user) {
  return list(user?.mediaProgress)
    .filter((entry) => text(entry?.libraryItemId))
    .map((entry) => ({
      itemId: entry.libraryItemId,
      episodeId: text(entry.episodeId),
      duration: number(entry.duration),
      currentTime: number(entry.currentTime),
      progress: number(entry.progress),
      isFinished: entry.isFinished === true,
      finishedAt: number(entry.finishedAt),
      lastUpdate: number(entry.lastUpdate) ?? 0,
      // Books only: an episode's progress has no title.
      title: text(entry.displayTitle),
    }));
}

/** Seconds listened today, on the day of the server. */
export const parseToday = (stats) => Math.max(0, number(stats?.today) ?? 0);

export function parseLibraries(answer) {
  return list(answer?.libraries)
    .filter((library) => text(library?.id))
    .map((library) => ({
      id: library.id,
      name: text(library.name) ?? library.id,
      mediaType: library.mediaType === MEDIA_TYPES.PODCAST ? MEDIA_TYPES.PODCAST : MEDIA_TYPES.BOOK,
    }));
}

/** Items (books or podcasts) and audio tracks (episodes, for a podcast library). */
export function parseStats(stats) {
  return {
    items: Math.max(0, Math.round(number(stats?.totalItems) ?? 0)),
    tracks: Math.max(0, Math.round(number(stats?.numAudioTracks) ?? 0)),
  };
}

/** The last downloaded episodes of a podcast library. */
export function parseRecentEpisodes(answer, library) {
  return list(answer?.episodes)
    .filter((episode) => text(episode?.id) && text(episode.libraryItemId))
    .map((episode) => ({
      id: episode.id,
      itemId: episode.libraryItemId,
      title: text(episode.title) ?? '?',
      podcast: text(episode.podcast?.metadata?.title) ?? '?',
      library: library.name,
      mediaType: MEDIA_TYPES.PODCAST,
      addedAt: number(episode.addedAt) ?? 0,
      duration: number(episode.duration),
      // The cover of an episode is the one of its podcast.
      cover: Boolean(text(episode.podcast?.coverPath)),
    }));
}

/** The last items added to a book library. */
export function parseItems(answer, library) {
  return list(answer?.results)
    .filter((item) => text(item?.id))
    .map((item) => {
      const metadata = item.media?.metadata ?? {};
      return {
        id: item.id,
        itemId: item.id,
        title: text(metadata.title) ?? '?',
        author:
          text(metadata.authorName) ??
          (list(metadata.authors)
            .map((author) => text(author?.name))
            .filter(Boolean)
            .join(', ') ||
            null),
        library: library.name,
        mediaType: MEDIA_TYPES.BOOK,
        addedAt: number(item.addedAt) ?? 0,
        duration: number(item.media?.duration),
        cover: Boolean(text(item.media?.coverPath)),
      };
    });
}

/**
 * Title, author and podcast of a book or of an episode, from /api/items/:id.
 * @returns {{ title: string, author: string|null, podcast: string|null, mediaType: string }}
 */
export function describeItem(item, episodeId = null) {
  const metadata = item?.media?.metadata ?? {};
  const authors = list(metadata.authors)
    .map((author) => text(author?.name))
    .filter(Boolean)
    .join(', ');
  if (item?.mediaType === MEDIA_TYPES.PODCAST || episodeId) {
    const episode = list(item?.media?.episodes).find((entry) => entry?.id === episodeId);
    return {
      title: text(episode?.title) ?? text(metadata.title) ?? '?',
      author: text(metadata.author),
      podcast: text(metadata.title),
      mediaType: MEDIA_TYPES.PODCAST,
    };
  }
  return {
    title: text(metadata.title) ?? '?',
    author: text(metadata.authorName) ?? (authors || null),
    podcast: null,
    mediaType: MEDIA_TYPES.BOOK,
  };
}

/** Podcast item ids of a podcast library (/api/libraries/:id/items). */
export const parsePodcastIds = (answer) =>
  list(answer?.results)
    .map((item) => text(item?.id))
    .filter(Boolean);
