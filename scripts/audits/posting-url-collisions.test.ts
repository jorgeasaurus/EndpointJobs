import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  classifyPostingUrlGroups,
  collisionAuditExitCode,
  collisionDropBlockedMessage,
  collisionDropLimit,
  companiesShareEmployer,
  postingCollisionWarning,
  quarantinePostingUrlCollisions
} from "./posting-url-collisions";
import { makeJob } from "./shared";

test("short company names still count as the same employer", () => {
  assert.equal(companiesShareEmployer("IBM", "IBM Corp"), true);
  assert.equal(companiesShareEmployer("HP", "HP Inc"), true);
  assert.equal(companiesShareEmployer("Harvey", "Harvey AI"), true);
  assert.equal(companiesShareEmployer("Acme", "Acme Corporation"), true);
  assert.equal(companiesShareEmployer("Cisco", "Cisco Systems"), true);
  assert.equal(companiesShareEmployer("The Home Depot", "Home Depot"), true);
  assert.equal(companiesShareEmployer("Global Systems", "Global Systems Inc"), true);
  assert.equal(companiesShareEmployer("Technology Solutions", "Technology Solutions LLC"), true);
  assert.equal(companiesShareEmployer("Accenture", "Bloomberg"), false);
  assert.equal(companiesShareEmployer("A", "A Corp"), false);
});

test("punctuation, connectors, and abbreviations stay the same employer", () => {
  assert.equal(companiesShareEmployer("Hewlett-Packard", "Hewlett Packard"), true);
  assert.equal(companiesShareEmployer("O'Reilly", "OReilly"), true);
  assert.equal(companiesShareEmployer("Procter & Gamble", "Procter and Gamble"), true);
  assert.equal(companiesShareEmployer("AT&T", "AT and T"), true);
  assert.equal(companiesShareEmployer("Nestlé", "Nestle"), true);
  assert.equal(companiesShareEmployer("Société Générale", "Societe Generale"), true);
  assert.equal(companiesShareEmployer("Harvey", "Harvey Labs"), true);
  assert.equal(companiesShareEmployer("Harvey", "Harvey AI"), true);
  assert.equal(companiesShareEmployer("IBM Intl", "IBM International"), true);
  assert.equal(companiesShareEmployer("IBM Int'l", "IBM International"), true);
  assert.equal(companiesShareEmployer("Acme Inc", "Acme Incorporated"), true);
  assert.equal(companiesShareEmployer("The Global Systems", "Global Systems Inc"), true);
  assert.equal(companiesShareEmployer("The Global Group", "Global Group"), true);
  assert.equal(companiesShareEmployer("The Global Group", "Global Group Inc"), true);
  assert.equal(companiesShareEmployer("TEKsystems", "TEK Systems"), true);
  assert.equal(companiesShareEmployer("ServiceNow", "Service Now"), true);
});

test("shared generic company words are not the same employer", () => {
  assert.equal(companiesShareEmployer("Acme Corp", "IBM Corp"), false);
  assert.equal(companiesShareEmployer("Cisco Systems", "Insight Global Systems"), false);
  assert.equal(companiesShareEmployer("Robert Half Technology", "Apex Technology"), false);
  assert.equal(companiesShareEmployer("Global Alliant", "Global Payments"), false);
  assert.equal(companiesShareEmployer("Robert Half Technology", "Robert Bosch Technology"), false);
  assert.equal(companiesShareEmployer("Systems Inc", "Global Systems"), false);
  assert.equal(companiesShareEmployer("Global", "Global Payments"), false);
  assert.equal(companiesShareEmployer("The Group", "Group One"), false);
  assert.equal(companiesShareEmployer("Technology Solutions", "Technology Solutions Partners"), false);
  assert.equal(companiesShareEmployer("The Global Group", "The Group"), false);
  assert.equal(companiesShareEmployer("The Global Group", "Global"), false);
  assert.equal(companiesShareEmployer("The Global Group", "Group One"), false);
  assert.equal(companiesShareEmployer("TEKsystems", "Tek"), false);
  assert.equal(companiesShareEmployer("ServiceNow", "Service"), false);
  assert.equal(companiesShareEmployer("Now Service", "ServiceNow"), false);
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
    jobs: [ibmJob(), ibmCorpJob(), stranger, harvey, harveyAi, ...fillerJobs(55, "pad")]
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
  assert.deepEqual(written.jobs.map((job) => job.id), ["harvey", "harvey-ai", ...fillerJobs(55, "pad").map((job) => job.id)]);
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
  assert.equal(report.blocked, false);
  assert.equal(collisionAuditExitCode(report.blocked), 0);
  assert.equal(await readFile(path, "utf8"), original);
});

test("a drop at the ceiling still removes the listings", async () => {
  assert.equal(collisionDropLimit(200), 5);
  const written = await quarantineFixture(200, 5);
  assert.equal(written.blocked, false);
  assert.equal(collisionAuditExitCode(written.blocked), 0);
  assert.equal(written.jobs.length, 195);
});

test("a drop over the ceiling keeps every listing and fails the audit", async () => {
  assert.equal(collisionDropLimit(200), 5);
  assert.equal(collisionDropLimit(40), 2);
  const overCount = await quarantineFixture(200, 6);
  assert.equal(overCount.blocked, true);
  assert.equal(collisionAuditExitCode(overCount.blocked), 1);
  assert.equal(overCount.jobs.length, 200);
  assert.match(overCount.summary, /Refused to drop 6 listings \(limit 5 of 200\)/);
  assert.match(collisionDropBlockedMessage({ ...overCount.report, blocked: true }, 200), /canonical posting URL regression/);

  const overPercent = await quarantineFixture(40, 3);
  assert.equal(overPercent.blocked, true);
  assert.equal(overPercent.jobs.length, 40);
  const underPercent = await quarantineFixture(40, 2);
  assert.equal(underPercent.blocked, false);
  assert.equal(underPercent.jobs.length, 38);
});

async function quarantineFixture(total: number, collisionCount: number) {
  const directory = await mkdtemp(join(tmpdir(), "posting-urls-"));
  const path = join(directory, "jobs.json");
  const summary = join(directory, "summary.md");
  const feed = {
    updatedAt: "2026-10-26T00:00:00.000Z",
    source: { name: "Fixture", url: "https://example.com" },
    jobs: [
      ...Array.from({ length: collisionCount }, (_, index) => makeJob({
        id: `collision-${index}`,
        company: `Brand${index} Holdings`,
        title: "Endpoint Engineer",
        applyUrl: "https://jobs.example.com/shared",
        sourceUrl: `https://example.com/collision-${index}`
      })),
      ...fillerJobs(total - collisionCount, "solo")
    ]
  };
  const original = `${JSON.stringify(feed, null, 2)}\n`;
  await writeFile(path, original);
  process.env.GITHUB_STEP_SUMMARY = summary;
  let report;
  try {
    report = await quarantinePostingUrlCollisions(path);
  } finally {
    delete process.env.GITHUB_STEP_SUMMARY;
  }
  const jobs = JSON.parse(await readFile(path, "utf8")) as { jobs: { id: string }[] };
  return {
    blocked: report.blocked,
    jobs: jobs.jobs,
    report,
    summary: report.blocked ? await readFile(summary, "utf8") : ""
  };
}

function fillerJobs(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => makeJob({
    id: `${prefix}-${index}`,
    company: `Solo ${prefix} ${index}`,
    title: "Endpoint Engineer",
    applyUrl: `https://jobs.example.com/${prefix}/${index}`,
    sourceUrl: `https://example.com/${prefix}-${index}`
  }));
}

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
