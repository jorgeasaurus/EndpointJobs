import { getActiveFilterItems } from "../../src/components/job-board/active-filters";
import {
  filterJobs,
  filterReducer,
  initialFilterState
} from "../../src/components/job-board/filter-model";
import {
  filterStateFromLocation,
  filterStateFromSearchParams,
  getBoardPathnameForFilters,
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

export async function auditFilters({ filterFixtureJobs, run, sources }: AuditContext) {
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
    const mexicoCityJob = makeJob({
      id: "mexico-city-country-search",
      location: "Ciudad de México, México",
      mapLocation: {
        label: "Mexico City, Mexico",
        latitude: 19.4326,
        longitude: -99.1332
      }
    });
    const cdmxJob = makeJob({
      id: "cdmx-country-search",
      location: "CDMX, Mexico",
      mapLocation: {
        label: "Mexico City, Mexico",
        latitude: 19.4326,
        longitude: -99.1332
      }
    });
    const centralAmericaRemoteJob = makeJob({
      id: "central-america-remote-country-search",
      location: "Central America, Remote",
      workplace: "Remote",
      mapLocation: {
        label: "Central America",
        latitude: 12.769,
        longitude: -85.6024
      }
    });
    for (const locationQuery of ["Mexico", "México", "Mexico City", "Ciudad de México"]) {
      assertIds(
        filterJobs([mexicoCityJob], { ...initialFilterState, locationQuery }),
        ["mexico-city-country-search"]
      );
    }
    assertIds(
      filterJobs([cdmxJob], { ...initialFilterState, locationQuery: "CDMX" }),
      ["cdmx-country-search"]
    );
    for (const locationQuery of ["Central America", "Remote"]) {
      assertIds(
        filterJobs([centralAmericaRemoteJob], { ...initialFilterState, locationQuery }),
        ["central-america-remote-country-search"]
      );
    }
    assertIds(
      filterJobs(filterFixtureJobs, { ...initialFilterState, locationQuery: "" }),
      ["recent-intune", "mac-jamf", "security-tanium"]
    );
    const locationGateIndex = sources.jobFilters.indexOf("if (location)");
    const locationHaystackIndex = sources.jobFilters.indexOf("locationHaystack");
    assertTruthy(
      locationGateIndex >= 0 && locationGateIndex < locationHaystackIndex,
      "location folding must stay gated on a non-empty locationQuery"
    );
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

    const pathOnly = filterStateFromLocation("/intune", new URLSearchParams());
    assertEqual(pathOnly.selectedTools.join(","), "Intune");
    assertEqual(
      getBoardPathnameForFilters({ ...initialFilterState, selectedTools: ["Intune"] }),
      "/intune"
    );
    assertEqual(
      getBoardPathnameForFilters({
        ...initialFilterState,
        selectedTools: ["Intune", "Jamf"]
      }),
      "/"
    );
    const pathAndQuery = filterStateFromLocation(
      "/intune",
      new URLSearchParams("tools=Jamf")
    );
    assertEqual(pathAndQuery.selectedTools.join(","), "Intune,Jamf");
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

  await run("FEAT-077", "Mexico and Central American metro area filters match Spanish aliases", () => {
    const mexicoCentralAmericanMetros = [
      "Mexico City, Mexico",
      "Guadalajara, Mexico",
      "Monterrey, Mexico",
      "San José, Costa Rica",
      "Panama City, Panama",
      "Guatemala City, Guatemala",
      "San Salvador, El Salvador",
      "Tegucigalpa, Honduras",
      "Managua, Nicaragua"
    ] as const;
    assertArrayIncludes([...metroAreaOptions], [...mexicoCentralAmericanMetros]);

    const mexicoCentralAmericanJobs = [
      makeJob({ id: "mexico-city-intune", location: "Ciudad de México, México" }),
      makeJob({ id: "mexico-city-cdmx", location: "CDMX, Mexico" }),
      makeJob({ id: "mexico-city-ascii", location: "Mexico City, MX" }),
      makeJob({ id: "guadalajara-jamf", location: "Guadalajara, Jalisco, México" }),
      makeJob({ id: "monterrey-mdm", location: "Monterrey, Nuevo León, Mexico" }),
      makeJob({ id: "san-jose-cr-uem", location: "San José, Costa Rica" }),
      makeJob({ id: "san-jose-cr-code", location: "San Jose, CR" }),
      makeJob({ id: "san-jose-ca", location: "San Jose, CA" }),
      makeJob({ id: "san-jose-accented", location: "San José" }),
      makeJob({ id: "san-jose-unaccented", location: "San Jose" }),
      makeJob({ id: "panama-city-pa", location: "Panama City, Panama" }),
      makeJob({ id: "panama-city-fl", location: "Panama City, FL" }),
      makeJob({ id: "guatemala-city-uem", location: "Guatemala City, Guatemala" }),
      makeJob({ id: "san-salvador-uem", location: "San Salvador, El Salvador" }),
      makeJob({ id: "tegucigalpa-uem", location: "Tegucigalpa, Honduras" }),
      makeJob({ id: "managua-uem", location: "Managua, Nicaragua" }),
      makeJob({ id: "mexico-ny", location: "Mexico, NY" }),
      makeJob({ id: "new-mexico", location: "Albuquerque, New Mexico" }),
      makeJob({ id: "albuquerque-nm", location: "Albuquerque, NM" }),
      makeJob({ id: "santa-fe-nm", location: "Santa Fe, New Mexico" }),
      makeJob({ id: "las-cruces-nm", location: "Las Cruces, NM" }),
      makeJob({ id: "silver-city-nm", location: "Silver City, NM" }),
      makeJob({
        id: "austin-onsite-mexico",
        location: "Austin, TX",
        workplace: "On-site",
        summary: "On-site endpoint engineer in Austin with occasional Mexico and LATAM customer travel."
      })
    ];

    assertIds(
      filterJobs(mexicoCentralAmericanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["Mexico City, Mexico"]
      }),
      ["mexico-city-intune", "mexico-city-cdmx", "mexico-city-ascii"]
    );
    assertIds(
      filterJobs(mexicoCentralAmericanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["Guadalajara, Mexico"]
      }),
      ["guadalajara-jamf"]
    );
    assertIds(
      filterJobs(mexicoCentralAmericanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["Monterrey, Mexico"]
      }),
      ["monterrey-mdm"]
    );
    assertIds(
      filterJobs(mexicoCentralAmericanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["San José, Costa Rica"]
      }),
      ["san-jose-cr-uem", "san-jose-cr-code"]
    );
    assertIds(
      filterJobs(mexicoCentralAmericanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["San Jose, CA"]
      }),
      ["san-jose-ca", "san-jose-unaccented"]
    );
    assertIds(
      filterJobs(mexicoCentralAmericanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["San Jose, CA"]
      }).filter((job) => job.id === "san-jose-accented" || job.id === "san-jose-cr-uem" || job.id === "san-jose-cr-code"),
      []
    );
    assertIds(
      filterJobs(mexicoCentralAmericanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["San José, Costa Rica"]
      }).filter((job) => job.id === "san-jose-ca" || job.id === "san-jose-accented" || job.id === "san-jose-unaccented"),
      []
    );
    assertIds(
      filterJobs(mexicoCentralAmericanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["Panama City, Panama"]
      }),
      ["panama-city-pa"]
    );
    assertIds(
      filterJobs(mexicoCentralAmericanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["Guatemala City, Guatemala"]
      }),
      ["guatemala-city-uem"]
    );
    assertIds(
      filterJobs(mexicoCentralAmericanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["San Salvador, El Salvador"]
      }),
      ["san-salvador-uem"]
    );
    assertIds(
      filterJobs(mexicoCentralAmericanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["Tegucigalpa, Honduras"]
      }),
      ["tegucigalpa-uem"]
    );
    assertIds(
      filterJobs(mexicoCentralAmericanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["Managua, Nicaragua"]
      }),
      ["managua-uem"]
    );
    assertIds(
      filterJobs(mexicoCentralAmericanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["Mexico City, Mexico"]
      }).filter((job) =>
        [
          "austin-onsite-mexico",
          "mexico-ny",
          "new-mexico",
          "albuquerque-nm",
          "santa-fe-nm",
          "las-cruces-nm",
          "silver-city-nm"
        ].includes(job.id)
      ),
      []
    );

    const merged = mergeFilterStateIntoSearchParams(new URLSearchParams(), {
      ...initialFilterState,
      selectedMetroAreas: ["Mexico City, Mexico"]
    });
    assertEqual(merged.get("metroAreas"), "Mexico City, Mexico");
  });

  await run("FEAT-077", "Andean and Caribbean metro area filters match Spanish aliases", () => {
    const andeanCaribbeanMetros = [
      "Quito, Ecuador",
      "Guayaquil, Ecuador",
      "Montevideo, Uruguay",
      "Asunción, Paraguay",
      "La Paz, Bolivia",
      "Santa Cruz, Bolivia",
      "Santo Domingo, Dominican Republic",
      "Kingston, Jamaica",
      "San Juan, Puerto Rico"
    ] as const;
    assertArrayIncludes([...metroAreaOptions], [...andeanCaribbeanMetros]);

    const andeanCaribbeanJobs = [
      makeJob({ id: "quito-intune", location: "Quito, Ecuador" }),
      makeJob({ id: "guayaquil-jamf", location: "Guayaquil, Ecuador" }),
      makeJob({ id: "montevideo-uem", location: "Montevideo, Uruguay" }),
      makeJob({ id: "asuncion-mdm", location: "Asunción, Paraguay" }),
      makeJob({ id: "la-paz-bo", location: "La Paz, Bolivia" }),
      makeJob({ id: "santa-cruz-bo", location: "Santa Cruz de la Sierra, Bolivia" }),
      makeJob({ id: "santa-cruz-ca", location: "Santa Cruz, CA" }),
      makeJob({ id: "santo-domingo-dr", location: "Santo Domingo, Dominican Republic" }),
      makeJob({ id: "santo-domingo-pueblo", location: "Santo Domingo Pueblo, NM" }),
      makeJob({ id: "kingston-jm", location: "Kingston, Jamaica" }),
      makeJob({ id: "kingston-ny", location: "Kingston, NY" }),
      makeJob({ id: "jamaica-queens", location: "Jamaica, Queens" }),
      makeJob({ id: "jamaica-ny", location: "Jamaica, NY" }),
      makeJob({ id: "san-juan-pr", location: "San Juan, Puerto Rico" }),
      makeJob({ id: "san-juan-pr-code", location: "San Juan, PR" }),
      makeJob({ id: "san-juan-capistrano", location: "San Juan Capistrano, CA" }),
      makeJob({
        id: "austin-onsite-caribbean",
        location: "Austin, TX",
        workplace: "On-site",
        summary: "On-site endpoint engineer in Austin with occasional Caribbean and Ecuador customer travel."
      })
    ];

    assertIds(
      filterJobs(andeanCaribbeanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["Quito, Ecuador"]
      }),
      ["quito-intune"]
    );
    assertIds(
      filterJobs(andeanCaribbeanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["Guayaquil, Ecuador"]
      }),
      ["guayaquil-jamf"]
    );
    assertIds(
      filterJobs(andeanCaribbeanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["Montevideo, Uruguay"]
      }),
      ["montevideo-uem"]
    );
    assertIds(
      filterJobs(andeanCaribbeanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["Asunción, Paraguay"]
      }),
      ["asuncion-mdm"]
    );
    assertIds(
      filterJobs(andeanCaribbeanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["La Paz, Bolivia"]
      }),
      ["la-paz-bo"]
    );
    assertIds(
      filterJobs(andeanCaribbeanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["Santa Cruz, Bolivia"]
      }),
      ["santa-cruz-bo"]
    );
    assertIds(
      filterJobs(andeanCaribbeanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["Santo Domingo, Dominican Republic"]
      }),
      ["santo-domingo-dr"]
    );
    assertIds(
      filterJobs(andeanCaribbeanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["Kingston, Jamaica"]
      }),
      ["kingston-jm"]
    );
    assertIds(
      filterJobs(andeanCaribbeanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["San Juan, Puerto Rico"]
      }),
      ["san-juan-pr", "san-juan-pr-code"]
    );
    assertIds(
      filterJobs(andeanCaribbeanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["Santa Cruz, Bolivia"]
      }).filter((job) => job.id === "santa-cruz-ca"),
      []
    );
    assertIds(
      filterJobs(andeanCaribbeanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["Kingston, Jamaica"]
      }).filter((job) => ["kingston-ny", "jamaica-queens", "jamaica-ny"].includes(job.id)),
      []
    );
    assertIds(
      filterJobs(andeanCaribbeanJobs, {
        ...initialFilterState,
        selectedMetroAreas: ["San Juan, Puerto Rico"]
      }).filter((job) => job.id === "san-juan-capistrano" || job.id === "austin-onsite-caribbean"),
      []
    );

    const quitoJob = makeJob({
      id: "quito-country-search",
      location: "Quito, Ecuador",
      mapLocation: {
        label: "Quito, Ecuador",
        latitude: -0.1807,
        longitude: -78.4678
      }
    });
    const caribbeanRemoteJob = makeJob({
      id: "caribbean-remote-country-search",
      location: "Caribbean, Remote",
      workplace: "Remote",
      mapLocation: {
        label: "Caribbean",
        latitude: 15.0,
        longitude: -73.0
      }
    });
    for (const locationQuery of ["Ecuador", "Quito"]) {
      assertIds(
        filterJobs([quitoJob], { ...initialFilterState, locationQuery }),
        ["quito-country-search"]
      );
    }
    for (const locationQuery of ["Caribbean", "Remote"]) {
      assertIds(
        filterJobs([caribbeanRemoteJob], { ...initialFilterState, locationQuery }),
        ["caribbean-remote-country-search"]
      );
    }

    const merged = mergeFilterStateIntoSearchParams(new URLSearchParams(), {
      ...initialFilterState,
      selectedMetroAreas: ["San Juan, Puerto Rico"]
    });
    assertEqual(merged.get("metroAreas"), "San Juan, Puerto Rico");
  });
}
