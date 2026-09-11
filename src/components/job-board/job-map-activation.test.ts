import assert from "node:assert/strict";
import test from "node:test";
import type { Feature } from "geojson";

import type { JobMapPoint } from "@/lib/job-map";
import { makeJob } from "../../../scripts/audits/shared";
import { getVisiblePopup, readJobPreview, type ActivePopup } from "./job-map-features";
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
  const points: JobMapPoint[] = [{ id: "point-1", job: makeJob(), label: "New York", latitude: 40, longitude: -73 }];
  const popup: ActivePopup = {
    count: 3, jobs: [readJobPreview(leaf)!], key: "cluster:1:3", label: "3 jobs",
    latitude: 40, longitude: -73, type: "cluster"
  };
  const selection = { popup, points };
  assert.equal(getVisiblePopup(selection, points), popup);
  assert.equal(getVisiblePopup(selection, [...points]), null);
});

test("stale rendered features cannot claim the current source snapshot", () => {
  const points: JobMapPoint[] = [{ id: "current-point", job: makeJob(), label: "New York", latitude: 40, longitude: -73 }];
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
