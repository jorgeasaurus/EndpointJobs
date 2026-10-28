export type DescriptionBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] };

const protectedTerms = [
  "ActiveDirectory",
  "AppStore",
  "AutoPilot",
  "Autopilot",
  "CarbonBlack",
  "CrowdStrike",
  "DevSecOps",
  "DevOps",
  "GitHub",
  "GitLab",
  "GraphAPI",
  "JavaScript",
  "LinkedIn",
  "MLOps",
  "OneDrive",
  "OneNote",
  "OpenID",
  "PowerApps",
  "PowerBI",
  "PowerShell",
  "ServiceNow",
  "SharePoint",
  "TeamViewer",
  "TypeScript",
  "VSCode",
  "YouTube",
  "eDiscovery",
  "iCloud",
  "iPadOS",
  "iPhone",
  "iPad",
  "macOS",
  "tvOS",
  "visionOS",
  "watchOS",
  "iOS"
].sort((left, right) => right.length - left.length);

const htmlMarkupPattern = /<\/?(?:a|br|div|em|h[1-6]|iframe|li|object|ol|p|script|section|span|strong|style|table|td|tr|ul)\b/i;
const bulletPattern = /^(?:[-*•]|\d+[.)])\s+/;

export function repairJobDescription(value: string) {
  const withoutMarkup = htmlMarkupPattern.test(value) ? stripJobHtml(value) : value;
  const { text, tokens } = protectTermsIn(withoutMarkup);
  const split = splitJoinedClauses(text);
  const restored = restoreTerms(
    split
      .replace(/〔[^〕]*〕/g, "")
      .replace(/【[^】]*】/g, "")
      .replace(/\{\{[^{}]*\}\}/g, "")
      .replace(/\[(?:placeholder|insert(?:\s+here)?|your actual|tbd|todo|xxx)[^\]]*\]/gi, ""),
    tokens
  );

  return restored
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => {
      if (!line.trim()) return "";
      const rawIndent = line.match(/^[ \t]*/)?.[0] ?? "";
      const indent = rawIndent.replace(/\t/g, "    ");
      const body = line.slice(rawIndent.length).replace(/[^\S\n]+/g, " ").trim();
      return body ? `${indent}${body}` : "";
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\n+$/g, "");
}

export function isDescriptionHeading(value: string, following = "") {
  const line = value.trim();
  if (!isHeadingShape(line)) return false;
  const next = stripBullet(following).trim();
  if (!next || /^[-*•]$/.test(next)) return false;
  return next.length > line.length;
}

export function toDescriptionBlocks(value: string): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];
  let bullets: string[] = [];
  let pendingMarker = false;

  function flushBullets() {
    if (bullets.length === 0) return;
    blocks.push({ type: "list", items: bullets.map(stripBullet) });
    bullets = [];
  }

  const sections = value.split(/\n{2,}/).map((section) => section.split("\n").map((line) => line.trim()).filter(Boolean));

  for (let index = 0; index < sections.length; index += 1) {
    const lines = sections[index] ?? [];
    if (lines.length === 0) continue;
    if (lines.length === 1 && /^[-*•]$/.test(lines[0] ?? "")) {
      pendingMarker = true;
      continue;
    }

    const following = followingSectionLine(sections, index);

    if (pendingMarker) {
      pendingMarker = false;
      const only = lines.length === 1 ? lines[0] ?? "" : "";
      if (only && !isDescriptionHeading(only, following) && !bulletPattern.test(only)) {
        bullets.push(`- ${only}`);
        continue;
      }
    }

    if (lines.every((line) => bulletPattern.test(line))) {
      bullets.push(...lines);
      continue;
    }

    if (lines.length === 1 && isDescriptionHeading(lines[0] ?? "", following)) {
      flushBullets();
      blocks.push({ type: "heading", text: headingText(lines[0] ?? "") });
      continue;
    }

    flushBullets();
    blocks.push(...partitionSection(lines, following));
  }

  flushBullets();
  return blocks.filter((block) => block.type === "list" ? block.items.length > 0 : block.text.length > 0);
}

