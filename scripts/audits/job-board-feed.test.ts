import { mock } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { JobBoard } from "../../src/components/job-board";
import { isActiveJob } from "../../src/lib/jobs";
import type { JobsFeed } from "../../src/types/job";

import { assertIncludes, assertTruthy, makeJob, type AuditContext } from "./shared";

export async function auditJobBoardFeed(run: AuditContext["run"]) {
  await run("REG-001", "Server-approved job count remains stable through client hydration", () => {
    const serverNow = new Date("2026-07-01T12:00:00.000Z");
    const clientNow = new Date("2026-07-02T12:00:00.000Z");
    const job = makeJob({ staleAfter: "2026-07-02T00:00:00.000Z" });
    const feed: JobsFeed = {
      updatedAt: serverNow.toISOString(),
      source: { name: "Audit", url: "https://example.com" },
      jobs: [job]
    };

    assertTruthy(isActiveJob(job, serverNow), "fixture must be active in the server snapshot");
    mock.timers.enable({ apis: ["Date"], now: clientNow });

    try {
      const markup = renderToStaticMarkup(createElement(JobBoard, { feed }));

      assertIncludes(markup, 'aria-label="1 tracked roles"');
    } finally {
      mock.timers.reset();
    }
  });
}
