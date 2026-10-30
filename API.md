# Borges AV Timer Pro HTTP API v1

Verified against the Timer 2.4.14 source. UTF-8 JSON, default TCP port 8099. Authenticate with `pin` query parameter or `X-Borges-PIN` header. The connection module uses GET with query parameters; the app also accepts POST form-urlencoded (up to 16384 bytes, authentication in header/query). The mobile page is `/remote`; it is not a JSON endpoint.

| Path | Parameters | Effect |
| --- | --- | --- |
| `/state` | none | Read current state |
| `/start` | none | Start/resume |
| `/pause` | none | Pause |
| `/toggle` | none | Toggle running |
| `/reset`, `/stop` | none | Restore duration, paused |
| `/plus1`, `/minus1` | none | Adjust +/-60 seconds |
| `/plus10`, `/minus10` | none | Adjust +/-10 seconds |
| `/set` | `seconds`, optional `start=1` | Replace duration, optionally start |

Additional Timer 2.4.14 endpoints, not used by module 1.0.2: `/message` (`text`, max 500 characters), `/message-show`, `/message-hide`, `/numbers-show`, `/numbers-hide`, `/numbers-auto-on`, `/numbers-auto-off`, `/progress-show`, `/progress-hide`. Older Timer builds may not implement these extensions. Empty message text clears the message. Setting text does not force visibility.

Example response (illustrative):
```json
{"ok":true,"error":null,"command":"state","apiVersion":1,"state":"paused","running":false,"display":"05:00","remainingSeconds":300,"durationSeconds":300,"mode":"countdown","message":"INTERVALO","messageVisible":true,"numbersVisible":true,"numbersEnabled":true,"hideNumbersAtZero":false,"progressEnabled":true,"warning":"normal","ndi":false}
```
`mode`: countdown/countup/clock. `state`: running/paused/finished. `warning`: normal/yellow/red; the source compares positive remaining seconds to 180/60 independently of visual warning switches. NDI is a boolean sender status, not a receiver count. Invalid commands/values may return HTTP 200 with `ok:false` and `error`; always check both HTTP status and `ok`. HTTP 401 means incorrect PIN, 403 means software entitlement required, 400 invalid POST body and 405 unsupported method.

HTTP is unencrypted; keep PINs out of public logs and use only a trusted local network. No licence activation, payment or private signing key is exposed through this API.
