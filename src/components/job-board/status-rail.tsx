"use client";

import { ChevronDown } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useId, useState, useSyncExternalStore, type MouseEvent } from "react";

import { boardStatPercent } from "@/lib/board-stat-percent";
import type { BoardMetrics } from "@/lib/board-page";
import { getEndpointToolLabel, seniorityOptions } from "@/lib/job-taxonomy";

import { AnimatedNumber } from "./animated-number";
import type { FilterAction, FilterDispatch, FilterState } from "./filter-model";
import { filterUrlStoreEvent } from "./use-url-synced-filters";
import {
  boardStatAccessibleName,
  boardStatFilterAction,
  boardStatFilterHref,
  isBoardStatActive,
  type BoardStatFilter
} from "./status-rail-links";

type StatusMeterModel = {
  key: string;
  label: string;
  value: number;
  percent: number;
  href?: string;
  action?: FilterAction;
  active: boolean;
  accessibleName?: string;
};

export function CommandStatusRail({
  activeJobsCount,
  breakdownsOpen = false,
  filters,
  metrics,
  onFilter,
  visibleJobsCount
}: {
  activeJobsCount: number;
  breakdownsOpen?: boolean;
  filters: FilterState;
  metrics: BoardMetrics;
  onFilter: FilterDispatch;
  visibleJobsCount: number;
}) {
  const currentSearch = useCurrentSearch();
  const catalogDiffers = activeJobsCount !== visibleJobsCount;
  const coverage = [
    staticMeter("mapped", "Mapped", metrics.mappedJobsCount, visibleJobsCount),
    staticMeter("remote", "Remote / hybrid", metrics.remoteJobsCount, visibleJobsCount),
    linkedMeter(filters, { type: "salary" }, "salary", "Salary shown", metrics.salaryJobsCount, visibleJobsCount, currentSearch)
  ];
  const leadership = linkedMeter(
    filters,
    { type: "leadership" },
    "leadership",
    "Leadership",
    metrics.leadershipJobsCount,
    visibleJobsCount,
    currentSearch
  );
  const seniority = seniorityOptions.flatMap((level) => {
    const value = metrics.seniorityCounts[level];
    if (value <= 0) return [];
    return [linkedMeter(
      filters,
      { type: "seniority", seniority: level },
      `seniority-${level}`,
      level,
      value,
      visibleJobsCount,
      currentSearch
    )];
  });
  const locations = metrics.topLocations.map((location) => linkedMeter(
    filters,
    { type: "metro", metroArea: location.metroArea },
    `location-${location.metroArea}`,
    location.metroArea,
    location.count,
    visibleJobsCount,
    currentSearch
  ));
  const tools = metrics.toolCounts.map((tool) => linkedMeter(
    filters,
    { type: "tool", tool: tool.tool },
    `tool-${tool.tool}`,
    getEndpointToolLabel(tool.tool),
    tool.count,
    visibleJobsCount,
    currentSearch
  ));

  return (
    <aside className="command-status" aria-label="Search coverage status">
      <div
        className={catalogDiffers ? "status-total" : "status-total sr-only"}
        aria-label={activeJobsCount + " tracked roles"}
      >
        {catalogDiffers ? (
          <>
            <span className="section-kicker">Open roles</span>
            <AnimatedNumber
              className="slot-number slot-number--hero"
              value={activeJobsCount}
            />
            <small>on the board</small>
          </>
        ) : (
          <span>{activeJobsCount} tracked roles</span>
        )}
      </div>

      <div className="status-card">
        {coverage.map((meter) => (
          <StatusMeter key={meter.key} meter={meter} onFilter={onFilter} />
        ))}
        <StatusSection
          defaultOpen={breakdownsOpen}
          meters={[leadership]}
          onFilter={onFilter}
          title="Leadership"
        />
        <StatusSection
          defaultOpen={breakdownsOpen}
          meters={seniority}
          onFilter={onFilter}
          title="Seniority"
        />
        <StatusSection
          defaultOpen={breakdownsOpen}
          meters={locations}
          onFilter={onFilter}
          title="Top metros"
        />
        <StatusSection
          defaultOpen={breakdownsOpen}
          meters={tools}
          onFilter={onFilter}
          title="Jobs per tool"
        />
      </div>
    </aside>
  );
}

function StatusSection({
  defaultOpen = false,
  meters,
  onFilter,
  title
}: {
  defaultOpen?: boolean;
  meters: StatusMeterModel[];
  onFilter: FilterDispatch;
  title: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  if (meters.length === 0) return null;

  return (
    <section className="status-section">
      <h2 className="status-section-title">
        <button
          type="button"
          className="status-section-toggle"
          aria-controls={panelId}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <span>{title}</span>
          <span className="sr-only"> breakdown</span>
          <ChevronDown
            aria-hidden="true"
            className={open ? "status-section-chevron is-open" : "status-section-chevron"}
            size={16}
          />
        </button>
      </h2>
      <div className="status-section-panel" hidden={!open} id={panelId}>
        {meters.map((meter) => (
          <StatusMeter key={meter.key} meter={meter} onFilter={onFilter} />
        ))}
      </div>
    </section>
  );
}

function StatusMeter({
  meter,
  onFilter
}: {
  meter: StatusMeterModel;
  onFilter: FilterDispatch;
}) {
  const body = (
    <>
      <div>
        <span>{meter.label}</span>
        <strong>{meter.value}</strong>
      </div>
      <span className="status-meter-track" aria-hidden="true">
        <span style={{ width: `${meter.percent}%` }} />
      </span>
    </>
  );

  if (!meter.href || !meter.action || !meter.accessibleName) {
    return <div className="status-meter">{body}</div>;
  }

  const action = meter.action;

  return (
    <Link
      aria-current={meter.active ? "true" : undefined}
      aria-label={meter.accessibleName}
      className="status-meter"
      href={meter.href as Route}
      prefetch={false}
      onClick={(event) => {
        if (shouldFollowHref(event)) return;
        event.preventDefault();
        onFilter(action);
      }}
    >
      {body}
    </Link>
  );
}

function staticMeter(key: string, label: string, value: number, total: number): StatusMeterModel {
  return {
    key,
    label,
    value,
    percent: boardStatPercent(value, total),
    active: false
  };
}

function linkedMeter(
  filters: FilterState,
  stat: BoardStatFilter,
  key: string,
  label: string,
  value: number,
  total: number,
  currentSearch: string
): StatusMeterModel {
  const active = isBoardStatActive(filters, stat);

  return {
    key,
    label,
    value,
    percent: boardStatPercent(value, total),
    href: boardStatFilterHref(filters, stat, currentSearch),
    action: boardStatFilterAction(filters, stat),
    active,
    accessibleName: boardStatAccessibleName(label, value, total, active)
  };
}

function useCurrentSearch() {
  return useSyncExternalStore(subscribeToLocationSearch, readLocationSearch, () => "");
}

function readLocationSearch() {
  return window.location.search.replace(/^\?/, "");
}

function subscribeToLocationSearch(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener(filterUrlStoreEvent, onStoreChange);
  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener(filterUrlStoreEvent, onStoreChange);
  };
}

function shouldFollowHref(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}
