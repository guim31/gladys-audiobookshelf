// -----------------------------------------------------------------------------
// What the integration writes at the default level (info): the lifecycle
// only. A normal reading writes nothing, a failure that repeats is logged
// once, and its end once. Never an API key, never a title at info.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, SERVER_URL, createWorld } from './helpers/world.js';

/** Capture the lines of the SDK logger at LOG_LEVEL=info. */
function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  const lines = [];
  const record =
    (stream) =>
    (...args) =>
      lines.push({
        stream,
        text: args.map((arg) => (arg instanceof Error ? arg.stack : String(arg))).join(' '),
      });
  t.mock.method(console, 'log', record('out'));
  t.mock.method(console, 'error', record('err'));
  return {
    lines,
    clear: () => lines.splice(0),
    texts: () => lines.map((line) => line.text),
  };
}

async function world(t, options = {}) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

test('a normal reading cycle writes nothing at info, not even a title', async (t) => {
  const logs = captureLogs(t);
  const w = await world(t);
  assert.ok(
    logs.texts().some((text) => text.includes('connected')),
    'the start is logged',
  );
  logs.clear();
  const session = w.server.play({ at: w.clock.now() });
  for (let i = 0; i < 5; i += 1) {
    w.clock.advance(60 * 60_000); // the libraries and the status are read again too
    w.server.sync(session, { at: w.clock.now() });
    w.server.addEpisode(w.clock.now(), `Episode ${i}`);
    await w.hub.refresh();
  }
  w.server.close(session);
  w.server.finish(w.clock.now());
  await w.hub.refresh({ library: true });
  assert.ok(w.fake.sceneEvents.length >= 8, 'events were fired');
  assert.deepEqual(logs.texts(), []);
});

test('a server that stays down is logged once, and once when it is back', async (t) => {
  const logs = captureLogs(t);
  const w = await world(t);
  logs.clear();
  w.server.online = false;
  for (let i = 0; i < 6; i += 1) {
    w.clock.advance(60_000);
    await w.hub.refresh();
  }
  assert.equal(logs.lines.length, 1, logs.texts().join('\n'));
  assert.equal(logs.lines[0].stream, 'err');
  logs.clear();
  w.server.online = true;
  await w.hub.refresh();
  await w.hub.refresh();
  assert.equal(logs.lines.length, 1, logs.texts().join('\n'));
  assert.match(logs.lines[0].text, /connection restored/);
});

test('a refused API key is logged once, never the key', async (t) => {
  const logs = captureLogs(t);
  const w = await world(t, { config: { server_url: SERVER_URL, api_key: 'wrong-key-42' } });
  for (let i = 0; i < 5; i += 1) {
    await w.hub.refresh();
  }
  const warnings = logs.lines.filter((line) => line.stream === 'err');
  assert.equal(warnings.length, 1, logs.texts().join('\n'));
  assert.match(warnings[0].text, /API key refused/);
  assert.ok(!logs.texts().join('\n').includes('wrong-key-42'), 'never the key');
});

test('Gladys refusing the states is logged once', async (t) => {
  const logs = captureLogs(t);
  const w = await world(t);
  logs.clear();
  w.gladys.publishStates = async () => {
    throw new Error('HTTP 500');
  };
  for (let i = 0; i < 4; i += 1) {
    w.clock.advance(15_000);
    w.server.play({ at: w.clock.now() });
    await w.hub.refresh();
  }
  assert.equal(logs.lines.length, 1, logs.texts().join('\n'));
  assert.match(logs.lines[0].text, /States refused/);
});

test('LOG_LEVEL=debug shows the titles and each reading problem; never the API key', async (t) => {
  const logs = captureLogs(t, 'debug');
  const w = await world(t, { config: CONFIG });
  w.server.play({ at: w.clock.now() });
  await w.hub.refresh();
  w.server.online = false;
  await w.hub.refresh();
  await w.hub.refresh();
  const text = logs.texts().join('\n');
  assert.match(text, /Listening started: alice, "Quiet Morning"/);
  assert.match(text, /\[DEBUG\].*again/);
  assert.ok(!text.includes('key-1'), 'never the API key');
});
