import { chromium, expect } from "@playwright/test";

import { loadBrowserAuditScenarios } from "./audit-user-stories-browser-fixtures.ts";
import { auditJobComparisonBrowser } from "./audits/job-comparison-browser.mjs";
import { auditMinimumSalaryBrowser } from "./audits/minimum-salary-browser.mjs";
import { auditJobsApiBrowser } from "./audits/jobs-api-browser.mjs";

const baseUrl = process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:3002";
const desktopViewport = { width: 1280, height: 900 };
const mobileViewport = { width: 390, height: 844 };
const {
  advancedFilterScenario,
  descriptionScenario,
  locationMapScenario,
  minimumSalaryScenario
} = await loadBrowserAuditScenarios();
const results = [];
const consoleMessages = [];
const resourceErrors = [];
let currentTestPages = [];

function record(id, status, detail) {
  results.push({ id, status, detail });
}

async function run(id, detail, fn) {
  currentTestPages = [];

  try {
    await fn();
    record(id, "Passed", detail);
  } catch (error) {
    record(
      id,
      "Failed",
      detail + ": " + (error instanceof Error ? error.message : String(error))
    );
  } finally {
    await Promise.allSettled(
      currentTestPages
        .filter((page) => !page.isClosed())
        .map((page) => page.close())
    );
    currentTestPages = [];
  }
}

async function newPage(browser, viewport, options = {}) {
  const page = await browser.newPage({ viewport, ...options.contextOptions });
  currentTestPages.push(page);
  options.beforeGoto?.(page);
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleMessages.push({ type: message.type(), text: message.text() });
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      resourceErrors.push({ status: response.status(), url: response.url() });
    }
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  return page;
}

async function withPage(browser, viewport, fn, options = {}) {
  const page = await newPage(browser, viewport, options);
  return fn(page);
}

const browser = await chromium.launch({ headless: true });

await run("FEAT-006", "Slash keyboard shortcut focuses search input", async () => {
  const page = await newPage(browser, { width: 1280, height: 900 });
  await page.evaluate(() => document.body.focus());
  await page.keyboard.press("/");
  await expect(page.locator('input[data-job-search="true"]')).toBeFocused();
  await page.close();
});

await run("FEAT-007", "Search highlighting renders visible mark elements", async () => {
  const page = await newPage(browser, { width: 1280, height: 900 });
  await page.locator('input[data-job-search="true"]').fill("Intune");
  await expect(page.locator(".active-filter-chip", { hasText: "Search: Intune" })).toBeVisible();
  await expect(page.locator("mark.search-hit").first()).toBeVisible();
  await page.close();
});

await run("FEAT-014", "Desktop filter stack is visible and mobile stack is hidden", async () => {
  const page = await newPage(browser, { width: 1280, height: 900 });
  const state = await page.evaluate(() => ({
    desktopDisplay: getComputedStyle(document.querySelector(".hero-filter-stack--desktop")).display,
    mobileDisplay: getComputedStyle(document.querySelector(".hero-filter-stack--mobile")).display,
    seniorityVisible: Boolean(document.querySelector(".hero-filter-stack--desktop select"))
  }));
  expect(state.desktopDisplay).not.toBe("none");
  expect(state.mobileDisplay).toBe("none");
  expect(state.seniorityVisible).toBeTruthy();
  await page.close();
});

await run("FEAT-015", "Mobile filter stack expands from More filters", async () => {
  const page = await newPage(browser, { width: 390, height: 844 });
  const state = await page.evaluate(() => ({
    desktopDisplay: getComputedStyle(document.querySelector(".hero-filter-stack--desktop")).display,
    mobileDisplay: getComputedStyle(document.querySelector(".hero-filter-stack--mobile")).display,
    open: document.querySelector(".hero-filter-stack--mobile")?.hasAttribute("open") ?? false
  }));
  expect(state.desktopDisplay).toBe("none");
  expect(state.mobileDisplay).not.toBe("none");
  expect(state.open).toBeFalsy();
  await page.getByText("More filters").click();
  await expect(page.locator(".hero-filter-stack--mobile[open]")).toHaveCount(1);
  await page.close();
});

