import type { Feature, FeatureCollection, Point } from "geojson";
import type { LngLatBoundsLike, MapGeoJSONFeature } from "maplibre-gl";
import type {
  MapLayerMouseEvent,
  MapLayerTouchEvent,
  MapRef
} from "react-map-gl/maplibre";

import type { JobMapPoint } from "@/lib/job-map";

import {
  clusterLayerId,
  defaultCenter,
  interactiveLayerIds,
  unclusteredLayerId
} from "./job-map-config";

export type JobFeatureProperties = {
  applyUrl: string;
  company: string;
  hasSalary: boolean;
  jobId: string;
  location: string;
  pointId: string;
  salary: string;
  source: string;
  title: string;
};

export type JobFeature = Feature<Point, JobFeatureProperties>;

export type JobPreview = {
  applyUrl: string;
  company: string;
  id: string;
  location: string;
  salary: string;
  source: string;
  title: string;
};

export type ActivePopup = {
  count: number;
  jobs: JobPreview[];
  key: string;
  label: string;
  latitude: number;
  longitude: number;
  type: "cluster" | "job";
};

export function buildFeatureCollection(
  points: JobMapPoint[]
): FeatureCollection<Point, JobFeatureProperties> {
  return {
    type: "FeatureCollection",
    features: points.map((point): JobFeature => {
      const job = point.job;

      return {
        type: "Feature",
        geometry: {
          coordinates: [point.longitude, point.latitude],
          type: "Point"
        },
        properties: {
          applyUrl: job.applyUrl ?? "",
          company: job.company,
          hasSalary: Boolean(job.salary),
          jobId: job.id,
          location: point.label,
          pointId: point.id,
          salary: job.salary?.label ?? "Salary not listed",
          source: job.attributionLabel,
          title: job.title
        }
      };
    })
  };
}

export function getVisiblePopup(popup: ActivePopup | null, points: JobMapPoint[]) {
  if (!popup) {
    return null;
  }

  const pointIds = new Set(points.map((point) => point.id));
  const hasVisibleJob = popup.jobs.some((job) => pointIds.has(job.id));

  return hasVisibleJob ? popup : null;
}

export function getInteractiveFeature(features: MapGeoJSONFeature[] | undefined) {
  return features?.find(
    (feature) => feature.layer.id === clusterLayerId || feature.layer.id === unclusteredLayerId
  );
}

export function getEventFeature(event: MapLayerMouseEvent | MapLayerTouchEvent) {
  return (
    getInteractiveFeature(event.features) ??
    getInteractiveFeature(
      event.target.queryRenderedFeatures(event.point, {
        layers: interactiveLayerIds
      })
    )
  );
}

export function buildJobPopup(feature: MapGeoJSONFeature): ActivePopup | undefined {
  const preview = readJobPreview(feature);
  const coordinates = getFeatureCoordinates(feature);

  if (!preview || !coordinates) {
    return undefined;
  }

  const [longitude, latitude] = coordinates;

  return {
    count: 1,
    jobs: [preview],
    key: `job:${preview.id}`,
    label: preview.location,
    latitude,
    longitude,
    type: "job"
  };
}

export function readJobPreview(feature: Feature | MapGeoJSONFeature): JobPreview | undefined {
  const properties = getJobFeatureProperties(feature);

  if (!properties) {
    return undefined;
  }

  return {
    applyUrl: properties.applyUrl,
    company: properties.company,
    id: properties.pointId || properties.jobId,
    location: properties.location || "Mapped job",
    salary: properties.salary || "Salary not listed",
    source: properties.source,
    title: properties.title
  };
}

export function getFeatureCoordinates(feature: Feature | MapGeoJSONFeature): [number, number] | undefined {
  if (feature.geometry.type !== "Point") {
    return undefined;
  }

  const [longitude, latitude] = feature.geometry.coordinates;

  if (typeof longitude !== "number" || typeof latitude !== "number") {
    return undefined;
  }

  return [longitude, latitude];
}

export function getNumericProperty(feature: MapGeoJSONFeature, key: string) {
  const value = feature.properties?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function getClusterLabel(count: number, jobs: JobPreview[]) {
  const firstLocation = jobs[0]?.location;

  if (!firstLocation) {
    return `${count} jobs in this area`;
  }

  return `${count} jobs near ${firstLocation}`;
}

export function getBestRenderedFocus(map: MapRef): [number, number] | undefined {
  const features = map.queryRenderedFeatures({
    layers: interactiveLayerIds
  });
  let bestFeature: MapGeoJSONFeature | undefined;
  let bestScore = 0;

  for (const feature of features) {
    const pointCount = getNumericProperty(feature, "point_count") ?? 1;

    if (pointCount > bestScore) {
      bestFeature = feature;
      bestScore = pointCount;
    }
  }

  return bestFeature ? getFeatureCoordinates(bestFeature) : undefined;
}

export function getJobBounds(points: JobMapPoint[]): LngLatBoundsLike {
  const longitudes = points.map((point) => point.longitude);
  const latitudes = points.map((point) => point.latitude);
  const west = Math.min(...longitudes);
  const east = Math.max(...longitudes);
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);

  return [
    [west, south],
    [east, north]
  ];
}

export function getJobFocusCoordinate(points: JobMapPoint[]): [number, number] {
  const point = points[Math.floor(points.length / 2)] ?? points[0];
  return point ? [point.longitude, point.latitude] : defaultCenter;
}

export function getFitPadding() {
  if (typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches) {
    return {
      bottom: 72,
      left: 42,
      right: 42,
      top: 34
    };
  }

  return {
    bottom: 74,
    left: 54,
    right: 54,
    top: 50
  };
}

function getJobFeatureProperties(
  feature: Feature | MapGeoJSONFeature
): JobFeatureProperties | undefined {
  const properties = feature.properties as Partial<JobFeatureProperties> | undefined;

  if (!properties?.title || !properties.company || !(properties.pointId || properties.jobId)) {
    return undefined;
  }

  return {
    applyUrl: properties.applyUrl ?? "",
    company: properties.company,
    hasSalary: Boolean(properties.hasSalary),
    jobId: properties.jobId ?? "",
    location: properties.location ?? "",
    pointId: properties.pointId ?? "",
    salary: properties.salary ?? "",
    source: properties.source ?? "",
    title: properties.title
  };
}
