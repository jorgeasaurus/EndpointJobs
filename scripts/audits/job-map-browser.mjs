import { expect } from "@playwright/test";

export async function auditJobMapBrowser({
  browser, desktopViewport, mobileViewport, locationMapScenario,
  newPage, withPage, run, withQuery, expectActiveFilterChips
}) {
  await run("FEAT-057", "Job map expands only after user request", async () => {
    const page = await newPage(browser, { width: 1280, height: 900 });
    await page.locator(".job-map-section").scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: /show map/i })).toBeVisible();
    await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);
    await page.getByRole("button", { name: /show map/i }).click();
    await expect(page.getByRole("button", { name: /hide map/i })).toBeVisible();
    await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 10000 });
    const state = await page.evaluate(() => {
      const button = document.querySelector(".map-toggle-button");
      const rect = button?.getBoundingClientRect();

      return {
        expanded: button?.getAttribute("aria-expanded"),
        hasCanvas: Boolean(document.querySelector(".maplibregl-canvas")),
        targetId: button?.getAttribute("aria-controls"),
        targetExists: Boolean(document.querySelector("#job-map-canvas")),
        toggleHeight: rect?.height ?? 0
      };
    });
    expect(state.expanded).toBe("true");
    expect(state.hasCanvas).toBeTruthy();
    expect(state.targetId).toBe("job-map-canvas");
    expect(state.targetExists).toBeTruthy();
    expect(state.toggleHeight).toBeGreaterThanOrEqual(44);
    await page.close();
  });

  await run("QA-007", "Collapsed map avoids map tile and glyph requests before expansion", async () => {
    const initialMapRequests = [];
    let isExpandedStage = false;

    const page = await newPage(browser, { width: 1280, height: 900 }, {
      beforeGoto: (page) => {
        page.on("response", (response) => {
          if (isExpandedStage || !isMapTileOrGlyphUrl(response.url())) {
            return;
          }

          initialMapRequests.push(response.url());
        });
      }
    });

    await page.locator(".job-map-section").scrollIntoViewIfNeeded();
    await page.waitForLoadState("networkidle");

    expect(initialMapRequests, initialMapRequests.join("\n")).toHaveLength(0);

    isExpandedStage = true;
    await page.getByRole("button", { name: /show map/i }).click();
    await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await page.close();
  });

  await run("FEAT-063", "Map zoom controls render and zooming updates the readout", async () => {
    const page = await newPage(browser, { width: 1280, height: 900 });
    await page.locator(".job-map-section").scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: /show map/i }).click();
    await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel("Map zoom controls")).toBeVisible();
    await expect(page.getByLabel("Zoom in map")).toBeVisible();
    await expect(page.getByLabel("Zoom out map")).toBeVisible();
    await expect(page.getByLabel("Fit map to jobs")).toBeVisible();

    const readZoom = () => readMapZoomPercent(page);

    await expect.poll(readZoom, { timeout: 8000 }).toBeGreaterThan(0);
    const before = await readZoom();
    await page.getByLabel("Zoom in map").click();
    await expect.poll(readZoom, { timeout: 8000 }).toBeGreaterThan(before);

    const controlSizes = await page.locator(".job-map-control-button").evaluateAll((buttons) =>
      buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { height: rect.height, width: rect.width };
      })
    );
    expect(controlSizes.every((rect) => rect.height >= 44 && rect.width >= 44)).toBeTruthy();
    await page.close();
  });

  await run("QA-010", "Desktop map point opens popup with safe apply link", () => withPage(browser, desktopViewport, async (page) => {
    await openLocationMap(page, locationMapScenario, withQuery);
    await activateCenteredMapPoint(page, "click");

    const popup = page.locator(".job-map-popup .job-map-tooltip");
    await expect(popup).toBeVisible({ timeout: 10000 });
    await expect(popup).toContainText(locationMapScenario.mapLabel);
    await expect(popup).toContainText(locationMapScenario.job.title);
    await expect(popup).toContainText(locationMapScenario.job.company);

    const apply = popup.getByRole("link", { name: /apply/i });
    await expect(apply).toHaveAttribute("href", getExpectedApplyHref(locationMapScenario.job));
    await expect(apply).toHaveAttribute("target", "_blank");
    await expect(apply).toHaveAttribute("rel", /noopener noreferrer/);
    await expect(page.locator(".job-map-mobile-sheet")).toBeHidden();
  }));

  await run("QA-011", "Mobile map point opens dismissible detail sheet", () => withPage(browser, mobileViewport, async (page) => {
    await openLocationMap(page, locationMapScenario, withQuery);
    await activateCenteredMapPoint(page, "tap");

    const sheet = page.locator(".job-map-mobile-sheet");
    await expect(sheet).toBeVisible({ timeout: 10000 });
    await expect(sheet).toContainText(locationMapScenario.job.title);
    await expect(sheet).toContainText(locationMapScenario.job.company);
    await expect(page.locator(".job-map-popup")).toBeHidden();

    const apply = sheet.getByRole("link", { name: /apply/i });
    await expect(apply).toHaveAttribute("target", "_blank");
    await expect(apply).toHaveAttribute("rel", /noopener noreferrer/);

    await page.getByRole("button", { name: "Close selected job" }).click();
    await expect(sheet).toHaveCount(0);
  }, {
      contextOptions: {
        hasTouch: true,
        isMobile: true
      }
    }));

  await run("QA-001", "Mobile spaced location input keeps mapped map results visible", () => withPage(browser, mobileViewport, async (page) => {
    await page.getByRole("button", { name: /show map/i }).click();
    await typeSpacedLocationQuery(page, locationMapScenario.query);

    await expect(page.getByPlaceholder("City, state, or country")).toHaveValue(locationMapScenario.query);
    await expectActiveFilterChips(page, [`Location: ${locationMapScenario.query}`]);
    await expectMapCounts(page, locationMapScenario);
    await expect(page.locator(".job-card").first()).toBeVisible();
    await expect(page.locator("#job-map-canvas canvas")).toBeVisible({ timeout: 10000 });
  }));

  await run("QA-002", "Location URL with encoded spaces hydrates map results", () => withPage(browser, mobileViewport, async (page) => {
    await page.goto(withQuery({ location: locationMapScenario.query }), { waitUntil: "networkidle" });

    await expect(page.getByPlaceholder("City, state, or country")).toHaveValue(locationMapScenario.query);
    await expectActiveFilterChips(page, [`Location: ${locationMapScenario.query}`]);
    await page.getByRole("button", { name: /show map/i }).click();
    await expectMapCounts(page, locationMapScenario);
    await expect(page.locator("#job-map-canvas canvas")).toBeVisible({ timeout: 10000 });
  }));
}

