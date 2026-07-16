import type { RefObject } from "react";

import {
  BriefcaseBusiness,
  Clock3,
  Cpu,
  DollarSign,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound,
  X
} from "lucide-react";

import {
  platformOptions,
  roleFamilyOptions,
  seniorityOptions,
  toolOptions
} from "@/lib/jobs";
import type { EndpointTool, Platform } from "@/types/job";

import { AnimatedNumber } from "./animated-number";
import type { ActiveFilterItem } from "./active-filters";
import { ToggleButton } from "./toggle-button";
import { LocationFilters } from "./location-filters";
import {
  freshnessFilterOptions,
  minimumSalaryFilterOptions,
  sortOptions
} from "./filter-model";
import type {
  FilterDispatch,
  FilterState,
  FreshnessFilter,
  MinimumSalaryFilter,
  RoleFamilyFilter,
  SeniorityFilter,
  SortKey
} from "./filter-model";
import {
  toFreshnessFilter,
  toMinimumSalaryFilter,
  toRoleFamilyFilter,
  toSeniorityFilter,
  toSortKey
} from "./filter-url";

export function CommandPanel({
  activeFilterCount,
  activeFilterItems,
  activeFilterLabel,
  activeJobsCount,
  clearFilters,
  dispatch,
  filters,
  mappedJobsCount,
  remoteJobsCount,
  salaryJobsCount,
  searchInputRef,
  visibleJobsCount
}: {
  activeFilterCount: number;
  activeFilterItems: ActiveFilterItem[];
  activeFilterLabel: string;
  activeJobsCount: number;
  clearFilters: () => void;
  dispatch: FilterDispatch;
  filters: FilterState;
  mappedJobsCount: number;
  remoteJobsCount: number;
  salaryJobsCount: number;
  searchInputRef: RefObject<HTMLInputElement | null>;
  visibleJobsCount: number;
}) {
  return (
    <div className="command-panel">
      <div className="command-layout">
        <div className="command-primary">
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
          </div>

          <SearchStrip
            dispatch={dispatch}
            leadershipOnly={filters.leadershipOnly}
            query={filters.query}
            salaryOnly={filters.salaryOnly}
            searchInputRef={searchInputRef}
          />
          <div className="command-filter-grid">
            <HighSignalFilters
              dispatch={dispatch}
              freshness={filters.freshness}
              roleFamily={filters.roleFamily}
            />
            <LocationFilters
              dispatch={dispatch}
              locationQuery={filters.locationQuery}
              workplace={filters.workplace}
            />
          </div>
          <ActiveFilterChips
            activeFilterItems={activeFilterItems}
            clearFilters={clearFilters}
            dispatch={dispatch}
          />
          <PlatformFilters
            dispatch={dispatch}
            selectedPlatforms={filters.selectedPlatforms}
          />
          <FilterStack
            activeFilterCount={activeFilterCount}
            activeFilterLabel={activeFilterLabel}
            clearFilters={clearFilters}
            dispatch={dispatch}
            selectedTools={filters.selectedTools}
            minimumSalary={filters.minimumSalary}
            seniority={filters.seniority}
            sort={filters.sort}
          />
        </div>

        <CommandStatusRail
          activeJobsCount={activeJobsCount}
          mappedJobsCount={mappedJobsCount}
          remoteJobsCount={remoteJobsCount}
          salaryJobsCount={salaryJobsCount}
          visibleJobsCount={visibleJobsCount}
        />
      </div>
    </div>
  );
}

