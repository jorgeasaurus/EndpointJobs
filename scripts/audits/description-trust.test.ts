import assert from "node:assert/strict";
import test from "node:test";

import feedData from "../../src/data/jobs.json";
import { getCurrencySymbol } from "../../src/lib/currency";
import { repairJobDescription, toDescriptionBlocks } from "../../src/lib/job-description";
import { filterJobs } from "../../src/lib/job-filters";
import { canonicalPostingUrl, dedupeJobs, dedupeWorkplaceJobs, dedupedWorkplaceCounts, inferLocationCurrency, listingLanguage, prepareBoardFeed, presentSalary, withPresentedSalary } from "../../src/lib/job-trust";
import { foldTokens } from "../../src/lib/text";
import { getJobDescriptionBlocks, getJobFreshnessLabel, isPostedDateKnown } from "../../src/lib/jobs";
import { normalizeSerpApiGoogleJob } from "../job-refresh/providers/serpapi";
import { toEndpointJob } from "../job-refresh/shared";
import { getEmptyResultsMessage } from "../../src/components/job-board/empty-results-message";
import { initialFilterState } from "../../src/components/job-board/filter-model";
import { makeJob } from "./shared";
import type { JobsFeed } from "../../src/types/job";

const feed = feedData as JobsFeed;
const blueLightId = "serpapi-blue-light-it-llc-boca-raton-fl-endpoint-engineer-microsoft-365-intune-endpoint-security-76281fc12b";

function distinctPosting(id: string) {
  return {
    sourceUrl: `https://example.com/jobs/${id}`,
    applyUrl: `https://example.com/jobs/${id}/apply`
  };
}

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

test("duplicate company and title listings collapse when the location and workplace match", () => {
  const first = makeJob({
    id: "b-cardinal",
    ...distinctPosting("b-cardinal"),
    company: "Cardinal Health",
    title: "Senior Analyst, IT Client Services",
    location: "Overland Park, KS",
    postedAt: "2026-10-25T11:24:56.320Z",
    fetchedAt: "2026-10-25T11:24:56.320Z"
  });
  const second = makeJob({
    id: "a-cardinal",
    ...distinctPosting("a-cardinal"),
    company: "cardinal health",
    title: "Senior Analyst, IT Client Services!",
    location: "Overland Park, KS",
    description: `${"Endpoint operations ".repeat(40)}`,
    postedAt: "2026-10-25T11:24:56.320Z",
    fetchedAt: "2026-10-25T11:24:56.320Z"
  });
  const unique = dedupeJobs([first, second, makeJob({ id: "other", ...distinctPosting("other"), title: "Other role", company: "Other Co" })]);
  assert.deepEqual(unique.map((job) => job.id), ["a-cardinal", "other"]);
});

test("the same title in two cities stays two listings", () => {
  const overland = makeJob({
    id: "overland-city",
    ...distinctPosting("overland-city"),
    company: "Cardinal Health",
    title: "Senior Analyst, IT Client Services",
    location: "Overland Park, KS"
  });
  const champlin = makeJob({
    id: "champlin-city",
    ...distinctPosting("champlin-city"),
    company: "Cardinal Health",
    title: "Senior Analyst, IT Client Services",
    location: "Champlin, MN"
  });
  assert.deepEqual(dedupeJobs([overland, champlin]).map((job) => job.id), ["overland-city", "champlin-city"]);
});

