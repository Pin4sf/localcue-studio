# Teleprompter landscape and LocalCue's boundary

Research date: 2026-08-18

## What already exists

The broad workflow is established. Commercial products such as [VocalScroll](https://vocalscroll.com/), [Teleprompter.com](https://www.teleprompter.com/), and [Speakflow](https://www.speakflow.com/docs) combine prompting, voice-controlled movement, recording, or team workflows. Open-source projects including [VoicePrompter](https://github.com/kosuvorov/VoicePrompter), [Open Teleprompter](https://github.com/Btheriot83/open-teleprompter), and [Prompt Me](https://github.com/larsbaunwall/promptme-ai) cover important parts of the space.

LocalCue does **not** claim to invent voice-following teleprompting.

## Product boundary

1. Bring a script, record, review, and download without registration.
2. No analytics or media-upload endpoint.
3. Voice following only when local processing can be enforced.
4. Auto-scroll and manual modes when that API is absent.
5. Download extension and label follow the actual recorder MIME type.

## Why the voice distinction matters

The [Web Speech API specification](https://webaudio.github.io/web-speech-api/) permits recognition services with implementation-dependent behavior. The newer [`processLocally`](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally), `available`, and `install` APIs explicitly request on-device recognition, but remain experimental and are not broadly available. LocalCue therefore refuses an ordinary Web Speech fallback.

## Why formats vary

The [MediaStream Recording specification](https://www.w3.org/TR/mediastream-recording/) and browsers allow multiple containers and codecs. LocalCue probes support, prefers MP4, falls back to WebM, and uses the finished recorder MIME type.

## Future work

- Bundled WebAssembly speech recognition for broader verifiable offline support
- Persistent local take library
- Local caption generation
- Camera placement calibration
- Browser compatibility and accessibility fixtures

These are directions, not current features.