function CommandStatusRail({
  activeJobsCount,
  mappedJobsCount,
  remoteJobsCount,
  salaryJobsCount,
  visibleJobsCount
}: {
  activeJobsCount: number;
  mappedJobsCount: number;
  remoteJobsCount: number;
  salaryJobsCount: number;
  visibleJobsCount: number;
}) {
  const mappedPercent = getPercentage(mappedJobsCount, visibleJobsCount);
  const remotePercent = getPercentage(remoteJobsCount, visibleJobsCount);
  const salaryPercent = getPercentage(salaryJobsCount, visibleJobsCount);

  return (
    <aside className="command-status" aria-label="Search coverage status">
      <div className="status-total" aria-label={activeJobsCount + " tracked roles"}>
        <span className="section-kicker">Open roles</span>
        <AnimatedNumber
          className="slot-number slot-number--hero"
          value={activeJobsCount}
        />
        <small>tracked roles</small>
      </div>

      <div className="status-card">
        <div className="status-card-heading">
          <span>Current view</span>
          <strong>{visibleJobsCount}</strong>
        </div>
        <StatusMeter label="Mapped" value={mappedJobsCount} percent={mappedPercent} />
        <StatusMeter label="Remote / hybrid" value={remoteJobsCount} percent={remotePercent} />
        <StatusMeter label="Salary shown" value={salaryJobsCount} percent={salaryPercent} />
      </div>

      <div className="status-grid" aria-label="Visible job summary">
        <span>
          <MapPin size={17} aria-hidden="true" />
          <strong>{mappedJobsCount}</strong>
          mapped
        </span>
        <span>
          <DollarSign size={17} aria-hidden="true" />
          <strong>{salaryJobsCount}</strong>
          salary
        </span>
      </div>
    </aside>
  );
}

function StatusMeter({
  label,
  percent,
  value
}: {
  label: string;
  percent: number;
  value: number;
}) {
  return (
    <div className="status-meter">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <span className="status-meter-track" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </span>
    </div>
  );
}

