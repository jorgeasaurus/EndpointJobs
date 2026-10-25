import assert from "node:assert/strict";
import test from "node:test";

import feedData from "../../src/data/jobs.json";
import { getCurrencySymbol } from "../../src/lib/currency";
import { repairJobDescription, toDescriptionBlocks } from "../../src/lib/job-description";
import { dedupeJobs, listingLanguage, presentSalary } from "../../src/lib/job-trust";
import { getJobDescriptionBlocks, getJobFreshnessLabel, isPostedDateKnown } from "../../src/lib/jobs";
import { getEmptyResultsMessage } from "../../src/components/job-board/empty-results-message";
import { initialFilterState } from "../../src/components/job-board/filter-model";
import { makeJob } from "./shared";
import type { JobsFeed } from "../../src/types/job";

const feed = feedData as JobsFeed;
const blueLightId = "serpapi-blue-light-it-llc-boca-raton-fl-endpoint-engineer-microsoft-365-intune-endpoint-security-76281fc12b";

test("job descriptions keep paragraphs and lists and drop placeholder text", () => {
  const job = feed.jobs.find((candidate) => candidate.id === blueLightId);
  assert.ok(job);
  const blocks = getJobDescriptionBlocks(job);
  const text = blocks.flatMap((block) => block.type === "paragraph" ? [block.text] : block.items).join("\n");
  const lists = blocks.filter((block) => block.type === "list");

  assert.ok(lists.length >= 2, "expected responsibility and qualification lists");
  assert.match(text, /Manage and troubleshoot endpoints in Microsoft Intune/);
  assert.match(text, /Bonus points/);
  assert.match(text, /What it's like here/);
  assert.doesNotMatch(text, /taskBonus|MDMHands|applicationsManage|〔|〕/);
  assert.equal(text.includes("<script"), false);

  const hostile = repairJobDescription("<script>alert(1)</script><p>Visible role</p><ul><li>Deploy Intune</li><li>Review compliance</li></ul>〔placeholder〕<img src=x onerror=alert(1)>");
  assert.equal(hostile.includes("alert(1)"), false);
  assert.equal(hostile.includes("onerror"), false);
  assert.match(hostile, /Visible role/);
  assert.match(hostile, /Deploy Intune/);
  const hostileBlocks = toDescriptionBlocks(hostile);
  assert.ok(hostileBlocks.some((block) => block.type === "list" && block.items.includes("Deploy Intune")));
});

test("duplicate company and title listings collapse to one card", () => {
  const first = makeJob({
    id: "b-cardinal",
    company: "Cardinal Health",
    title: "Senior Analyst, IT Client Services",
    location: "Overland Park, KS",
    postedAt: "2026-10-25T11:24:56.320Z",
    fetchedAt: "2026-10-25T11:24:56.320Z"
  });
  const second = makeJob({
    id: "a-cardinal",
    company: "cardinal health",
    title: "Senior Analyst, IT Client Services!",
    location: "Champlin, MN",
    description: `${"Endpoint operations ".repeat(40)}`,
    postedAt: "2026-10-25T11:24:56.320Z",
    fetchedAt: "2026-10-25T11:24:56.320Z"
  });
  const unique = dedupeJobs([first, second, makeJob({ id: "other", title: "Other role", company: "Other Co" })]);
  assert.deepEqual(unique.map((job) => job.id), ["a-cardinal", "other"]);
});

test("missing source dates are unknown and real dates stay", () => {
  const unknown = makeJob({
    postedAt: "2026-10-25T11:24:56.320Z",
    fetchedAt: "2026-10-25T11:24:56.320Z",
    tags: ["Full-time"]
  });
  const known = makeJob({
    postedAt: "2026-10-22T00:00:00.000Z",
    fetchedAt: "2026-10-25T11:24:56.320Z",
    tags: ["3 days ago"]
  });
  const today = makeJob({
    postedAt: "2026-10-25T11:24:56.320Z",
    fetchedAt: "2026-10-25T11:24:56.320Z",
    tags: ["12 hours ago"]
  });

  assert.equal(isPostedDateKnown(unknown), false);
  assert.equal(getJobFreshnessLabel(unknown), "Date unknown");
  assert.equal(isPostedDateKnown(known), true);
  assert.equal(isPostedDateKnown(today), true);
  assert.equal(getJobFreshnessLabel(today), "Posted today");
});

test("salary labels follow the source or location currency", () => {
  const madrid = presentSalary({
    location: "Madrid, Comunidad de Madrid",
    salary: { min: 90000, max: 130000, currency: "USD", label: "$90k-$130k" }
  });
  assert.equal(madrid?.currency, "EUR");
  assert.equal(madrid?.label, "€90k-€130k");
  assert.equal(getCurrencySymbol("EUR"), "€");

  const seattle = presentSalary({
    location: "Seattle, WA",
    salary: { min: 120000, max: 150000, currency: "USD", label: "$120k-$150k" }
  });
  assert.equal(seattle?.label, "$120k-$150k");
});

test("non-English listings are labeled and English listings are not", () => {
  assert.equal(listingLanguage({
    title: "Arquitecto/a de Seguridad con conocimientos en plataformas MDM",
    summary: "Adzuna listing",
    description: undefined
  }), "Spanish");
  assert.equal(listingLanguage({
    title: "Endpoint Engineer - Microsoft 365, Intune & Endpoint Security",
    summary: "Blue Light IT is hiring an Endpoint Engineer.",
    description: "Manage Intune and Windows endpoints."
  }), undefined);
});

test("empty results copy names the active search", () => {
  assert.match(getEmptyResultsMessage({ ...initialFilterState, query: "zzzz" }), /zzzz/);
  assert.doesNotMatch(getEmptyResultsMessage({ ...initialFilterState, query: "zzzz" }), /tool filters/);
  assert.match(getEmptyResultsMessage({
    ...initialFilterState,
    selectedTools: ["Intune"]
  }), /tool filters/);
});

test("protected product names survive description repair", () => {
  const repaired = repairJobDescription("Use macOS and PowerShell daily. OneDrivePlan migrations separately.");
  assert.match(repaired, /macOS/);
  assert.match(repaired, /PowerShell/);
  assert.match(repaired, /OneDrive\nPlan/);
});
