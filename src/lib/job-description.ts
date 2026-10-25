export type DescriptionBlock =
  | { type: "paragraph"; text: string }
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
  const split = text
    .replace(/[〕】](?=[A-Z])/g, (mark) => `${mark}\n`)
    .replace(/\)(?=[A-Z])/g, ")\n")
    .replace(/(?<=[a-z]{2})(?=[A-Z])/g, "\n")
    .replace(/(?<=[A-Z]{2})(?=[A-Z][a-z])/g, "\n")
    .replace(/\uE001(?=[A-Z])/g, "\uE001\n");
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
      const indent = (line.match(/^[ \t]*/)?.[0] ?? "").replace(/\t/g, "    ");
      const body = line.slice(indent.length).replace(/[^\S\n]+/g, " ").trim();
      return body ? `${indent}${body}` : "";
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\n+$/g, "");
}

export function toDescriptionBlocks(value: string): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];
  let bullets: string[] = [];

  function flushBullets() {
    if (bullets.length === 0) return;
    blocks.push({ type: "list", items: bullets.map(stripBullet) });
    bullets = [];
  }

  for (const section of value.split(/\n{2,}/)) {
    const lines = section.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length > 0 && lines.every((line) => bulletPattern.test(line))) {
      bullets.push(...lines);
      continue;
    }

    flushBullets();
    blocks.push(...partitionSection(lines));
  }

  flushBullets();
  return blocks.filter((block) => block.type === "list" ? block.items.length > 0 : block.text.length > 0);
}

function partitionSection(lines: string[]): DescriptionBlock[] {
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
    if (trailingHeading) blocks.push({ type: "paragraph", text: trailingHeading });
    items = [];
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const next = lines[index + 1];
    const marked = bulletPattern.test(line);
    const words = line.split(/\s+/).length;
    const heading = !marked
      && words <= 5
      && line.length <= 28
      && !/[,:;]$/.test(line)
      && !line.includes(",")
      && Boolean(next)
      && (next?.length ?? 0) > line.length
      && /^[A-Z0-9]/.test(next ?? "");

    if (heading) {
      flushItems();
      blocks.push({ type: "paragraph", text: line });
      continue;
    }

    items.push(line);
  }

  flushItems();
  return blocks.filter((block) => block.type === "list" ? block.items.length > 0 : block.text.length > 0);
}

function trailingSectionHeading(items: string[]) {
  if (items.length < 2) return undefined;
  const last = stripBullet(items[items.length - 1] ?? "");
  const previous = stripBullet(items[items.length - 2] ?? "");
  const words = last.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4 || last.length > 24 || /[,:.]/.test(last)) return undefined;
  if (previous.length < last.length + 20) return undefined;
  return last;
}

function stripBullet(value: string) {
  return value.replace(bulletPattern, "").trim();
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
