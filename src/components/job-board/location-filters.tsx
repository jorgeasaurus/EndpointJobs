import { MapPin } from "lucide-react";

import { workplaceFilterOptions } from "./filter-model";
import type {
  FilterDispatch,
  WorkplaceFilter
} from "./filter-model";
import { toWorkplaceFilter } from "./filter-url";

export function LocationFilters({
  dispatch,
  locationQuery,
  workplace
}: {
  dispatch: FilterDispatch;
  locationQuery: string;
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
            placeholder="City, state, or country"
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
    </section>
  );
}
