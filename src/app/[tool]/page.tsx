import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JobBoard } from "@/components/job-board";
import feedData from "@/data/jobs.json";
import { getEndpointToolSeo } from "@/lib/job-seo";
import {
  endpointToolOptions,
  getEndpointToolBySlug,
  getEndpointToolSlug
} from "@/lib/job-taxonomy";
import { isActiveJob } from "@/lib/jobs";
import type { JobsFeed } from "@/types/job";

import {
  getEndpointToolUrl,
  ogImage,
  siteDescription,
  siteName
} from "../site-metadata";

type ToolPageProps = {
  params: Promise<{ tool: string }>;
};

const feed = feedData as JobsFeed;

export const revalidate = 300;

// Static app segments (`/jobs`, `/api`, `/api-docs`) are more specific than
// this `[tool]` param, so those routes keep winning. Only taxonomy slugs are
// generated; anything else 404s.
export const dynamicParams = false;

export function generateStaticParams() {
  return endpointToolOptions.map((tool) => ({
    tool: getEndpointToolSlug(tool)
  }));
}

export async function generateMetadata({ params }: ToolPageProps): Promise<Metadata> {
  const { tool: slug } = await params;
  const tool = getEndpointToolBySlug(slug);

  if (!tool) {
    return {
      title: "Tool not found",
      description: siteDescription,
      robots: { index: false, follow: false }
    };
  }

  const { title, description } = getEndpointToolSeo(tool);
  const url = getEndpointToolUrl(tool);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName,
      title,
      description,
      images: [ogImage]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage.url]
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1
      }
    }
  };
}

export default async function EndpointToolPage({ params }: ToolPageProps) {
  const { tool: slug } = await params;
  const tool = getEndpointToolBySlug(slug);

  if (!tool) {
    notFound();
  }

  const activeFeed = {
    ...feed,
    jobs: feed.jobs.filter((job) => isActiveJob(job))
  };

  return <JobBoard feed={activeFeed} initialSelectedTools={[tool]} />;
}
