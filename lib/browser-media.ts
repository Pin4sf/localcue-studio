export const recordingTypes = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export function chooseRecordingType(
  supported: (mime: string) => boolean = (mime) => MediaRecorder.isTypeSupported(mime),
) {
  return recordingTypes.find(supported) ?? "";
}

export function extensionForMime(mime: string) {
  return mime.toLocaleLowerCase().includes("mp4") ? "mp4" : "webm";
}

export function formatForMime(mime: string) {
  return mime.toLocaleLowerCase().includes("mp4") ? "MP4" : "WebM";
}

export type LocalSpeechState =
  | "checking"
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable"
  | "unsupported";

export interface SpeechRecognitionResultEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
}

export interface LocalSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  processLocally: boolean;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(audioTrack?: MediaStreamTrack): void;
  stop(): void;
  abort(): void;
}

interface LocalSpeechConstructor {
  new (): LocalSpeechRecognition;
  available?(options: { langs: string[]; processLocally: boolean }): Promise<"available" | "downloadable" | "downloading" | "unavailable">;
  install?(options: { langs: string[]; processLocally: boolean }): Promise<boolean>;
}

export function localRecognitionConstructor(): LocalSpeechConstructor | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as Window & {
    SpeechRecognition?: LocalSpeechConstructor;
    webkitSpeechRecognition?: LocalSpeechConstructor;
  }).SpeechRecognition ?? (window as Window & { webkitSpeechRecognition?: LocalSpeechConstructor }).webkitSpeechRecognition;

  if (!candidate || !candidate.prototype || !("processLocally" in candidate.prototype)) return null;
  return candidate;
}

export async function inspectLocalSpeech(language: string): Promise<LocalSpeechState> {
  const Recognition = localRecognitionConstructor();
  if (!Recognition?.available) return "unsupported";
  try {
    return await Recognition.available({ langs: [language], processLocally: true });
  } catch {
    return "unavailable";
  }
}

export async function ensureLocalSpeech(language: string) {
  const Recognition = localRecognitionConstructor();
  if (!Recognition?.available) return { Recognition: null, state: "unsupported" as const };
  let state = await inspectLocalSpeech(language);
  if (state === "downloadable" && Recognition.install) {
    const installed = await Recognition.install({ langs: [language], processLocally: true });
    state = installed ? "available" : "unavailable";
  }
  return { Recognition: state === "available" ? Recognition : null, state };
}
