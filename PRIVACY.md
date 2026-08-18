# Privacy model

LocalCue Studio is designed to work without a LocalCue account or application server.

## What the application stores

- The current script and its title are saved in browser `localStorage`.
- A finished recording is held as an in-memory browser object URL for review and download.
- The application does not include analytics, advertising, error-reporting, or recording-upload code.

## Voice following

Voice following activates only when the browser exposes an API that explicitly requests local processing. Otherwise, the app offers auto-scroll and manual modes. It does not use ordinary network-capable Web Speech recognition as a fallback.

The browser may download a language pack before local recognition starts. That browser-managed download is distinct from uploading a recording.

## Limits

This repository cannot control your browser, extensions, operating system, device backups, screen recorders, or network. For sensitive material, inspect the source, use a trusted browser profile, download the finished take, discard it, and close the tab.

Clearing the script removes the LocalCue draft from `localStorage`. Closing or refreshing the review tab releases an undownloaded in-memory take.
