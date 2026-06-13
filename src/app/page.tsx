import { JobBoard } from "@/components/job-board";
import feedData from "@/data/jobs.json";
import type { JobsFeed } from "@/types/job";

export default function Home() {
  return <JobBoard feed={feedData as JobsFeed} />;
}
