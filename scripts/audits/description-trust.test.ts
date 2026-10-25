import assert from "node:assert/strict";
import test from "node:test";

import feedData from "../../src/data/jobs.json";
import { getCurrencySymbol } from "../../src/lib/currency";
import { repairJobDescription, toDescriptionBlocks } from "../../src/lib/job-description";
import { filterJobs } from "../../src/lib/job-filters";
import { dedupeJobs, dedupeWorkplaceJobs, dedupedWorkplaceCounts, inferLocationCurrency, listingLanguage, prepareBoardFeed, presentSalary, withPresentedSalary } from "../../src/lib/job-trust";
import { getJobDescriptionBlocks, getJobFreshnessLabel, isPostedDateKnown } from "../../src/lib/jobs";
import { normalizeSerpApiGoogleJob } from "../job-refresh/providers/serpapi";
import { toEndpointJob } from "../job-refresh/shared";
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

test("duplicate winners keep the sorted position of the winning listing", () => {
  const low = makeJob({
    id: "low",
    company: "Acme",
    title: "Endpoint Engineer",
    salary: { min: 80000, currency: "USD", currencySource: "source", label: "$80k" }
  });
  const other = makeJob({
    id: "other",
    company: "Other Co",
    title: "Other role",
    salary: { min: 90000, currency: "USD", currencySource: "source", label: "$90k" }
  });
  const winner = makeJob({
    id: "winner",
    company: "Acme",
    title: "Endpoint Engineer",
    description: "Endpoint operations ".repeat(40),
    salary: { min: 200000, currency: "USD", currencySource: "source", label: "$200k" }
  });
  assert.deepEqual(dedupeJobs([low, other, winner]).map((job) => job.id), ["other", "winner"]);
});

test("workplace counts dedupe each workplace after the other filters", () => {
  const onsite = makeJob({
    id: "onsite",
    company: "Acme",
    title: "Endpoint Engineer",
    workplace: "On-site",
    description: "Endpoint operations ".repeat(40)
  });
  const remote = makeJob({
    id: "remote",
    company: "Acme",
    title: "Endpoint Engineer",
    workplace: "Remote"
  });
  const matches = [onsite, remote];
  assert.deepEqual(dedupeWorkplaceJobs(matches, "Any").map((job) => job.id), ["onsite"]);
  assert.deepEqual(dedupeWorkplaceJobs(matches, "Remote").map((job) => job.id), ["remote"]);
  assert.deepEqual(dedupedWorkplaceCounts(matches), { Any: 1, Remote: 1, Hybrid: 0, "On-site": 1 });
});

