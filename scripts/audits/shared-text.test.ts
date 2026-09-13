import assert from "node:assert/strict";
import test from "node:test";
import { cleanText, stripHtml, toEndpointJob } from "../job-refresh/shared";

test("HTML text decodes decimal and hexadecimal numeric character references", () => {
  assert.equal(stripHtml("10&#43; years; C&#x2b;&#X2B;; caf&#233;; &#x1F680;"), "10+ years; C++; café; \u{1F680}");
  assert.equal(cleanText("Engineer&#39;s work &amp; testing &#8212; 10&#43; years"), "Engineer's work & testing - 10+ years");
  assert.equal(stripHtml("&mdash; &#8212; &#x2014; &ndash; &#8211; &#X2013;"), "- - - - - -");
});

test("HTML stripping handles encoded markup and preserves visible angle placeholders", () => {
  assert.equal(stripHtml("<p>Use &#60;device&#62;, &#60;policy&#62; and &#x3c;value&#x3e; as literal text.</p>").trim(), "Use <device>, <policy> and <value> as literal text.");
  assert.equal(stripHtml("&lt;ul&gt;&lt;li&gt;10&#43; years&lt;/li&gt;&lt;li&gt;Manage &#60;device&#62;&lt;/li&gt;&lt;/ul&gt;").trim(), "- 10+ years\n\n- Manage <device>");
  assert.equal(stripHtml("<script>hidden()</script><style>.hidden{}</style><p>Visible &#60;value&#62;</p>").trim(), "Visible <value>");
  assert.equal(stripHtml("Latency &#60; 10ms and throughput &#62; 20 requests; n &#60; 100 &#62; 50"), "Latency < 10ms and throughput > 20 requests; n < 100 > 50");
});

test("Invalid numeric Unicode references cannot crash text normalization", () => {
  assert.equal(stripHtml("&#0; &#xD800; &#55296; &#x110000; &#999999999999999999999999999999999999999;"), "\uFFFD \uFFFD \uFFFD \uFFFD \uFFFD");
  assert.equal(stripHtml("&#x10FFFF;"), "\u{10FFFF}");
  assert.equal(stripHtml("&#xZZ; &#-1; &unknown;"), "&#xZZ; &#-1; &unknown;");
});

test("Job normalization retains numeric angle placeholders in summaries and full descriptions", () => {
  const html = `<p>Manage Intune &#60;device&#62; and &#x3c;policy&#x3e; templates.</p><p>${"Automate Windows endpoint deployment and compliance. ".repeat(12)}</p>`;
  for (const descriptionFormat of ["html", "text"] as const) {
    const job = toEndpointJob({
      id: "literal-templates", title: "Endpoint Engineer", company: "Example",
      postedAt: "2026-09-12T00:00:00Z", fetchedAt: new Date("2026-09-12T12:00:00Z"),
      source: "Greenhouse", sourceUrl: "https://example.com/jobs/templates",
      attributionLabel: "Example", termsProfile: "public-api",
      description: descriptionFormat === "text" ? stripHtml(html) : html,
      descriptionFormat
    });
    assert.ok(job?.summary.includes("<device> and <policy>"));
    assert.ok(job?.description?.includes("<device> and <policy>"));
    assert.ok(!job?.description?.includes("<p>"));
  }
});
