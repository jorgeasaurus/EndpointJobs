"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { clearViewHistory } from "@/components/job-board/use-account-board";

export function ClearViewHistoryButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function clear() {
    setError(null);
    const cleared = await clearViewHistory();
    if (!cleared) {
      setError("View history could not be cleared.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="account-actions">
      <button className="compare-button" type="button" onClick={() => void clear()}>
        Clear view history
      </button>
      {error ? <p className="account-error" role="alert">{error}</p> : null}
    </div>
  );
}
