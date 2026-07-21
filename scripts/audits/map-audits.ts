import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { initialFilterState, filterJobs } from "../../src/components/job-board/filter-model";
import { JobMapPopupContent } from "../../src/components/job-board/job-map-popup";
import { buildJobMapPoints } from "../../src/lib/job-map";
import { isActiveJob } from "../../src/lib/jobs";
import {
  buildFeatureCollection,
  readJobPreview
} from "../../src/components/job-board/job-map-features";
import { resolveJobMapLocation } from "../job-refresh/map-location";

import {
  assertEqual,
  assertIncludes,
  assertNoStaticImport,
  assertNotIncludes,
  assertTruthy,
  fixedAuditNow,
  makeJob,
  type AuditContext
} from "./shared";

export async function auditMaps({ feed, run, sources }: AuditContext) {
  await run("FEAT-061", "Mapped count and ratio come from active job map points", () => {
    const activeJobs = feed.jobs.filter((job) => isActiveJob(job, fixedAuditNow));
    const activeJobsWithMapLocation = activeJobs.filter((job) => job.mapLocation);
    const fallbackResolvedJobs = activeJobs.filter(
      (job) => !job.mapLocation && resolveJobMapLocation(job.location)
    );
    const points = buildJobMapPoints(activeJobs);
    const mappedScenarioJob = activeJobs.find((job) => job.mapLocation);
    assertTruthy(mappedScenarioJob, "active feed has no mapped scenario job");
    const mappedLocationJobs = filterJobs(activeJobs, {
      ...initialFilterState,
      locationQuery: mappedScenarioJob?.location ?? ""
    });
    const mappedLocationPoints = buildJobMapPoints(mappedLocationJobs);

    assertTruthy(points.length > 0, "active feed has no mapped jobs");
    assertTruthy(
      points.length >= Math.floor(activeJobs.length * 0.5),
      `mapped coverage too low: ${points.length} of ${activeJobs.length}`
    );
    assertTruthy(points.length <= activeJobs.length, "mapped points exceed active jobs");
    assertEqual(points.length, activeJobsWithMapLocation.length, "map points should come from persisted mapLocation");
    assertEqual(fallbackResolvedJobs.length, 0, "active feed relies on client map-location fallback");
    assertTruthy(mappedLocationJobs.length > 0, "mapped location filter returned no jobs");
    assertTruthy(mappedLocationPoints.length > 0, "mapped location filter returned no mapped jobs");
    assertNoStaticImport(sources.jobMap, "./job-map-canvas", "map canvas should not be a static import");
    assertIncludes(sources.jobMap, "const mappedJobCount = points.length");
    assertIncludes(sources.jobMap, "{mappedJobCount} of {jobs.length}");
    assertIncludes(sources.jobMapFeatures, "buildFeatureCollection");
    assertIncludes(sources.refresh, "addResolvedMapLocation");
    assertNoStaticImport(sources.jobMapLib, "./map-location", "client map should not import resolver table");
    assertIncludes(sources.companyAts, "parseWorkdayLocationFromExternalPath");
  });

  await run("FEAT-062", "Per-job map points preserve duplicate-coordinate jobs", () => {
    const jobs = [
      makeJob({
        id: "map-a",
        mapLocation: { label: "Seattle, WA", latitude: 47.6062, longitude: -122.3321 }
      }),
      makeJob({
        id: "map-b",
        mapLocation: { label: "Seattle, WA", latitude: 47.6062, longitude: -122.3321 }
      }),
      makeJob({ id: "map-unmapped", mapLocation: undefined })
    ];
    const points = buildJobMapPoints(jobs);
    assertEqual(points.length, 2);
    assertEqual(new Set(points.map((point) => point.id)).size, 2);
    assertEqual(points.every((point) => point.latitude === 47.6062), true);
    assertIncludes(sources.jobMapFeatures, "buildFeatureCollection");
  });

  await run("FEAT-064", "Map popup content includes job details and safe apply links", () => {
    const [point] = buildJobMapPoints([
      makeJob({
        id: "popup-job",
        title: "Map Endpoint Engineer",
        company: "Map Company",
        mapLocation: { label: "Seattle, WA", latitude: 47.6062, longitude: -122.3321 },
        salary: { min: 140000, max: 160000, currency: "USD", label: "$140k-$160k" },
        applyUrl: "https://example.com/map-apply"
      })
    ]);
    const feature = buildFeatureCollection([point]).features[0];
    const preview = readJobPreview(feature);
    if (!preview) {
      throw new Error("missing popup preview");
    }
    assertEqual(preview?.title, "Map Endpoint Engineer");
    assertEqual(preview?.company, "Map Company");
    assertEqual(preview?.salary, "$140k-$160k");
    assertEqual(preview?.applyUrl, "https://example.com/map-apply");

    const markup = renderToStaticMarkup(
      createElement(JobMapPopupContent, {
        popup: {
          count: 3,
          jobs: [preview],
          key: "cluster:1:3",
          label: "3 jobs near Seattle, WA",
          latitude: 47.6062,
          longitude: -122.3321,
          type: "cluster"
        }
      })
    );
    assertIncludes(markup, "Map Endpoint Engineer");
    assertIncludes(markup, "Map Company");
    assertIncludes(markup, "$140k-$160k");
    assertIncludes(markup, "https://example.com/map-apply");
    assertIncludes(markup, 'rel="noopener noreferrer"');
    assertIncludes(markup, 'target="_blank"');
    assertIncludes(markup, "Showing 1 of 3");
  });

  await run("FEAT-065", "Mobile map detail sheet is wired for selected jobs", () => {
    assertIncludes(sources.jobMapCanvas, "JobMapMobileSheet");
    assertIncludes(sources.jobMapCanvas, "Close selected job");
    assertIncludes(sources.jobMapCss, ".job-map-mobile-sheet");
    assertIncludes(sources.jobMapCss, ".job-map-popup");
    assertIncludes(sources.jobMapCss, "display: none;");
    assertIncludes(sources.jobMapCss, "bottom: calc(66px + env(safe-area-inset-bottom))");
  });

  await run("FEAT-066", "Map visual treatment and attribution match the page", () => {
    assertIncludes(sources.jobMapCss, "--map-highlight: var(--lime)");
    assertIncludes(sources.jobMapCss, "--map-highlight-dark: var(--emerald)");
    assertIncludes(sources.jobMapCss, "border-radius: 8px");
    assertIncludes(sources.jobMapCss, ".maplibregl-canvas-container", "scoped map canvas CSS");
    assertIncludes(sources.jobMapCss, ".maplibregl-popup-anchor-bottom", "scoped map popup CSS");
    assertIncludes(sources.jobMapCss, ".maplibregl-cooperative-gesture-screen", "scoped cooperative gesture CSS");
    assertNotIncludes(sources.layout, "maplibre-gl/dist/maplibre-gl.css", "layout should not import global MapLibre CSS");
    assertIncludes(sources.jobMapConfig, "carto-dark");
    assertIncludes(sources.jobMapCanvas, "OpenStreetMap");
    assertIncludes(sources.jobMapCanvas, "CARTO");
  });

  await run("FEAT-069", "Map location resolver maps known places and skips ambiguous rows", () => {
    assertEqual(resolveJobMapLocation("San Francisco, CA")?.label, "San Francisco, CA");
    assertEqual(resolveJobMapLocation("Berlin, Germany")?.label, "Berlin, Germany");
    assertEqual(resolveJobMapLocation("Berlin, DE")?.label, "Berlin, Germany");
    assertEqual(resolveJobMapLocation("München, Deutschland")?.label, "Munich, Germany");
    assertEqual(resolveJobMapLocation("Germany")?.label, "Germany");
    assertEqual(
      resolveJobMapLocation("Sydney, New South Wales, Australia")?.label,
      "Sydney, Australia"
    );
    assertEqual(
      resolveJobMapLocation("Canberra, Australian Capital Territory, Australia")?.label,
      "Canberra, Australia"
    );
    assertEqual(resolveJobMapLocation("Perth, WA, Australia")?.label, "Perth, Australia");
    assertEqual(resolveJobMapLocation("Australia")?.label, "Australia");
    assertEqual(resolveJobMapLocation("Stuttgart, AR"), undefined);
    assertEqual(resolveJobMapLocation("Stuttgart, AR 72150"), undefined);
    assertEqual(
      resolveJobMapLocation("Stuttgart, AR, United States")?.label,
      "United States"
    );
    for (const [location, label] of [
      ["Frankfurt am Main, Germany", "Frankfurt, Germany"],
      ["Köln, Deutschland", "Cologne, Germany"],
      ["Koeln, Germany", "Cologne, Germany"],
      ["Muenchen, Germany", "Munich, Germany"],
      ["Stuttgart, Germany", "Stuttgart, Germany"],
      ["Düsseldorf, Germany", "Düsseldorf, Germany"],
      ["Duesseldorf, Germany", "Düsseldorf, Germany"]
    ] as const) {
      assertEqual(resolveJobMapLocation(location)?.label, label);
    }
    assertEqual(resolveJobMapLocation("NYC")?.label, "New York, NY");
    assertEqual(resolveJobMapLocation("United States")?.label, "United States");
    assertEqual(resolveJobMapLocation("Hawthorne, CA")?.label, "Los Angeles, CA");
    assertEqual(resolveJobMapLocation("Jacks Cabin, Gunnison County")?.label, "Denver, CO");
    assertEqual(resolveJobMapLocation("Newark, New Castle County")?.label, "Wilmington, DE");
    assertEqual(resolveJobMapLocation("Paris, France")?.label, "Paris, France");
    assertEqual(resolveJobMapLocation("La-Madeleine, Lille")?.label, "Lille, France");
    assertEqual(resolveJobMapLocation("Toulouse, Haute-Garonne")?.label, "Toulouse, France");
    assertEqual(resolveJobMapLocation("Hérault, Occitanie")?.label, "Montpellier, France");
    assertEqual(resolveJobMapLocation("Barcelona, Spain")?.label, "Barcelona, Spain");
    assertEqual(resolveJobMapLocation("Albacete")?.label, "Albacete, Spain");
    assertEqual(resolveJobMapLocation("Vitoria-Gasteiz, Alava")?.label, "Vitoria-Gasteiz, Spain");
    assertEqual(resolveJobMapLocation("España")?.label, "Spain");
    assertEqual(resolveJobMapLocation("Milano, Italia")?.label, "Milan, Italy");
    assertEqual(resolveJobMapLocation("Zürich")?.label, "Zurich, Switzerland");
    assertEqual(resolveJobMapLocation("Fehraltorf (Zurich), Switzerland")?.label, "Zurich, Switzerland");
    assertEqual(resolveJobMapLocation("Köniz, Bern-Mittelland")?.label, "Bern, Switzerland");
    assertEqual(resolveJobMapLocation("Zollikofen, Bern-Mittelland")?.label, "Bern, Switzerland");
    assertEqual(resolveJobMapLocation("Basel (City)")?.label, "Basel, Switzerland");
    assertEqual(resolveJobMapLocation("Genf")?.label, "Geneva, Switzerland");
    assertEqual(resolveJobMapLocation("Kriens, Luzern-Land")?.label, "Lucerne, Switzerland");
    assertEqual(resolveJobMapLocation("Le Mont-sur-Lausanne, Lausanne")?.label, "Lausanne, Switzerland");
    assertEqual(resolveJobMapLocation("Switzerland")?.label, "Switzerland");
    assertEqual(resolveJobMapLocation("12 locations"), undefined);
    assertIncludes(sources.mapLocation, "locationCoordinates");
    assertIncludes(sources.mapLocation, "searchableLocationCoordinates");
    assertIncludes(sources.mapLocation, "normalizedKeys");
    assertIncludes(sources.shared, "resolveJobMapLocation(location)");
  });
}
