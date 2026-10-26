import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { classifyPostingUrlGroups, companiesShareEmployer, postingCollisionWarning, quarantinePostingUrlCollisions } from "./posting-url-collisions";
import { makeJob } from "./shared";

test("short company names still count as the same employer", () => {
  assert.equal(companiesShareEmployer("IBM", "IBM Corp"), true);
  assert.equal(companiesShareEmployer("HP", "HP Inc"), true);
  assert.equal(companiesShareEmployer("Harvey", "Harvey AI"), true);
  assert.equal(companiesShareEmployer("Acme", "Acme Corporation"), true);
  assert.equal(companiesShareEmployer("Cisco", "Cisco Systems"), true);
  assert.equal(companiesShareEmployer("Accenture", "Bloomberg"), false);
  assert.equal(companiesShareEmployer("A", "A Corp"), false);
});

test("shared generic company words are not the same employer", () => {
  assert.equal(companiesShareEmployer("Acme Corp", "IBM Corp"), false);
  assert.equal(companiesShareEmployer("Cisco Systems", "Insight Global Systems"), false);
  assert.equal(companiesShareEmployer("Robert Half Technology", "Apex Technology"), false);
  assert.equal(companiesShareEmployer("Global Alliant", "Global Payments"), false);
  assert.equal(companiesShareEmployer("Robert Half Technology", "Robert Bosch Technology"), false);
  assert.equal(companiesShareEmployer("Systems Inc", "Global Systems"), false);
});

test("the same posting url reports title aliases and flags distinct employers", () => {
  const ibm = makeJob({
    id: "ibm",
    company: "IBM",
    title: "Sr. Systems Engineer",
    applyUrl: "https://jobs.example.com/req/1?utm_source=board",
    sourceUrl: "https://example.com/ibm"
  });
  const ibmCorp = makeJob({
    id: "ibm-corp",
    company: "IBM Corp",
    title: "Senior Systems Engineer",
    applyUrl: "https://jobs.example.com/req/1",
    sourceUrl: "https://example.com/ibm-corp"
  });
  const accenture = makeJob({
    id: "accenture",
    company: "Accenture",
    title: "Endpoint Engineer",
    applyUrl: "https://www.indeed.com/viewjob?utm_source=google",
    sourceUrl: "https://example.com/accenture"
  });
  const bloomberg = makeJob({
    id: "bloomberg",
    company: "Bloomberg",
    title: "Endpoint Engineer",
    applyUrl: "https://www.indeed.com/viewjob",
    sourceUrl: "https://example.com/bloomberg"
  });
  const separate = makeJob({
    id: "separate",
    company: "Global Alliant",
    title: "Endpoint Engineer",
    applyUrl: "https://www.indeed.com/viewjob?jk=separate",
    sourceUrl: "https://example.com/separate"
  });

  const report = classifyPostingUrlGroups([ibm, ibmCorp, accenture, bloomberg, separate]);
  assert.deepEqual(report.aliases.map((group) => group.key), ["jobs.example.com/req/1"]);
  assert.deepEqual(report.aliases[0]?.titles, ["Sr. Systems Engineer", "Senior Systems Engineer"]);
  assert.deepEqual(report.collisions.map((group) => group.key), ["www.indeed.com/viewjob"]);
  assert.deepEqual(report.collisions[0]?.companies, ["Accenture", "Bloomberg"]);
  assert.deepEqual(report.droppedIds, ["accenture", "bloomberg"]);
});

test("a collision drops every listing on that url and leaves aliases in the feed", async () => {
  const directory = await mkdtemp(join(tmpdir(), "posting-urls-"));
  const path = join(directory, "jobs.json");
  const summary = join(directory, "summary.md");
  const stranger = makeJob({
    id: "stranger",
    company: "Accenture",
    title: "Endpoint Engineer",
    applyUrl: "https://jobs.example.com/req/1",
    sourceUrl: "https://example.com/stranger"
  });
  const harvey = makeJob({
    id: "harvey",
    company: "Harvey",
    title: "Staff Engineer",
    applyUrl: "https://jobs.ashbyhq.com/harvey/1/application",
    sourceUrl: "https://example.com/harvey"
  });
  const harveyAi = makeJob({
    id: "harvey-ai",
    company: "Harvey AI",
    title: "Staff Engineer",
    applyUrl: "https://jobs.ashbyhq.com/harvey/1/application?utm_source=board",
    sourceUrl: "https://example.com/harvey-ai"
  });
  const feed = {
    updatedAt: "2026-10-26T00:00:00.000Z",
    source: { name: "Fixture", url: "https://example.com" },
    jobs: [ibmJob(), ibmCorpJob(), stranger, harvey, harveyAi]
  };
  await writeFile(path, `${JSON.stringify(feed, null, 2)}\n`);
  process.env.GITHUB_STEP_SUMMARY = summary;
  let report;
  try {
    report = await quarantinePostingUrlCollisions(path);
  } finally {
    delete process.env.GITHUB_STEP_SUMMARY;
  }

  assert.deepEqual(report.droppedIds, ["ibm", "ibm-corp", "stranger"]);
  assert.match(postingCollisionWarning(report.collisions[0]!), /Dropped 3 listings sharing jobs\.example\.com\/req\/1/);
  const written = JSON.parse(await readFile(path, "utf8")) as { jobs: { id: string }[] };
  assert.deepEqual(written.jobs.map((job) => job.id), ["harvey", "harvey-ai"]);
  assert.match(await readFile(summary, "utf8"), /Dropped 3 listings sharing jobs\.example\.com\/req\/1/);
});

test("a feed without collisions is not rewritten", async () => {
  const directory = await mkdtemp(join(tmpdir(), "posting-urls-"));
  const path = join(directory, "jobs.json");
  const feed = {
    updatedAt: "2026-10-26T00:00:00.000Z",
    source: { name: "Fixture", url: "https://example.com" },
    jobs: [ibmJob(), ibmCorpJob()]
  };
  const original = `${JSON.stringify(feed, null, 2)}\n`;
  await writeFile(path, original);
  const report = await quarantinePostingUrlCollisions(path);
  assert.deepEqual(report.droppedIds, []);
  assert.equal(await readFile(path, "utf8"), original);
});

function ibmJob() {
  return makeJob({
    id: "ibm",
    company: "IBM",
    title: "Sr. Systems Engineer",
    applyUrl: "https://jobs.example.com/req/1?utm_source=board",
    sourceUrl: "https://example.com/ibm"
  });
}

function ibmCorpJob() {
  return makeJob({
    id: "ibm-corp",
    company: "IBM Corp",
    title: "Senior Systems Engineer",
    applyUrl: "https://jobs.example.com/req/1",
    sourceUrl: "https://example.com/ibm-corp"
  });
}
