import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JobBoard } from "@/components/job-board";
import { withInitialTools } from "@/components/job-board/filter-model";
import feedData from "@/data/jobs.json";
import { getActiveBoardFeed, queryBoardPage } from "@/lib/board-page";
import { getEndpointToolSeo } from "@/lib/job-seo";
import {
  endpointToolOptions,
  getEndpointToolBySlug,
  getEndpointToolSlug
} from "@/lib/job-taxonomy";
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

export const revalidate = 3600;

// Static app segments (`/board`, `/jobs`, `/privacy`, `/api`, `/api-docs`) are
// more specific than this `[tool]` param, so those routes keep winning. Only
// taxonomy slugs are generated; anything else 404s.
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

  const activeFeed = getActiveBoardFeed(feed);
  const initialPage = queryBoardPage(activeFeed, withInitialTools([tool]), 1);

  return <JobBoard initialPage={initialPage} initialSelectedTools={[tool]} />;
}