await run("FEAT-072", "Current-view coverage metrics update with filters", async () => {
  const page = await newPage(browser, desktopViewport);
  const status = page.getByRole("complementary", { name: "Search coverage status" });
  const trackedBefore = await readNumericText(status.locator(".status-total .slot-number"));
  const currentBefore = await readNumericText(status.locator(".status-card-heading strong"));

  await page.getByPlaceholder("City, state, or country").fill("Switzerland");
  await expect(status.locator(".status-card-heading strong")).not.toHaveText(currentBefore.text);

  const metrics = await status.evaluate((element) => {
    const readMeter = (label) => {
      const meter = [...element.querySelectorAll(".status-meter")].find((item) =>
        item.querySelector("span")?.textContent?.includes(label)
      );
      return {
        count: Number(meter?.querySelector("strong")?.textContent ?? 0),
        width: meter?.querySelector(".status-meter-track span")?.style.width ?? ""
      };
    };

    return {
      current: Number(element.querySelector(".status-card-heading strong")?.textContent ?? 0),
      mapped: readMeter("Mapped"),
      remote: readMeter("Remote / hybrid"),
      salary: readMeter("Salary shown")
    };
  });

  expect(metrics.current).toBeGreaterThan(0);
  expect(metrics.current).toBeLessThan(currentBefore.value);
  expect(metrics.mapped.count).toBeLessThanOrEqual(metrics.current);
  expect(metrics.remote.count).toBeLessThanOrEqual(metrics.current);
  expect(metrics.salary.count).toBeLessThanOrEqual(metrics.current);
  for (const metric of [metrics.mapped, metrics.remote, metrics.salary]) {
    expect(metric.width).toMatch(/^\d+%$/);
  }
  await expect(status.locator(".status-total .slot-number")).toHaveText(trackedBefore.text);
  await page.close();
});

await run("FEAT-021", "Back navigation restores URL-derived filter state", async () => {
  const page = await newPage(browser, { width: 1280, height: 900 });
  await page.goto(baseUrl + "/?q=Jamf", { waitUntil: "networkidle" });
  await expect(page.locator('input[data-job-search="true"]')).toHaveValue("Jamf");
  await page.goto(baseUrl + "/?q=Intune", { waitUntil: "networkidle" });
  await expect(page.locator('input[data-job-search="true"]')).toHaveValue("Intune");
  await page.goBack({ waitUntil: "networkidle" });
  await expect(page.locator('input[data-job-search="true"]')).toHaveValue("Jamf");
  await page.close();
});

