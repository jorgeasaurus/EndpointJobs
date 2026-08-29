import { getActiveFilterItems } from "../../src/components/job-board/active-filters";
import {
  filterJobs,
  filterReducer,
  initialFilterState
} from "../../src/components/job-board/filter-model";
import {
  filterStateFromSearchParams,
  mergeFilterStateIntoSearchParams
} from "../../src/components/job-board/filter-url";
import { roleFamilyOptions } from "../../src/lib/jobs";
import { metroAreaOptions } from "../../src/lib/metro-areas";

import {
  assertArrayIncludes,
  assertEqual,
  assertIds,
  assertLabels,
  assertTruthy,
  makeJob,
  type AuditContext
} from "./shared";

export async function auditFilters({ filterFixtureJobs, run }: AuditContext) {
  await run("FEAT-005", "Keyword search checks broad job text", () => {
    const matchesTool = filterJobs(filterFixtureJobs, {
      ...initialFilterState,
      query: "autopilot"
    });
    const matchesCompany = filterJobs(filterFixtureJobs, {
      ...initialFilterState,
      query: "acme"
    });
    assertIds(matchesTool, ["recent-intune"]);
    assertIds(matchesCompany, ["mac-jamf"]);
  });

  await run("FEAT-008", "Free-text location search checks location and workplace", () => {
    assertIds(filterJobs(filterFixtureJobs, { ...initialFilterState, locationQuery: "Austin" }), [
      "security-tanium"
    ]);
    assertIds(filterJobs(filterFixtureJobs, { ...initialFilterState, locationQuery: "Remote" }), [
      "mac-jamf"
    ]);
    const zurichJob = makeJob({
      id: "zurich-country-search",
      location: "Zürich",
      mapLocation: {
        label: "Zurich, Switzerland",
        latitude: 47.3769,
        longitude: 8.5417
      }
    });
    for (const locationQuery of ["Switzerland", "Zurich", "Zurich Switzerland", "Zürich"]) {
      assertIds(
        filterJobs([zurichJob], { ...initialFilterState, locationQuery }),
        ["zurich-country-search"]
      );
    }
    const saoPauloJob = makeJob({
      id: "sao-paulo-country-search",
      location: "São Paulo, Brasil",
      mapLocation: {
        label: "São Paulo, Brazil",
        latitude: -23.5505,
        longitude: -46.6333
      }
    });
    const latamRemoteJob = makeJob({
      id: "latam-remote-country-search",
      location: "LATAM, Remote",
      workplace: "Remote",
      mapLocation: {
        label: "Latin America",
        latitude: -15.7801,
        longitude: -47.9292
      }
    });
    for (const locationQuery of ["Brazil", "Brasil", "São Paulo", "Sao Paulo"]) {
      assertIds(
        filterJobs([saoPauloJob], { ...initialFilterState, locationQuery }),
        ["sao-paulo-country-search"]
      );
    }
    for (const locationQuery of ["LATAM", "Latin America", "Remote"]) {
      assertIds(
        filterJobs([latamRemoteJob], { ...initialFilterState, locationQuery }),
        ["latam-remote-country-search"]
      );
    }
  });

  await run("FEAT-009", "Workplace filter requires exact workplace type", () => {
    assertIds(filterJobs(filterFixtureJobs, { ...initialFilterState, workplace: "Remote" }), [
      "mac-jamf"
    ]);
    assertIds(filterJobs(filterFixtureJobs, { ...initialFilterState, workplace: "Hybrid" }), [
      "recent-intune"
    ]);
    const florenceOnsiteJob = makeJob({
      id: "florence-onsite-false-remote",
      title: "Senior Windows Endpoint Engineer – MECM/SCCM & Test Lab",
      location: "Florence, KY",
      workplace: "Remote",
      summary:
        "Support enterprise Windows endpoint testing in Florence, Kentucky. This is not a remote or hybrid position.",
      description:
        "This position requires full-time onsite support in Florence, KY.\nThis is not a remote\nor hybrid position.\nAbility to Commute: Florence, KY 41042 (Required)\nWork Location:\nIn person"
    });
    assertIds(
      filterJobs([florenceOnsiteJob, ...filterFixtureJobs], {
        ...initialFilterState,
        workplace: "Remote"
      }),
      ["mac-jamf"]
    );
    assertIds(
      filterJobs([florenceOnsiteJob], { ...initialFilterState, workplace: "On-site" }),
      ["florence-onsite-false-remote"]
    );
  });

  await run("FEAT-010", "Salary-only filter keeps only transparent pay listings", () => {
    const filtered = filterJobs(filterFixtureJobs, { ...initialFilterState, salaryOnly: true });
    assertIds(filtered, ["recent-intune", "security-tanium"]);
    assertLabels(getActiveFilterItems({ ...initialFilterState, salaryOnly: true }), ["Salary shown"]);
  });

  await run("FEAT-011", "Role family filter matches exact role families", () => {
    assertIds(
      filterJobs(filterFixtureJobs, {
        ...initialFilterState,
        roleFamily: "Endpoint Security"
      }),
      ["security-tanium"]
    );
  });

  await run("FEAT-012", "Posted-age freshness filters use postedAt age", () => {
    assertLabels(getActiveFilterItems({ ...initialFilterState, freshness: "1" }), [
      "Last 1 day"
    ]);
    assertIds(filterJobs(filterFixtureJobs, { ...initialFilterState, freshness: "7" }), [
      "recent-intune"
    ]);
    assertIds(filterJobs(filterFixtureJobs, { ...initialFilterState, freshness: "14" }), [
      "recent-intune",
      "mac-jamf"
    ]);
  });

  await run("FEAT-013", "Platform multi-select matches any selected platform", () => {
    assertIds(
      filterJobs(filterFixtureJobs, {
        ...initialFilterState,
        selectedPlatforms: ["macOS", "Linux"]
      }),
      ["mac-jamf", "security-tanium"]
    );
    const next = filterReducer(initialFilterState, { type: "togglePlatform", value: "macOS" });
    assertEqual(next.selectedPlatforms[0], "macOS");
  });

  await run("FEAT-016", "Seniority filter matches exact seniority", () => {
    assertIds(filterJobs(filterFixtureJobs, { ...initialFilterState, seniority: "Staff" }), [
      "security-tanium"
    ]);
  });

  await run("FEAT-017", "Sort options order by newest, compensation, and company", () => {
    assertIds(filterJobs(filterFixtureJobs, { ...initialFilterState, sort: "newest" }), [
      "recent-intune",
      "mac-jamf",
      "security-tanium"
    ]);
    assertIds(filterJobs(filterFixtureJobs, { ...initialFilterState, sort: "salary" }), [
      "security-tanium",
      "recent-intune",
      "mac-jamf"
    ]);
    assertIds(filterJobs(filterFixtureJobs, { ...initialFilterState, sort: "company" }), [
      "mac-jamf",
      "recent-intune",
      "security-tanium"
    ]);
  });

  await run("FEAT-018", "Tool multi-select matches any selected tool", () => {
    assertIds(
      filterJobs(filterFixtureJobs, {
        ...initialFilterState,
        selectedTools: ["Jamf", "Defender"]
      }),
      ["mac-jamf", "security-tanium"]
    );
    const next = filterReducer(initialFilterState, { type: "toggleTool", value: "Jamf" });
    assertEqual(next.selectedTools[0], "Jamf");

    assertIds(
      filterJobs(filterFixtureJobs, {
        ...initialFilterState,
        selectedTools: ["PowerShell"]
      }),
      ["recent-intune"]
    );

    const workspaceJob = makeJob({ id: "workspace-admin", tools: ["Google Workspace"] });
    assertIds(
      filterJobs([workspaceJob, ...filterFixtureJobs], {
        ...initialFilterState,
        selectedTools: ["Google Workspace"]
      }),
      ["workspace-admin"]
    );
  });

  await run("FEAT-019", "Active filter chips expose removable labels and clear actions", () => {
    const items = getActiveFilterItems({
      ...initialFilterState,
      query: " Jamf ",
      locationQuery: " Remote ",
      selectedPlatforms: ["macOS"],
      selectedTools: ["Kandji"],
      workplace: "Remote",
      salaryOnly: true,
      seniority: "Senior",
      roleFamily: "Endpoint Security",
      freshness: "7",
      sort: "salary"
    });
    assertLabels(items, [
      "Search: Jamf",
      "Location: Remote",
      "Remote",
      "Salary shown",
      "Endpoint Security",
      "Last 7 days",
      "Senior",
      "Sort: Compensation",
      "macOS",
      "Kandji/Iru"
    ]);
    items.forEach((item) => assertTruthy(item.clearAction, `${item.id} missing clear action`));
  });

  await run("FEAT-020", "Filter state serializes to shareable URL params", () => {
    const parsed = filterStateFromSearchParams(
      new URLSearchParams(
        "q=Jamf&platforms=macOS,Nope&tools=Jamf,PowerShell,Bad&location=Austin&remote=1&salary=1&minSalary=150000&seniority=Senior&family=Endpoint%20Security&freshness=1&sort=company"
      )
    );
    assertEqual(parsed.query, "Jamf");
    assertEqual(parsed.locationQuery, "Austin");
    assertEqual(parsed.workplace, "Remote");
    assertEqual(parsed.salaryOnly, true);
    assertEqual(parsed.minimumSalary, "150000");
    assertEqual(parsed.selectedPlatforms.join(","), "macOS");
    assertEqual(parsed.selectedTools.join(","), "Jamf,PowerShell");
    assertEqual(parsed.roleFamily, "Endpoint Security");
    assertEqual(parsed.freshness, "1");
    assertEqual(parsed.sort, "company");

    const systemsAdministration = filterStateFromSearchParams(
      new URLSearchParams("family=Systems%20Administration")
    );
    assertEqual(systemsAdministration.roleFamily, "Systems Administration");
    assertArrayIncludes(roleFamilyOptions, ["Systems Administration"]);

    const renamedAndNewTools = filterStateFromSearchParams(
      new URLSearchParams("tools=Kandji,Google%20Workspace")
    );
    assertEqual(renamedAndNewTools.selectedTools.join(","), "Kandji,Google Workspace");

    const merged = mergeFilterStateIntoSearchParams(
      new URLSearchParams("keep=1&locations=legacy&remote=1"),
      {
        ...initialFilterState,
        query: "Intune",
        selectedPlatforms: ["Windows"],
        salaryOnly: true,
        minimumSalary: "120000",
        freshness: "1"
      }
    );
    assertEqual(merged.get("keep"), "1");
    assertEqual(merged.get("locations"), null);
    assertEqual(merged.get("remote"), null);
    assertEqual(merged.get("q"), "Intune");
    assertEqual(merged.get("platforms"), "Windows");
    assertEqual(merged.get("salary"), "1");
    assertEqual(merged.get("minSalary"), "120000");
    assertEqual(merged.get("freshness"), "1");
  });

  await run("FEAT-077", "European metro area filters match by name and aliases", () => {
    const europeanMetros = [
      "London, UK",
      "Berlin, Germany",
      "Frankfurt, Germany",
      "Munich, Germany",
      "Paris, France",
      "Madrid, Spain",
      "Barcelona, Spain",
      "Milan, Italy",
      "Zurich, Switzerland"
    ] as const;
    assertArrayIncludes([...metroAreaOptions], [...europeanMetros]);

    const europeanJobs = [
      makeJob({ id: "london-intune", location: "London, UK" }),
      makeJob({ id: "munich-jamf", location: "Munich, Germany" }),
      makeJob({ id: "munchen-alias", location: "München, Bavaria" }),
      makeJob({ id: "paris-diacritic", location: "Île-de-France, France" }),
      makeJob({ id: "zurich-umlaut", location: "Zürich, ZH", postedAt: "2026-07-18T00:00:00.000Z" }),
      makeJob({ id: "zurich-mdm", location: "Zurich, Switzerland", postedAt: "2026-07-19T00:00:00.000Z" }),
      makeJob({ id: "seattle-kandji", location: "Seattle, WA" })
    ];

    assertIds(
      filterJobs(europeanJobs, { ...initialFilterState, selectedMetroAreas: ["London, UK"] }),
      ["london-intune"]
    );
    assertIds(
      filterJobs(europeanJobs, { ...initialFilterState, selectedMetroAreas: ["Zurich, Switzerland"] }),
      ["zurich-mdm", "zurich-umlaut"]
    );
    assertIds(
      filterJobs(europeanJobs, { ...initialFilterState, selectedMetroAreas: ["Paris, France"] }),
      ["paris-diacritic"]
    );
    // Umlaut/ASCII aliases resolve to the same metro.
    const munichMatches = filterJobs(europeanJobs, {
      ...initialFilterState,
      selectedMetroAreas: ["Munich, Germany"]
    });
    assertIds(munichMatches, ["munich-jamf", "munchen-alias"]);

    const merged = mergeFilterStateIntoSearchParams(new URLSearchParams(), {
      ...initialFilterState,
      selectedMetroAreas: ["Berlin, Germany"]
    });
    assertEqual(merged.get("metroAreas"), "Berlin, Germany");
    const parsed = filterStateFromSearchParams(
      new URLSearchParams("metroAreas=Berlin%2C%20Germany%7CParis%2C%20France")
    );
    assertEqual(parsed.selectedMetroAreas.join(" / "), "Berlin, Germany / Paris, France");
  });

  await run("FEAT-077", "South American metro area filters match Portuguese and Spanish aliases", () => {
    const southAmericanMetros = [
      "São Paulo, Brazil",
      "Rio de Janeiro, Brazil",
      "Buenos Aires, Argentina",
      "Bogotá, Colombia",
      "Santiago, Chile",
      "Lima, Peru",
      "Medellín, Colombia"
    ] as const;
    assertArrayIncludes([...metroAreaOptions], [...southAmericanMetros]);

    const southAmericanJobs = [
      makeJob({ id: "sao-paulo-intune", location: "São Paulo, Brasil" }),
      makeJob({ id: "sao-paulo-ascii", location: "Sao Paulo, SP, Brazil" }),
      makeJob({ id: "rio-jamf", location: "Rio de Janeiro, Brazil" }),
      makeJob({ id: "bogota-mdm", location: "Bogotá, Colombia" }),
      makeJob({ id: "santiago-chile", location: "Santiago, Chile" }),
      makeJob({ id: "lima-peru", location: "Lima, Perú" }),
      makeJob({ id: "buenos-aires-uem", location: "Buenos Aires, Argentina" }),
      makeJob({ id: "caba-uem", location: "CABA, Argentina" }),
      makeJob({
        id: "puerto-rico-buenos-aires",
        location: "Urbanización Buenos Aires, Santa Isabel"
      }),
      makeJob({ id: "seattle-kandji", location: "Seattle, WA" }),
      makeJob({
        id: "austin-onsite",
        location: "Austin, TX",
        workplace: "On-site",
        summary: "On-site endpoint engineer in Austin with occasional LATAM customer travel."
      })
    ];

    assertIds(
      filterJobs(southAmericanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["São Paulo, Brazil"]
      }),
      ["sao-paulo-intune", "sao-paulo-ascii"]
    );
    assertIds(
      filterJobs(southAmericanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["Rio de Janeiro, Brazil"]
      }),
      ["rio-jamf"]
    );
    assertIds(
      filterJobs(southAmericanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["Bogotá, Colombia"]
      }),
      ["bogota-mdm"]
    );
    assertIds(
      filterJobs(southAmericanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["Santiago, Chile"]
      }),
      ["santiago-chile"]
    );
    assertIds(
      filterJobs(southAmericanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["Lima, Peru"]
      }),
      ["lima-peru"]
    );
    assertIds(
      filterJobs(southAmericanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["Buenos Aires, Argentina"]
      }),
      ["buenos-aires-uem", "caba-uem"]
    );
    assertIds(
      filterJobs(southAmericanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["São Paulo, Brazil"]
      }).filter((job) => job.id === "austin-onsite"),
      []
    );

    const merged = mergeFilterStateIntoSearchParams(new URLSearchParams(), {
      ...initialFilterState,
      selectedMetroAreas: ["São Paulo, Brazil"]
    });
    assertEqual(merged.get("metroAreas"), "São Paulo, Brazil");
  });
}
