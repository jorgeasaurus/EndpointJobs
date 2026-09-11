import { mock } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { updateComparisonSelection } from "../../src/components/job-board/comparison-selection";
import { JobComparison } from "../../src/components/job-board/job-comparison";
import { daysAgo, fixedAuditNow, makeJob } from "./shared";

type RunAudit = (
  id: string,
  detail: string,
  audit: () => Promise<void> | void
) => Promise<void>;

export async function auditJobComparisonData(run: RunAudit) {
  await run("FEAT-070", "Job comparison renders requested decision fields", () => {
    mock.timers.enable({ apis: ["Date"], now: fixedAuditNow });
    let markup: string;
    try {
      markup = renderToStaticMarkup(
        createElement(JobComparison, {
          jobs: comparisonJobs,
          onClear: () => undefined,
          onRemove: () => undefined
        })
      );
    } finally {
      mock.timers.reset();
    }

    [
      "Compare 2 roles",
      "Categories",
      "Employer",
      "Salary",
      "Location",
      "Workplace",
      "Seniority",
      "Tools",
      "Match signals",
      "Freshness",
      "1 day old",
      "3 days old",
      "$120k-$150k",
      "Not shown"
    ].forEach((text) => assertIncludes(markup, text));
    const categoriesHeader = '<th class="comparison-label comparison-categories" scope="col">';
    assertIncludes(markup, categoriesHeader);
    assertBefore(markup, categoriesHeader, "Endpoint Engineer");
    assertIncludes(markup, "Remove Endpoint Engineer at Example One from comparison");

    let selection = new Set<string>();
    ["one", "two", "three", "four", "five"].forEach((jobId) => {
      selection = updateComparisonSelection(selection, { type: "toggle", jobId });
    });
    assertEqual(selection.size, 4, "comparison selection cap");
    assertEqual(selection.has("five"), false, "fifth comparison selection rejected");

    selection = updateComparisonSelection(selection, { type: "remove", jobId: "two" });
    assertEqual(selection.has("two"), false, "comparison selection removed");
    selection = updateComparisonSelection(selection, { type: "toggle", jobId: "five" });
    assertEqual(selection.has("five"), true, "comparison slot reused after removal");
    selection = updateComparisonSelection(selection, { type: "clear" });
    assertEqual(selection.size, 0, "comparison selection cleared");
  });
}

const comparisonJobs = [
  makeJob({
    id: "comparison-one",
    title: "Endpoint Engineer",
    company: "Example One",
    location: "Seattle, WA",
    workplace: "Hybrid",
    salary: { currency: "USD", label: "$120k-$150k" },
    tools: ["Intune"],
    platforms: ["Windows"],
    seniority: "Senior"
  }),
  makeJob({
    id: "comparison-two",
    title: "Client Platform Engineer",
    company: "Example Two",
    location: "Remote",
    workplace: "Remote",
    postedAt: daysAgo(3),
    tools: ["Jamf"],
    platforms: ["macOS"],
    seniority: "Mid"
  })
];

function assertIncludes(value: string, expected: string) {
  if (!value.includes(expected)) {
    throw new Error(`expected markup to include ${expected}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertBefore(value: string, first: string, second: string) {
  const firstIndex = value.indexOf(first);
  const secondIndex = value.indexOf(second);

  if (firstIndex < 0 || secondIndex < 0 || firstIndex >= secondIndex) {
    throw new Error(`expected ${first} before ${second}`);
  }
}
