import { appendFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { put } from "@vercel/blob";

import {
  defaultJobsFeedRevalidateUrl,
  jobsFeedPathname,
  jobsFeedSnapshotUrl,
  jobsFeedVersionPathname,
  jobsFeedVersionUrl
} from "../src/lib/jobs-feed-config";
import { parsePublishedJobsFeed } from "../src/lib/published-jobs-feed";

const outputPath = "src/data/jobs.json";
let published = false;

function setOutput(name: string, value: string) {
  if (name === "published") published = value === "true";
  const line = `${name}=${value}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, line);
  else console.log(line.trim());
}

async function publishFeed() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    console.log("BLOB_READ_WRITE_TOKEN is unset. The workflow will commit jobs.json instead.");
    setOutput("published", "false");
    return;
  }

  const body = await readFile(outputPath);
  const updatedAt = readUpdatedAt(body);
  let url: string;
  try {
    const blob = await put(jobsFeedPathname, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
      contentType: "application/json",
      token
    });
    url = blob.url;
  } catch (error) {
    console.error("Blob publish failed. The workflow will commit jobs.json instead.");
    console.error(error);
    setOutput("published", "false");
    return;
  }

  console.log(`Published jobs feed to ${url}`);
  setOutput("published", "true");
  if (updatedAt) await publishSnapshotVersion(token, url, updatedAt);

  const secret = process.env.REVALIDATE_SECRET?.trim();
  if (!secret) {
    console.warn("REVALIDATE_SECRET is unset. Pages keep the previous HTML until the daily revalidate backstop.");
    return;
  }

  const revalidateUrl = process.env.REVALIDATE_URL?.trim() || defaultJobsFeedRevalidateUrl;
  try {
    const response = await fetch(revalidateUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ updatedAt })
    });
    if (!response.ok) {
      const text = await response.text();
      console.error(`Revalidate request to ${revalidateUrl} failed (${response.status}). ${text.slice(0, 300)}`);
      return;
    }
    console.log(`Revalidated ${revalidateUrl}`);
  } catch (error) {
    console.error(`Revalidate request to ${revalidateUrl} failed.`, error);
  }
}

function readUpdatedAt(body: Buffer) {
  try {
    const parsed = JSON.parse(body.toString("utf8")) as { updatedAt?: unknown };
    if (typeof parsed.updatedAt !== "string") return undefined;
    const updatedAt = parsed.updatedAt.trim();
    return updatedAt || undefined;
  } catch {
    return undefined;
  }
}

async function publishSnapshotVersion(token: string, feedUrl: string, updatedAt: string) {
  const versionUrl = jobsFeedVersionUrl(feedUrl);
  if (versionUrl) {
    try {
      await put(jobsFeedVersionPathname, updatedAt, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 60,
        contentType: "text/plain",
        token
      });
      const versionReady = await waitForBody(jobsFeedSnapshotUrl(versionUrl, updatedAt), (body) => (
        Date.parse(body.trim()) >= Date.parse(updatedAt)
      ));
      if (!versionReady) {
        console.error(`Published jobs feed version ${updatedAt} was not readable at ${versionUrl}`);
      }
    } catch (error) {
      console.error("Jobs feed version pointer was not updated. Revalidation will wait on the feed snapshot.", error);
    }
  }

  const feedReady = await waitForBody(jobsFeedSnapshotUrl(feedUrl, updatedAt), (body) => {
    const feed = parsePublishedJobsFeed(body);
    return Boolean(feed && Date.parse(feed.updatedAt) >= Date.parse(updatedAt));
  });
  if (!feedReady) {
    console.error(`Published jobs feed ${updatedAt} was not readable at ${feedUrl}`);
  }
}

async function waitForBody(url: string, accept: (body: string) => boolean) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: { "cache-control": "no-cache" }
      });
      if (response.ok && accept(await response.text())) return true;
    } catch (error) {
      console.error(error);
    }
    if (attempt < 9) await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

try {
  await publishFeed();
} catch (error) {
  console.error(error);
  if (!published) setOutput("published", "false");
}
