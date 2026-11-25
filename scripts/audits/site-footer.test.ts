import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { getApiDocsPath, getJobsDirectoryPath, getRoadmapPath } from "../../src/app/site-metadata";
import { SiteFooter } from "../../src/components/job-board/site-footer";

const footer = renderToStaticMarkup(createElement(SiteFooter, { updatedAt: "2026-10-27T00:00:00.000Z" }));

/** The opening tag of the footer link with this visible text. */
function linkTag(text: string) {
  const tag = footer.match(new RegExp(`<a [^>]*>${text}</a>`))?.[0];
  assert.ok(tag, `the footer has no "${text}" link`);
  return tag;
}

test("the footer groups its links under labelled Browse and Project lists", () => {
  for (const [id, label] of [["browse", "Browse"], ["project", "Project"]]) {
    assert.match(footer, new RegExp(`id="footer-group-${id}">${label}<`));
    assert.match(footer, new RegExp(`<ul class="footer-link-list" aria-labelledby="footer-group-${id}">`));
  }
  assert.doesNotMatch(footer, /Popular endpoint job searches/);
});

test("the footer links the directory, API docs, and roadmap once each", () => {
  assert.match(linkTag("Job directory"), new RegExp(`href="${getJobsDirectoryPath()}"`));
  assert.match(linkTag("API docs"), new RegExp(`href="${getApiDocsPath()}"`));
  assert.equal(footer.split(`href="${getRoadmapPath()}"`).length - 1, 1);
});

test("the footer project links open PowerShell docs, issues, and support in a new tab", () => {
  const powershell = linkTag("PowerShell");
  assert.match(powershell, /href="https:\/\/github\.com\/jorgeasaurus\/EndpointJobs\/blob\/main\/powershell\/EndpointJobs\/README\.md"/);
  assert.match(powershell, /aria-label="Open PowerShell module documentation on GitHub"/);
  assert.match(linkTag("Report / request"), /href="https:\/\/github\.com\/jorgeasaurus\/EndpointJobs\/issues\/new\?template=report-or-request\.yml"/);
  assert.match(linkTag("Support the board"), /href="https:\/\/buymeacoffee\.com\/jorgeasaurus"/);
  for (const text of ["PowerShell", "Report / request", "Support the board"]) {
    assert.match(linkTag(text), /rel="noopener noreferrer"/);
    assert.match(linkTag(text), /target="_blank"/);
  }
});
