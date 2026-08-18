# LocalCue Studio

An open-source, local-first teleprompter and video recorder that runs in your browser.

**[Open LocalCue Studio](https://localcue-studio.piyushfulper3210.chatgpt.site)**

Paste or import a script, place it close to the camera, record a take, review it immediately, and download the actual file produced by your browser. No account is required.

## Why this exists

Voice-controlled teleprompters already exist. LocalCue is intentionally focused on a narrower contract that is easy to inspect:

- the current script is stored only in browser storage;
- recorded media is held in the current tab until you download or discard it;
- there is no account, analytics SDK, or media-upload endpoint;
- voice following runs only when the browser can enforce on-device recognition;
- unsupported browsers use auto-scroll or manual control instead of silently sending speech elsewhere;
- the review screen reports the format actually produced by the browser.

Read the [landscape and product boundary](docs/landscape.md) for the prior-art research behind these decisions.

## Features

- Paste a script or import `.txt`, `.md`, and `.markdown`
- Camera preview positioned directly beneath the physical webcam
- Enforced on-device voice following where supported
- Auto-scroll and manual modes everywhere recording APIs are available
- Adjustable type size and scrolling speed
- In-browser camera and microphone recording
- Immediate playback, download, re-record, and discard
- MP4 when the browser supports it; WebM fallback with truthful labeling

## Browser support

Camera recording requires `getUserMedia`, `MediaRecorder`, permission, and a secure context (HTTPS or localhost).

Enforced local voice following additionally requires the experimental on-device Web Speech APIs (`processLocally`, `available`, and `install`). In practice, this is aimed at compatible desktop Chrome or Edge builds. Safari, Firefox, and mobile browsers can use auto-scroll or manual mode.

LocalCue deliberately does not fall back to ordinary Web Speech recognition because implementations may use a remote service.

## Development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Run the full check:

```bash
npm run check
```

## Privacy model

See [PRIVACY.md](PRIVACY.md). This is a product contract, not a promise about the browser, operating system, extensions, or device you run it on. Audit the code and use a browser profile you trust for sensitive recordings.

## Contributing

Issues and focused pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and review [SECURITY.md](SECURITY.md) before reporting a vulnerability.

## License

[MIT](LICENSE)
