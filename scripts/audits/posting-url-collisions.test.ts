import assert from "node:assert/strict";
import test from "node:test";

import { classifyPostingUrlGroups, companiesShareEmployer } from "./posting-url-collisions";
import { makeJob } from "./shared";

test("short company names still count as the same employer", () => {
  assert.equal(companiesShareEmployer("IBM", "IBM Corp"), true);
  assert.equal(companiesShareEmployer("HP", "HP Inc"), true);
  assert.equal(companiesShareEmployer("Harvey", "Harvey AI"), true);
  assert.equal(companiesShareEmployer("Accenture", "Bloomberg"), false);
  assert.equal(companiesShareEmployer("A", "A Corp"), false);
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
});