await run("FEAT-023", "Pagination next button changes active page", async () => {
  const page = await newPage(browser, { width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("footer").scrollIntoViewIfNeeded();
  await page.getByTitle("Next page").last().click();
  await expect(page.locator(".pagination-button.is-active").first()).toHaveText("2");
  await expect.poll(async () => {
    const box = await page.locator("#open-roles").boundingBox();
    return Math.abs(Math.round(box?.y ?? Number.POSITIVE_INFINITY));
  }).toBeLessThanOrEqual(3);
  await expect(page.locator(".pagination-ellipsis").first()).toBeVisible();
  await page.close();
});

await run("QA-009", "Pagination boundaries keep top and bottom controls in sync", async () => {
  const page = await newPage(browser, { width: 1280, height: 900 });
  const initialSummary = (await page.locator(".pagination-summary").first().textContent()) ?? "";
  const totalJobs = Number(initialSummary.match(/of\s+(\d+)/)?.[1] ?? 0);
  const totalPages = Math.ceil(totalJobs / 20);
  const lastPageStart = (totalPages - 1) * 20 + 1;

  expect(totalPages).toBeGreaterThan(1);
  await expect(page.getByTitle("Previous page")).toHaveCount(2);
  expect(await disabledButtonCount(page, "Previous page")).toBe(2);

  await page.getByRole("button", { name: `Go to job page ${totalPages}` }).first().click();
  await expect(page.locator(".pagination-summary")).toHaveText([
    `Showing ${lastPageStart}-${totalJobs} of ${totalJobs}`,
    `Showing ${lastPageStart}-${totalJobs} of ${totalJobs}`
  ]);
  await expect(page.locator(".pagination-button.is-active")).toHaveText([
    String(totalPages),
    String(totalPages)
  ]);
  expect(await disabledButtonCount(page, "Next page")).toBe(2);

  await page.getByTitle("Previous page").first().click();
  await expect(page.locator(".pagination-button.is-active")).toHaveText([
    String(totalPages - 1),
    String(totalPages - 1)
  ]);
  await page.close();
});

await run("FEAT-027", "Expandable descriptions open", async () => {
  const page = await newPage(browser, { width: 1280, height: 900 });
  await page.goto(
    baseUrl + "/?q=" + encodeURIComponent(descriptionScenario.query),
    { waitUntil: "networkidle" }
  );
  await expect(
    page.getByRole("heading", { name: descriptionScenario.title }).first()
  ).toBeVisible();
  const details = page.locator("details.description-details").first();
  await expect(details).toBeVisible();
  await details.locator("summary").click();
  await expect(page.locator("details.description-details[open]").first()).toBeVisible();
  await page.close();
});

await run("FEAT-030", "Apply links open externally with safe rel", async () => {
  const page = await newPage(browser, { width: 1280, height: 900 });
  const apply = page.locator("a.apply-link").first();
  await expect(apply).toBeVisible();
  await expect(apply).toHaveAttribute("target", "_blank");
  await expect(apply).toHaveAttribute("rel", /noopener noreferrer/);
  await page.close();
});

await run("FEAT-031", "Footer attribution and project links are visible", async () => {
  const page = await newPage(browser, { width: 1280, height: 900 });
  const topbarFeedback = page.getByRole("link", { name: "Open feedback form on GitHub" });
  await expect(topbarFeedback).toBeVisible();
  await expect(topbarFeedback).toHaveAttribute("target", "_blank");
  await expect(topbarFeedback).toHaveAttribute("rel", /noopener noreferrer/);
  await page.locator("footer").scrollIntoViewIfNeeded();
  await expect(page.getByText("Made by Jorgeasaurus")).toBeVisible();
  await expect(page.getByRole("link", { name: /Report an issue/i })).toHaveAttribute("href", new RegExp("github\\.com/jorgeasaurus/EndpointJobs/issues/new"));
  await expect(page.getByRole("link", { name: /Open the Endpoint Jobs GitHub repository/i })).toHaveAttribute("href", "https://github.com/jorgeasaurus/EndpointJobs");
  await page.close();
});

await run("FEAT-032", "Parallax background layers render behind content", async () => {
  const page = await newPage(browser, { width: 1280, height: 900 });
  await page.waitForSelector('[data-endpoint-signal-canvas="true"]', { timeout: 10000 });
  const state = await page.evaluate(() => {
    const field = document.querySelector(".parallax-field");
    const content = document.querySelector(".site-content");
    const signalCanvas = document.querySelector('[data-endpoint-signal-canvas="true"]');
    return {
      ariaHidden: field?.getAttribute("aria-hidden"),
      fieldPosition: field ? getComputedStyle(field).position : null,
      contentPosition: content ? getComputedStyle(content).position : null,
      hasAtmosphere: Boolean(document.querySelector(".parallax-atmosphere")),
      hasSignalCanvas: Boolean(signalCanvas),
      signalCanvasPosition: signalCanvas ? getComputedStyle(signalCanvas).position : null
    };
  });
  expect(state.ariaHidden).toBe("true");
  expect(state.fieldPosition).toBe("fixed");
  expect(state.hasAtmosphere).toBeTruthy();
  expect(state.hasSignalCanvas).toBeTruthy();
  expect(state.signalCanvasPosition).toBe("absolute");
  expect(["relative", "absolute", "fixed", "sticky"]).toContain(state.contentPosition);
  await page.close();
});

await run("QA-012", "Reduced motion skips the Three signal canvas", async () => {
  const page = await newPage(browser, { width: 1280, height: 900 }, {
    contextOptions: {
      reducedMotion: "reduce"
    }
  });

  await expect(page.locator('[data-endpoint-signal-canvas="true"]')).toHaveCount(0);
  const state = await page.evaluate(() => {
    const field = document.querySelector(".parallax-field");
    const host = document.querySelector(".parallax-three-host");

    return {
      hasThreeClass: field?.classList.contains("parallax-field--three") ?? false,
      hostChildCount: host?.childElementCount ?? 0
    };
  });

  expect(state.hasThreeClass).toBeFalsy();
  expect(state.hostChildCount).toBe(0);
  await page.close();
});

await run("FEAT-033", "Animated count numbers render numeric text", async () => {
  const page = await newPage(browser, { width: 1280, height: 900 });
  const numbers = await page.locator(".slot-number").evaluateAll((nodes) =>
    nodes.map((node) => node.textContent?.trim() ?? "")
  );
  expect(numbers.length).toBeGreaterThan(1);
  expect(numbers.some((value) => /\d/.test(value))).toBeTruthy();
  await page.close();
});

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

  const readZoom = async () =>
    Number((await page.locator(".job-map-zoom-readout").textContent())?.replace("%", "") ?? 0);

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
  await openLocationMap(page, locationMapScenario);
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
  await openLocationMap(page, locationMapScenario);
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

await run("QA-016", "Country location search includes jobs stored by city", () => withPage(browser, desktopViewport, async (page) => {
  const locationInput = page.getByPlaceholder("City, state, or country");
  await locationInput.fill("Switzerland");

  await expectActiveFilterChips(page, ["Location: Switzerland"]);
  await expect(page.getByText("No matching roles")).toHaveCount(0);
  await expect(page.locator(".job-card").first()).toBeVisible();
}));

await run("QA-003", "Mobile empty state reset restores results after a location miss", async () => {
  const page = await newPage(browser, { width: 390, height: 844 });
  await page.getByPlaceholder("City, state, or country").fill("No Matching City");

  await expect(page.getByText("No matching roles")).toBeVisible();
  await page.getByRole("button", { name: /reset filters/i }).click();
  await expect(page.getByPlaceholder("City, state, or country")).toHaveValue("");
  await expect(page.locator(".job-card").first()).toBeVisible();
  await page.close();
});

await run("QA-008", "UI filters hydrate from URL and chip removal recovers", () => withPage(browser, desktopViewport, async (page) => {
  const salaryToggle = page.getByRole("button", { name: "Salary shown", exact: true });
  const desktopFilterStack = page.locator(".hero-filter-stack--desktop");
  const workplaceSelect = page.locator(".mini-field--workplace select");

  await salaryToggle.click();
  await page.getByRole("button", { name: "Windows" }).click();
  await workplaceSelect.selectOption("Remote");
  await desktopFilterStack.getByRole("button", { name: "Intune", exact: true }).click();

  await expectActiveFilterChips(page, ["Salary shown", "Windows", "Remote", "Intune"]);
  await expect(page.locator(".job-card").first()).toBeVisible();

  expectUrlParams(page, {
    salary: "1",
    platforms: "Windows",
    workplace: "Remote",
    tools: "Intune"
  });

  await page.reload({ waitUntil: "networkidle" });
  await expect(salaryToggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".facet-button.is-active", { hasText: "Windows" })).toBeVisible();
  await expect(workplaceSelect).toHaveValue("Remote");
  await expect(desktopFilterStack.locator(".facet-button.is-active", { hasText: "Intune" })).toBeVisible();
  await expect(page.locator(".job-card").first()).toBeVisible();

  await page.getByRole("button", { name: "Remove filter: Windows" }).click();
  expectUrlParams(page, { platforms: null });
  await expect(page.getByRole("button", { name: "Remove filter: Windows" })).toHaveCount(0);
  await expect(page.locator(".job-card").first()).toBeVisible();

  await clearActiveFilters(page);
  await expect(page.locator(".job-card").first()).toBeVisible();
}));

await run("QA-015", "PowerShell tool filter renders and hydrates on desktop and mobile", async () => {
  const desktopPage = await newPage(browser, desktopViewport);
  const desktopFilterStack = desktopPage.locator(".hero-filter-stack--desktop");
  const desktopPowerShell = desktopFilterStack.getByRole("button", {
    name: "PowerShell",
    exact: true
  });

  await expect(desktopPowerShell).toBeVisible();
  await desktopPowerShell.click();
  await expectActiveFilterChips(desktopPage, ["PowerShell"]);
  expectUrlParams(desktopPage, { tools: "PowerShell" });

  await desktopPage.goto(withQuery({ tools: "PowerShell" }), { waitUntil: "networkidle" });
  await expect(desktopPowerShell).toHaveAttribute("aria-pressed", "true");
  await expect(desktopPage.locator(".job-card").first()).toBeVisible();
  await desktopPage.close();

  const mobilePage = await newPage(browser, mobileViewport);
  await mobilePage.getByText("More filters").click();
  const mobileFilterStack = mobilePage.locator(".hero-filter-stack--mobile");
  const mobilePowerShell = mobileFilterStack.getByRole("button", {
    name: "PowerShell",
    exact: true
  });

  await expect(mobilePowerShell).toBeVisible();
  await mobilePowerShell.scrollIntoViewIfNeeded();
  await expectElementHorizontallyReachable(mobilePage, mobilePowerShell);
  await mobilePowerShell.click();
  await expectActiveFilterChips(mobilePage, ["PowerShell"]);
  expectUrlParams(mobilePage, { tools: "PowerShell" });
  await mobilePage.close();
});

await run("QA-014", "Advanced select filters serialize, hydrate, and sort visible results", () => withPage(browser, desktopViewport, async (page) => {
  const roleSelect = page.locator(".high-signal-filters .mini-field", { hasText: "Role" }).locator("select");
  const freshnessSelect = page.locator(".high-signal-filters .mini-field", { hasText: "Freshness" }).locator("select");
  const desktopFilterStack = page.locator(".hero-filter-stack--desktop");
  const senioritySelect = desktopFilterStack.locator(".field", { hasText: "Seniority" }).locator("select");
  const sortSelect = desktopFilterStack.locator(".field", { hasText: "Sort" }).locator("select");

  await roleSelect.selectOption(advancedFilterScenario.roleFamily);
  await freshnessSelect.selectOption(advancedFilterScenario.freshness);
  await senioritySelect.selectOption(advancedFilterScenario.seniority);
  await sortSelect.selectOption("company");

  await expectActiveFilterChips(page, [
    advancedFilterScenario.roleFamily,
    `Last ${advancedFilterScenario.freshness} days`,
    advancedFilterScenario.seniority,
    "Sort: Company"
  ]);
  await expect(page.locator(".pagination-summary").first()).toContainText(`of ${advancedFilterScenario.resultCount}`);

  expectUrlParams(page, {
    family: advancedFilterScenario.roleFamily,
    freshness: advancedFilterScenario.freshness,
    seniority: advancedFilterScenario.seniority,
    sort: "company"
  });

  await expect(page.locator(".job-card").first()).toContainText(advancedFilterScenario.roleFamily);
  await expect(page.locator(".job-card").first()).toContainText(advancedFilterScenario.seniority);
  const firstCompanies = await getVisibleCompanyNames(page, advancedFilterScenario.expectedCompanies.length);
  expect(firstCompanies).toEqual(advancedFilterScenario.expectedCompanies);

  await page.reload({ waitUntil: "networkidle" });
  await expect(roleSelect).toHaveValue(advancedFilterScenario.roleFamily);
  await expect(freshnessSelect).toHaveValue(advancedFilterScenario.freshness);
  await expect(senioritySelect).toHaveValue(advancedFilterScenario.seniority);
  await expect(sortSelect).toHaveValue("company");
  await expect(page.locator(".pagination-summary").first()).toContainText(`of ${advancedFilterScenario.resultCount}`);
  expect(await getVisibleCompanyNames(page, advancedFilterScenario.expectedCompanies.length)).toEqual(firstCompanies);

  await page.getByRole("button", { name: "Remove filter: Sort: Company" }).click();
  expectUrlParams(page, { sort: null });
  await expect(sortSelect).toHaveValue("newest");
  await clearActiveFilters(page);
}));

await run("QA-013", "Mobile horizontal filters and chips stay reachable", async () => {
  const page = await newPage(browser, { width: 390, height: 844 });
  await page.getByRole("button", { name: "Salary shown", exact: true }).click();
  await page.getByPlaceholder("City, state, or country").fill("Remote");
  await page.locator(".mini-field--workplace select").selectOption("Remote");

  for (const platform of ["macOS", "Windows", "iOS", "Android", "Linux"]) {
    const button = page.getByRole("button", { name: platform, exact: true });
    await button.scrollIntoViewIfNeeded();
    await expectElementHorizontallyReachable(page, button);
    await button.click();
  }

  await page.locator(".active-filter-chips").evaluate((chips) => {
    chips.scrollLeft = chips.scrollWidth;
  });

  const linuxChip = page.getByRole("button", { name: "Remove filter: Linux" });
  await linuxChip.scrollIntoViewIfNeeded();
  await expectElementHorizontallyReachable(page, linuxChip);
  await linuxChip.click();

  const platforms = new URL(page.url()).searchParams.get("platforms") ?? "";
  expect(platforms.includes("Linux")).toBeFalsy();
  await expect(page.getByRole("button", { name: "Remove filter: Linux" })).toHaveCount(0);

  await page.locator(".active-filter-chip--clear").click();
  await expect(page.locator(".active-filter-chips")).toHaveCount(0);
  expect(new URL(page.url()).search).toBe("");
  await page.close();
});

await run("QA-004", "Same-origin links resolve without dead routes", async () => {
  const page = await newPage(browser, { width: 1280, height: 900 });
  const internalHrefs = await page.locator("a[href]").evaluateAll((links) =>
    Array.from(
      new Set(
        links
          .map((link) => link.getAttribute("href"))
          .filter((href) => href && !href.startsWith("#") && !href.startsWith("mailto:") && !href.startsWith("tel:"))
          .filter((href) => new URL(href, window.location.href).origin === window.location.origin)
      )
    )
  );

  for (const href of internalHrefs) {
    const response = await page.request.get(new URL(href, baseUrl).toString(), {
      failOnStatusCode: false
    });
    expect(response.status(), `${href} returned ${response.status()}`).toBeLessThan(400);
  }

  await page.close();
});

await run("FEAT-071", "Footer popular search links hydrate filtered result states", async () => {
  const page = await newPage(browser, { width: 1280, height: 900 });
  await page.locator("footer").scrollIntoViewIfNeeded();

  const popularLinks = await page.locator("footer .footer-search-link").evaluateAll((links) =>
    links.map((link) => ({
      href: link.getAttribute("href") ?? "",
      label: link.textContent?.trim() ?? ""
    }))
  );

  expect(popularLinks).toHaveLength(9);

  for (const link of popularLinks) {
    await page.goto(new URL(link.href, baseUrl).toString(), { waitUntil: "networkidle" });

    const activeLabels = await page.locator(".active-filter-chip").evaluateAll((chips) =>
      chips
        .map((chip) => chip.textContent?.replace(/\s+/g, " ").trim() ?? "")
        .filter((label) => label && label !== "Clear all")
    );

    expect(activeLabels.length, `${link.label} should activate at least one filter`).toBeGreaterThan(0);
    await expect(page.locator(".job-card").first(), `${link.label} should show matching jobs`).toBeVisible();
    await expect(page.locator(".empty-state"), `${link.label} should not show empty state`).toHaveCount(0);
  }

  await page.close();
});

await run("QA-006", "Footer popular search links do not route-prefetch on scroll", async () => {
  const page = await newPage(browser, { width: 1280, height: 900 });
  const routePrefetches = [];
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("_rsc=") && isPopularSearchUrl(url)) {
      routePrefetches.push(url);
    }
  });

  await page.locator("footer").scrollIntoViewIfNeeded();
  await page.waitForLoadState("networkidle");

  expect(routePrefetches, routePrefetches.join("\n")).toHaveLength(0);
  await page.close();
});

