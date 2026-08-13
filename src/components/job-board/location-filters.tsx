import { MapPin } from "lucide-react";

import { workplaceFilterOptions } from "./filter-model";
import type {
  FilterDispatch,
  WorkplaceFilter
} from "./filter-model";
import { ToggleButton } from "./toggle-button";

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
      <div className="workplace-filter" aria-label="Workplace" role="group">
        {workplaceFilterOptions.map((option) => (
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
            <strong aria-label={`${workplaceCounts[option.value]} roles`}>
              {workplaceCounts[option.value]}
            </strong>
          </ToggleButton>
        ))}
      </div>
    </section>
  );
}
