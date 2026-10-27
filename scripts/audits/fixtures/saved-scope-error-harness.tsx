import { createRoot } from "react-dom/client";
import { useMemo, useRef, useState } from "react";

import { presentBoardResults } from "@/lib/account/records";
import type { BoardPage } from "@/lib/board-page";
import { initialFilterState } from "@/components/job-board/filter-model";
import { OpenRolesSection } from "@/components/job-board/open-roles";
import { useBoardPage } from "@/components/job-board/use-board-results";

const pageNode = document.getElementById("board-page");
const root = document.getElementById("root");
if (!pageNode || !root) throw new Error("missing saved-scope harness nodes");

const initialPage = JSON.parse(pageNode.textContent ?? "") as BoardPage;
const initialFilterKey = JSON.stringify(initialFilterState);

window.fetch = async (input) => {
  const url = String(input);
  if (url.includes("/api/board/saved")) {
    return new Response("saved board failed", { status: 500 });
  }
  return new Response("unexpected board request", { status: 500 });
};

function Harness() {
  const [savedOnly, setSavedOnly] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);
  const saved = useMemo(
    () => (savedOnly ? { kind: "session" as const, token: "1" } : { kind: "off" as const }),
    [savedOnly]
  );
  const board = useBoardPage(initialPage, initialFilterState, 1, initialFilterKey, saved);
  const results = presentBoardResults({
    hideViewed: false,
    jobs: board.page.jobs,
    loading: board.status === "loading",
    page: board.page.page,
    pageSize: board.page.pageSize,
    pendingScope: board.pendingScope,
    requestedPage: 1,
    savedIds: new Set<string>(),
    savedOnly: savedOnly && board.scope === "saved",
    total: board.page.total,
    totalPages: board.page.totalPages,
    viewedIds: new Set<string>()
  });

  return (
    <OpenRolesSection
      clearFilters={() => undefined}
      currentPage={results.currentPage}
      filters={initialFilterState}
      hideViewed={false}
      listedJobs={results.listedJobs}
      loading={board.status === "loading"}
      onPageChange={() => undefined}
      onRetry={board.retry}
      onSortChange={() => undefined}
      onToggleHideViewed={() => undefined}
      onToggleSaved={() => undefined}
      onToggleSavedOnly={() => setSavedOnly((current) => !current)}
      pageEnd={results.pageEnd}
      pageStart={results.pageStart}
      pendingScope={board.pendingScope}
      queryError={board.status === "error"}
      resultsRef={resultsRef}
      savedIds={new Set()}
      savedOnly={savedOnly}
      selectedJobIds={new Set()}
      signedIn
      toggleComparison={() => undefined}
      totalJobs={results.totalJobs}
      totalPages={results.totalPages}
      viewedIds={new Set()}
      viewingSaved={results.viewingSaved}
    />
  );
}

createRoot(root).render(<Harness />);