await auditJobComparisonBrowser({
  browser,
  desktopViewport,
  mobileViewport,
  newPage,
  run
});

await auditMinimumSalaryBrowser({
  browser,
  minimumSalaryScenario,
  mobileViewport,
  newPage,
  run
});

await auditJobsApiBrowser({ baseUrl, browser, desktopViewport, newPage, run });

await run("FEAT-034", "Mobile viewport has no document overflow", async () => {
  const page = await newPage(browser, { width: 390, height: 844 });
  await page.getByText("More filters").click();
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    overflowingElements: [...document.querySelectorAll("body *")]
      .filter((element) =>
        element instanceof HTMLElement &&
        !element.closest(".quick-filters, .facet-list") &&
        element.getBoundingClientRect().right > window.innerWidth + 1
      )
      .slice(0, 8)
      .map((element) => ({
        tag: element.tagName,
        className: element.className,
        right: element.getBoundingClientRect().right
      }))
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.overflowingElements).toHaveLength(0);
  await page.close();
});

const relevantConsoleMessages = consoleMessages.filter(
  (message) => !isIgnoredConsoleMessage(message)
);
if (relevantConsoleMessages.length > 0) {
  record("BROWSER-CONSOLE", "Failed", JSON.stringify(relevantConsoleMessages.slice(0, 10)));
}

