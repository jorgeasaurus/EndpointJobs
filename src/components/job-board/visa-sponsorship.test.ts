import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { VisaSponsorship } from "./visa-sponsorship";

test("missing and unknown sponsorship stay hidden on cards and explicit on details", () => {
  for (const sponsorship of [undefined, { status: "not-stated" as const }]) {
    assert.equal(renderToStaticMarkup(createElement(VisaSponsorship, { sponsorship })), "");
    assert.match(
      renderToStaticMarkup(createElement(VisaSponsorship, { sponsorship, expanded: true })),
      /Visa sponsorship: Not stated/
    );
  }
});

test("listing evidence is escaped text in an accessible disclosure with a protected source link", () => {
  const markup = renderToStaticMarkup(createElement(VisaSponsorship, {
    sponsorship: {
      status: "case-by-case",
      evidence: "Sponsorship <may> be available & subject to approval.",
      sourceUrl: "https://example.com/job"
    },
    expanded: true
  }));
  assert.match(markup, /<details[^>]* open=""/);
  assert.match(markup, /<summary>Visa sponsorship:/);
  assert.match(markup, /<blockquote>Sponsorship &lt;may&gt; be available &amp; subject to approval\.<\/blockquote>/);
  assert.match(markup, /Confirm conditions with the employer/);
  assert.match(markup, /href="https:\/\/example.com\/job" rel="noopener noreferrer" target="_blank"/);
});

test("unsafe or malformed source links are omitted without hiding the evidence", () => {
  for (const sourceUrl of ["javascript:alert(1)", "data:text/html,test", "not-a-url"]) {
    const markup = renderToStaticMarkup(createElement(VisaSponsorship, {
      sponsorship: { status: "unavailable", evidence: "No visa sponsorship.", sourceUrl }
    }));
    assert.doesNotMatch(markup, /<a /);
    assert.match(markup, /<blockquote>No visa sponsorship\.<\/blockquote>/);
  }
});
