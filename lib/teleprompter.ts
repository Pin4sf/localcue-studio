export function tokenize(input: string) {
  return input.match(/\p{L}[\p{L}\p{M}\p{N}'’-]*|\p{N}+|[^\s]/gu) ?? [];
}

function normalize(input: string) {
  return input
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function isWordPiece(input: string) {
  return /[\p{L}\p{N}]/u.test(input);
}

export function alignTranscript(
  tokens: string[],
  transcript: string,
  startAt: number,
  lookAhead = 90,
) {
  const spoken = tokenize(transcript).map(normalize).filter(Boolean);
  if (!spoken.length) return startAt;

  const end = Math.min(tokens.length, startAt + lookAhead);
  let best = { score: 0, cursor: startAt };

  for (let candidate = Math.max(0, startAt - 5); candidate < end; candidate += 1) {
    let scriptIndex = candidate;
    let spokenIndex = 0;
    let score = 0;

    while (scriptIndex < end && spokenIndex < spoken.length) {
      const scriptWord = normalize(tokens[scriptIndex]);
      if (!scriptWord) {
        scriptIndex += 1;
        continue;
      }

      const spokenWord = spoken[spokenIndex];
      if (
        scriptWord === spokenWord ||
        (scriptWord.length > 4 && spokenWord.length > 4 &&
          (scriptWord.startsWith(spokenWord) || spokenWord.startsWith(scriptWord)))
      ) {
        score += 2;
        spokenIndex += 1;
      } else if (spoken.slice(spokenIndex + 1, spokenIndex + 3).includes(scriptWord)) {
        score += 1;
        spokenIndex += spoken.slice(spokenIndex + 1, spokenIndex + 3).indexOf(scriptWord) + 2;
      } else {
        score -= 0.2;
      }
      scriptIndex += 1;
    }

    const coverage = spokenIndex / spoken.length;
    const finalScore = score * coverage - Math.abs(candidate - startAt) * 0.025;
    if (finalScore > best.score && coverage >= 0.35) {
      best = { score: finalScore, cursor: scriptIndex };
    }
  }

  return best.score >= 1.5 ? Math.max(startAt, best.cursor) : startAt;
}

export function safeFileName(input: string) {
  const result = input
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return result || "localcue-take";
}

export function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.max(0, Math.floor(totalSeconds % 60));
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
