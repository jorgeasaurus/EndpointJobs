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
    const mapCss = sources.jobMapCss.replace(/\s+/g, " ");
    assertIncludes(
      mapCss,
      ".maplibregl-map { position: absolute; inset: 0; z-index: 0;",
      "map canvas stacking context stays below chrome"
    );
    assertIncludes(
      mapCss,
      ".job-map-attribution { position: absolute; bottom: 12px; left: 12px; z-index: 5;",
      "attribution stacks above map canvas"
    );
    assertIncludes(
      mapCss,
      ".job-map-controls { position: absolute; right: 12px; bottom: 12px; z-index: 5;",
      "zoom controls stack above map canvas"
    );
    assertNotIncludes(sources.layout, "maplibre-gl/dist/maplibre-gl.css", "layout should not import global MapLibre CSS");
    assertIncludes(sources.jobMapConfig, "carto-dark");
    assertIncludes(sources.jobMapCanvas, "OpenStreetMap");
    assertIncludes(sources.jobMapCanvas, "CARTO");
  });

  await run("FEAT-069", "Map location resolver maps known places and skips ambiguous rows", () => {
    assertEqual(resolveJobMapLocation("San Francisco, CA")?.label, "San Francisco, CA");
    assertEqual(resolveJobMapLocation("Mooresville, NC")?.label, "Mooresville, NC");
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
    assertEqual(resolveJobMapLocation("Valencia, Spain")?.label, "Valencia, Spain");
    assertEqual(resolveJobMapLocation("Valencia, CA"), undefined);
    assertEqual(resolveJobMapLocation("Sevilla, España")?.label, "Seville, Spain");
    assertEqual(resolveJobMapLocation("Seville, Spain")?.label, "Seville, Spain");
    assertEqual(resolveJobMapLocation("Bilbao, Spain")?.label, "Bilbao, Spain");
    assertEqual(resolveJobMapLocation("Málaga, Spain")?.label, "Málaga, Spain");
    assertEqual(resolveJobMapLocation("Malaga")?.label, "Málaga, Spain");
    assertEqual(resolveJobMapLocation("Zaragoza, Spain")?.label, "Zaragoza, Spain");
    assertEqual(resolveJobMapLocation("Palma de Mallorca, Spain")?.label, "Palma, Spain");
    assertEqual(resolveJobMapLocation("Palma, Spain")?.label, "Palma, Spain");
    assertEqual(resolveJobMapLocation("Palma"), undefined);
    assertEqual(resolveJobMapLocation("Albacete")?.label, "Albacete, Spain");
    assertEqual(resolveJobMapLocation("Vitoria-Gasteiz, Alava")?.label, "Vitoria-Gasteiz, Spain");
    assertEqual(resolveJobMapLocation("España")?.label, "Spain");
    assertEqual(resolveJobMapLocation("Spain, IN"), undefined);
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
    assertEqual(resolveJobMapLocation("São Paulo, Brasil")?.label, "São Paulo, Brazil");
    assertEqual(resolveJobMapLocation("Sao Paulo, SP, Brazil")?.label, "São Paulo, Brazil");
    assertEqual(resolveJobMapLocation("Rio de Janeiro, Brazil")?.label, "Rio de Janeiro, Brazil");
    assertEqual(resolveJobMapLocation("Brasil")?.label, "Brazil");
    assertEqual(resolveJobMapLocation("Brazil, IN"), undefined);
    assertEqual(resolveJobMapLocation("Buenos Aires, Argentina")?.label, "Buenos Aires, Argentina");
    assertEqual(resolveJobMapLocation("CABA")?.label, "Buenos Aires, Argentina");
    assertEqual(resolveJobMapLocation("Urbanización Buenos Aires, Santa Isabel"), undefined);
    assertEqual(resolveJobMapLocation("Bogotá, Colombia")?.label, "Bogotá, Colombia");
    assertEqual(resolveJobMapLocation("Bogota, NJ"), undefined);
    assertEqual(resolveJobMapLocation("Medellín, Colombia")?.label, "Medellín, Colombia");
    assertEqual(resolveJobMapLocation("Santiago, Chile")?.label, "Santiago, Chile");
    assertEqual(resolveJobMapLocation("Chile")?.label, "Chile");
    assertEqual(resolveJobMapLocation("Chile, NY"), undefined);
    assertEqual(resolveJobMapLocation("Santiago, CA"), undefined);
    assertEqual(resolveJobMapLocation("Lima, Perú")?.label, "Lima, Peru");
    assertEqual(resolveJobMapLocation("Lima, OH"), undefined);
    assertEqual(resolveJobMapLocation("Peru, IN"), undefined);
    assertEqual(resolveJobMapLocation("LATAM")?.label, "Latin America");
    assertEqual(resolveJobMapLocation("Latin America, Remote")?.label, "Latin America");
    assertEqual(resolveJobMapLocation("South America")?.label, "Latin America");
    assertEqual(resolveJobMapLocation("Mexico City, Mexico")?.label, "Mexico City, Mexico");
    assertEqual(resolveJobMapLocation("Ciudad de México")?.label, "Mexico City, Mexico");
    assertEqual(resolveJobMapLocation("CDMX")?.label, "Mexico City, Mexico");
    assertEqual(resolveJobMapLocation("Mexico")?.label, "Mexico");
    assertEqual(resolveJobMapLocation("México, Remote")?.label, "Mexico");
    assertEqual(resolveJobMapLocation("Mexico, NY"), undefined);
    assertEqual(resolveJobMapLocation("New Mexico"), undefined);
    assertEqual(resolveJobMapLocation("Albuquerque, New Mexico"), undefined);
    assertEqual(resolveJobMapLocation("Albuquerque, NM"), undefined);
    assertEqual(resolveJobMapLocation("Santa Fe, New Mexico"), undefined);
    assertEqual(resolveJobMapLocation("Santa Fe, NM"), undefined);
    assertEqual(resolveJobMapLocation("Las Cruces, NM"), undefined);
    assertEqual(resolveJobMapLocation("Las Cruces, New Mexico"), undefined);
    assertEqual(resolveJobMapLocation("Silver City, NM"), undefined);
    assertEqual(resolveJobMapLocation("Silver City, New Mexico"), undefined);
    assertEqual(resolveJobMapLocation("Rio Rancho, NM"), undefined);
    assertEqual(resolveJobMapLocation("Guadalajara, Jalisco, México")?.label, "Guadalajara, Mexico");
    assertEqual(resolveJobMapLocation("Monterrey, Nuevo León")?.label, "Monterrey, Mexico");
    assertEqual(resolveJobMapLocation("Monterey, CA"), undefined);
    assertEqual(resolveJobMapLocation("San José, Costa Rica")?.label, "San José, Costa Rica");
    assertEqual(resolveJobMapLocation("San Jose, CR")?.label, "San José, Costa Rica");
    assertEqual(resolveJobMapLocation("San Jose, CA")?.label, "San Jose, CA");
    assertEqual(resolveJobMapLocation("Costa Rica")?.label, "Costa Rica");
    assertEqual(resolveJobMapLocation("Costa Mesa, CA")?.label, "Costa Mesa, CA");
    assertEqual(resolveJobMapLocation("Panama City, Panama")?.label, "Panama City, Panama");
    assertEqual(resolveJobMapLocation("Ciudad de Panamá")?.label, "Panama City, Panama");
    assertEqual(resolveJobMapLocation("Panama")?.label, "Panama");
    assertEqual(resolveJobMapLocation("Panama City, FL"), undefined);
    assertEqual(resolveJobMapLocation("Panama City Beach, FL"), undefined);
    assertEqual(resolveJobMapLocation("Panama City"), undefined);
    assertEqual(resolveJobMapLocation("Guatemala City")?.label, "Guatemala City, Guatemala");
    assertEqual(resolveJobMapLocation("Guatemala")?.label, "Guatemala");
    assertEqual(resolveJobMapLocation("Belize")?.label, "Belize");
    assertEqual(resolveJobMapLocation("San Salvador, El Salvador")?.label, "San Salvador, El Salvador");
    assertEqual(resolveJobMapLocation("El Salvador")?.label, "El Salvador");
    assertEqual(resolveJobMapLocation("Tegucigalpa")?.label, "Tegucigalpa, Honduras");
    assertEqual(resolveJobMapLocation("Honduras")?.label, "Honduras");
    assertEqual(resolveJobMapLocation("Managua")?.label, "Managua, Nicaragua");
    assertEqual(resolveJobMapLocation("Nicaragua")?.label, "Nicaragua");
    assertEqual(resolveJobMapLocation("Central America")?.label, "Central America");
    assertEqual(resolveJobMapLocation("Centroamérica, Remote")?.label, "Central America");
    assertEqual(resolveJobMapLocation("Quito, Ecuador")?.label, "Quito, Ecuador");
    assertEqual(resolveJobMapLocation("Guayaquil")?.label, "Guayaquil, Ecuador");
    assertEqual(resolveJobMapLocation("Ecuador")?.label, "Ecuador");
    assertEqual(resolveJobMapLocation("Montevideo, Uruguay")?.label, "Montevideo, Uruguay");
    assertEqual(resolveJobMapLocation("Uruguay")?.label, "Uruguay");
    assertEqual(resolveJobMapLocation("Asunción, Paraguay")?.label, "Asunción, Paraguay");
    assertEqual(resolveJobMapLocation("Paraguay")?.label, "Paraguay");
    assertEqual(resolveJobMapLocation("La Paz, Bolivia")?.label, "La Paz, Bolivia");
    assertEqual(resolveJobMapLocation("Santa Cruz de la Sierra, Bolivia")?.label, "Santa Cruz, Bolivia");
    assertEqual(resolveJobMapLocation("Santa Cruz, Bolivia")?.label, "Santa Cruz, Bolivia");
    assertEqual(resolveJobMapLocation("Bolivia")?.label, "Bolivia");
    assertEqual(resolveJobMapLocation("Santa Cruz, CA"), undefined);
    assertEqual(resolveJobMapLocation("Santa Cruz, California"), undefined);
    assertEqual(resolveJobMapLocation("La Paz, CA"), undefined);
    assertEqual(resolveJobMapLocation("Santo Domingo, Dominican Republic")?.label, "Santo Domingo, Dominican Republic");
    assertEqual(resolveJobMapLocation("Santo Domingo, DO")?.label, "Santo Domingo, Dominican Republic");
    assertEqual(resolveJobMapLocation("República Dominicana")?.label, "Dominican Republic");
    assertEqual(resolveJobMapLocation("Santo Domingo Pueblo, NM"), undefined);
    assertEqual(resolveJobMapLocation("Kingston, Jamaica")?.label, "Kingston, Jamaica");
    assertEqual(resolveJobMapLocation("Kingston, JM")?.label, "Kingston, Jamaica");
    assertEqual(resolveJobMapLocation("Jamaica")?.label, "Jamaica");
    assertEqual(resolveJobMapLocation("Jamaica, NY"), undefined);
    assertEqual(resolveJobMapLocation("Jamaica, Queens"), undefined);
    assertEqual(resolveJobMapLocation("Kingston, NY"), undefined);
    assertEqual(resolveJobMapLocation("San Juan, Puerto Rico")?.label, "San Juan, Puerto Rico");
    assertEqual(resolveJobMapLocation("San Juan, PR")?.label, "San Juan, Puerto Rico");
    assertEqual(resolveJobMapLocation("Puerto Rico")?.label, "Puerto Rico");
    assertEqual(resolveJobMapLocation("San Juan Capistrano, CA"), undefined);
    assertEqual(resolveJobMapLocation("Caribbean, Remote")?.label, "Caribbean");
    assertEqual(resolveJobMapLocation("12 locations"), undefined);
    assertIncludes(sources.mapLocation, "locationCoordinates");
    assertIncludes(sources.mapLocation, "searchableLocationCoordinates");
    assertIncludes(sources.mapLocation, "normalizedKeys");
    assertIncludes(sources.shared, "resolveJobMapLocation(location)");
  });
}
