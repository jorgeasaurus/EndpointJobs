import assert from "node:assert/strict";
import test from "node:test";
import { extractLinks } from "../link-audit/check";

const base = "https://example.com/";

test("link extraction reads actual href attributes in quoted and unquoted forms", () => {
  const html = `<a href="/jobs" data-href="/tracking">Jobs</a>
    <a data-href="/ignored" href=/jobs?page=2>More</a>
    <A HREF='/jobs?page=3'>Last</A><a data-href="/ignored">No link</a>`;
  assert.deepEqual(extractLinks(html, base), ["https://example.com/jobs", "https://example.com/jobs?page=2", "https://example.com/jobs?page=3"]);
});

test("quoted values preserve opposite quotes and cannot inject fake href attributes or anchors", () => {
  const html = `<a title="href='/fake' > <a href='/also-fake'>" href="/jobs?name=O'Reilly">Jobs</a>
    <div data-template="<a href='/fake-div'>"></div>
    <a href="/first" href="/second">Duplicate</a>`;
  assert.deepEqual(extractLinks(html, base), ["https://example.com/jobs?name=O%27Reilly", "https://example.com/first"]);
});

test("comments and raw text elements cannot add links to the crawl", () => {
  const html = `<!-- <a href="/comment"> -->
    <script>const html = '<a href="/script">';</script>
    <script>const partial = '<a href="';</script>
    <style>.a::before { content: '<a href="/style">'; }</style>
    <textarea><a href="/textarea"></textarea><title><a href="/title"></title>
    <a href="/actual">Actual</a><!-- <a href="/unterminated">`;
  assert.deepEqual(extractLinks(html, base), ["https://example.com/actual"]);
});
