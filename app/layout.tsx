import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LocalCue Studio",
  description: "A local-first voice-following teleprompter and video recorder.",
  metadataBase: new URL("https://localcue-studio.piyushfulper3210.chatgpt.site"),
  alternates: { canonical: "/" },
  openGraph: {
    title: "LocalCue Studio",
    description: "Read near the lens. Keep your take local.",
    images: ["https://raw.githubusercontent.com/Pin4sf/localcue-studio/main/public/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
