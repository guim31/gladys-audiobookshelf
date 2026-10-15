// -----------------------------------------------------------------------------
// The two dashboard widgets: content validated by the SDK's own validator
// (what the core accepts), the covers served through onWidgetGetImage, and
// the "check new episodes" button.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { WIDGET_KEYS } from '../src/hub.js';
import { ACTIONS } from '../src/widgets.js';
import { COVER, IDS, SERVER_URL, createWorld, userDevice } from './helpers/world.js';

async function world(t, options) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

async function content(w, key, settings = {}, language = 'en') {
  const ack = await w.fake.widgetGet(key, { settings, language });
  assert.equal(ack.success, true, ack.error);
  const body = ack.data.content;
  assert.deepEqual(validateWidgetContent(body), [], JSON.stringify(body));
  return body;
}

const ofType = (body, type) => body.components.filter((component) => component.type === type);

test('"Now listening" shows the playing and paused sessions with their covers', async (t) => {
  const w = await world(t);
  w.server.play({ at: w.clock.now() });
  w.server.play({
    userId: IDS.ROOT,
    at: w.clock.now() - 5 * 60_000,
    episode: true,
    currentTime: 40,
  });
  await w.hub.refresh();
  const body = await content(w, WIDGET_KEYS.NOW_LISTENING);
  const [playing, today] = ofType(body, 'value');
  assert.equal(playing.value, 1);
  assert.equal(today.value, 3);
  const [list] = ofType(body, 'card-list');
  assert.deepEqual(
    list.items.map((item) => [item.title, item.subtitle, item.badge.text, item.image]),
    [
      ['Quiet Morning', 'alice · Jane Doe · 25 %', 'Listening', `cover-${IDS.QUIET_MORNING}`],
      // The podcast of the captures has no cover: no image declared.
      ['Episode Two', 'root · Test Tones Podcast · 33 %', 'Paused', undefined],
    ],
  );
});

test('"Now listening" for one user, nobody, an unknown user, French', async (t) => {
  const w = await world(t);
  w.server.play({ userId: IDS.ROOT, at: w.clock.now(), episode: true });
  await w.hub.refresh();
  const alice = await content(w, WIDGET_KEYS.NOW_LISTENING, { device: userDevice(w.gladys) });
  assert.equal(ofType(alice, 'card-list').length, 0);
  assert.equal(ofType(alice, 'text')[0].text, 'Nobody is listening right now.');
  const gone = await content(w, WIDGET_KEYS.NOW_LISTENING, {
    device: userDevice(w.gladys, 'gone'),
  });
  assert.match(gone.components[0].text, /no longer on the server/);
  const fr = await content(w, WIDGET_KEYS.NOW_LISTENING, {}, 'fr');
  assert.equal(ofType(fr, 'card-list')[0].items[0].badge.text, 'En écoute');
});

test('"Recently added" shows books and episodes, last first, and the button', async (t) => {
  const w = await world(t);
  const body = await content(w, WIDGET_KEYS.RECENTLY_ADDED);
  const [books, podcasts] = ofType(body, 'value');
  assert.equal(books.value, 2);
  assert.equal(podcasts.value, 1);
  const [grid] = ofType(body, 'card-list');
  assert.equal(grid.display, 'grid');
  assert.deepEqual(
    grid.items.map((item) => [item.title, item.badge.text, item.image]),
    [
      ['Episode Three', 'Episode', undefined],
      ['Episode Two', 'Episode', undefined],
      ['Quiet Morning', 'Book', `cover-${IDS.QUIET_MORNING}`],
      ['Long Evening', 'Book', undefined],
    ],
  );
  const [button] = ofType(body, 'button');
  assert.equal(button.action.key, ACTIONS.CHECK_EPISODES);

  const ack = await w.fake.widgetAction(WIDGET_KEYS.RECENTLY_ADDED, ACTIONS.CHECK_EPISODES, {});
  assert.equal(ack.success, true, ack.error);
  assert.equal(ack.data.message.en, '1 podcast(s) checked, 1 new episode(s).');
});

test('the covers come from the server, only for the declared keys', async (t) => {
  const w = await world(t);
  const ack = await w.fake.widgetGetImage(`cover-${IDS.QUIET_MORNING}`);
  assert.equal(ack.success, true, ack.error);
  assert.equal(ack.data.image, COVER.toString('base64'));
  const request = w.server.requests.at(-1);
  assert.equal(request.path, `/api/items/${IDS.QUIET_MORNING}/cover`);
  assert.deepEqual(request.query, { width: '240', format: 'jpeg' });
  const refused = await w.fake.widgetGetImage('../api/users');
  assert.equal(refused.success, false);
});

test('without configuration or with the server down, the widgets say so', async (t) => {
  const empty = await world(t, { config: { language: 'en' } });
  const body = await content(empty, WIDGET_KEYS.NOW_LISTENING);
  assert.match(body.components[0].text, /Enter the address/);

  const w = await world(t, { config: { server_url: SERVER_URL, api_key: 'key-1' } });
  w.server.online = false;
  await w.hub.refresh();
  const down = await content(w, WIDGET_KEYS.NOW_LISTENING);
  assert.match(down.components[0].text, /does not answer/);
  // The last additions read stay shown.
  const recent = await content(w, WIDGET_KEYS.RECENTLY_ADDED);
  assert.equal(ofType(recent, 'card-list').length, 1);
});