test("duplicate winners keep the sorted position of the winning listing", () => {
  const low = makeJob({
    id: "low",
    ...distinctPosting("low"),
    company: "Acme",
    title: "Endpoint Engineer",
    salary: { min: 80000, currency: "USD", currencySource: "source", label: "$80k" }
  });
  const other = makeJob({
    id: "other",
    ...distinctPosting("other-sorted"),
    company: "Other Co",
    title: "Other role",
    salary: { min: 90000, currency: "USD", currencySource: "source", label: "$90k" }
  });
  const winner = makeJob({
    id: "winner",
    ...distinctPosting("winner"),
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
    ...distinctPosting("onsite"),
    company: "Acme",
    title: "Endpoint Engineer",
    workplace: "On-site",
    description: "Endpoint operations ".repeat(40)
  });
  const remote = makeJob({
    id: "remote",
    ...distinctPosting("remote"),
    company: "Acme",
    title: "Endpoint Engineer",
    workplace: "Remote"
  });
  const matches = [onsite, remote];
  assert.deepEqual(dedupeWorkplaceJobs(matches, "Any").map((job) => job.id), ["onsite", "remote"]);
  assert.deepEqual(dedupeWorkplaceJobs(matches, "Remote").map((job) => job.id), ["remote"]);
  assert.deepEqual(dedupedWorkplaceCounts(matches), { Any: 2, Remote: 1, Hybrid: 0, "On-site": 1 });
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
  assert.equal(listingLanguage({
    title: "Endpoint Engineer",
    summary: "Salary note",
    description: "Salary: N/A. Travel: N/A."
  }), undefined);
  assert.equal(listingLanguage({
    title: "Endpoint Engineer",
    summary: "Hiring manager",
    description: "Contact Peña about the role."
  }), undefined);
  assert.equal(listingLanguage({
    title: "Endpoint Engineer",
    summary: "Site",
    description: "The office is in La Cañada."
  }), undefined);
  assert.equal(listingLanguage({
    title: "ingeniero/a",
    summary: "Role",
    description: undefined
  }), "Spanish");
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
    ...distinctPosting("champlin"),
    company: "Cardinal Health",
    title: "Senior Analyst, IT Client Services",
    location: "Champlin, Minnesota, United States",
    staleAfter: "2027-01-01T00:00:00.000Z"
  });
  const overland = makeJob({
    id: "overland",
    ...distinctPosting("overland"),
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
  assert.deepEqual(dedupeJobs(prepared.jobs).map((job) => job.id), ["overland", "champlin"]);
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

  const mislabeled = [
    "New Mexico",
    "Albuquerque, New Mexico",
    "Santa Fe, NM",
    "Ontario, CA",
    "Ontario, OR",
    "Alberta, VA",
    "Mexico, MO",
    "Madrid, NM",
    "Paris, TX",
    "Berlin, NH",
    "Berlin, DE",
    "Rome, GA",
    "Atlanta, Georgia",
    "Tbilisi, Georgia",
    "Columbia, SC",
    "Columbia, Maryland",
    "Boston, New England",
    "Newark, New Jersey",
    "Jersey City, NJ",
    "Jersey City, Hudson County",
    "London, CA",
    "Indianapolis, IN",
    "United States; Mexico",
    "U.S.A."
  ];
  for (const location of mislabeled) {
    assert.equal(inferLocationCurrency(location), undefined, location);
  }
  for (const location of ["Albuquerque, New Mexico", "Ontario, CA", "Ontario, OR", "Alberta, VA"]) {
    const job = withPresentedSalary(makeJob({
      ...distinctPosting(location),
      location,
      staleAfter: "2027-01-01T00:00:00.000Z",
      salary: { min: 160000, max: 180000, currency: "USD", currencySource: "default", label: "$160k-$180k" }
    }));
    assert.equal(job.salary?.currency, "USD", location);
    assert.equal(filterJobs([job], { ...initialFilterState, minimumSalary: "150000" }).length, 1, location);
  }

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

test("UK regions map to GBP and colliding place names keep their own currency", () => {
  const gbp = [
    "Northern Ireland",
    "Belfast, Northern Ireland, United Kingdom",
    "England",
    "Scotland",
    "Wales",
    "South Wales",
    "London, UK",
    "London, GB",
    "Manchester, United Kingdom"
  ];
  for (const location of gbp) assert.equal(inferLocationCurrency(location), "GBP", location);

  const eur = [
    "Ireland",
    "Dublin, Ireland",
    "Paris, France",
    "Île-de-France",
    "Berlin, Germany",
    "Rome, Italy",
    "Madrid, Spain",
    "Madrid, ES"
  ];
  for (const location of eur) assert.equal(inferLocationCurrency(location), "EUR", location);
  assert.equal(inferLocationCurrency("México"), "MXN");
  assert.equal(inferLocationCurrency("Mexico City"), "MXN");
  assert.equal(inferLocationCurrency("Guadalajara, MX"), "MXN");
  assert.equal(inferLocationCurrency("Toronto, Ontario"), "CAD");
  assert.equal(inferLocationCurrency("Toronto, Canada"), "CAD");
  assert.equal(inferLocationCurrency("London, Ontario"), "CAD");
  assert.equal(inferLocationCurrency("Victoria, British Columbia"), "CAD");
  assert.equal(inferLocationCurrency("Québec"), "CAD");
  assert.equal(inferLocationCurrency("Bengaluru, India"), "INR");
  assert.equal(inferLocationCurrency("Zürich, CH"), "CHF");
  assert.equal(inferLocationCurrency("Sydney, AU"), "AUD");
  assert.equal(inferLocationCurrency("Sydney, AU, NSW"), "AUD");
  assert.equal(inferLocationCurrency("Sydney, New South Wales"), "AUD");
  assert.equal(inferLocationCurrency("Sydney, New South Wales, Australia"), "AUD");
  assert.equal(inferLocationCurrency("Western Australia"), "AUD");
  assert.equal(inferLocationCurrency("New Zealand"), "NZD");
  assert.equal(inferLocationCurrency("Boston, New England"), undefined);
  assert.equal(inferLocationCurrency("Newark, New Jersey"), undefined);
  assert.equal(inferLocationCurrency("Jersey City, Hudson County"), undefined);
  assert.equal(inferLocationCurrency("Saint Helier, Jersey"), undefined);
  assert.equal(inferLocationCurrency("Atlanta, Georgia"), undefined);
  assert.equal(inferLocationCurrency("Tbilisi, Georgia"), undefined);
  assert.equal(inferLocationCurrency("Champagne-au-Mont-d'Or, Lyon"), undefined);
  assert.equal(inferLocationCurrency("Madrid ES"), "EUR");

  const belfast = presentSalary({
    location: "Belfast, Northern Ireland",
    salary: { min: 80000, max: 100000, currency: "USD", currencySource: "default", label: "$80k-$100k" }
  });
  assert.equal(belfast?.currency, "GBP");
  assert.equal(belfast?.label, "£80k-£100k");

  const sydney = presentSalary({
    location: "Sydney, New South Wales, Australia",
    salary: { min: 140000, max: 180000, currency: "USD", currencySource: "default", label: "$140k-$180k" }
  });
  assert.equal(sydney?.currency, "AUD");
  assert.equal(sydney?.label, `${getCurrencySymbol("AUD")}140k-${getCurrencySymbol("AUD")}180k`);

  const mexicoCity = withPresentedSalary(makeJob({
    ...distinctPosting("mexico-city"),
    location: "Mexico City",
    staleAfter: "2027-01-01T00:00:00.000Z",
    salary: { min: 160000, max: 180000, currency: "USD", currencySource: "default", label: "$160k-$180k" }
  }));
  assert.equal(mexicoCity.salary?.currency, "MXN");
  assert.equal(filterJobs([mexicoCity], { ...initialFilterState, minimumSalary: "150000" }).length, 0);
});

test("same apply URL is one posting even when the location text differs", () => {
  const shared = "https://jobs.example.com/req/42";
  const first = makeJob({
    id: "nyc-low",
    company: "Acme",
    title: "Endpoint Engineer",
    location: "New York, NY",
    applyUrl: `${shared}?ref=a`,
    sourceUrl: "https://boards.example.com/one"
  });
  const second = makeJob({
    id: "nyc-win",
    company: "Acme",
    title: "Endpoint Engineer",
    location: "NYC",
    description: "Endpoint operations ".repeat(40),
    applyUrl: `${shared}/?ref=b`,
    sourceUrl: "https://boards.example.com/two"
  });
  assert.deepEqual(dedupeJobs([first, second]).map((job) => job.id), ["nyc-win"]);

  const sourceOnly = makeJob({
    id: "source-win",
    company: "Acme",
    title: "Endpoint Engineer",
    location: "Austin, Texas",
    applyUrl: undefined,
    sourceUrl: "https://boards.example.com/jobs/9?utm_source=email",
    description: "Endpoint operations ".repeat(20)
  });
  const sourceTwin = makeJob({
    id: "source-low",
    company: "Acme",
    title: "Endpoint Engineer",
    location: "Austin, TX",
    applyUrl: undefined,
    sourceUrl: "https://boards.example.com/jobs/9"
  });
  assert.deepEqual(dedupeJobs([sourceTwin, sourceOnly]).map((job) => job.id), ["source-win"]);
});

test("aggregator job ids stay in the posting key and tracking params do not", () => {
  const accenture = makeJob({
    id: "indeed-accenture",
    company: "Accenture",
    title: "Endpoint Engineer",
    location: "Chicago, IL",
    applyUrl: "https://www.indeed.com/viewjob?jk=aaa111&utm_source=google_jobs_apply&utm_medium=organic",
    sourceUrl: "https://boards.example.com/accenture"
  });
  const bloomberg = makeJob({
    id: "indeed-bloomberg",
    company: "Bloomberg",
    title: "Endpoint Engineer",
    location: "New York, NY",
    applyUrl: "https://www.indeed.com/viewjob?jk=bbb222&utm_campaign=google_jobs_apply&utm_source=google_jobs_apply",
    sourceUrl: "https://boards.example.com/bloomberg"
  });
  assert.deepEqual(dedupeJobs([accenture, bloomberg]).map((job) => job.id), ["indeed-accenture", "indeed-bloomberg"]);

  const jamfA = makeJob({
    id: "gh-a",
    company: "Jamf",
    title: "Mac Admin",
    location: "Eau Claire, WI",
    applyUrl: "https://www.jamf.com/about/careers/jobs/?gh_jid=111&utm_source=google",
    sourceUrl: "https://boards.example.com/jamf-a"
  });
  const jamfB = makeJob({
    id: "gh-b",
    company: "Jamf",
    title: "Mac Admin",
    location: "Minneapolis, MN",
    applyUrl: "https://www.jamf.com/about/careers/jobs/?utm_medium=organic&gh_jid=222",
    sourceUrl: "https://boards.example.com/jamf-b"
  });
  assert.deepEqual(dedupeJobs([jamfA, jamfB]).map((job) => job.id), ["gh-a", "gh-b"]);

  const glassdoorA = makeJob({
    id: "gd-a",
    company: "ETC Solutions",
    title: "Desktop Support",
    applyUrl: "https://www.glassdoor.com/job-listing/jv?jl=101&utm_source=google_jobs_apply",
    sourceUrl: "https://boards.example.com/gd-a"
  });
  const glassdoorB = makeJob({
    id: "gd-b",
    company: "ServiceNow",
    title: "Desktop Support",
    applyUrl: "https://www.glassdoor.com/job-listing/jv?jl=202&gclid=abc&fbclid=def",
    sourceUrl: "https://boards.example.com/gd-b"
  });
  assert.deepEqual(dedupeJobs([glassdoorA, glassdoorB]).map((job) => job.id), ["gd-a", "gd-b"]);

  const tracked = makeJob({
    id: "tracked-low",
    company: "Acme",
    title: "Endpoint Engineer",
    location: "Austin, TX",
    applyUrl: "https://jobs.example.com/jobs/AbC123?utm_source=a&utm_medium=b&ref=newsletter",
    sourceUrl: "https://boards.example.com/tracked-low"
  });
  const trackedTwin = makeJob({
    id: "tracked-win",
    company: "Acme",
    title: "Endpoint Engineer",
    location: "Austin, Texas",
    description: "Endpoint operations ".repeat(40),
    applyUrl: "https://jobs.example.com/jobs/AbC123?utm_campaign=c&src=email",
    sourceUrl: "https://boards.example.com/tracked-win"
  });
  assert.deepEqual(dedupeJobs([tracked, trackedTwin]).map((job) => job.id), ["tracked-win"]);

  const upper = makeJob({
    id: "case-upper",
    company: "Case Co",
    title: "Endpoint Engineer",
    location: "Denver, CO",
    applyUrl: "https://ats.example.com/jobs/AbC123",
    sourceUrl: "https://boards.example.com/case-upper"
  });
  const lower = makeJob({
    id: "case-lower",
    company: "Other Co",
    title: "Endpoint Engineer",
    location: "Boulder, CO",
    applyUrl: "https://ats.example.com/jobs/abc123",
    sourceUrl: "https://boards.example.com/case-lower"
  });
  assert.deepEqual(dedupeJobs([upper, lower]).map((job) => job.id), ["case-upper", "case-lower"]);
  assert.equal(canonicalPostingUrl("https://ATS.Example.com/jobs/AbC123/?utm_source=a"), "ats.example.com/jobs/AbC123");

  const samePosting = makeJob({
    id: "tr-same",
    company: "Accenture",
    title: "Endpoint Engineer",
    location: "Chicago, IL",
    applyUrl: "https://www.indeed.com/viewjob?jk=same111",
    sourceUrl: "https://boards.example.com/tr-same"
  });
  const samePostingTracked = makeJob({
    id: "tr-tracked",
    company: "Accenture",
    title: "Endpoint Engineer",
    location: "Chicago, IL",
    description: "Endpoint operations ".repeat(20),
    applyUrl: "https://www.indeed.com/viewjob?jk=same111&utm_source=google",
    sourceUrl: "https://boards.example.com/tr-tracked"
  });
  const otherEmployer = makeJob({
    id: "tr-other",
    company: "Bloomberg",
    title: "Endpoint Engineer",
    location: "Chicago, IL",
    applyUrl: "https://www.indeed.com/viewjob?jk=other222",
    sourceUrl: "https://boards.example.com/tr-other"
  });
  assert.deepEqual(
    dedupeJobs([samePosting, otherEmployer, samePostingTracked]).map((job) => job.id),
    ["tr-other", "tr-tracked"]
  );
});

test("real feed urls do not merge distinct company and title pairs", () => {
  const byKey = new Map<string, Set<string>>();
  for (const job of feed.jobs) {
    const key = (job.applyUrl && canonicalPostingUrl(job.applyUrl)) || canonicalPostingUrl(job.sourceUrl);
    if (!key) continue;
    const identity = `${foldTokens(job.company)}|${foldTokens(job.title)}`;
    const identities = byKey.get(key) ?? new Set<string>();
    identities.add(identity);
    byKey.set(key, identities);
  }

  for (const [key, identities] of byKey) {
    if (identities.size < 2) continue;
    const titles = new Set([...identities].map((identity) => identity.split("|")[1]));
    assert.equal(titles.size, 1, key);
    const companyTokens = [...identities].map((identity) => new Set(identity.split("|")[0].split(" ").filter((token) => token.length >= 4)));
    const [first, ...rest] = companyTokens;
    for (const tokens of rest) {
      assert.ok([...first].some((token) => tokens.has(token)), `${key} merges ${[...identities].join(" / ")}`);
    }
  }

  for (const needle of ["indeed.com/viewjob", "glassdoor.com/job-listing", "jamf.com/about/careers/jobs", "a16z.com/about/jobs"]) {
    const matches = feed.jobs.filter((job) => `${job.applyUrl ?? ""} ${job.sourceUrl}`.includes(needle));
    const pairs = new Set(matches.map((job) => `${foldTokens(job.company)}|${foldTokens(job.title)}`));
    assert.ok(dedupeJobs(matches).length >= pairs.size, needle);
  }
});
