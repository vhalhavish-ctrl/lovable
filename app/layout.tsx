import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KAIJAOWINTER | ไข่เจียวอินเตอร์",
  description: "Retro pixel-food ordering and membership web app"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
