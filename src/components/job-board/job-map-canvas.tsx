"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LocateFixed, X, ZoomIn, ZoomOut } from "lucide-react";
import type { GeoJSONSource, MapGeoJSONFeature } from "maplibre-gl";
import Map, {
  Layer,
  Popup,
  Source,
  type MapLayerMouseEvent,
  type MapLayerTouchEvent,
  type MapRef,
  type ViewStateChangeEvent
} from "react-map-gl/maplibre";

import type { JobMapPoint } from "@/lib/job-map";

import {
  clusterCountLayer,
  clusterLayer,
  clusterLayerId,
  clusterMaxZoom,
  darkRasterStyle,
  defaultCenter,
  getSelectedPointLayer,
  interactiveLayerIds,
  maxZoom,
  minZoom,
  sourceId,
  unclusteredLayerId,
  unclusteredPointLayer
} from "./job-map-config";
import {
  type ActivePopup,
  type JobPreview,
  buildFeatureCollection,
  buildJobPopup,
  getBestRenderedFocus,
  getClusterLabel,
  getEventFeature,
  getFeatureCoordinates,
  getFitPadding,
  getInteractiveFeature,
  getJobBounds,
  getJobFocusCoordinate,
  getNumericProperty,
  getVisiblePopup,
  readJobPreview
} from "./job-map-features";
import { JobMapPopupContent } from "./job-map-popup";

export function JobMapCanvas({ points }: { points: JobMapPoint[] }) {
  const mapRef = useRef<MapRef>(null);
  const [activePopup, setActivePopup] = useState<ActivePopup | null>(null);
  const [zoomLevel, setZoomLevel] = useState(minZoom);
  const featureCollection = useMemo(() => buildFeatureCollection(points), [points]);
  const jobFocusCoordinate = useMemo(() => getJobFocusCoordinate(points), [points]);
  const visiblePopup = useMemo(
    () => getVisiblePopup(activePopup, points),
    [activePopup, points]
  );
  const selectedPointId =
    visiblePopup?.type === "job" ? visiblePopup.jobs[0]?.id ?? "__none" : "__none";

  const selectedPointLayer = useMemo(
    () => getSelectedPointLayer(selectedPointId),
    [selectedPointId]
  );

  const fitToJobs = useCallback(
    (duration = 650) => {
      const map = mapRef.current;

      if (!map) {
        return;
      }

      if (points.length === 0) {
        map.easeTo({
          center: defaultCenter,
          duration,
          zoom: 2.2
        });
        return;
      }

      if (points.length === 1) {
        const point = points[0];

        map.easeTo({
          center: [point.longitude, point.latitude],
          duration,
          zoom: 8.2
        });
        return;
      }

      map.fitBounds(getJobBounds(points), {
        duration,
        maxZoom: points.length < 8 ? 8.4 : 5.8,
        padding: getFitPadding()
      });
    },
    [points]
  );

  useEffect(() => {
    window.requestAnimationFrame(() => fitToJobs(420));
  }, [fitToJobs]);

  function handleZoomIn() {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    map.easeTo({
      center: visiblePopup
        ? [visiblePopup.longitude, visiblePopup.latitude]
        : getBestRenderedFocus(map) ?? jobFocusCoordinate,
      duration: 180,
      zoom: Math.min(maxZoom, map.getZoom() + 1)
    });
  }

  function handleZoomOut() {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    map.easeTo({
      duration: 220,
      zoom: Math.max(minZoom, map.getZoom() - 1)
    });
  }

  const handleMove = useCallback((event: ViewStateChangeEvent) => {
    setZoomLevel(Number(event.viewState.zoom.toFixed(2)));
  }, []);

  const handleMouseMove = useCallback((event: MapLayerMouseEvent) => {
    const feature = getInteractiveFeature(event.features);
    event.target.getCanvas().style.cursor = feature ? "pointer" : "";

    if (!feature || feature.layer.id !== unclusteredLayerId) {
      return;
    }

    const popup = buildJobPopup(feature);

    if (!popup) {
      return;
    }

    setActivePopup((current) => (current?.key === popup.key ? current : popup));
  }, []);

  const handleMouseLeave = useCallback((event: MapLayerMouseEvent) => {
    event.target.getCanvas().style.cursor = "";
  }, []);

  const activateFeature = useCallback(async (feature: MapGeoJSONFeature | undefined) => {
    if (!feature) {
      setActivePopup(null);
      return;
    }

    if (feature.layer.id === unclusteredLayerId) {
      const popup = buildJobPopup(feature);

      if (popup) {
        setActivePopup(popup);
      }

      return;
    }

    if (feature.layer.id !== clusterLayerId) {
      return;
    }

    const coordinates = getFeatureCoordinates(feature);
    const clusterId = getNumericProperty(feature, "cluster_id");
    const pointCount = getNumericProperty(feature, "point_count");
    const source = mapRef.current?.getMap().getSource(sourceId) as GeoJSONSource | undefined;

    if (!coordinates || clusterId === undefined || pointCount === undefined || !source) {
      return;
    }

    const leaves = await source.getClusterLeaves(clusterId, Math.min(pointCount, 6), 0);
    const previews = leaves.map(readJobPreview).filter((job): job is JobPreview => Boolean(job));
    const [longitude, latitude] = coordinates;

    setActivePopup({
      count: pointCount,
      jobs: previews,
      key: `cluster:${clusterId}:${pointCount}`,
      label: getClusterLabel(pointCount, previews),
      latitude,
      longitude,
      type: "cluster"
    });

    const currentZoom = mapRef.current?.getZoom() ?? minZoom;
    const expansionZoom = await source.getClusterExpansionZoom(clusterId);
    const nextZoom = Math.min(maxZoom, expansionZoom, currentZoom + 1.15);

    mapRef.current?.easeTo({
      center: coordinates,
      duration: 300,
      zoom: nextZoom
    });
  }, []);

  const handleClick = useCallback(
    (event: MapLayerMouseEvent) => {
      void activateFeature(getEventFeature(event));
    },
    [activateFeature]
  );

  const handleTouchEnd = useCallback(
    (event: MapLayerTouchEvent) => {
      void activateFeature(getEventFeature(event));
    },
    [activateFeature]
  );

  return (
    <div
      className={
        visiblePopup
          ? "job-map-canvas-wrap job-map-canvas-wrap--active-popup"
          : "job-map-canvas-wrap"
      }
      id="job-map-canvas"
    >
      <Map
        ref={mapRef}
        attributionControl={false}
        cooperativeGestures={true}
        initialViewState={{
          latitude: defaultCenter[1],
          longitude: defaultCenter[0],
          zoom: minZoom
        }}
        interactiveLayerIds={interactiveLayerIds}
        mapStyle={darkRasterStyle}
        maxZoom={maxZoom}
        minZoom={minZoom}
        onClick={handleClick}
        onLoad={() => window.requestAnimationFrame(() => fitToJobs(700))}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
        onMove={handleMove}
        onTouchEnd={handleTouchEnd}
        renderWorldCopies={false}
        reuseMaps
        style={{ height: "100%", width: "100%" }}
      >
        <Source
          id={sourceId}
          cluster
          clusterMaxZoom={clusterMaxZoom}
          clusterRadius={52}
          data={featureCollection}
          type="geojson"
        >
          <Layer {...clusterLayer} />
          <Layer {...clusterCountLayer} />
          <Layer {...unclusteredPointLayer} />
          <Layer {...selectedPointLayer} />
        </Source>

        {visiblePopup ? (
          <Popup
            className="job-map-popup"
            closeButton={false}
            closeOnClick={false}
            latitude={visiblePopup.latitude}
            longitude={visiblePopup.longitude}
            maxWidth="340px"
            offset={22}
            onClose={() => setActivePopup(null)}
          >
            <JobMapPopupContent popup={visiblePopup} />
          </Popup>
        ) : null}
      </Map>

      <JobMapAttribution />
      <JobMapControls
        onFitJobs={() => fitToJobs(520)}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        zoomLevel={zoomLevel}
      />

      {visiblePopup ? (
        <JobMapMobileSheet onClose={() => setActivePopup(null)} popup={visiblePopup} />
      ) : null}
    </div>
  );
}

