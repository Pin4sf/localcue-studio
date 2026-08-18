import { describe, expect, it } from "vitest";
import { alignTranscript, formatClock, safeFileName, tokenize } from "../lib/teleprompter";

describe("teleprompter alignment", () => {
  it("advances through an exact spoken phrase", () => {
    const tokens = "The quick brown fox jumps over the fence".split(/(\s+)/).filter(Boolean);
    expect(alignTranscript(tokens, "quick brown fox jumps", 0)).toBeGreaterThan(4);
  });
  it("does not move for unrelated speech", () => {
    const tokens = "The quick brown fox jumps over the fence".split(/(\s+)/).filter(Boolean);
    expect(alignTranscript(tokens, "weather balloon algebra", 0)).toBe(0);
  });
  it("handles punctuation and unicode words", () => {
    expect(tokenize("Élan, local-first!")).toEqual(["Élan", ",", "local-first", "!"]);
  });
});

describe("download helpers", () => {
  it("creates a safe useful filename", () => expect(safeFileName(" My AIAF Video! ")).toBe("my-aiaf-video"));
  it("formats recording time", () => expect(formatClock(125)).toBe("2:05"));
});
