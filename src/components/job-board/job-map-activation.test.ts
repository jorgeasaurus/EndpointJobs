import assert from "node:assert/strict";
import test from "node:test";
import type { Feature } from "geojson";

import { buildJobMapPoints, type JobMapPoint } from "@/lib/job-map";
import { makeJob } from "../../../scripts/audits/shared";
import { buildFeatureCollection, buildJobPopup, getVisiblePopup, readJobPreview, selectHoveredPopup, type ActivePopup } from "./job-map-features";
import { loadClusterSelection } from "./job-map-activation";

const cluster: Feature = {
  type: "Feature",
  geometry: { type: "Point", coordinates: [-73, 40] },
  properties: { cluster_id: 1, point_count: 3 }
};
const leaf: Feature = {
  type: "Feature",
  geometry: { type: "Point", coordinates: [-73, 40] },
  properties: { pointId: "point-1", title: "Engineer", company: "Example", location: "New York" }
};

function matchingPoint(overrides: Partial<JobMapPoint> = {}): JobMapPoint {
  return {
    id: "point-1",
    job: makeJob({ title: "Engineer", company: "Example", applyUrl: undefined }),
    label: "New York",
    latitude: 40,
    longitude: -73,
    ...overrides
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

test("cluster popup and camera wait for both independently started worker reads", async () => {
  const leaves = deferred<Feature[]>();
  const expansion = deferred<number>();
  const calls: string[] = [];
  let settled = false;
  const selection = loadClusterSelection({
    getClusterLeaves: () => { calls.push("leaves"); return leaves.promise; },
    getClusterExpansionZoom: () => { calls.push("zoom"); return expansion.promise; }
  }, cluster, 4, new AbortController().signal).then((result) => { settled = true; return result; });
  assert.deepEqual(calls, ["leaves", "zoom"]);
  leaves.resolve([leaf]);
  await Promise.resolve();
  assert.equal(settled, false);
  expansion.resolve(7);
  const result = await selection;
  assert.equal(result?.popup.jobs[0].id, "point-1");
  assert.equal(result?.camera.zoom, 5.15);
  assert.deepEqual(result?.camera.center, [-73, 40]);
});

test("cancelled selection cannot publish after its worker completes", async () => {
  const leaves = deferred<Feature[]>();
  const activation = new AbortController();
  const selection = loadClusterSelection({
    getClusterLeaves: () => leaves.promise,
    getClusterExpansionZoom: async () => 7
  }, cluster, 4, activation.signal);
  activation.abort();
  leaves.resolve([leaf]);
  assert.equal(await selection, undefined);
});

test("a failed worker cannot return a partial popup/camera update", async () => {
  await assert.rejects(loadClusterSelection({
    getClusterLeaves: async () => [leaf],
    getClusterExpansionZoom: async () => { throw new Error("Cluster expired"); }
  }, cluster, 4, new AbortController().signal), /Cluster expired/);
});

test("cluster popups are invalidated when the map source changes", () => {
  const points = [matchingPoint()];
  const popup: ActivePopup = {
    count: 3, jobs: [readJobPreview(leaf)!], key: "cluster:1:3", label: "3 jobs",
    latitude: 40, longitude: -73, type: "cluster"
  };
  const selection = { popup, points };
  assert.equal(getVisiblePopup(selection, points), popup);
  assert.equal(getVisiblePopup(selection, [...points]), null);
});

test("stale rendered features cannot claim the current source snapshot", () => {
  const points = [matchingPoint({ id: "current-point" })];
  for (const type of ["job", "cluster"] as const) {
    const popup: ActivePopup = {
      count: 1, jobs: [readJobPreview(leaf)!], key: "stale-point", label: "Old job",
      latitude: 40, longitude: -73, type
    };
    assert.equal(getVisiblePopup({ popup, points }, points), null);
    popup.jobs = [];
    assert.equal(getVisiblePopup({ popup, points }, points), null);
  }
});

test("job popups stay visible when preview, position, and label match the current point", () => {
  const points = [matchingPoint()];
  const popup: ActivePopup = {
    count: 1, jobs: [readJobPreview(leaf)!], key: "job:point-1", label: "New York",
    latitude: 40, longitude: -73, type: "job"
  };
  assert.equal(getVisiblePopup({ popup, points }, points), popup);
});

test("stale preview fields are discarded even when the point id is unchanged", () => {
  const points = [matchingPoint({
    job: makeJob({ title: "Updated title", company: "New Co", applyUrl: "https://example.com/new" }),
    label: "Boston",
    latitude: 42,
    longitude: -71
  })];
  const popup: ActivePopup = {
    count: 1, jobs: [readJobPreview(leaf)!], key: "job:point-1", label: "New York",
    latitude: 40, longitude: -73, type: "job"
  };
  assert.equal(getVisiblePopup({ popup, points }, points), null);
});

test("job popups are discarded when the current point moved or relabeled", () => {
  const points = [matchingPoint()];
  const jobs = [readJobPreview(leaf)!];
  assert.equal(getVisiblePopup({
    popup: { count: 1, jobs, key: "job:point-1", label: "New York", latitude: 41, longitude: -73, type: "job" },
    points
  }, points), null);
  assert.equal(getVisiblePopup({
    popup: { count: 1, jobs, key: "job:point-1", label: "Boston", latitude: 40, longitude: -73, type: "job" },
    points
  }, points), null);
});

test("popup visibility accepts composite point ids and underlying job ids", () => {
  const job = makeJob({
    id: "job-99",
    title: "Engineer",
    company: "Example",
    applyUrl: undefined,
    mapLocation: { label: "New York", latitude: 40, longitude: -73 }
  });
  const points = buildJobMapPoints([job]);
  const point = points[0];
  assert.ok(point);
  assert.equal(point.id, "40.000,-73.000:job-99");

  const fromPointId = readJobPreview({
    type: "Feature",
    geometry: { type: "Point", coordinates: [-73, 40] },
    properties: { pointId: point.id, title: "Engineer", company: "Example", location: "New York" }
  })!;
  const fromJobId = readJobPreview({
    type: "Feature",
    geometry: { type: "Point", coordinates: [-73, 40] },
    properties: { jobId: "job-99", title: "Engineer", company: "Example", location: "New York" }
  })!;
  assert.equal(fromPointId.id, point.id);
  assert.equal(fromJobId.id, "job-99");

  for (const preview of [fromPointId, fromJobId]) {
    const popup: ActivePopup = {
      count: 1, jobs: [preview], key: `job:${preview.id}`, label: "New York",
      latitude: 40, longitude: -73, type: "job"
    };
    assert.equal(getVisiblePopup({ popup, points }, points), popup);
  }
});

test("hover recovers after a stale feature claimed the current source snapshot", () => {
  const points = [matchingPoint()];
  const freshPopup: ActivePopup = {
    count: 1, jobs: [readJobPreview(leaf)!], key: "job:point-1", label: "New York",
    latitude: 40, longitude: -73, type: "job"
  };
  const stalePopup = {
    ...freshPopup,
    jobs: [{ ...freshPopup.jobs[0], title: "Outdated title" }]
  };
  const staleSelection = selectHoveredPopup(null, stalePopup, points);
  assert.equal(getVisiblePopup(staleSelection, points), null);

  const recoveredSelection = selectHoveredPopup(staleSelection, freshPopup, points);
  assert.equal(getVisiblePopup(recoveredSelection, points), freshPopup);
  assert.equal(selectHoveredPopup(recoveredSelection, freshPopup, points), recoveredSelection);
});

test("rendered job popups retain source coordinates despite tile quantization", () => {
  const points = [matchingPoint({ latitude: 40.7128, longitude: -74.006 })];
  const feature = buildFeatureCollection(points).features[0];
  feature.geometry.coordinates = [-74.00390625, 40.713955826286046];
  const popup = buildJobPopup(feature)!;
  assert.equal(popup.latitude, points[0].latitude);
  assert.equal(popup.longitude, points[0].longitude);
  assert.equal(getVisiblePopup({ popup, points }, points), popup);

  const movedPoints = [{ ...points[0], latitude: 40.72, longitude: -74.01 }];
  assert.equal(getVisiblePopup({ popup, points: movedPoints }, movedPoints), null);
});
