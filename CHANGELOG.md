# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.1] - 2026-10-22

### Security

- Rebuilt on Node.js 24.22.1, the October 2026 security release (remote code
  execution in the Brotli decoder, CVE-2026-111497; TLS hostname and DNS
  fixes).

## [1.0.0] - 2026-10-15

### Added

- An **Audiobookshelf** server device: online, players listening now, number
  of audiobooks, podcasts and downloaded episodes, version.
- One device per **Audiobookshelf user**: listening (yes/no), current or last
  title, progress (%), time left and minutes listened today.
- Scene triggers: listening started, listening stopped, book or episode
  finished, new podcast episode downloaded (filters: user, audiobook or
  episode, podcast title).
- Scene actions: check for new podcast episodes, and read "where am I" as a
  sentence for a notification or a speaker.
- Dashboard widgets: **Now listening** (covers, progress, playing or paused)
  and **Recently added** (cover grid, with a button to check for new
  episodes).
- Texts and documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-audiobookshelf/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/guim31/gladys-audiobookshelf/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/guim31/gladys-audiobookshelf/releases/tag/v1.0.0
