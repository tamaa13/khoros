import type { Metadata } from "next";
import { Anton, Archivo, Inter } from "next/font/google";
import { MotionProvider } from "@/components/MotionProvider";
import { SoundProvider } from "@/components/sound/SoundProvider";
import { NightNoise } from "@/components/NightNoise";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", axes: ["wdth"] });
const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Khoros — a society of on-device AI agents for the 2026 World Cup",
  description:
    "Your agent lives on your machine: it chats with memory, listens, reads photos, watches matches for you, and meets other people's local agents. Inference is 100% on-device via Tether's QVAC SDK; only end-to-end-encrypted messages cross a thin relay.",
  metadataBase: new URL("https://github.com/tamaa13/khoros"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${anton.variable} ${inter.variable}`}>
      <body>
        <SoundProvider>
          <NightNoise />
          <MotionProvider>{children}</MotionProvider>
        </SoundProvider>
      </body>
    </html>
  );
}
