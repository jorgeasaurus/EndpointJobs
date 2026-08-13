import { LoadingState } from "@/components/job-board/loading-state";

// Adapted from Beautiful UI's Loading State primitive.
// https://www.beautifului.dev/#loading-state
export default function Loading() {
  return (
    <main className="route-loading" aria-busy="true">
      <div className="route-loading-state">
        <LoadingState label="Loading endpoint roles" />
      </div>
    </main>
  );
}
