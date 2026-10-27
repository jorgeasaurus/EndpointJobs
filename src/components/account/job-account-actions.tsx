"use client";

import { useRecordJobView, useSavedJob } from "@/components/job-board/use-account-board";

export function JobAccountActions({ jobId }: { jobId: string }) {
  useRecordJobView(jobId);
  const saved = useSavedJob(jobId);
  if (!saved.signedIn) return null;

  return (
    <button
      aria-pressed={saved.saved ? "true" : "false"}
      className={`compare-button save-button${saved.saved ? " is-active" : ""}`}
      type="button"
      onClick={() => void saved.toggle()}
    >
      {saved.saved ? "Saved" : "Save"}
    </button>
  );
}
