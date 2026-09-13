import assert from "node:assert/strict";
import test from "node:test";
import { extractSalaryFromText } from "../job-refresh/shared";

test("salary extraction recognizes ATS ranges separated by Hangul filler", () => {
  assert.deepEqual(extractSalaryFromText("Salary Ranges:\n\n97,916.00\u3164-\u3164139,880.00\u3164USD"), {
    min: 97916,
    max: 139880,
    currency: "USD",
    label: "$98k-$140k"
  });
});

test("salary separator normalization retains currency and annual salary safeguards", () => {
  assert.equal(extractSalaryFromText("Salary Ranges: 97,916.00\u3164-\u3164139,880.00\u3164CAD"), undefined);
  assert.equal(extractSalaryFromText("Salary Ranges: 25.00\u3164-\u316440.00\u3164USD hourly"), undefined);
});
