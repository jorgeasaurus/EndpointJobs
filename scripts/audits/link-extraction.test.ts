import assert from "node:assert/strict";
import test from "node:test";
import { extractLinks, normalizeLink } from "../link-audit/check";

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


test("HTML href character references decode once before URL parsing", () => {
  for (const separator of ["&amp;", "&AMP;", "&#38;", "&#x26;", "&#X26;", "&#38"]) {
    assert.deepEqual(extractLinks(`<a href="/jobs?page=2${separator}sort=date">Jobs</a>`, base), ["https://example.com/jobs?page=2&sort=date"]);
  }
  assert.deepEqual(extractLinks('<a href="/jobs?q=&copy;&NotEqualTilde;">Jobs</a>', base), ["https://example.com/jobs?q=%C2%A9%E2%89%82%CC%B8"]);
  assert.deepEqual(extractLinks('<a href="/jobs?q=a&amp;amp;b=c">Jobs</a>', base), ["https://example.com/jobs?q=a&amp;b=c"]);
  assert.deepEqual(extractLinks('<a href="/jobs?q=a&ampersand=b">Jobs</a>', base), ["https://example.com/jobs?q=a&ampersand=b"]);
});

test("already decoded XML and feed URLs are not HTML-decoded again", () => {
  assert.equal(normalizeLink("/jobs?q=a&amp;b=c", base), "https://example.com/jobs?q=a&amp;b=c");
});
