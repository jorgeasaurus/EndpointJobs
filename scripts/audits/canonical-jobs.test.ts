import assert from "node:assert/strict";
import test from "node:test";
import { getCanonicalSeoIndex, getCanonicalSeoJobs } from "../../src/lib/canonical-jobs";
import { makeJob } from "./shared";

test("Oracle HCM listings are canonical for matching aggregator copies in either feed order", () => {
  const description = "Manage macOS devices and Jamf Pro for the enterprise. ".repeat(30);
  const oracle = makeJob({ id: "oracle-direct", company: "Florida Blue", source: "Oracle HCM", description });
  const aggregator = makeJob({ id: "aggregator-copy", company: "Florida Blue", source: "The Muse", description });
  for (const jobs of [[aggregator, oracle], [oracle, aggregator]]) {
    const index = getCanonicalSeoIndex(jobs);
    assert.equal(index.get(oracle.id), oracle.id);
    assert.equal(index.get(aggregator.id), oracle.id);
    assert.deepEqual(getCanonicalSeoJobs(jobs).map((job) => job.id), [oracle.id]);
  }
});
