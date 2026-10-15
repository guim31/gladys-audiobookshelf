# Audiobookshelf for Gladys Assistant

External integration connecting an [Audiobookshelf](https://www.audiobookshelf.org)
server (self-hosted audiobooks and podcasts) to
[Gladys Assistant](https://gladysassistant.com), built on the official
[JavaScript SDK](https://github.com/GladysAssistant/integration-sdk-js) and the
[integration template](https://github.com/GladysAssistant/integration-template-js).

## Features

| Surface             | What you get                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Server device       | Online, players listening now, audiobooks, podcasts, downloaded episodes, version                                                       |
| One device per user | Listening (yes/no), current or last title, progress (%), time left (min), minutes listened today                                        |
| Scene triggers      | `listening_started`, `listening_stopped`, `item_finished` (filters: user, audiobook or episode), `episode_downloaded` (filter: podcast) |
| Scene actions       | `check_new_episodes` (the server reads every feed and downloads the new episodes), `read_progress` ("where am I" as a sentence)         |
| Dashboard widgets   | `now_listening` (covers, progress, playing or paused), `recently_added` (cover grid, "Check new episodes" button)                       |

Texts and documentation in English, French, German and Spanish.

## Requirements

- Gladys Assistant 5.1.0 or later.
- An Audiobookshelf server on the local network, and an **API key of an
  administrator** (Settings → API Keys, Audiobookshelf 2.26 or later; the API
  token of an admin user on older servers): the open sessions and the progress
  of every user are admin endpoints.

## Installation

1. In Gladys, open **Integrations** → **Install from GitHub** and enter the
   address of this repository: `https://github.com/guim31/gladys-audiobookshelf`
   (or install **Audiobookshelf** from the catalog once it is listed).
2. In **Configuration**, enter the address of your server
   (`http://192.168.1.20:13378`, or `https://example.org/audiobookshelf` behind
   a reverse proxy) and the API key. Save, then click **Test the connection**.
3. Open the **Discover** tab and add the server and the users to follow.

The user guide is in [`docs/en.md`](docs/en.md) (also in
[French](docs/fr.md), [German](docs/de.md) and [Spanish](docs/es.md)); Gladys
links it from the Configuration screen.

## How it works

- REST API only, with the key as a Bearer token. No socket.io: the open
  sessions (`/api/users/online`) are read every 15 to 60 seconds (30 by
  default), on a timer of the container (`should_poll: false`).
- A session stays open while its player is paused: a session counts as
  playing while its position moves, and as stopped after 90 seconds without
  a synchronization of the player.
- Every 5 minutes, and at once for a user who starts or stops listening: the
  libraries and their statistics, the last downloaded episodes, the users,
  their progress (`/api/users/:id`) and their listening time today.
- Finished books and downloaded episodes are announced from cursors kept in
  `/data`, once, also across restarts; nothing older than 24 hours.
- The covers of the widgets are resized by the server (240 px JPEG) and
  served through the widget image proxy of Gladys.
- Quiet logs: the lifecycle and the errors at info, once; the titles listened
  to only at debug.

## Checked against a real server

The client, the parsers and the scenarios were checked against
**Audiobookshelf 2.37.1** (the official image `ghcr.io/advplyr/audiobookshelf`)
with generated audiobooks and a local podcast feed: the answers in
`test/fixtures/abs/` are real (tokens removed, addresses anonymized), and the
integration ran in its locked-down container against that server. It has not
yet run in a real Gladys installation: feedback welcome.

## Limitations

- Polling, not push: a start or a stop reaches Gladys within the interval.
- E-books and their reading progress are not covered.
- No playback control: Audiobookshelf has no remote control of its players.
- One server per installation of the integration.

## Development

```bash
npm ci
npm run format:check
npm run lint
npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests run against a fake Audiobookshelf server built from real answers
(`test/fixtures/abs/`) and the fake Gladys of the SDK; they never touch the
network. See [`CLAUDE.md`](CLAUDE.md) for the project rules.

## Credits

- [Audiobookshelf](https://github.com/advplyr/audiobookshelf) (GPL-3.0) by
  advplyr and contributors, and its [API documentation](https://api.audiobookshelf.org).
  No code was copied from it.
- Built on the official
  [integration template](https://github.com/GladysAssistant/integration-template-js)
  and [SDK](https://github.com/GladysAssistant/integration-sdk-js).

## Disclaimer

Not affiliated with, nor endorsed by, the Audiobookshelf project.

## License

[Apache-2.0](LICENSE)
