"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";

import { ChevronDown, MapPin } from "lucide-react";

import { buildJobMapPoints, type JobMapPoint } from "@/lib/job-map";
import type { Job } from "@/types/job";

const LazyJobMapCanvas = dynamic<{ points: JobMapPoint[] }>(
  () => import("./job-map-canvas").then((module) => module.JobMapCanvas),
  {
    loading: () => <JobMapCanvasLoading />,
    ssr: false
  }
);

export function JobMap({ id, jobs }: { id?: string; jobs: Job[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const points = useMemo(() => buildJobMapPoints(jobs), [jobs]);
  const mappedJobCount = points.length;

  const handleToggleMap = useCallback(() => {
    setIsExpanded((current) => !current);
  }, []);

  return (
    <section
      id={id}
      className={
        isExpanded
          ? "job-map-section job-map-section--expanded"
          : "job-map-section job-map-section--collapsed"
      }
      aria-label="Mapped job locations"
    >
      <div className="job-map-heading">
        <div className="job-map-heading-copy">
          <span className="section-kicker">Job geography</span>
          <h2>{mappedJobCount} mapped jobs</h2>
        </div>
        <div className="job-map-heading-actions">
          <span className="map-count-pill">
            <MapPin size={15} aria-hidden="true" />
            {mappedJobCount} of {jobs.length}
          </span>
          <button
            aria-controls="job-map-canvas"
            aria-expanded={isExpanded}
            className="map-toggle-button"
            onClick={handleToggleMap}
            type="button"
          >
            {isExpanded ? "Hide map" : "Show map"}
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {isExpanded ? <LazyJobMapCanvas points={points} /> : null}
    </section>
  );
}

function JobMapCanvasLoading() {
  return (
    <output
      aria-label="Loading map"
      className="job-map-canvas-wrap job-map-canvas-wrap--loading"
      id="job-map-canvas"
    >
      <span className="job-map-loading">Loading map</span>
    </output>
  );
}
