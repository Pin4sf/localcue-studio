import { describe, expect, it } from "vitest";
import { chooseRecordingType, extensionForMime, formatForMime } from "../lib/browser-media";

describe("browser recording formats", () => {
  it("prefers MP4 when supported", () => expect(chooseRecordingType((mime) => mime === "video/mp4")).toBe("video/mp4"));
  it("labels the actual fallback", () => {
    expect(chooseRecordingType((mime) => mime === "video/webm")).toBe("video/webm");
    expect(extensionForMime("video/webm;codecs=vp8,opus")).toBe("webm");
    expect(formatForMime("video/mp4")).toBe("MP4");
  });
});
