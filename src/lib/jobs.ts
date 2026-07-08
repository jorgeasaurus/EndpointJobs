import type { Job } from "@/types/job";

import {
  endpointToolOptions,
  platformOptions,
  roleFamilyOptions,
  seniorityOptions
} from "./job-taxonomy";
import {
  isExcludedJobSourceUrl,
  isSourceFreshnessExpired
} from "./job-exclusions";

export const toolOptions = endpointToolOptions;
export { platformOptions, roleFamilyOptions, seniorityOptions };

const postedDateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric"
});

const updatedAtFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit"
});

export function formatPostedDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fresh";
  }

  return postedDateFormatter.format(date);
}

export function getPostedAgeDays(value: string, now = new Date()) {
  const posted = new Date(value);

  if (Number.isNaN(posted.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(
    0,
    Math.floor((now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24))
  );
}

export function getFreshnessLabel(value: string) {
  const age = getPostedAgeDays(value);

  if (!Number.isFinite(age)) {
    return "Freshness unknown";
  }

  if (age === 0) {
    return "Posted today";
  }

  if (age === 1) {
    return "1 day old";
  }

  return `${age} days old`;
}

function isStale(job: Job, now = new Date()) {
  const staleAfter = new Date(job.staleAfter);

  if (Number.isNaN(staleAfter.getTime())) {
    return false;
  }

  return staleAfter.getTime() < now.getTime();
}

export function isActiveJob(job: Job, now = new Date()) {
  return (
    !isStale(job, now) &&
    !isSourceFreshnessExpired(job, now) &&
    !isExcludedJobSourceUrl(job.sourceUrl)
  );
}

export function formatUpdatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Pending refresh";
  }

  return updatedAtFormatter.format(date);
}

export function getSearchText(job: Job) {
  return [
    job.title,
    job.company,
    job.location,
    job.summary,
    job.description ?? "",
    job.seniority,
    job.employmentType,
    job.tags.join(" "),
    job.tools.join(" "),
    job.platforms.join(" ")
  ]
    .join(" ")
    .toLowerCase();
}

export function getSalarySortValue(job: Job) {
  return job.salary?.max ?? job.salary?.min ?? 0;
}

export function getExpandedDescriptionParagraphs(job: Job) {
  const additionalDescription = getAdditionalDescription(job);

  if (!additionalDescription) {
    return [];
  }

  return additionalDescription.split(/\n+/).flatMap((paragraph) => {
    const trimmed = paragraph.trim();
    return trimmed ? [trimmed] : [];
  });
}

function getAdditionalDescription(job: Job) {
  const description = job.description?.trim();

  if (!description) {
    return undefined;
  }

  const compactDescription = compactWhitespace(description);
  const summaryPrefix = getCompleteSummaryPrefix(job.summary, compactDescription);

  if (summaryPrefix && compactDescription.startsWith(summaryPrefix)) {
    const remainder = trimFormattedPrefix(description, summaryPrefix);

    return remainder && compactWhitespace(remainder).length >= 160
      ? remainder
      : undefined;
  }

  return compactDescription.length >= job.summary.length + 160
    ? description
    : undefined;
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getCompleteSummaryPrefix(summary: string, compactDescription: string) {
  const prefix = summary.trim().replace(/\.\.\.$/, "").trimEnd();

  if (!prefix || !compactDescription.startsWith(prefix)) {
    return prefix;
  }

  const lastPrefixChar = prefix.at(-1) ?? "";
  const nextDescriptionChar = compactDescription[prefix.length] ?? "";

  if (!isWordCharacter(lastPrefixChar) || !isWordCharacter(nextDescriptionChar)) {
    return prefix;
  }

  const lastSpace = prefix.lastIndexOf(" ");
  return lastSpace > 0 ? prefix.slice(0, lastSpace).trimEnd() : prefix;
}

function isWordCharacter(value: string) {
  return /[A-Za-z0-9]/.test(value);
}

function trimFormattedPrefix(value: string, prefix: string) {
  let valueIndex = 0;
  let prefixIndex = 0;

  while (valueIndex < value.length && prefixIndex < prefix.length) {
    const valueChar = value[valueIndex];
    const prefixChar = prefix[prefixIndex];

    if (valueChar && /\s/.test(valueChar)) {
      while (valueIndex < value.length && /\s/.test(value[valueIndex] ?? "")) {
        valueIndex += 1;
      }

      while (prefixIndex < prefix.length && /\s/.test(prefix[prefixIndex] ?? "")) {
        prefixIndex += 1;
      }

      continue;
    }

    if (prefixChar && /\s/.test(prefixChar)) {
      while (prefixIndex < prefix.length && /\s/.test(prefix[prefixIndex] ?? "")) {
        prefixIndex += 1;
      }

      continue;
    }

    if (valueChar !== prefixChar) {
      return undefined;
    }

    valueIndex += 1;
    prefixIndex += 1;
  }

  while (prefixIndex < prefix.length && /\s/.test(prefix[prefixIndex] ?? "")) {
    prefixIndex += 1;
  }

  if (prefixIndex < prefix.length) {
    return undefined;
  }

  let startIndex = valueIndex;
  const previousBreak = value.lastIndexOf("\n", Math.max(0, startIndex - 1));
  const lineBeforeTrim = value.slice(previousBreak + 1, startIndex).trim();

  if (lineBeforeTrim) {
    const nextBreak = value.indexOf("\n", startIndex);
    startIndex = nextBreak === -1 ? startIndex : nextBreak + 1;
  }

  return value
    .slice(startIndex)
    .replace(/^[\s.,;:\u2013\u2014-]+/, "")
    .trim();
}