test("missing source dates are unknown and real dates stay", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-25T11:24:56.320Z") });
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

test("description repair leaves already-correct mixed-case terms intact", () => {
  const repaired = repairJobDescription("Deploy ChromeOS, SaaS, and SentinelOne with macOS, iOS, and PowerShell. DevOps and eDiscovery stay intact.");
  assert.match(repaired, /ChromeOS/);
  assert.match(repaired, /SaaS/);
  assert.match(repaired, /SentinelOne/);
  assert.match(repaired, /macOS/);
  assert.match(repaired, /iOS/);
  assert.match(repaired, /eDiscovery/);
  assert.doesNotMatch(repaired, /Chrome\nOS|Saa\nS|Sentinel\nOne|e\nDiscovery/);
});

test("location variants stay searchable until dedupe runs on the filtered set", () => {
  const champlin = makeJob({
    id: "champlin",
    company: "Cardinal Health",
    title: "Senior Analyst, IT Client Services",
    location: "Champlin, Minnesota, United States",
    staleAfter: "2027-01-01T00:00:00.000Z"
  });
  const overland = makeJob({
    id: "overland",
    company: "Cardinal Health",
    title: "Senior Analyst, IT Client Services",
    location: "Overland Park, Kansas, United States",
    staleAfter: "2027-01-01T00:00:00.000Z"
  });
  const prepared = prepareBoardFeed({
    updatedAt: "2026-10-25T11:24:56.320Z",
    source: { name: "Test", url: "https://example.com" },
    jobs: [overland, champlin]
  });
  assert.deepEqual(prepared.jobs.map((job) => job.id), ["overland", "champlin"]);
  const searched = dedupeJobs(filterJobs(prepared.jobs, { ...initialFilterState, query: "Champlin" }));
  assert.deepEqual(searched.map((job) => job.id), ["champlin"]);
  assert.equal(dedupeJobs(prepared.jobs).length, 1);
});

test("US state suffixes are not treated as country currencies", () => {
  for (const location of ["San Francisco, CA", "Indianapolis, IN", "Wilmington, DE", "London, CA", "Carmel, IN"]) {
    assert.equal(inferLocationCurrency(location), undefined, location);
    assert.equal(presentSalary({
      location,
      salary: { min: 160000, max: 180000, currency: "USD", label: "$160k-$180k" }
    })?.currency, "USD", location);
  }
  assert.equal(inferLocationCurrency("Toronto, Canada"), "CAD");
  assert.equal(inferLocationCurrency("Toronto, Ontario"), "CAD");
  assert.equal(inferLocationCurrency("Berlin, Germany"), "EUR");
  assert.equal(inferLocationCurrency("Bengaluru, India"), "INR");
  assert.equal(inferLocationCurrency("Madrid, ES"), "EUR");

  const point72 = withPresentedSalary(makeJob({
    id: "point72",
    location: "San Francisco, CA",
    staleAfter: "2027-01-01T00:00:00.000Z",
    salary: { min: 160000, max: 180000, currency: "USD", label: "$160k-$180k" }
  }));
  assert.equal(filterJobs([point72], { ...initialFilterState, minimumSalary: "150000" }).length, 1);
});

test("tab indentation is expanded without eating the line", () => {
  assert.equal(repairJobDescription("\tManage Intune endpoints"), "    Manage Intune endpoints");
});

test("explicit source currency survives a foreign location", () => {
  const authoritative = presentSalary({
    location: "Toronto, Ontario",
    salary: { min: 120000, currency: "USD", currencySource: "source", label: "US$120k" }
  });
  assert.equal(authoritative?.currency, "USD");
  assert.equal(authoritative?.label, "US$120k");

  const assumed = presentSalary({
    location: "Toronto, Ontario",
    salary: { min: 120000, currency: "USD", currencySource: "default", label: "$120k" }
  });
  assert.equal(assumed?.currency, "CAD");
  assert.equal(assumed?.label, "CA$120k");

  const fetchedAt = new Date("2026-10-25T11:24:56.320Z");
  const serp = normalizeSerpApiGoogleJob({
    title: "Endpoint Engineer",
    company_name: "Example Co",
    location: "Toronto, Ontario",
    description: "Manage Intune and Windows endpoints for the enterprise fleet.",
    detected_extensions: { salary: "US$120,000-US$160,000 a year" },
    apply_options: [{ title: "Apply", link: "https://example.com/jobs/toronto-usd" }]
  }, "endpoint engineer", fetchedAt, "CAD");
  assert.ok(serp?.salary);
  assert.equal(serp.salary.currencySource, "source");
  assert.equal(serp.salary.currency, "USD");
  assert.equal(serp.salary.min, 120000);
  const presented = withPresentedSalary(serp);
  assert.equal(presented.salary?.currency, "USD");
  assert.equal(filterJobs([presented], { ...initialFilterState, minimumSalary: "100000" }).length, 1);
});

test("source posted-at evidence is kept when display tags are capped", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-25T11:24:56.320Z") });
  const fetchedAt = new Date("2026-10-25T11:24:56.320Z");
  const capped = toEndpointJob({
    id: "capped-date",
    title: "Endpoint Engineer",
    company: "Example",
    location: "Austin, TX",
    postedAt: fetchedAt.toISOString(),
    fetchedAt,
    source: "Test",
    sourceUrl: "https://example.com/jobs/capped",
    attributionLabel: "Test",
    termsProfile: "seed",
    description: "Manage Intune endpoints for the enterprise fleet.",
    sourceTags: [...Array.from({ length: 16 }, (_, index) => `Benefit ${index}`), "3 days ago"]
  });
  assert.ok(capped);
  assert.equal(capped.tags.includes("3 days ago"), false);
  assert.equal(capped.postedAtEvidence, "3 days ago");
  assert.equal(isPostedDateKnown(capped), true);

  const today = normalizeSerpApiGoogleJob({
    title: "Endpoint Engineer",
    company_name: "Example Co",
    location: "Austin, TX",
    description: "Manage Intune and Windows endpoints for the enterprise fleet.",
    detected_extensions: { posted_at: "today" },
    extensions: ["Full-time", "Health insurance"],
    apply_options: [{ title: "Apply", link: "https://example.com/jobs/today" }]
  }, "endpoint engineer", fetchedAt);
  assert.ok(today);
  assert.equal(today.postedAt, fetchedAt.toISOString());
  assert.equal(today.postedAtEvidence, "today");
  assert.equal(today.tags.includes("today"), false);
  assert.equal(isPostedDateKnown(today), true);
  assert.equal(getJobFreshnessLabel(today), "Posted today");
});
