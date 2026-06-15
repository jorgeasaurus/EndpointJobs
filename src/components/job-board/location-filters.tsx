import { MapPin } from "lucide-react";

import { ToggleButton } from "./toggle-button";
import { workplaceFilterOptions } from "./filter-model";
import type {
  FilterDispatch,
  LocationOption,
  WorkplaceFilter
} from "./filter-model";
import { toWorkplaceFilter } from "./filter-url";

export function LocationFilters({
  dispatch,
  locationOptions,
  locationQuery,
  selectedLocations,
  workplace
}: {
  dispatch: FilterDispatch;
  locationOptions: LocationOption[];
  locationQuery: string;
  selectedLocations: string[];
  workplace: WorkplaceFilter;
}) {
  return (
    <section className="location-filter-panel" aria-label="Location filters">
      <div className="location-filter-row">
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
            placeholder="City, state, country, or remote"
          />
        </label>

        <label className="mini-field mini-field--workplace">
          <MapPin size={17} aria-hidden="true" />
          <span>Workplace</span>
          <select
            value={workplace}
            onChange={(event) =>
              dispatch({
                type: "setWorkplace",
                value: toWorkplaceFilter(event.currentTarget.value)
              })
            }
          >
            {workplaceFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {locationOptions.length > 0 ? (
        <div className="location-chip-list" aria-label="Location quick filters">
          {locationOptions.map((option) => (
            <ToggleButton
              key={option.value}
              activeClassName="facet-button location-chip is-active"
              inactiveClassName="facet-button location-chip"
              isActive={isLocationSelected(selectedLocations, option.value)}
              onClick={() =>
                dispatch({ type: "toggleLocation", value: option.value })
              }
            >
              <span>{option.label}</span>
              <small>{option.count}</small>
            </ToggleButton>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function isLocationSelected(selectedLocations: string[], location: string) {
  const normalizedLocation = location.toLowerCase();

  return selectedLocations.some(
    (selectedLocation) => selectedLocation.toLowerCase() === normalizedLocation
  );
}