const relevantResourceErrors = resourceErrors.filter(
  (error) => !isIgnoredResourceError(error)
);
if (relevantResourceErrors.length > 0) {
  record("BROWSER-RESOURCES", "Failed", JSON.stringify(relevantResourceErrors.slice(0, 10)));
}

await browser.close();

const summary = results.reduce((acc, result) => {
  acc[result.status] = (acc[result.status] ?? 0) + 1;
  return acc;
}, {});

console.log(JSON.stringify({ baseUrl, summary, results }, null, 2));

if (results.some((result) => result.status !== "Passed")) {
  process.exitCode = 1;
}

function isIgnoredConsoleMessage(message) {
  return (
    message.text.includes("Download the React DevTools") ||
    message.text.includes("Failed to load resource") ||
    /AJAXError: Failed to fetch \(0\): https:\/\/[a-d]\.basemaps\.cartocdn\.com\//.test(message.text) ||
    (message.type === "warning" &&
      message.text.includes("GL Driver Message") &&
      message.text.includes("ReadPixels"))
  );
}

function isIgnoredResourceError(error) {
  const isLocalAudit = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(baseUrl);
  return isLocalAudit && error.url.includes("/_vercel/insights/script.js");
}

async function disabledButtonCount(page, title) {
  return page.getByTitle(title).evaluateAll((buttons) =>
    buttons.filter((button) => button instanceof HTMLButtonElement && button.disabled).length
  );
}

