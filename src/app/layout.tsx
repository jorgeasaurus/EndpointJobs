import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";

import {
  ogImage,
  siteDescription,
  siteKeywords,
  siteName,
  siteTitle,
  siteUrl
} from "./site-metadata";

import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "slot-text/style.css";
import "./parallax-background.css";
import "./job-board.css";
import "./job-board-filters.css";
import "./job-board-location.css";
import "./job-board-pagination.css";
import "./job-board-map.css";
import "./job-board-responsive.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: {
    default: siteTitle,
    template: `%s | ${siteName}`
  },
  description: siteDescription,
  keywords: siteKeywords,
  authors: [{ name: "Jorgeasaurus", url: "https://github.com/jorgeasaurus" }],
  creator: "Jorgeasaurus",
  publisher: "Jorgeasaurus",
  category: "jobs",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName,
    title: siteTitle,
    description: siteDescription,
    locale: "en_US",
    images: [ogImage]
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [ogImage.url]
  }
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
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
