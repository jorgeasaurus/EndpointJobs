import type { Metadata, Viewport } from "next";

import "./globals.css";
import "./job-board.css";
import "./job-board-responsive.css";

export const metadata: Metadata = {
  title: "Endpoint Jobs",
  description:
    "A focused job board for Endpoint Engineering, macOS, Windows, MDM, UEM, and client platform roles."
};

export const viewport: Viewport = {
  themeColor: "#000000"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
