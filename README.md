# Borges AV Timer Pro — Companion module

Connection module 1.0.2 for the Borges AV Studio Timer Pro Windows application, using its built-in HTTP API v1. It controls the existing timer; no replacement timer engine or NDI implementation is bundled.

## Setup
1. Install the packaged module in Companion's Modules page while official catalogue publication is pending. Use Companion with Node 22 / module API 2.0.4 support (validated in Companion 5.0.3).
2. In Timer Pro, open Companion and start the HTTP server. An active trial or software licence is required for remote control.
3. Add the Borges AV Timer Pro connection. Set host to `localhost` on the same machine, or the Timer computer's LAN IP. Port defaults to `8099`. Enter the PIN shown in Timer Pro; default source configuration is `2468`.
4. Drag presets onto buttons. Existing buttons keep their own styles when the module is upgraded: remove malformed text/font overrides from legacy feedbacks or recreate those buttons from the current presets.

## Features
Start, pause, toggle, stop/reset, +/-1 minute, +/-10 seconds, duration with optional start; presets for 5/10/15/20/30/45/60 minutes. Variables: display, message, state, running, remaining_seconds, duration_seconds, warning, ndi_status. Feedbacks: online, running, paused, finished, yellow and red warnings.

STOP and RESET restore the configured duration and pause; they do not set the display to zero. Renaming a connection may require updating variable references in existing buttons.

The module reads messages and NDI status. Version 1.0.2 does not provide message editing, progress-bar or NDI switching actions. Timer 2.4.14's mobile panel has additional controls; those are not advertised as module actions. Warning feedbacks follow the API thresholds (180 and 60 seconds), which are independent of the application's visual warning enable switches. Warning feedbacks are suppressed outside countdown mode.

## Network and errors
HTTP and PIN are intended for a trusted LAN. Do not forward the port to the Internet. The module does not change Windows firewall or URL reservations. A server running in localhost fallback mode is unavailable to other computers. Wrong PIN: HTTP 401; inactive licence: HTTP 403. Commands are not retried automatically, avoiding duplicate time adjustments or toggles. Polling defaults to 250 ms; requests time out after 1500 ms. Disconnection displays `--:--` and clears active warning feedbacks.

## Development
Install dependencies using the committed pnpm lockfile, then run `npm test` and `npm run package`. See [API.md](API.md) for protocol details and [VALIDATION.md](VALIDATION.md) for evidence and limits.

## Licensing and publication
This integration's source is MIT licensed; this does not license the proprietary Timer application or its licence issuer. The official Bitfocus repository request is pending: https://developer.bitfocus.io/create-repository/80 . A personal GitHub repository is a review source, not an official catalogue release.

Support: borgesav487@gmail.com