function getPercentage(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

function SearchStrip({
  dispatch,
  leadershipOnly,
  query,
  salaryOnly,
  searchInputRef
}: {
  dispatch: FilterDispatch;
  leadershipOnly: boolean;
  query: string;
  salaryOnly: boolean;
  searchInputRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="search-strip">
      <label className="search-box">
        <Search size={20} aria-hidden="true" />
        <span className="sr-only">Search jobs</span>
        <input
          ref={searchInputRef}
          data-job-search="true"
          type="search"
          value={query}
          onChange={(event) =>
            dispatch({ type: "setQuery", value: event.currentTarget.value })
          }
          placeholder="Search Jamf, Intune, macOS, SCCM, Kandji..."
        />
      </label>

      <div className="search-mode-buttons">
        <ToggleButton
          activeClassName="mode-button is-active"
          inactiveClassName="mode-button"
          isActive={leadershipOnly}
          onClick={() => dispatch({ type: "toggleLeadershipOnly" })}
        >
          <UsersRound size={18} aria-hidden="true" />
          Leadership
        </ToggleButton>
        <ToggleButton
          activeClassName="mode-button is-active"
          inactiveClassName="mode-button"
          isActive={salaryOnly}
          onClick={() => dispatch({ type: "toggleSalaryOnly" })}
        >
          <DollarSign size={18} aria-hidden="true" />
          Salary shown
        </ToggleButton>
      </div>
    </div>
  );
}


function HighSignalFilters({
  dispatch,
  freshness,
  roleFamily
}: {
  dispatch: FilterDispatch;
  freshness: FreshnessFilter;
  roleFamily: RoleFamilyFilter;
}) {
  return (
    <div className="high-signal-filters">
      <label className="mini-field">
        <BriefcaseBusiness size={17} aria-hidden="true" />
        <span>Role</span>
        <select
          value={roleFamily}
          onChange={(event) =>
            dispatch({
              type: "setRoleFamily",
              value: toRoleFamilyFilter(event.currentTarget.value)
            })
          }
        >
          <option value="All">All</option>
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
            dispatch({
              type: "setFreshness",
              value: toFreshnessFilter(event.currentTarget.value)
            })
          }
        >
          {freshnessFilterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function ActiveFilterChips({
  activeFilterItems,
  clearFilters,
  dispatch
}: {
  activeFilterItems: ActiveFilterItem[];
  clearFilters: () => void;
  dispatch: FilterDispatch;
}) {
  if (activeFilterItems.length === 0) {
    return null;
  }

  return (
    <div className="active-filter-chips" aria-label="Active filters">
      {activeFilterItems.map((item) => (
        <button
          aria-label={`Remove filter: ${item.label}`}
          className={getActiveFilterChipClassName(item)}
          key={item.id}
          type="button"
          onClick={() => dispatch(item.clearAction)}
        >
          {item.label}
          <X size={14} aria-hidden="true" />
        </button>
      ))}

      <button
        className="active-filter-chip active-filter-chip--clear"
        type="button"
        onClick={clearFilters}
      >
        Clear all
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

function getActiveFilterChipClassName(item: ActiveFilterItem) {
  return item.variant === "salary"
    ? "active-filter-chip active-filter-chip--salary"
    : "active-filter-chip";
}
function PlatformFilters({
  dispatch,
  selectedPlatforms
}: {
  dispatch: FilterDispatch;
  selectedPlatforms: Platform[];
}) {
  return (
    <div className="quick-filters" aria-label="Platform filters">
      {platformOptions.map((platform) => (
        <ToggleButton
          key={platform}
          activeClassName="facet-button is-active"
          inactiveClassName="facet-button"
          isActive={selectedPlatforms.includes(platform)}
          onClick={() => dispatch({ type: "togglePlatform", value: platform })}
        >
          {platform}
        </ToggleButton>
      ))}
    </div>
  );
}

function FilterStack({
  activeFilterCount,
  activeFilterLabel,
  clearFilters,
  dispatch,
  selectedTools,
  minimumSalary,
  seniority,
  sort
}: {
  activeFilterCount: number;
  activeFilterLabel: string;
  clearFilters: () => void;
  dispatch: FilterDispatch;
  selectedTools: EndpointTool[];
  minimumSalary: MinimumSalaryFilter;
  seniority: SeniorityFilter;
  sort: SortKey;
}) {
  const contentProps = {
    activeFilterCount,
    activeFilterLabel,
    clearFilters,
    dispatch,
    selectedTools,
    minimumSalary,
    seniority,
    sort
  };

  return (
    <>
      <section
        className="hero-filter-stack hero-filter-stack--desktop"
        aria-label="Filter stack"
      >
        <FilterStackHeading />
        <FilterStackContent {...contentProps} />
      </section>

      <details className="hero-filter-stack hero-filter-stack--mobile">
        <summary className="mobile-filter-summary">
          <span>
            <SlidersHorizontal size={17} aria-hidden="true" />
            More filters
          </span>
          <span className="mobile-filter-summary-count">
            {activeFilterCount > 0 ? activeFilterLabel : "Optional"}
          </span>
        </summary>
        <FilterStackContent {...contentProps} />
      </details>
    </>
  );
}

function FilterStackHeading() {
  return (
    <div className="rail-heading">
      <SlidersHorizontal size={18} aria-hidden="true" />
      <span>Filter Stack</span>
    </div>
  );
}

function FilterStackContent({
  activeFilterCount,
  activeFilterLabel,
  clearFilters,
  dispatch,
  selectedTools,
  minimumSalary,
  seniority,
  sort
}: {
  activeFilterCount: number;
  activeFilterLabel: string;
  clearFilters: () => void;
  dispatch: FilterDispatch;
  selectedTools: EndpointTool[];
  minimumSalary: MinimumSalaryFilter;
  seniority: SeniorityFilter;
  sort: SortKey;
}) {
  return (
    <>
      <div className="hero-filter-controls">
        <label className="field">
          <span>Minimum salary</span>
          <select
            value={minimumSalary}
            onChange={(event) =>
              dispatch({
                type: "setMinimumSalary",
                value: toMinimumSalaryFilter(event.currentTarget.value)
              })
            }
          >
            {minimumSalaryFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Seniority</span>
          <select
            value={seniority}
            onChange={(event) =>
              dispatch({
                type: "setSeniority",
                value: toSeniorityFilter(event.currentTarget.value)
              })
            }
          >
            <option value="All">All</option>
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
            onChange={(event) =>
              dispatch({ type: "setSort", value: toSortKey(event.currentTarget.value) })
            }
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="facet-group hero-tool-group">
        <div className="facet-title">
          <Cpu size={17} aria-hidden="true" />
          Tools
        </div>
        <div className="facet-list">
          {toolOptions.map((tool) => (
            <ToggleButton
              key={tool}
              activeClassName="facet-button is-active"
              inactiveClassName="facet-button"
              isActive={selectedTools.includes(tool)}
              onClick={() => dispatch({ type: "toggleTool", value: tool })}
            >
              {tool}
            </ToggleButton>
          ))}
        </div>
      </div>

      {activeFilterCount > 0 ? (
        <button
          aria-label={"Clear " + activeFilterLabel}
          className="clear-button"
          type="button"
          onClick={clearFilters}
        >
          <X size={17} aria-hidden="true" />
          <span>Clear</span>
          <AnimatedNumber
            className="slot-number slot-number--button"
            value={activeFilterCount}
          />
        </button>
      ) : null}
    </>
  );
}
