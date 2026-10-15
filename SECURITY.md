# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

What the integration handles:

- **Secrets**: the Audiobookshelf API key (an administrator's) is a `secret`
  field of the Gladys configuration. The integration reads it from Gladys at
  startup, keeps it in memory, sends it only to the configured server (in the
  `Authorization` header, never in a URL), and never writes it to `/data` nor
  to the logs. The user list of Audiobookshelf carries the tokens of the
  users: the integration keeps only their id and name.
- **Stored in `/data`**: `audiobookshelf-state.json`, the server address, the
  date of the last finished book per user id and of the last downloaded
  episode per library, so a restart announces nothing twice. Nothing else.
- **Privacy**: the titles listened to only appear in the logs at the debug
  level (`LOG_LEVEL=debug`).
- **Network**: requests go only to the Audiobookshelf address typed in the
  configuration, on the local network, in HTTP or HTTPS (certificates
  verified). The covers shown by the widgets are read from this server, never
  from the Internet. The integration opens no port and calls no cloud service.
  It only reads, and asks the server to check the podcast feeds: it never
  deletes nor changes anything.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
Audiobookshelf itself, and the other devices and services of your network.
