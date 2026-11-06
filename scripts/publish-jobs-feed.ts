import { appendFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { put } from "@vercel/blob";

import { defaultJobsFeedRevalidateUrl, jobsFeedPathname } from "../src/lib/jobs-feed-config";

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

  const secret = process.env.REVALIDATE_SECRET?.trim();
  if (!secret) {
    console.warn("REVALIDATE_SECRET is unset. Pages keep the previous HTML until the daily revalidate backstop.");
    return;
  }

  const revalidateUrl = process.env.REVALIDATE_URL?.trim() || defaultJobsFeedRevalidateUrl;
  try {
    const response = await fetch(revalidateUrl, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` }
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

try {
  await publishFeed();
} catch (error) {
  console.error(error);
  if (!published) setOutput("published", "false");
}
