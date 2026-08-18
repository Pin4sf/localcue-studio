import type { Metadata } from "next";
import { LocalCueStudio } from "./LocalCueStudio";

export const metadata: Metadata = {
  title: "LocalCue Studio — local teleprompter recorder",
  description:
    "Import a script, follow it near the camera, record in your browser, and download the take without creating an account.",
};

export default function Home() {
  return <LocalCueStudio />;
}
