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
import "./parallax-background.css";
import "./job-board.css";
import "./job-comparison.css";
import "./job-board-filters.css";
import "./job-board-location.css";
import "./job-board-pagination.css";
import "./job-board-map.css";
import "./job-board-responsive.css";
import "./job-detail.css";

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
  referrer: "origin-when-cross-origin",
  category: "jobs",
  alternates: {
    canonical: siteUrl
  },
  openGraph: {
    type: "website",
    url: siteUrl,
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
