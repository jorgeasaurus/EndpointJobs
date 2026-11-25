import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function ruleBody(css: string, selector: string) {
  const match = css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `${selector} rule`);
  return match[1];
}

test("the shared page frame fills the viewport and keeps its side padding", () => {
  const css = readFileSync(new URL("../../src/app/job-board.css", import.meta.url), "utf8");
  const frame = ruleBody(css, String.raw`\.site-frame`);
  assert.match(frame, /width:\s*100%/);
  assert.doesNotMatch(frame, /1480px/);
  assert.match(frame, /padding:\s*18px/);
});

test("the home page alone fills a tall viewport as a column", () => {
  const home = readFileSync(new URL("../../src/app/page.tsx", import.meta.url), "utf8");
  const board = readFileSync(new URL("../../src/components/job-board.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../../src/app/landing.css", import.meta.url), "utf8");

  assert.match(home, /className="site-frame landing-frame"/);
  assert.doesNotMatch(board, /landing-frame/);
  const frame = ruleBody(css, String.raw`\.site-frame\.landing-frame`);
  assert.match(frame, /display:\s*flex/);
  assert.match(frame, /flex-direction:\s*column/);
  assert.match(frame, /min-height:\s*100dvh/);
  assert.match(css, /\.landing-frame \.landing-hero\s*\{[^}]*flex:\s*1\s*0\s*auto/);
});

test("home, board, directory, and roadmap share the full-width frame", () => {
  const sources = [
    new URL("../../src/app/page.tsx", import.meta.url),
    new URL("../../src/components/job-board.tsx", import.meta.url),
    new URL("../../src/app/jobs/page.tsx", import.meta.url),
    new URL("../../src/app/roadmap/page.tsx", import.meta.url)
  ].map((url) => readFileSync(url, "utf8"));

  assert.match(sources[0], /className="site-frame landing-frame"/);
  for (const source of sources) {
    assert.doesNotMatch(source, /job-detail-frame/);
  }
  for (const source of sources.slice(1)) {
    assert.match(source, /className="site-frame"/);
    assert.doesNotMatch(source, /landing-frame/);
  }
});

test("long-form pages keep a reading width and directory prose stays capped", () => {
  const detail = readFileSync(new URL("../../src/app/job-detail.css", import.meta.url), "utf8");
  assert.match(ruleBody(detail, String.raw`\.job-detail-frame`), /width:\s*min\(1220px,\s*100%\)/);
  assert.match(ruleBody(detail, String.raw`\.job-directory-header p`), /max-width:\s*680px/);

  const job = readFileSync(new URL("../../src/app/jobs/[id]/page.tsx", import.meta.url), "utf8");
  const privacy = readFileSync(new URL("../../src/app/privacy/page.tsx", import.meta.url), "utf8");
  assert.match(job, /job-detail-frame/);
  assert.match(privacy, /job-detail-frame/);

  const roadmap = readFileSync(new URL("../../src/app/roadmap/roadmap.css", import.meta.url), "utf8");
  assert.match(roadmap, /\.roadmap-lead,\s*\.roadmap-track p,\s*\.roadmap-level p,\s*\.roadmap-skills p\s*\{[^}]*max-width:\s*68ch/);
});
