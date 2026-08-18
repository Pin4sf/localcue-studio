"use client";

import {
  ChangeEvent,
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  chooseRecordingType,
  ensureLocalSpeech,
  extensionForMime,
  formatForMime,
  inspectLocalSpeech,
  LocalSpeechRecognition,
  LocalSpeechState,
} from "@/lib/browser-media";
import { alignTranscript, formatClock, isWordPiece, safeFileName } from "@/lib/teleprompter";

const sampleScript = `Welcome to LocalCue Studio.

Paste your own script here, or import a plain-text or Markdown file.

When you are ready, the script will sit close to your camera while you record. Your script and your raw take stay in this browser tab.`;

type Screen = "setup" | "studio" | "review";
type CueMode = "voice" | "auto" | "manual";

const speechLabels: Record<LocalSpeechState, string> = {
  checking: "Checking this browser…",
  available: "On-device speech is ready.",
  downloadable: "A language pack can be installed by your browser.",
  downloading: "Installing the language pack…",
  unavailable: "This language pack is unavailable.",
  unsupported: "On-device voice following is not supported here.",
};

export function LocalCueStudio() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [script, setScript] = useState(sampleScript);
  const [scriptName, setScriptName] = useState("Untitled script");
  const [mode, setMode] = useState<CueMode>("voice");
  const [language, setLanguage] = useState("en-US");
  const [fontSize, setFontSize] = useState(42);
  const [autoSpeed, setAutoSpeed] = useState(28);
  const [cursor, setCursor] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [speechState, setSpeechState] = useState<LocalSpeechState>("checking");
  const [voiceActive, setVoiceActive] = useState(false);
  const [status, setStatus] = useState("Camera and microphone have not been requested yet.");
  const [error, setError] = useState("");
  const [takeUrl, setTakeUrl] = useState("");
  const [takeMime, setTakeMime] = useState("");
  const [takeBytes, setTakeBytes] = useState(0);

  const fileInput = useRef<HTMLInputElement>(null);
  const cameraVideo = useRef<HTMLVideoElement>(null);
  const studioRoot = useRef<HTMLDivElement>(null);
  const promptStage = useRef<HTMLDivElement>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recognition = useRef<LocalSpeechRecognition | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceWatchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const takeUrlRef = useRef("");
  const cursorRef = useRef(0);

  const promptTokens = useMemo(() => script.split(/(\s+)/).filter(Boolean), [script]);
  const wordCount = useMemo(() => script.trim().split(/\s+/).filter(Boolean).length, [script]);
  const estimatedMinutes = Math.max(1, Math.ceil(wordCount / 125));
  const progress = promptTokens.length ? Math.min(100, (cursor / promptTokens.length) * 100) : 0;

  useEffect(() => {
    const stored = window.localStorage.getItem("localcue.current-script");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as { script?: string; name?: string };
      queueMicrotask(() => {
        if (parsed.script) setScript(parsed.script);
        if (parsed.name) setScriptName(parsed.name);
      });
    } catch {
      window.localStorage.removeItem("localcue.current-script");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "localcue.current-script",
      JSON.stringify({ script, name: scriptName }),
    );
  }, [script, scriptName]);

  useEffect(() => {
    cursorRef.current = cursor;
    const active = promptStage.current?.querySelector<HTMLElement>("[data-active='true']");
    active?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [cursor]);

  useEffect(() => {
    if (cameraVideo.current && mediaStream.current) {
      cameraVideo.current.srcObject = mediaStream.current;
    }
  }, [cameraReady, screen]);

  useEffect(() => {
    if (screen !== "studio" || mode !== "auto" || !recording) return;
    let frame = 0;
    let previous = performance.now();
    const advance = (now: number) => {
      const delta = (now - previous) / 1000;
      previous = now;
      if (promptStage.current) promptStage.current.scrollTop += autoSpeed * delta;
      frame = requestAnimationFrame(advance);
    };
    frame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frame);
  }, [autoSpeed, mode, recording, screen]);

  const stopVoiceFollowing = useCallback(() => {
    if (voiceWatchdog.current) clearTimeout(voiceWatchdog.current);
    voiceWatchdog.current = null;
    recognition.current?.abort();
    recognition.current = null;
    setVoiceActive(false);
  }, []);

  const stopCamera = useCallback(() => {
    mediaStream.current?.getTracks().forEach((track) => track.stop());
    mediaStream.current = null;
    setCameraReady(false);
  }, []);

  useEffect(() => () => {
    recognition.current?.abort();
    mediaStream.current?.getTracks().forEach((track) => track.stop());
    if (timer.current) clearInterval(timer.current);
    if (voiceWatchdog.current) clearTimeout(voiceWatchdog.current);
    if (takeUrlRef.current) URL.revokeObjectURL(takeUrlRef.current);
  }, []);

  async function importScript(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/\.(txt|md|markdown)$/i.test(file.name)) {
      setError("Choose a .txt, .md, or .markdown file.");
      return;
    }
    setScript(await file.text());
    setScriptName(file.name.replace(/\.(txt|md|markdown)$/i, ""));
    setError("");
    event.target.value = "";
  }

  function clearLocalScript() {
    setScript("");
    setScriptName("Untitled script");
    window.localStorage.removeItem("localcue.current-script");
  }

  async function checkSpeech() {
    setSpeechState("checking");
    const next = await inspectLocalSpeech(language);
    setSpeechState(next);
    if (next === "unsupported" || next === "unavailable") setMode("auto");
  }

  async function enableCamera() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error("This browser does not expose the required camera recorder APIs.");
    }
    if (mediaStream.current?.active) return mediaStream.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: "user" },
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    mediaStream.current = stream;
    setCameraReady(true);
    setStatus("Camera and microphone are ready. Nothing is recording yet.");
    return stream;
  }

  async function openStudio() {
    setError("");
    setCursor(0);
    setScreen("studio");
    await checkSpeech();
    try {
      await enableCamera();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Camera permission was not granted.");
      setStatus("Recording is unavailable until camera and microphone access is granted.");
    }
  }

  async function startVoiceFollowing() {
    setSpeechState("checking");
    const local = await ensureLocalSpeech(language);
    setSpeechState(local.state);
    if (!local.Recognition) {
      setMode("auto");
      setStatus("Voice following is unavailable here. Auto-scroll is active instead.");
      return;
    }

    stopVoiceFollowing();
    const engine = new local.Recognition();
    engine.lang = language;
    engine.continuous = true;
    engine.interimResults = true;
    engine.processLocally = true;
    engine.onresult = (event) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += `${event.results[index][0].transcript} `;
      }
      const next = alignTranscript(promptTokens, transcript, cursorRef.current);
      if (next > cursorRef.current) setCursor(next);
      if (voiceWatchdog.current) clearTimeout(voiceWatchdog.current);
      voiceWatchdog.current = setTimeout(() => {
        setStatus("Still listening locally. Pause and resume voice follow if the cue stops moving.");
      }, 18000);
    };
    engine.onerror = (event) => {
      if (event.error !== "aborted") {
        setStatus(`Local voice follow paused${event.error ? `: ${event.error}` : "."}`);
      }
    };
    engine.onend = () => {
      if (recognition.current === engine && recording) {
        try { engine.start(); } catch { setVoiceActive(false); }
      }
    };
    recognition.current = engine;
    const audioTrack = mediaStream.current?.getAudioTracks()[0];
    try {
      if (audioTrack) engine.start(audioTrack);
      else engine.start();
      setVoiceActive(true);
      setStatus("Recording. The on-device listener is following your words.");
    } catch {
      engine.start();
      setVoiceActive(true);
    }
  }

  async function startRecording() {
    setError("");
    let stream: MediaStream;
    try {
      stream = await enableCamera();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Camera access failed.");
      return;
    }

    const preferred = chooseRecordingType();
    let nextRecorder: MediaRecorder;
    try {
      nextRecorder = preferred
        ? new MediaRecorder(stream, { mimeType: preferred, videoBitsPerSecond: 5_000_000 })
        : new MediaRecorder(stream);
    } catch {
      nextRecorder = new MediaRecorder(stream);
    }

    chunks.current = [];
    nextRecorder.ondataavailable = (event) => {
      if (event.data.size) chunks.current.push(event.data);
    };
    nextRecorder.onerror = () => setError("The browser recorder reported an error. Your previous downloads are unaffected.");
    nextRecorder.onstop = () => {
      const actualMime = nextRecorder.mimeType || chunks.current[0]?.type || preferred || "video/webm";
      const blob = new Blob(chunks.current, { type: actualMime });
      if (takeUrlRef.current) URL.revokeObjectURL(takeUrlRef.current);
      const url = URL.createObjectURL(blob);
      takeUrlRef.current = url;
      setTakeUrl(url);
      setTakeMime(actualMime);
      setTakeBytes(blob.size);
      setScreen("review");
      setStatus("Take finished. Review it and download before closing this tab.");
    };
    recorder.current = nextRecorder;
    nextRecorder.start(1000);
    setElapsed(0);
    setRecording(true);
    timer.current = setInterval(() => setElapsed((value) => value + 1), 1000);
    setStatus("Recording. Your take is being held in this tab.");
    if (mode === "voice") await startVoiceFollowing();
  }

  function stopRecording() {
    if (recorder.current?.state !== "inactive") recorder.current?.stop();
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setRecording(false);
    stopVoiceFollowing();
    stopCamera();
  }

  function nudge(direction: number) {
    setCursor((value) => Math.max(0, Math.min(promptTokens.length - 1, value + direction)));
  }

  function exitStudio() {
    if (recording) stopRecording();
    else stopCamera();
    stopVoiceFollowing();
    setScreen("setup");
  }

  function discardTake(next: Screen = "studio") {
    if (takeUrlRef.current) URL.revokeObjectURL(takeUrlRef.current);
    takeUrlRef.current = "";
    setTakeUrl("");
    setTakeMime("");
    setTakeBytes(0);
    setElapsed(0);
    setCursor(0);
    setScreen(next);
    if (next === "studio") {
      void enableCamera().catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Camera access failed.");
      });
    }
  }

  if (screen === "review") {
    const extension = extensionForMime(takeMime);
    return (
      <main className="review-shell">
        <header className="review-header">
          <div><p className="step-label">03 / REVIEW</p><h1>Your take is still local.</h1></div>
          <span className="local-badge"><i /> Not uploaded</span>
        </header>
        <section className="review-grid">
          {/* User-generated raw takes do not have a caption track yet. */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video className="take-player" src={takeUrl} controls playsInline />
          <aside className="take-panel">
            <p className="take-kicker">FINISHED TAKE</p>
            <h2>{scriptName}</h2>
            <dl>
              <div><dt>Duration</dt><dd>{formatClock(elapsed)}</dd></div>
              <div><dt>Format</dt><dd>{formatForMime(takeMime)}</dd></div>
              <div><dt>Size</dt><dd>{(takeBytes / 1_048_576).toFixed(1)} MB</dd></div>
            </dl>
            <a className="download-button" href={takeUrl} download={`${safeFileName(scriptName)}.${extension}`}>
              Download {formatForMime(takeMime)} <span>↓</span>
            </a>
            <p className="tab-warning">Download before closing or refreshing this tab. LocalCue does not keep a server copy.</p>
            <div className="review-actions">
              <button type="button" className="secondary" onClick={() => discardTake("studio")}>Record again</button>
              <button type="button" className="text-button danger" onClick={() => discardTake("setup")}>Discard take</button>
            </div>
          </aside>
        </section>
      </main>
    );
  }

  if (screen === "studio") {
    return (
      <div className="studio" ref={studioRoot}>
        <div className="studio-topline">
          <button type="button" className="studio-wordmark" onClick={exitStudio}>LC <span>LocalCue</span></button>
          <div className={`record-state ${recording ? "is-live" : ""}`}><i /> {recording ? formatClock(elapsed) : "Ready"}</div>
          <button type="button" className="fullscreen-button" onClick={() => studioRoot.current?.requestFullscreen()}>Full screen</button>
        </div>

        <div className="camera-dock" aria-label="Camera preview">
          <video ref={cameraVideo} autoPlay muted playsInline />
          {!cameraReady ? <button type="button" onClick={() => void enableCamera()}>Enable camera</button> : null}
          <span>Camera preview</span>
        </div>
        <div className="eye-guide" aria-hidden="true"><i /> Read here, near the lens</div>

        <div className="prompt-stage" ref={promptStage} style={{ "--prompt-size": `${fontSize}px` } as CSSProperties}>
          <div className="prompt-copy">
            {promptTokens.map((token, index) => (
              <span
                key={`${index}-${token}`}
                className={isWordPiece(token) ? (index < cursor ? "spoken" : index === cursor ? "active" : "") : "spacing"}
                data-active={index === cursor ? "true" : undefined}
              >{token}</span>
            ))}
            <span className="prompt-end">End of script</span>
          </div>
        </div>

        <div className="studio-shade" aria-hidden="true" />
        <div className="progress-rail" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>

        <aside className="studio-controls">
          <div className="mode-tabs" aria-label="Teleprompter mode">
            {(["voice", "auto", "manual"] as CueMode[]).map((choice) => (
              <button
                key={choice}
                type="button"
                className={mode === choice ? "selected" : ""}
                onClick={() => { stopVoiceFollowing(); setMode(choice); }}
              >{choice === "voice" ? "Voice follow" : choice === "auto" ? "Auto-scroll" : "Manual"}</button>
            ))}
          </div>
          <div className="cue-settings">
            <label>Text <input type="range" min="28" max="64" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} /></label>
            {mode === "auto" ? <label>Speed <input type="range" min="8" max="80" value={autoSpeed} onChange={(event) => setAutoSpeed(Number(event.target.value))} /></label> : null}
            {mode === "voice" ? (
              <label>Language
                <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                  <option value="en-US">English (US)</option><option value="en-GB">English (UK)</option><option value="en-IN">English (India)</option>
                </select>
              </label>
            ) : null}
            <button type="button" className="nudge" onClick={() => nudge(-8)} aria-label="Move prompt backward">↑</button>
            <button type="button" className="nudge" onClick={() => nudge(8)} aria-label="Move prompt forward">↓</button>
          </div>
          <div className="record-actions">
            {recording ? (
              <button type="button" className="stop-button" onClick={stopRecording}><i /> Stop &amp; review</button>
            ) : (
              <button type="button" className="record-button" onClick={() => void startRecording()}><i /> Start recording</button>
            )}
          </div>
          <div className="studio-status">
            <p>{status}</p>
            {mode === "voice" ? <p className="speech-detail">{voiceActive ? "On-device listener active." : speechLabels[speechState]} No cloud speech fallback is used.</p> : null}
            {error ? <p className="studio-error" role="alert">{error}</p> : null}
          </div>
        </aside>
      </div>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="LocalCue Studio home"><span className="brand-mark" aria-hidden="true">LC</span><span>LocalCue Studio</span></a>
        <div className="topbar-actions"><span className="local-badge"><i /> Local by default</span><a href="https://github.com/Pin4sf/localcue-studio">GitHub</a></div>
      </header>
      <section className="hero" id="top">
        <p className="eyebrow">OPEN-SOURCE TELEPROMPTER RECORDER</p>
        <h1>Read near the lens.<br />Keep your natural flow.</h1>
        <p className="lede">Bring a script, record with your camera and microphone, review the take, and download it—without creating an account.</p>
      </section>
      <section className="workspace" aria-labelledby="script-heading">
        <div className="workspace-heading">
          <div><p className="step-label">01 / SCRIPT</p><h2 id="script-heading">What are you recording?</h2></div>
          <div className="setup-actions"><button className="text-button" type="button" onClick={clearLocalScript}>Clear local draft</button><button className="secondary" type="button" onClick={() => fileInput.current?.click()}>Import .txt or .md</button></div>
          <input ref={fileInput} type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" onChange={importScript} hidden />
        </div>
        <label className="script-title"><span>Script name</span><input value={scriptName} onChange={(event) => setScriptName(event.target.value)} /></label>
        <textarea className="script-editor" aria-label="Teleprompter script" value={script} onChange={(event) => setScript(event.target.value)} spellCheck="true" />
        {error ? <p className="error" role="alert">{error}</p> : null}
        <div className="editor-footer"><p><strong>{wordCount}</strong> words · about <strong>{estimatedMinutes} min</strong> at 125 wpm</p><button className="primary" type="button" disabled={!script.trim()} onClick={() => void openStudio()}>Open recording studio <span aria-hidden="true">→</span></button></div>
      </section>
      <section className="trust-strip" aria-label="How LocalCue works">
        <article><span>01</span><h3>Your script</h3><p>Paste or import. Your current draft is kept in this browser.</p></article>
        <article><span>02</span><h3>Your pace</h3><p>Use enforced on-device voice follow, auto-scroll, or manual control.</p></article>
        <article><span>03</span><h3>Your take</h3><p>Record, review, download, or discard it locally.</p></article>
      </section>
      <aside className="capability-note"><strong>Truthful browser support.</strong> Enforced on-device voice following requires a compatible desktop Chrome or Edge language pack. Other browsers can still record with auto-scroll or manual mode. Recording format is selected by your browser and shown before download.</aside>
    </main>
  );
}
