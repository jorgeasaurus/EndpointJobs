import { MapPin, RotateCcw, Sparkles } from "lucide-react";

import { platformOptions, seniorityOptions, toolOptions } from "@/lib/jobs";

import type { MatchPreferences } from "./job-match";
import { ToggleButton } from "./toggle-button";

export function MatchProfile({
  onChange,
  preferences
}: {
  onChange: (preferences: MatchPreferences) => void;
  preferences: MatchPreferences;
}) {
  const configuredCount = getConfiguredPreferenceCount(preferences);

  return (
    <section className="match-profile" aria-labelledby="match-profile-title">
      <details>
        <summary>
          <span className="match-profile-heading">
            <Sparkles size={18} aria-hidden="true" />
            <span>
              <strong id="match-profile-title">Personalized matches</strong>
              <small>Score roles against what matters to you</small>
            </span>
          </span>
          <span className="match-profile-count">
            {configuredCount === 0 ? "Set preferences" : `${configuredCount} configured`}
          </span>
        </summary>

        <div className="match-profile-body">
          <PreferenceButtons
            label="Platforms"
            options={platformOptions}
            selected={preferences.platforms}
            onToggle={(platform) =>
              onChange({
                ...preferences,
                platforms: toggleValue(preferences.platforms, platform)
              })
            }
          />
          <PreferenceButtons
            label="Tools"
            options={toolOptions}
            selected={preferences.tools}
            onToggle={(tool) =>
              onChange({ ...preferences, tools: toggleValue(preferences.tools, tool) })
            }
          />

          <div className="match-profile-fields">
            <label>
              <span>Preferred location</span>
              <span className="match-profile-input">
                <MapPin size={16} aria-hidden="true" />
                <input
                  type="text"
                  value={preferences.location}
                  onChange={(event) =>
                    onChange({ ...preferences, location: event.currentTarget.value })
                  }
                  placeholder="Seattle or Switzerland"
                />
              </span>
            </label>
            <label>
              <span>Minimum salary</span>
              <span className="match-profile-input match-profile-input--salary">
                <span aria-hidden="true">$</span>
                <input
                  min="0"
                  step="5000"
                  type="number"
                  value={preferences.salaryFloor ?? ""}
                  onChange={(event) =>
                    onChange({
                      ...preferences,
                      salaryFloor: event.currentTarget.value
                        ? Number(event.currentTarget.value)
                        : null
                    })
                  }
                  placeholder="120000"
                />
              </span>
            </label>
            <label>
              <span>Preferred seniority</span>
              <select
                value={preferences.seniority}
                onChange={(event) =>
                  onChange({
                    ...preferences,
                    seniority: event.currentTarget.value as MatchPreferences["seniority"]
                  })
                }
              >
                <option value="Any">Any level</option>
                {seniorityOptions.map((seniority) => (
                  <option key={seniority} value={seniority}>{seniority}</option>
                ))}
              </select>
            </label>
          </div>

          {configuredCount > 0 ? (
            <button
              className="match-profile-reset"
              type="button"
              onClick={() =>
                onChange({
                  platforms: [],
                  tools: [],
                  location: "",
                  salaryFloor: null,
                  seniority: "Any"
                })
              }
            >
              <RotateCcw size={15} aria-hidden="true" />
              Reset preferences
            </button>
          ) : null}
        </div>
      </details>
    </section>
  );
}

function PreferenceButtons<T extends string>({
  label,
  onToggle,
  options,
  selected
}: {
  label: string;
  onToggle: (option: T) => void;
  options: readonly T[];
  selected: T[];
}) {
  return (
    <fieldset className="match-preference-group">
      <legend>{label}</legend>
      <div className="match-preference-scroll">
        {options.map((option) => (
          <ToggleButton
            activeClassName="match-preference-button is-active"
            inactiveClassName="match-preference-button"
            isActive={selected.includes(option)}
            key={option}
            onClick={() => onToggle(option)}
          >
            {option}
          </ToggleButton>
        ))}
      </div>
    </fieldset>
  );
}

function getConfiguredPreferenceCount(preferences: MatchPreferences) {
  return Number(preferences.platforms.length > 0) +
    Number(preferences.tools.length > 0) +
    Number(Boolean(preferences.location.trim())) +
    Number(preferences.salaryFloor !== null) +
    Number(preferences.seniority !== "Any");
}

function toggleValue<T>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value];
}
