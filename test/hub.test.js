// -----------------------------------------------------------------------------
// The hub against the fake Audiobookshelf server: devices, states, the start
// and stop of listening, finished books, downloaded episodes, the scene
// actions, the cursors kept across restarts, and the error statuses.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEDIA_TYPES } from '../src/abs/model.js';
import { TRIGGERS } from '../src/hub.js';
import {
  FakeAbs,
  IDS,
  SERVER_URL,
  createClock,
  createWorld,
  serverDevice,
  serverFeature,
  userDevice,
  userFeature,
} from './helpers/world.js';

async function world(t, options) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

const events = (w, key) => w.fake.sceneEvents.filter((event) => event.key === key);

test('discovers the server and one device per active user', async (t) => {
  const w = await world(t);
  const devices = w.fake.discoveredDevices;
  assert.deepEqual(
    devices.map((device) => device.name),
    ['Audiobookshelf', 'Audiobookshelf root', 'Audiobookshelf alice'],
  );
  assert.equal(devices[0].external_id, serverDevice(w.gladys));
  assert.deepEqual(devices[0].params, [{ name: 'AUDIOBOOKSHELF_URL', value: SERVER_URL }]);
  assert.ok(devices.every((device) => device.should_poll === false));
  assert.equal(w.fake.connectionStatus.connected, true);
});

test('publishes the library counts, the version and the users at the first reading', async (t) => {
  const w = await world(t);
  assert.equal(w.fake.lastState(serverFeature(w.gladys, 'online')), 1);
  assert.equal(w.fake.lastState(serverFeature(w.gladys, 'books')), 2);
  assert.equal(w.fake.lastState(serverFeature(w.gladys, 'podcasts')), 1);
  assert.equal(w.fake.lastState(serverFeature(w.gladys, 'episodes')), 1);
  assert.equal(w.fake.lastState(serverFeature(w.gladys, 'sessions')), 0);
  assert.equal(w.fake.lastState(serverFeature(w.gladys, 'version')), '2.37.1');
  // alice listened to Quiet Morning for 200 s today, a third of it.
  assert.equal(w.fake.lastState(userFeature(w.gladys, 'listening')), 0);
  assert.equal(w.fake.lastState(userFeature(w.gladys, 'title')), 'Quiet Morning — Jane Doe');
  assert.equal(w.fake.lastState(userFeature(w.gladys, 'progress')), 33);
  assert.equal(w.fake.lastState(userFeature(w.gladys, 'remaining')), 7);
  assert.equal(w.fake.lastState(userFeature(w.gladys, 'today')), 3);
  // root's last episode: its title comes from the item, not from the progress.
  assert.equal(
    w.fake.lastState(userFeature(w.gladys, 'title', IDS.ROOT)),
    'Episode Two — Test Tones Podcast',
  );
  assert.deepEqual(events(w, TRIGGERS.FINISHED), [], 'the first reading announces nothing');
  assert.deepEqual(events(w, TRIGGERS.EPISODE), []);
});

test('a session that plays, pauses and closes fires started then stopped once', async (t) => {
  const w = await world(t);
  const session = w.server.play({ at: w.clock.now() });
  w.clock.advance(15_000);
  await w.hub.refresh();
  const [started] = events(w, TRIGGERS.STARTED);
  assert.ok(started, 'listening_started fired');
  assert.deepEqual(started.data, {
    device: userDevice(w.gladys),
    user: 'alice',
    title: 'Quiet Morning',
    author: 'Jane Doe',
    podcast: null,
    media_type: MEDIA_TYPES.BOOK,
    progress: 25,
  });
  assert.equal(w.fake.lastState(userFeature(w.gladys, 'listening')), 1);
  assert.equal(w.fake.lastState(serverFeature(w.gladys, 'sessions')), 1);

  // Still playing: the player synchronizes, nothing new fires.
  for (let i = 0; i < 4; i += 1) {
    w.clock.advance(15_000);
    w.server.sync(session, { at: w.clock.now() });
    await w.hub.refresh();
  }
  assert.equal(events(w, TRIGGERS.STARTED).length, 1);
  assert.equal(w.fake.lastState(userFeature(w.gladys, 'progress')), 35);

  // Paused: the session stays open but stops moving.
  w.clock.advance(60_000);
  await w.hub.refresh();
  assert.equal(events(w, TRIGGERS.STOPPED).length, 0, 'not yet: 60 s without a sync');
  w.clock.advance(31_000);
  await w.hub.refresh();
  const [stopped] = events(w, TRIGGERS.STOPPED);
  assert.ok(stopped, 'listening_stopped fired after 90 s without a sync');
  assert.equal(stopped.data.minutes, 4);
  assert.equal(w.fake.lastState(userFeature(w.gladys, 'listening')), 0);

  // Resumed, then closed: started again, stopped again.
  w.server.sync(session, { at: w.clock.now() });
  await w.hub.refresh();
  w.server.close(session);
  await w.hub.refresh();
  assert.equal(events(w, TRIGGERS.STARTED).length, 2);
  assert.equal(events(w, TRIGGERS.STOPPED).length, 2);
  assert.equal(w.fake.lastState(serverFeature(w.gladys, 'sessions')), 0);
});

