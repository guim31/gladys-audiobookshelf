# Audiobookshelf fixtures

Real answers of an Audiobookshelf **2.37.1** server (official image
`ghcr.io/advplyr/audiobookshelf`), captured on 15/10/2026 on a test bench:
two generated audiobooks (sine tones, `Jane Doe` and `John Roe` are made up),
a podcast built from a local RSS feed, the users `root` and `alice`, a book
listened to then finished, an episode in progress.

Anonymized: the user tokens (`token`, `accessToken`, `refreshToken`) are
removed, the client addresses replaced by `192.0.2.50`. The ids are the random
UUIDs of that throwaway server. `cover-240.jpg` is a plain cover resized by the
server (`/api/items/:id/cover?width=240&format=jpeg`).
