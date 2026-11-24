import { MapPin } from "lucide-react";

import type { FilterDispatch } from "./filter-model";

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
          id="location-query"
          name="location"
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
