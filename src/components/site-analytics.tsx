"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

import { isKnownCrawler } from "@/lib/known-crawler";

function dropCrawlerEvents(event: BeforeSendEvent) {
  if (isKnownCrawler(navigator.userAgent)) return null;
  return event;
}

export function SiteAnalytics() {
  return <Analytics beforeSend={dropCrawlerEvents} />;
}
