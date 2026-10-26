import { expect, test, type Locator, type Page } from "@playwright/test";

type ChipBox = {
  height: number;
  label: string;
  top: number;
};

async function platformChipBoxes(scope: Locator) {
  const chips = scope.locator(".tool-chip--platform");
  await expect(chips.first()).toBeVisible();
  return chips.evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        height: rect.height,
        label: (node.textContent ?? "").replace(/\s+/g, " ").trim(),
        top: rect.top
      };
    })
  );
}

function rowsOf(boxes: ChipBox[]) {
  const rows: ChipBox[][] = [];

  for (const box of boxes) {
    const row = rows.find((entry) => entry.some((other) => verticalOverlap(other, box)));
    if (row) row.push(box);
    else rows.push([box]);
  }

  return rows.filter((row) => row.length > 1);
}

function verticalOverlap(a: ChipBox, b: ChipBox) {
  return a.top < b.top + b.height && b.top < a.top + a.height;
}

function expectUniformRow(row: ChipBox[]) {
  const tops = row.map((box) => box.top);
  const heights = row.map((box) => box.height);
  const topSpread = Math.max(...tops) - Math.min(...tops);
  const heightSpread = Math.max(...heights) - Math.min(...heights);
  expect(topSpread, row.map((box) => box.label).join(", ")).toBeLessThanOrEqual(1);
  expect(heightSpread, row.map((box) => `${box.label}:${box.height}`).join(", ")).toBeLessThanOrEqual(1);
}

async function openPlatformChipCard(page: Page) {
  await page.goto("/");
  const card = page
    .locator("article.job-card")
    .filter({ has: page.locator(".tool-chip--platform", { hasText: /^Windows$/ }) })
    .filter({ has: page.locator(".tool-chip--platform", { hasText: /^macOS$/ }) })
    .first();
  await expect(card).toBeVisible();
  await card.locator("summary").click();
  const chips = card.locator("ul.tool-chips");
  await chips.scrollIntoViewIfNeeded();
  return { card, chips };
}

test("expanded description OS chips in one row share height and top offset", async ({ page }) => {
  const { chips } = await openPlatformChipCard(page);
  const boxes = await platformChipBoxes(chips);
  const rows = rowsOf(boxes);
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) expectUniformRow(row);

  const windows = boxes.find((box) => box.label === "Windows");
  const macos = boxes.find((box) => box.label === "macOS");
  expect(windows).toBeTruthy();
  expect(macos).toBeTruthy();
  if (!windows || !macos) return;
  expect(Math.abs(windows.top - macos.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(windows.height - macos.height)).toBeLessThanOrEqual(1);
});

test("job detail platform chips in one row share height and top offset", async ({ page }) => {
  const { card } = await openPlatformChipCard(page);
  const href = await card.locator("a.job-title-link").getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href!);
  const chips = page.locator(".job-context-card--stack .tool-chips").first();
  await chips.scrollIntoViewIfNeeded();
  const rows = rowsOf(await platformChipBoxes(chips));
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) expectUniformRow(row);
});
