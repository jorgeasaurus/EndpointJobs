import { LoadingState } from "./loading-state";

export function JobMapCanvasLoading() {
  return (
    <div
      aria-busy="true"
      className="job-map-canvas-wrap job-map-canvas-wrap--loading"
      id="job-map-canvas"
    >
      <LoadingState label="Loading map" variant="orbit" />
    </div>
  );
}
