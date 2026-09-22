import { MapPin } from "lucide-react";

import { workplaceFilterOptions } from "./filter-model";
import type {
  FilterDispatch,
  WorkplaceFilter
} from "./filter-model";
import { ToggleButton } from "./toggle-button";

const locationRequestUrl = `https://github.com/jorgeasaurus/EndpointJobs/issues/new?${new URLSearchParams({
  title: "Request coverage for a missing city or region",
  body: [
    "### City or region",
    "",
    "### State or province",
    "",
    "### Country",
    "",
    "### Additional context (optional)",
    "Tell us about the endpoint roles you are looking for.",
    "",
    "### Relevant job sources (optional)",
    "Add links to local job boards or employer career pages."
  ].join("\n")
})}`;

export function LocationRequestLink() {
  return (
    <a
      className="location-request-link"
      href={locationRequestUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Don’t see your city or region? Let us know on GitHub (opens in a new tab)"
    >
      Don’t see your city or region? Let us know on GitHub.
    </a>
  );
}

export function LocationFilters({
  dispatch,
  locationQuery
}: {
  dispatch: FilterDispatch;
  locationQuery: string;
}) {
  return (
    <section className="location-filter-panel" aria-label="Location filters">
      <label className="location-search-box">
        <MapPin size={19} aria-hidden="true" />
        <span className="sr-only">Search locations</span>
        <input
          type="search"
          value={locationQuery}
          onChange={(event) =>
            dispatch({
              type: "setLocationQuery",
              value: event.currentTarget.value
            })
          }
          placeholder="City, state, or country"
        />
      </label>
    </section>
  );
}

export function WorkplaceFilters({
  dispatch,
  workplace,
  workplaceCounts
}: {
  dispatch: FilterDispatch;
  workplace: WorkplaceFilter;
  workplaceCounts: Record<WorkplaceFilter, number>;
}) {
  return (
    <section className="workplace-filter-panel" aria-label="Workplace filters">
      <span className="workplace-filter-label">
        <MapPin size={15} aria-hidden="true" />
        Workplace
      </span>
      <fieldset className="workplace-filter" aria-label="Workplace" style={{ margin: 0 }}>
        {workplaceFilterOptions.map((option) => {
          const count = workplaceCounts[option.value];
          return (
            <ToggleButton
              activeClassName="workplace-filter-button is-active"
              inactiveClassName="workplace-filter-button"
              isActive={workplace === option.value}
              key={option.value}
              onClick={() =>
                dispatch({ type: "setWorkplace", value: option.value })
              }
            >
              <span>{option.label}</span>
              <strong aria-label={`${count} ${count === 1 ? "role" : "roles"}`}>
                {count}
              </strong>
            </ToggleButton>
          );
        })}
      </fieldset>
    </section>
  );
}