async function openLocationMap(page, scenario) {
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

async function expectActiveFilterChips(page, labels) {
  for (const label of labels) {
    await expect(page.locator(".active-filter-chip", { hasText: label })).toBeVisible();
  }
}

function expectUrlParams(page, expectedParams) {
  const params = new URL(page.url()).searchParams;

  for (const [key, value] of Object.entries(expectedParams)) {
    if (value === null) {
      expect(params.has(key), `${key} should be absent`).toBeFalsy();
    } else {
      expect(params.get(key), `${key} URL param`).toBe(value);
    }
  }
}

async function clearActiveFilters(page) {
  await page.locator(".active-filter-chip--clear").click();
  await expect(page.locator(".active-filter-chips")).toHaveCount(0);
  expect(new URL(page.url()).search).toBe("");
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

function withQuery(params) {
  const url = new URL(baseUrl);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
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

async function getVisibleCompanyNames(page, limit) {
  return page.locator(".job-card .company-line").evaluateAll((nodes, limit) =>
    nodes
      .slice(0, limit)
      .map((node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "")
      .filter(Boolean),
    limit
  );
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

async function expectElementHorizontallyReachable(page, locator) {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();

  if (!box || !viewport) {
    throw new Error("missing element or viewport box");
  }

  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
}

function isPopularSearchUrl(url) {
  return (
    url.includes("tools=") ||
    url.includes("platforms=") ||
    url.includes("family=") ||
    url.includes("workplace=") ||
    url.includes("q=client%20platform") ||
    url.includes("q=client+platform")
  );
}

function isMapTileOrGlyphUrl(url) {
  return (
    url.includes("cartocdn.com/") ||
    url.includes("demotiles.maplibre.org/font/")
  );
}

async function readNumericText(locator) {
  const text = await locator.textContent();
  expect(text).not.toBeNull();
  const normalized = text.trim();
  expect(normalized).toMatch(/^\d+$/);
  return { text: normalized, value: Number(normalized) };
}