test('a podcast episode carries the podcast, filtered by media type', async (t) => {
  const w = await world(t);
  w.server.play({ userId: IDS.ROOT, at: w.clock.now(), episode: true, currentTime: 40 });
  await w.hub.refresh();
  const [started] = events(w, TRIGGERS.STARTED);
  assert.equal(started.data.device, userDevice(w.gladys, IDS.ROOT));
  assert.equal(started.data.title, 'Episode Two');
  assert.equal(started.data.podcast, 'Test Tones Podcast');
  assert.equal(started.data.media_type, MEDIA_TYPES.PODCAST);
  assert.equal(
    w.fake.lastState(userFeature(w.gladys, 'title', IDS.ROOT)),
    'Episode Two — Test Tones Podcast',
  );
});

test('sessions already playing at start are the starting point, not news', async (t) => {
  const server = new FakeAbs();
  const clock = createClock();
  server.play({ at: clock.now() - 5_000 });
  const w = await world(t, { server, clock });
  assert.deepEqual(events(w, TRIGGERS.STARTED), []);
  assert.equal(w.fake.lastState(userFeature(w.gladys, 'listening')), 1);
});

test('a finished book is announced once, also across a restart', async (t) => {
  const w = await world(t);
  w.clock.advance(60_000);
  w.server.finish(w.clock.now());
  await w.hub.refresh({ library: true });
  const [finished] = events(w, TRIGGERS.FINISHED);
  assert.deepEqual(finished.data, {
    device: userDevice(w.gladys),
    user: 'alice',
    title: 'Quiet Morning',
    author: 'Jane Doe',
    podcast: null,
    media_type: MEDIA_TYPES.BOOK,
  });
  assert.equal(w.fake.lastState(userFeature(w.gladys, 'progress')), 100);
  assert.equal(w.fake.lastState(userFeature(w.gladys, 'remaining')), 0);
  await w.hub.refresh({ library: true });
  assert.equal(events(w, TRIGGERS.FINISHED).length, 1);

  await w.app.stop();
  const again = await world(t, { server: w.server, clock: w.clock, dataDir: w.dataDir });
  assert.deepEqual(events(again, TRIGGERS.FINISHED), [], 'not announced again after a restart');
});

test('a downloaded episode is announced once, with its podcast and duration', async (t) => {
  const w = await world(t);
  w.clock.advance(60_000);
  w.server.addEpisode(w.clock.now());
  await w.hub.refresh({ library: true });
  const [episode] = events(w, TRIGGERS.EPISODE);
  assert.deepEqual(episode.data, {
    device: serverDevice(w.gladys),
    podcast: 'Test Tones Podcast',
    title: 'Episode Four',
    library: 'Podcasts',
    minutes: 2,
  });
  await w.hub.refresh({ library: true });
  assert.equal(events(w, TRIGGERS.EPISODE).length, 1);
});

test('"check new episodes" asks every podcast and reads the episodes soon after', async (t) => {
  const w = await world(t);
  const ack = await w.fake.sceneAction('check_new_episodes', {});
  assert.equal(ack.success, true, ack.error);
  assert.deepEqual(ack.data.outputs, { podcasts: 1, episodes: 1 });
  assert.ok(w.server.requests.some((request) => request.path.endsWith('/checknew')));
  // The download takes a while: the library is read again 45 s later.
  w.server.addEpisode(w.clock.now() + 10_000, 'Episode Three');
  w.clock.advance(46_000);
  await w.hub.refresh();
  assert.equal(events(w, TRIGGERS.EPISODE).length, 1);
});

