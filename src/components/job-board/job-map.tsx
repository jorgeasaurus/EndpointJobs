"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";

import { ChevronDown } from "lucide-react";

import { buildJobMapPoints, type JobMapPoint, type JobMapRecord } from "@/lib/job-map";

import { JobMapCanvasLoading } from "./job-map-loading";

const LazyJobMapCanvas = dynamic<{ points: JobMapPoint[] }>(
  () => import("./job-map-canvas").then((module) => module.JobMapCanvas),
  {
    loading: () => <JobMapCanvasLoading />,
    ssr: false
  }
);

export function JobMap({
  expanded,
  id,
  isLoading = false,
  jobs,
  loadFailed = false,
  onExpandedChange,
  onRetry
}: {
  expanded: boolean;
  id?: string;
  isLoading?: boolean;
  jobs: readonly JobMapRecord[];
  knownMappedCount?: number;
  loadFailed?: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onRetry?: () => void;
  totalJobCount?: number;
}) {
  const points = useMemo(() => buildJobMapPoints(jobs), [jobs]);

  function handleToggleMap() {
    onExpandedChange(!expanded);
  }

  return (
    <section
      id={id}
      className={
        expanded
          ? "job-map-section job-map-section--expanded"
          : "job-map-section job-map-section--collapsed"
      }
      aria-label="Mapped job locations"
    >
      <div className="job-map-heading">
        <div className="job-map-heading-copy">
          <span className="section-kicker">Job geography</span>
          <h2>Locations</h2>
        </div>
        <div className="job-map-heading-actions">
          <button
            aria-controls="job-map-canvas"
            aria-expanded={expanded}
            className="map-toggle-button"
            onClick={handleToggleMap}
            type="button"
          >
            {expanded ? "Hide map" : "Show map"}
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {expanded ? (
        isLoading && points.length === 0 ? (
          <JobMapCanvasLoading />
        ) : loadFailed && points.length === 0 ? (
          <p className="map-load-error" role="alert">
            Map data did not load.{" "}
            <button type="button" onClick={onRetry}>
              Try again
            </button>
          </p>
        ) : (
          <LazyJobMapCanvas points={points} />
        )
      ) : null}
    </section>
  );
}