async function openLocationMap(page, scenario, withQuery) {
  await page.goto(withQuery({ location: scenario.query }), { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /show map/i }).click();
  await expectMapCounts(page, scenario);
  await expect(page.locator("#job-map-canvas canvas")).toBeVisible({ timeout: 10000 });
  await expect.poll(() => readMapZoomPercent(page), { timeout: 10000 }).toBeGreaterThanOrEqual(800);
}

async function expectMapCounts(page, scenario) {
  await expect(page.locator(".job-map-heading h2")).toHaveText(`${scenario.mappedCount} mapped jobs`);
  await expect(page.locator(".map-count-pill")).toContainText(`${scenario.mappedCount} of ${scenario.totalCount}`);
}

async function typeSpacedLocationQuery(page, query) {
  const firstSpace = query.indexOf(" ");

  if (firstSpace < 1) {
    throw new Error(`location query must contain a typed space: ${query}`);
  }

  const locationInput = page.getByPlaceholder("City, state, or country");
  await locationInput.click();
  await page.keyboard.type(query.slice(0, firstSpace));
  await page.keyboard.press("Space");
  await expect(locationInput).toHaveValue(query.slice(0, firstSpace + 1));
  await page.keyboard.type(query.slice(firstSpace + 1));
}

function getExpectedApplyHref(job) {
  if (!job.applyUrl) {
    throw new Error(`map scenario job has no apply URL: ${job.id}`);
  }

  return job.applyUrl;
}

async function activateCenteredMapPoint(page, method) {
  const canvas = page.locator("#job-map-canvas canvas");
  const box = await canvas.boundingBox();

  if (!box) {
    throw new Error("missing map canvas bounding box");
  }

  const center = {
    x: Math.round(box.width / 2),
    y: Math.round(box.height / 2)
  };
  const offsets = [
    [0, 0],
    [-10, 0],
    [10, 0],
    [0, -10],
    [0, 10],
    [-18, -18],
    [18, -18],
    [-18, 18],
    [18, 18]
  ];

  for (const [offsetX, offsetY] of offsets) {
    const position = {
      x: Math.min(Math.max(center.x + offsetX, 4), Math.round(box.width - 4)),
      y: Math.min(Math.max(center.y + offsetY, 4), Math.round(box.height - 4))
    };

    if (method === "tap") {
      await canvas.tap({ position });
    } else {
      await canvas.hover({ position });
      await canvas.click({ position });
    }

    if (await hasVisibleMapDetail(page, method)) {
      return;
    }
  }

  throw new Error("map point activation did not open job details");
}

async function readMapZoomPercent(page) {
  return Number((await page.locator(".job-map-zoom-readout").textContent())?.replace("%", "") ?? 0);
}

async function hasVisibleMapDetail(page, method) {
  const detail = page.locator(
    method === "tap" ? ".job-map-mobile-sheet" : ".job-map-popup .job-map-tooltip"
  );

  try {
    await expect(detail).toBeVisible({ timeout: 600 });
    return true;
  } catch {
    return false;
  }
}

function isMapTileOrGlyphUrl(url) {
  return (
    url.includes("cartocdn.com/") ||
    url.includes("demotiles.maplibre.org/font/")
  );
}
