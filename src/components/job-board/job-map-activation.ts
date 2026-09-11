import type { Feature } from "geojson";
import type { GeoJSONSource } from "maplibre-gl";

import { maxZoom } from "./job-map-config";
import {
  type ActivePopup,
  getClusterLabel,
  getFeatureCoordinates,
  getNumericProperty,
  readJobPreview
} from "./job-map-features";

export async function loadClusterSelection(
  source: Pick<GeoJSONSource, "getClusterLeaves" | "getClusterExpansionZoom">,
  feature: Feature,
  currentZoom: number,
  signal: AbortSignal
) {
  const coordinates = getFeatureCoordinates(feature);
  const clusterId = getNumericProperty(feature, "cluster_id");
  const pointCount = getNumericProperty(feature, "point_count");

  if (!coordinates || clusterId === undefined || pointCount === undefined || signal.aborted) {
    return undefined;
  }

  const [leaves, expansionZoom] = await Promise.all([
    source.getClusterLeaves(clusterId, Math.min(pointCount, 6), 0),
    source.getClusterExpansionZoom(clusterId)
  ]);

  if (signal.aborted) return undefined;

  const jobs = leaves.map(readJobPreview).filter((job) => job !== undefined);
  const [longitude, latitude] = coordinates;
  const popup: ActivePopup = {
    count: pointCount,
    jobs,
    key: `cluster:${clusterId}:${pointCount}`,
    label: getClusterLabel(pointCount, jobs),
    latitude,
    longitude,
    type: "cluster"
  };

  return {
    popup,
    camera: {
      center: coordinates,
      duration: 300,
      zoom: Math.min(maxZoom, expansionZoom, currentZoom + 1.15)
    }
  };
}