test('"where am I" reads a sentence in the configured language', async (t) => {
  const w = await world(t, {
    config: { server_url: SERVER_URL, api_key: 'key-1', language: 'fr' },
  });
  const ack = await w.fake.sceneAction('read_progress', { device: userDevice(w.gladys) });
  assert.equal(ack.success, true, ack.error);
  assert.deepEqual(ack.data.outputs, {
    sentence: 'alice en est à 33 % de Quiet Morning de Jane Doe, reste 7 min.',
    title: 'Quiet Morning — Jane Doe',
    progress: 33,
  });
  // No user: those listening or with something in progress.
  const all = await w.fake.sceneAction('read_progress', {});
  assert.match(
    all.data.outputs.sentence,
    /^root en est à 33 % de Episode Two \(Test Tones Podcast\)/,
  );
  assert.match(all.data.outputs.sentence, /alice en est à 33 %/);
});

test('"where am I" on a user removed from the server says so', async (t) => {
  const w = await world(t);
  const ack = await w.fake.sceneAction('read_progress', {
    device: userDevice(w.gladys, 'gone-user'),
  });
  assert.equal(ack.success, false);
  assert.match(ack.error, /no longer on the Audiobookshelf server/);
});

test('adding a device republishes its states and refreshes the widgets', async (t) => {
  const w = await world(t);
  const device = w.fake.discoveredDevices.find(
    (entry) => entry.external_id === userDevice(w.gladys),
  );
  const before = w.fake.states.length;
  const refreshes = w.fake.widgetRefreshes.length;
  await w.fake.deviceCreated(device);
  assert.equal(w.fake.states.length - before, 5, 'the five features of the user');
  assert.equal(w.fake.widgetRefreshes.length, refreshes + 2);
});

test('nothing is republished while nothing changes, except the 12 h heartbeat', async (t) => {
  const w = await world(t);
  const before = w.fake.states.length;
  await w.hub.refresh({ library: true });
  await w.hub.refresh();
  assert.equal(w.fake.states.length, before);
  w.clock.advance(12 * 60 * 60_000);
  await w.hub.refresh({ library: true });
  assert.ok(w.fake.states.length > before);
});

test('a server down marks it offline and says so, then comes back', async (t) => {
  const w = await world(t);
  w.server.online = false;
  await w.hub.refresh();
  assert.equal(w.fake.lastState(serverFeature(w.gladys, 'online')), 0);
  assert.equal(w.fake.connectionStatus.connected, false);
  assert.match(w.fake.connectionStatus.message.en, /does not answer/);
  assert.equal(w.fake.transports.at(-1).transport, 'unreachable');
  w.server.online = true;
  await w.hub.refresh();
  assert.equal(w.fake.lastState(serverFeature(w.gladys, 'online')), 1);
  assert.equal(w.fake.connectionStatus.connected, true);
});

test('a key refused, a key of a plain user, another application: explained', async (t) => {
  const refused = await world(t, { config: { server_url: SERVER_URL, api_key: 'wrong' } });
  assert.match(refused.fake.connectionStatus.message.en, /API key refused/);

  const plain = await world(t, { server: new FakeAbs({ admin: false }) });
  assert.match(plain.fake.connectionStatus.message.en, /not an administrator/);

  const other = new FakeAbs();
  other.status = { appName: 'Sonarr', version: '4.0.0' };
  const wrong = await world(t, { server: other });
  assert.match(wrong.fake.connectionStatus.message.en, /no Audiobookshelf server/);
});

test('no configuration: no device, a status that says what to enter', async (t) => {
  const w = await world(t, { config: { language: 'en' } });
  assert.deepEqual(w.fake.discoveredDevices, []);
  assert.equal(w.fake.connectionStatus.connected, false);
  assert.match(w.fake.connectionStatus.message.en, /address of your Audiobookshelf server/);
  const ack = await w.fake.sceneAction('check_new_episodes', {});
  assert.equal(ack.success, false);
  assert.match(ack.error, /No Audiobookshelf server/);
});

test('"Test the connection" reports the version, the libraries and the users', async (t) => {
  const w = await world(t);
  const ack = await w.fake.action('test_connection', {});
  assert.equal(ack.success, true, ack.error);
  assert.equal(
    ack.data.message.en,
    'Audiobookshelf 2.37.1: connected, 2 audiobook(s), 1 podcast(s), 2 user(s), 0 listening now',
  );
});

test('the timer of the container reads the sessions without Gladys polling', async (t) => {
  const w = await world(t, {
    timers: true,
    config: { server_url: SERVER_URL, api_key: 'key-1', poll_interval: '15' },
  });
  const reads = () => w.server.requests.filter((r) => r.path === '/api/users/online').length;
  const first = reads();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  w.hub.schedule();
  t.mock.timers.tick(15_000);
  await w.hub.running;
  assert.equal(reads(), first + 1);
});