function JobMapAttribution() {
  return (
    <div className="job-map-attribution">
      <a
        href="https://www.openstreetmap.org/copyright"
        rel="noopener noreferrer"
        target="_blank"
      >
        OpenStreetMap
      </a>
      <span>/</span>
      <a href="https://carto.com/attributions" rel="noopener noreferrer" target="_blank">
        CARTO
      </a>
    </div>
  );
}

function JobMapControls({
  onFitJobs,
  onZoomIn,
  onZoomOut,
  zoomLevel
}: {
  onFitJobs: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  zoomLevel: number;
}) {
  return (
    <div className="job-map-controls" aria-label="Map zoom controls">
      <button
        aria-label="Zoom in map"
        className="job-map-control-button"
        disabled={zoomLevel >= maxZoom - 0.01}
        onClick={onZoomIn}
        title="Zoom in"
        type="button"
      >
        <ZoomIn size={15} aria-hidden="true" />
      </button>
      <button
        aria-label="Zoom out map"
        className="job-map-control-button"
        disabled={zoomLevel <= minZoom + 0.01}
        onClick={onZoomOut}
        title="Zoom out"
        type="button"
      >
        <ZoomOut size={15} aria-hidden="true" />
      </button>
      <button
        aria-label="Fit map to jobs"
        className="job-map-control-button"
        onClick={onFitJobs}
        title="Fit jobs"
        type="button"
      >
        <LocateFixed size={15} aria-hidden="true" />
      </button>
      <span className="job-map-zoom-readout">{Math.round(zoomLevel * 100)}%</span>
    </div>
  );
}

function JobMapMobileSheet({
  onClose,
  popup
}: {
  onClose: () => void;
  popup: ActivePopup;
}) {
  return (
    <div className="job-map-mobile-sheet">
      <button
        aria-label="Close selected job"
        className="job-map-sheet-close"
        onClick={onClose}
        type="button"
      >
        <X size={15} aria-hidden="true" />
      </button>
      <JobMapPopupContent popup={popup} />
    </div>
  );
}
