import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const href = 'href="/board#open-roles"';

test("job and API links target the open-roles anchor on the board", () => {
  const jobPage = readFileSync(new URL("../../src/app/jobs/[id]/page.tsx", import.meta.url), "utf8");
  const apiDocs = readFileSync(new URL("../../src/app/api-docs/page.tsx", import.meta.url), "utf8");
  assert.equal(jobPage.includes('href="/#open-roles"'), false);
  assert.equal(apiDocs.includes('href="/#open-roles"'), false);
  assert.equal((jobPage.match(/href="\/board#open-roles"/g) ?? []).length, 2);
  assert.equal(apiDocs.includes(href), true);
});
