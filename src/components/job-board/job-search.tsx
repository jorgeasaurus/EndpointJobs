import { Search, X } from "lucide-react";
import type { RefObject } from "react";

// Adapted from Beautiful UI's Search primitive (MIT, copyright Shane Levine).
// https://www.beautifului.dev/#search
export function JobSearch({
  inputRef,
  onQueryChange,
  query,
  resultCount
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  onQueryChange: (query: string) => void;
  query: string;
  resultCount: number;
}) {
  const resultLabel = `${resultCount} ${resultCount === 1 ? "role" : "roles"} found`;

  function clearSearch() {
    onQueryChange("");
    inputRef.current?.focus();
  }

  return (
    <div className="job-search">
      <div className="search-box">
        <Search size={20} aria-hidden="true" />
        <label className="sr-only" htmlFor="job-search-input">
          Search jobs
        </label>
        <input
          aria-describedby="job-search-status"
          id="job-search-input"
          ref={inputRef}
          data-job-search="true"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          placeholder="Search Jamf, Intune, macOS, Kandji/Iru..."
        />
        <span className="search-result-count" aria-hidden="true">
          {resultLabel}
        </span>
        {query ? (
          <button
            aria-label="Clear job search"
            className="search-clear-button"
            type="button"
            onClick={clearSearch}
          >
            <X size={15} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <span className="sr-only" id="job-search-status" aria-live="polite">
        {resultLabel}
      </span>
    </div>
  );
}
