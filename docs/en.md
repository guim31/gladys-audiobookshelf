# Audiobookshelf

Bring your [Audiobookshelf](https://www.audiobookshelf.org) server (audiobooks
and podcasts) into Gladys, over your local network: who listens to what, the
progress and the time left in each book, the minutes listened today, the last
additions with their covers on the dashboard, and scenes that react when
someone starts or stops listening, finishes a book, or when a new podcast
episode is downloaded.

The integration was tested against a real Audiobookshelf 2.37 server (the
official Docker image), not yet in a real Gladys installation: feedback is
welcome on the [Gladys forum](https://community.gladysassistant.com) or in the
[issues](https://github.com/guim31/gladys-audiobookshelf/issues).

## What you need

- Gladys Assistant 5.1.0 or later.
- An **Audiobookshelf** server reachable from Gladys (same network).
- An **API key of an administrator**: in Audiobookshelf, **Settings** → **API
  Keys** → **Add API Key**, for an admin user (Audiobookshelf 2.26 or later).
  On an older server, use the API token of an admin user (**Settings** →
  **Users** → the user). The listening sessions and the progress of every user
  are only readable by an administrator.

## Set up

1. Install the integration from the Gladys catalog.
2. In **Configuration**, enter the **Server URL** with its port (for example
   `http://192.168.1.20:13378`; behind a reverse proxy,
   `https://example.org/audiobookshelf`) and the **API key**.
3. Optionally, choose how often the listening sessions are read (every 30
   seconds by default) and the language of the names.
4. Save, then click **Test the connection**: it shows the version, the
   libraries and the users found.
5. In the **Discovery** tab, add the server and the users you want to follow.

## Devices

**Audiobookshelf** (the server):

| Feature              | Meaning                                      |
| -------------------- | -------------------------------------------- |
| **Online**           | 1 while the integration reads the server     |
| **Listening now**    | number of players playing right now          |
| **Audiobooks**       | books in the book libraries                  |
| **Podcasts**         | podcasts in the podcast libraries            |
| **Podcast episodes** | episodes downloaded in the podcast libraries |
| **Version**          | version of Audiobookshelf                    |

**Audiobookshelf <user>** (one device per user of the server):

| Feature            | Meaning                                                                             |
| ------------------ | ----------------------------------------------------------------------------------- |
| **Listening**      | 1 while one of the user's players plays                                             |
| **Current title**  | the book (with its author) or episode (with its podcast) playing, else the last one |
| **Progress**       | position in that book or episode, in %                                              |
| **Time left**      | minutes left in that book or episode                                                |
| **Listened today** | minutes listened today (day of the server)                                          |

A paused player keeps its session open: the user counts as listening until
the player has not reported its position for 90 seconds.

## Dashboard

- **Now listening**: who listens to what, with the covers, the progress and a
  _Listening_ or _Paused_ badge (a paused session stays 30 minutes), the
  number of players playing and the minutes listened today. Every user, or the
  one chosen in the widget settings.
- **Recently added**: a grid of the last audiobooks and podcast episodes
  added, with their covers, the number of audiobooks and podcasts, and a
  **Check new episodes** button (the same as the scene action below).

## Scenes

### Triggers

- **Listening started**: a user starts or resumes an audiobook or an episode.
  Filters: the user, the type (audiobook or podcast episode). Information:
  user, title, author, podcast, type, progress.
- **Listening stopped**: a user pauses or stops (90 seconds without progress).
  Same filters and information, plus the minutes listened in the session.
- **Book or episode finished**: a user reaches the end of a book or of an
  episode, or marks it as finished. Same filters.
- **New podcast episode downloaded**: Audiobookshelf downloaded a new episode
  (automatic download, or the action below). Filter: the podcast title,
  exactly as shown in Audiobookshelf. Information: podcast, episode title,
  library, duration in minutes.

### Actions

- **Check for new podcast episodes**: Audiobookshelf reads the feed of every
  podcast and downloads the new episodes. Results: podcasts checked, new
  episodes found.
- **Read where I am in my audiobook**: a sentence for a notification or a
  speaker, for example _"alice is at 33% of Quiet Morning by Jane Doe, 7 min
  left."_ Choose the user; empty, every user listening or with a book in
  progress. Results: the sentence, the title, the progress.

### Scene ideas

- **Bedtime story**: when _Listening started_ for the children's user after
  8 pm, dim the bedroom light; when _Listening stopped_, turn it off.
- **Morning podcast**: every day at 6 am, _Check for new podcast episodes_;
  when _New podcast episode downloaded_ for your daily show, send a
  notification with its title.
- **Congratulations**: when _Book or episode finished_ with the type
  audiobook, send a congratulation message with the title of the book.

## Troubleshooting

- **"the server does not answer"**: check the address and the port from the
  Gladys machine. Gladys runs the integration in a container: `localhost` is
  the container itself, use the IP address of the machine.
- **"API key refused"**: the key was deleted, disabled or has expired; create
  a new one.
- **"this API key is not an administrator's"**: create the key for a user of
  type admin or root.
- **"no Audiobookshelf server at this address"** or **"the address
  redirects"**: a server behind a reverse proxy needs its path
  (`https://example.org/audiobookshelf`); a login page of the proxy blocks the
  API: use the local address.
- **"certificate refused"**: HTTPS with a self-signed certificate is not
  supported; use the `http://` address on your network.
- No cover: Audiobookshelf has none for that book or podcast.
- The integration logs the lifecycle only; with `LOG_LEVEL=debug` it also
  logs each listening event, with the titles.

## Limits

- The sessions are read every 15 to 60 seconds, not pushed: a start or a stop
  reaches Gladys within that interval (90 seconds for a pause).
- The libraries, the users, the progress and the time listened today are read
  every 5 minutes, and at once for a user who starts or stops listening.
- Finished books and downloaded episodes older than 24 hours are not
  announced (a Gladys stopped for two days does not replay them).
- E-books and their reading progress are not covered.
- No playback control: Audiobookshelf has no remote control of its players.
- Not affiliated with the Audiobookshelf project.
