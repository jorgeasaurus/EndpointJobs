import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getLandingJsonLd, serializeJsonLd } from "../../src/app/structured-data";
import { legacyHomeBoardRedirect } from "../../src/lib/legacy-board-url";

const home = readFileSync(new URL("../../src/app/page.tsx", import.meta.url), "utf8");
const board = readFileSync(new URL("../../src/app/board/page.tsx", import.meta.url), "utf8");

test("the home page is a landing page with a privacy link and an account reason", () => {
  assert.match(home, /See the jobs/);
  assert.match(home, /href=\{getBoardPath\(\)\}/);
  assert.match(home, /href="\/privacy"/);
  assert.match(home, /Why an account/);
  assert.match(home, /jobs you save/);
  assert.match(home, /filters you choose to keep/);
  assert.match(home, /which listings you have opened/);
  assert.match(home, /An account is optional/);
  assert.match(home, /export const revalidate = 3600/);
  assert.doesNotMatch(home, /<JobBoard/);
  assert.doesNotMatch(home, /queryBoardPage/);
  assert.match(board, /<JobBoard initialPage=\{initialPage\} \/>/);
  assert.match(board, /export const revalidate = 3600/);
});

test("landing JSON-LD describes the site without embedding listings", () => {
  const serialized = serializeJsonLd(getLandingJsonLd());
  assert.match(serialized, /WebSite/);
  assert.match(serialized, /WebApplication/);
  assert.match(serialized, /endpoint engineering jobs/i);
  assert.match(serialized, /\/board\?q=/);
  assert.doesNotMatch(serialized, /ItemList/);
  assert.doesNotMatch(serialized, /CollectionPage/);
});

test("filtered home URLs redirect to the job board and plain visits stay put", () => {
  const filtered = legacyHomeBoardRedirect(new URL("https://endpointjobs.dev/?q=Intune&utm_source=share"));
  assert.equal(filtered?.pathname, "/board");
  assert.equal(filtered?.searchParams.get("q"), "Intune");
  assert.equal(filtered?.searchParams.get("utm_source"), "share");

  const paged = legacyHomeBoardRedirect(new URL("https://endpointjobs.dev/?page=2"));
  assert.equal(paged?.pathname, "/board");
  assert.equal(paged?.searchParams.get("page"), "2");

  assert.equal(legacyHomeBoardRedirect(new URL("https://endpointjobs.dev/")), null);
  assert.equal(legacyHomeBoardRedirect(new URL("https://endpointjobs.dev/?utm_source=google")), null);
  assert.equal(legacyHomeBoardRedirect(new URL("https://endpointjobs.dev/jobs?page=2")), null);
  assert.equal(legacyHomeBoardRedirect(new URL("https://endpointjobs.dev/board?q=Jamf")), null);
});
