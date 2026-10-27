import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const homeHtmlByteBudget = 100_000;

export const prerenderedHomeHtmlPath = fileURLToPath(
  new URL("../../.next/server/app/index.html", import.meta.url)
);

export function assertPrerenderedHomeHtml(html: Buffer) {
  assert.ok(
    html.byteLength < homeHtmlByteBudget,
    `prerendered / is ${html.byteLength} bytes`
  );
  assert.match(html.toString("utf8"), /Remote or hybrid/);
}

const isDirectRun = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const html = readFileSync(prerenderedHomeHtmlPath);
  assertPrerenderedHomeHtml(html);
  console.log(`prerendered / is ${html.byteLength} bytes`);
}