function partitionSection(lines: string[], afterSection: string): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];
  let items: string[] = [];

  function flushItems() {
    const trailingHeading = trailingSectionHeading(items);
    const body = trailingHeading ? items.slice(0, -1) : items;
    if (body.length > 1) {
      blocks.push({ type: "list", items: body.map(stripBullet) });
    } else if (body.length === 1) {
      blocks.push({ type: "paragraph", text: stripBullet(body[0] ?? "") });
    }
    if (trailingHeading) blocks.push({ type: "heading", text: headingText(trailingHeading) });
    items = [];
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const following = lines[index + 1] ?? afterSection;
    if (isDescriptionHeading(line, following)) {
      flushItems();
      blocks.push({ type: "heading", text: headingText(line) });
      continue;
    }

    items.push(line);
  }

  flushItems();
  return blocks.filter((block) => block.type === "list" ? block.items.length > 0 : block.text.length > 0);
}

function isHeadingShape(line: string) {
  if (!line || bulletPattern.test(line) || /^[-*•]$/.test(line)) return false;
  if (/[.!?]$/.test(line) || /[;]/.test(line) || /\.\s/.test(line)) return false;
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 8 || line.length > 72) return false;
  if (!/^[A-Z0-9("]/.test(line)) return false;
  const label = line.replace(/:$/, "");
  if (line.includes(",")) return false;
  if (/^(?:Must|Should|Please)\s+[a-z]/.test(line)) return false;
  if (/^\d+\+?\s+years?\b/i.test(line)) return false;
  if (/^(?:full|part)[ -]time$/i.test(label)) return false;
  if (/^(?:remote|hybrid|on-?site)(?:\s*[-–—]\s+\S.*|\s+(?:role|position|work(?:\s+arrangement)?))?$/i.test(label)) return false;
  if (line.endsWith(":")) return true;
  return words.length < 5 || words.slice(1).some((word) => /[A-Z]/.test(word));
}

function followingSectionLine(sections: string[][], index: number) {
  for (let next = index + 1; next < sections.length; next += 1) {
    for (const line of sections[next] ?? []) {
      if (!line || /^[-*•]$/.test(line)) continue;
      return line;
    }
  }
  return "";
}

function trailingSectionHeading(items: string[]) {
  if (items.length < 2) return undefined;
  const last = stripBullet(items[items.length - 1] ?? "");
  const previous = stripBullet(items[items.length - 2] ?? "");
  const words = last.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4 || last.length > 24 || /[,:.]/.test(last)) return undefined;
  if (!isHeadingShape(last)) return undefined;
  if (previous.length < last.length + 20) return undefined;
  return last;
}

function headingText(value: string) {
  return value.trim().replace(/:$/, "").trim();
}

function stripBullet(value: string) {
  return value.replace(bulletPattern, "").trim();
}

function splitJoinedClauses(value: string) {
  return value
    .replace(/[〕】](?=[A-Z])/g, (mark) => `${mark}\n`)
    .replace(/\)(?=[A-Z][a-z])/g, ")\n")
    .replace(
      /(^|[^A-Za-z0-9])([a-z][a-z'-]*[a-z])(?=[A-Z][a-z]{2,}(?:[^A-Za-z]|$))/g,
      "$1$2\n"
    )
    .replace(
      /(^|[^A-Za-z0-9])([A-Z]{2,})(?=[A-Z][a-z]{2,}(?:[^A-Za-z]|$))/g,
      "$1$2\n"
    )
    .replace(/\uE001(?=[A-Z])/g, "\uE001\n");
}

function protectTermsIn(value: string) {
  const tokens: string[] = [];
  let text = value;

  for (const term of protectedTerms) {
    if (!text.includes(term)) continue;
    text = text.replaceAll(term, () => {
      const token = `\uE000${tokens.length}\uE001`;
      tokens.push(term);
      return token;
    });
  }

  return { text, tokens };
}

function restoreTerms(value: string, tokens: string[]) {
  return value.replace(/\uE000(\d+)\uE001/g, (_match, index: string) => tokens[Number(index)] ?? "");
}

function stripJobHtml(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/(?:p|div|h[1-6]|ul|ol|li|tr|section|table)>/gi, "\n")
    .replace(/<(?:p|div|h[1-6]|ul|ol|tr|section|table)\b[^>]*>/gi, "\n")
    .replace(/<\/?[a-z][^>\n]*>/gi, "");
}
