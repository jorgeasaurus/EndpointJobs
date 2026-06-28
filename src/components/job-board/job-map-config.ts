import type { StyleSpecification } from "maplibre-gl";
import type { LayerProps } from "react-map-gl/maplibre";

export const sourceId = "job-locations";
export const clusterLayerId = "job-clusters";
export const clusterCountLayerId = "job-cluster-counts";
export const unclusteredLayerId = "job-points";
export const selectedPointLayerId = "job-selected-points";
export const minZoom = 0;
export const maxZoom = 18;
export const clusterMaxZoom = 15;
export const defaultCenter: [number, number] = [-98.5795, 39.8283];
export const interactiveLayerIds = [clusterLayerId, unclusteredLayerId];

export const darkRasterStyle: StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    "carto-dark": {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
      ],
      tileSize: 256,
      type: "raster"
    }
  },
  layers: [
    {
      id: "background",
      paint: {
        "background-color": "#050505"
      },
      type: "background"
    },
    {
      id: "carto-dark",
      paint: {
        "raster-contrast": 0.16,
        "raster-opacity": 0.9,
        "raster-saturation": -0.22
      },
      source: "carto-dark",
      type: "raster"
    }
  ]
};

export const clusterLayer: LayerProps = {
  id: clusterLayerId,
  filter: ["has", "point_count"],
  paint: {
    "circle-blur": 0.04,
    "circle-color": [
      "step",
      ["get", "point_count"],
      "rgba(204, 255, 0, 0.82)",
      10,
      "rgba(184, 255, 41, 0.88)",
      40,
      "rgba(16, 185, 129, 0.88)"
    ],
    "circle-radius": ["step", ["get", "point_count"], 18, 10, 24, 40, 32],
    "circle-stroke-color": "rgba(5, 5, 5, 0.94)",
    "circle-stroke-width": 3
  },
  source: sourceId,
  type: "circle"
};

export const clusterCountLayer: LayerProps = {
  id: clusterCountLayerId,
  filter: ["has", "point_count"],
  layout: {
    "text-field": ["get", "point_count_abbreviated"],
    "text-font": ["Noto Sans Regular"],
    "text-size": 12
  },
  paint: {
    "text-color": "#050505",
    "text-halo-color": "rgba(204, 255, 0, 0.18)",
    "text-halo-width": 1
  },
  source: sourceId,
  type: "symbol"
};

export const unclusteredPointLayer: LayerProps = {
  id: unclusteredLayerId,
  filter: ["!", ["has", "point_count"]],
  paint: {
    "circle-color": [
      "case",
      ["boolean", ["get", "hasSalary"], false],
      "#ccff00",
      "#10b981"
    ],
    "circle-opacity": 0.94,
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      3,
      5,
      8,
      7,
      14,
      10
    ],
    "circle-stroke-color": "rgba(5, 5, 5, 0.92)",
    "circle-stroke-width": [
      "interpolate",
      ["linear"],
      ["zoom"],
      3,
      1.5,
      10,
      2.5
    ]
  },
  source: sourceId,
  type: "circle"
};

export function getSelectedPointLayer(selectedPointId: string): LayerProps {
  return {
    id: selectedPointLayerId,
    filter: ["==", ["get", "pointId"], selectedPointId],
    paint: {
      "circle-color": "rgba(0, 0, 0, 0)",
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        3,
        11,
        8,
        15,
        14,
        22
      ],
      "circle-stroke-color": "#ccff00",
      "circle-stroke-opacity": 0.9,
      "circle-stroke-width": 2.5
    },
    source: sourceId,
    type: "circle"
  };
}
