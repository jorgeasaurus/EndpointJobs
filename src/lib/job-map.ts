import type { Job } from "@/types/job";

export type JobMapRecord = Pick<
  Job,
  "applyUrl" | "attributionLabel" | "company" | "id" | "mapLocation" | "salary" | "title"
>;

export type JobMapPoint = {
  id: string;
  job: JobMapRecord;
  label: string;
  latitude: number;
  longitude: number;
};

export function buildJobMapPoints(jobs: readonly JobMapRecord[]) {
  const grouped = new Map<string, { location: NonNullable<Job["mapLocation"]>; jobs: JobMapRecord[] }>();

  for (const job of jobs) {
    const location = job.mapLocation;

    if (!location) {
      continue;
    }

    const id = `${location.latitude.toFixed(3)},${location.longitude.toFixed(3)}`;
    const existing = grouped.get(id);

    if (existing) {
      existing.jobs.push(job);
      continue;
    }

    grouped.set(id, {
      location,
      jobs: [job]
    });
  }

  return Array.from(grouped.entries()).flatMap(([coordinateId, group]) =>
    group.jobs.map((job) => ({
      id: `${coordinateId}:${job.id}`,
      job,
      label: group.location.label,
      latitude: group.location.latitude,
      longitude: group.location.longitude
    }))
  );
}
