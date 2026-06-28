"use client";

import { useCallback, useMemo, useState } from "react";

import { ChevronDown, MapPin } from "lucide-react";

import { buildJobMapPoints } from "@/lib/job-map";
import type { Job } from "@/types/job";

import { JobMapCanvas } from "./job-map-canvas";

export function JobMap({ jobs }: { jobs: Job[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const points = useMemo(() => buildJobMapPoints(jobs), [jobs]);
  const mappedJobCount = points.length;

  const handleToggleMap = useCallback(() => {
    setIsExpanded((current) => !current);
  }, []);

  return (
    <section
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

      {isExpanded ? <JobMapCanvas points={points} /> : null}
    </section>
  );
}
