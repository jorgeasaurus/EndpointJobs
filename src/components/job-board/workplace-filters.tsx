import { MapPin } from "lucide-react";

import { workplaceFilterOptions } from "./filter-model";
import type {
  FilterDispatch,
  WorkplaceFilter
} from "./filter-model";
import { ToggleButton } from "./toggle-button";

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
