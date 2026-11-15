import assert from "node:assert/strict";
import test from "node:test";

import { boardUsesInitialPage } from "../../src/components/job-board/use-board-results";
import { isKnownCrawler } from "../../src/lib/known-crawler";

const googleOther =
  "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.122 Mobile Safari/537.36 (compatible; GoogleOther)";
const chrome =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const headlessChrome =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36";

test("known crawlers match GoogleOther and other named bots", () => {
  assert.equal(isKnownCrawler(googleOther), true);
  assert.equal(isKnownCrawler("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), true);
  assert.equal(isKnownCrawler("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"), true);
  assert.equal(isKnownCrawler(chrome), false);
  assert.equal(isKnownCrawler(headlessChrome), false);
  assert.equal(isKnownCrawler(""), false);
});

test("crawlers keep the server-rendered board instead of calling /api/board", () => {
  assert.equal(boardUsesInitialPage(true, chrome), true);
  assert.equal(boardUsesInitialPage(false, chrome), false);
  assert.equal(boardUsesInitialPage(false, googleOther), true);
  assert.equal(boardUsesInitialPage(false, headlessChrome), false);
});
