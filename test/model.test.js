// -----------------------------------------------------------------------------
// The parsers on the real answers of an Audiobookshelf 2.37 server, and on
// broken ones.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  describeItem,
  parseItems,
  parseProgress,
  parseRecentEpisodes,
  parseSessions,
  parseUsers,
} from '../src/abs/model.js';
import { fixture } from './helpers/fakeAbs.js';

test('open sessions: a book and an episode', () => {
  const [book, episode] = parseSessions(fixture('online-two'));
  assert.equal(book.title, 'Quiet Morning');
  assert.equal(book.author, 'Jane Doe');
  assert.equal(book.mediaType, 'book');
  assert.equal(book.podcast, null);
  assert.equal(episode.title, 'Episode Two');
  assert.equal(episode.podcast, 'Test Tones Podcast');
  assert.equal(episode.mediaType, 'podcast');
});

test('users, progress, episodes, items, descriptions', () => {
  assert.deepEqual(
    parseUsers(fixture('users')).map((user) => user.username),
    ['root', 'alice'],
  );
  const [progress] = parseProgress(fixture('user-alice-finished'));
  assert.equal(progress.isFinished, true);
  assert.equal(typeof progress.finishedAt, 'number');
  const library = { id: 'l', name: 'Podcasts' };
  const [episode] = parseRecentEpisodes(fixture('recent-episodes'), library);
  assert.equal(episode.podcast, 'Test Tones Podcast');
  assert.equal(parseItems(fixture('items-recent'), library)[0].author, 'Jane Doe');
  const item = fixture('item-podcast');
  assert.equal(describeItem(item, item.media.episodes[0].id).title, 'Episode Two');
  assert.equal(describeItem(fixture('item-book')).author, 'Jane Doe');
});

test('broken answers give empty lists, never undefined', () => {
  for (const answer of [null, {}, { openSessions: 'x' }, { openSessions: [null, {}] }]) {
    assert.deepEqual(parseSessions(answer), []);
  }
  assert.deepEqual(parseUsers({ users: [{ id: 'x' }] }), []);
  assert.deepEqual(parseProgress(null), []);
  assert.deepEqual(describeItem(null), {
    title: '?',
    author: null,
    podcast: null,
    mediaType: 'book',
  });
});
