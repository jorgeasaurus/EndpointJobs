"use client";

import {
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Cpu,
  ExternalLink,
  Layers3,
  MapPin,
  MonitorSmartphone,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  formatPostedDate,
  formatUpdatedAt,
  getFreshnessLabel,
  getPostedAgeDays,
  getSalarySortValue,
  getSearchText,
  isStale,
  platformOptions,
  roleFamilyOptions,
  seniorityOptions,
  toolOptions
} from "@/lib/jobs";
import type {
  EndpointTool,
  Job,
  JobsFeed,
  Platform,
  RoleFamily,
  Seniority
} from "@/types/job";

type SortKey = "newest" | "salary" | "company";
type SeniorityFilter = "All" | Seniority;
type RoleFamilyFilter = "All" | RoleFamily;
type FreshnessFilter = "Any" | "7" | "14" | "30";

export function JobBoard({ feed }: { feed: JobsFeed }) {
  const [query, setQuery] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [selectedTools, setSelectedTools] = useState<EndpointTool[]>([]);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [seniority, setSeniority] = useState<SeniorityFilter>("All");
  const [roleFamily, setRoleFamily] = useState<RoleFamilyFilter>("All");
  const [freshness, setFreshness] = useState<FreshnessFilter>("Any");
  const [sort, setSort] = useState<SortKey>("newest");

  const activeJobs = useMemo(
    () => feed.jobs.filter((job) => !isStale(job)),
    [feed.jobs]
  );

  const visibleJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return activeJobs
      .filter((job) => {
        if (normalizedQuery && !getSearchText(job).includes(normalizedQuery)) {
          return false;
        }

        if (
          selectedPlatforms.length > 0 &&
          !selectedPlatforms.some((platform) => job.platforms.includes(platform))
        ) {
          return false;
        }

        if (
          selectedTools.length > 0 &&
          !selectedTools.some((tool) => job.tools.includes(tool))
        ) {
          return false;
        }

        if (remoteOnly && job.workplace !== "Remote") {
          return false;
        }

        if (seniority !== "All" && job.seniority !== seniority) {
          return false;
        }

        if (roleFamily !== "All" && job.roleFamily !== roleFamily) {
          return false;
        }

        if (
          freshness !== "Any" &&
          getPostedAgeDays(job.postedAt) > Number(freshness)
        ) {
          return false;
        }

        return true;
      })
      .sort((first, second) => sortJobs(first, second, sort));
  }, [
    activeJobs,
    freshness,
    query,
    remoteOnly,
    roleFamily,
    selectedPlatforms,
    selectedTools,
    seniority,
    sort
  ]);

  const remoteCount = activeJobs.filter((job) => job.workplace === "Remote").length;
  const toolCount = new Set(activeJobs.flatMap((job) => job.tools)).size;
  const activeFilterCount =
    selectedPlatforms.length +
    selectedTools.length +
    (remoteOnly ? 1 : 0) +
    (seniority !== "All" ? 1 : 0) +
    (roleFamily !== "All" ? 1 : 0) +
    (freshness !== "Any" ? 1 : 0) +
    (query.trim() ? 1 : 0);

  function clearFilters() {
    setQuery("");
    setSelectedPlatforms([]);
    setSelectedTools([]);
    setRemoteOnly(false);
    setSeniority("All");
    setRoleFamily("All");
    setFreshness("Any");
    setSort("newest");
  }

  return (
    <main className="site-frame">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Endpoint Jobs home">
          <span className="brand-mark">
            <MonitorSmartphone size={18} aria-hidden="true" />
          </span>
          <span>Endpoint Jobs</span>
        </Link>

        <div className="topbar-actions">
          <span className="refresh-pill">
            <RefreshCw size={15} aria-hidden="true" />
            {formatUpdatedAt(feed.updatedAt)}
          </span>
        </div>
      </header>

      <section className="workbench" aria-label="Endpoint job search">
        <div className="command-panel">
          <div className="eyebrow">
            <ShieldCheck size={16} aria-hidden="true" />
            Endpoint, workplace, and client platform roles
          </div>

          <div className="title-row">
            <div>
              <h1>Endpoint Jobs</h1>
              <p>
                Focused listings for macOS, Windows, MDM, UEM, endpoint security,
                packaging, and automation work.
              </p>
            </div>

            <div className="counter-stack" aria-label="Job feed totals">
              <span>{activeJobs.length}</span>
              <small>tracked roles</small>
            </div>
          </div>

          <div className="search-strip">
            <label className="search-box">
              <Search size={20} aria-hidden="true" />
              <span className="sr-only">Search jobs</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Jamf, Intune, macOS, SCCM, Kandji..."
              />
            </label>

            <button
              className={remoteOnly ? "mode-button is-active" : "mode-button"}
              type="button"
              aria-pressed={remoteOnly}
              onClick={() => setRemoteOnly((value) => !value)}
            >
              <MapPin size={18} aria-hidden="true" />
              Remote
            </button>
          </div>

          <div className="high-signal-filters">
            <label className="mini-field">
              <BriefcaseBusiness size={17} aria-hidden="true" />
              <span>Role</span>
              <select
                value={roleFamily}
                onChange={(event) =>
                  setRoleFamily(event.target.value as RoleFamilyFilter)
                }
              >
                <option value="All">All endpoint roles</option>
                {roleFamilyOptions.map((family) => (
                  <option key={family} value={family}>
                    {family}
                  </option>
                ))}
              </select>
            </label>

            <label className="mini-field">
              <Clock3 size={17} aria-hidden="true" />
              <span>Freshness</span>
              <select
                value={freshness}
                onChange={(event) =>
                  setFreshness(event.target.value as FreshnessFilter)
                }
              >
                <option value="Any">Any active listing</option>
                <option value="7">Last 7 days</option>
                <option value="14">Last 14 days</option>
                <option value="30">Last 30 days</option>
              </select>
            </label>
          </div>

          <div className="quick-filters" aria-label="Platform filters">
            {platformOptions.map((platform) => (
              <FacetButton
                key={platform}
                isActive={selectedPlatforms.includes(platform)}
                label={platform}
                onClick={() =>
                  setSelectedPlatforms((current) => toggleValue(current, platform))
                }
              />
            ))}
          </div>
        </div>

        <aside className="signal-panel" aria-label="Feed signal">
          <Image
            src="/endpoint-signal.svg"
            alt=""
            width={900}
            height={620}
            priority
          />
          <div className="signal-metrics">
            <Metric label="remote" value={remoteCount.toString()} />
            <Metric label="tools" value={toolCount.toString()} />
            <Metric label="shown" value={visibleJobs.length.toString()} />
          </div>
        </aside>
      </section>

      <section className="board-grid">
        <aside className="filter-rail" aria-label="Job filters">
          <div className="rail-heading">
            <SlidersHorizontal size={18} aria-hidden="true" />
            <span>Filter Stack</span>
          </div>

          <label className="field">
            <span>Seniority</span>
            <select
              value={seniority}
              onChange={(event) => setSeniority(event.target.value as SeniorityFilter)}
            >
              <option value="All">All levels</option>
              {seniorityOptions.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Sort</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
            >
              <option value="newest">Newest</option>
              <option value="salary">Compensation</option>
              <option value="company">Company</option>
            </select>
          </label>

          <div className="facet-group">
            <div className="facet-title">
              <Cpu size={17} aria-hidden="true" />
              Tools
            </div>
            <div className="facet-list">
              {toolOptions.map((tool) => (
                <FacetButton
                  key={tool}
                  isActive={selectedTools.includes(tool)}
                  label={tool}
                  onClick={() => setSelectedTools((current) => toggleValue(current, tool))}
                />
              ))}
            </div>
          </div>

          {activeFilterCount > 0 ? (
            <button className="clear-button" type="button" onClick={clearFilters}>
              <X size={17} aria-hidden="true" />
              Clear {activeFilterCount}
            </button>
          ) : null}
        </aside>

        <section className="results-panel" aria-label="Job listings">
          <div className="results-heading">
            <div>
              <span className="section-kicker">Open roles</span>
              <h2>{visibleJobs.length} endpoint opportunities</h2>
            </div>
            <span className="feed-note">
              <Clock3 size={16} aria-hidden="true" />
              Daily refresh
            </span>
          </div>

          {visibleJobs.length > 0 ? (
            <div className="job-list">
              {visibleJobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Layers3 size={34} aria-hidden="true" />
              <h3>No matching roles</h3>
              <p>Try fewer tool filters or search for a broader platform term.</p>
              <button className="clear-button" type="button" onClick={clearFilters}>
                Reset filters
              </button>
            </div>
          )}
        </section>
      </section>

      <footer className="site-footer">
        <span>Endpoint Jobs</span>
        <span>{formatUpdatedAt(feed.updatedAt)}</span>
      </footer>
    </main>
  );
}

function JobCard({ job }: { job: Job }) {
  return (
    <article className="job-card">
      <div className="job-card-top">
        <span className="source-pill">{job.source}</span>
        <span className="posted-pill">
          <Clock3 size={15} aria-hidden="true" />
          {formatPostedDate(job.postedAt)}
        </span>
      </div>

      <div className="job-main">
        <div>
          <h3>{job.title}</h3>
          <p className="company-line">
            <BriefcaseBusiness size={16} aria-hidden="true" />
            {job.company}
          </p>
        </div>
        <span className="workplace">{job.workplace}</span>
      </div>

      <p className="summary">{job.summary}</p>

      <div className="match-row" aria-label="Endpoint match reasons">
        {job.matchReasons.slice(0, 3).map((reason) => (
          <span key={reason}>
            <CheckCircle2 size={14} aria-hidden="true" />
            {reason}
          </span>
        ))}
      </div>

      <div className="metadata-row">
        <span>
          <MapPin size={15} aria-hidden="true" />
          {job.location}
        </span>
        <span>{getFreshnessLabel(job.postedAt)}</span>
        <span>{job.roleFamily}</span>
        <span>{job.seniority}</span>
        <span>{job.employmentType}</span>
        {job.salary ? <span>{job.salary.label}</span> : null}
      </div>

      <div className="tag-row" aria-label="Matched tools and platforms">
        {[...job.platforms, ...job.tools].slice(0, 8).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>

      <div className="job-actions">
        <span className="attribution-label" title={job.attributionLabel}>
          {job.attributionLabel}
        </span>
        {job.applyUrl ? (
          <a className="apply-link" href={job.applyUrl} rel="noreferrer" target="_blank">
            Apply
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        ) : (
          <span className="apply-link is-disabled">
            Seed listing
            <CheckCircle2 size={16} aria-hidden="true" />
          </span>
        )}
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{value}</span>
      <small>{label}</small>
    </div>
  );
}

function FacetButton({
  isActive,
  label,
  onClick
}: {
  isActive: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={isActive ? "facet-button is-active" : "facet-button"}
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function toggleValue<T>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value];
}

function sortJobs(first: Job, second: Job, sort: SortKey) {
  if (sort === "salary") {
    return getSalarySortValue(second) - getSalarySortValue(first);
  }

  if (sort === "company") {
    return first.company.localeCompare(second.company);
  }

  return new Date(second.postedAt).getTime() - new Date(first.postedAt).getTime();
}
