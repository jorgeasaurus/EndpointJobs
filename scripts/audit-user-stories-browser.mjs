import { chromium, expect } from "@playwright/test";

const baseUrl = process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:3002";
const results = [];
const consoleMessages = [];
const resourceErrors = [];

function record(id, status, detail) {
  results.push({ id, status, detail });
}

async function run(id, detail, fn) {
  try {
    await fn();
    record(id, "Passed", detail);
  } catch (error) {
    record(
      id,
      "Failed",
      detail + ": " + (error instanceof Error ? error.message : String(error))
    );
  }
}

async function newPage(browser, viewport) {
  const page = await browser.newPage({ viewport });
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
  await page.getByTitle("Next page").first().click();
  await expect(page.locator(".pagination-button.is-active").first()).toHaveText("2");
  await page.close();
});

await run("FEAT-027", "Expandable descriptions open", async () => {
  const page = await newPage(browser, { width: 1280, height: 900 });
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

await run("QA-001", "Mobile San Diego location input keeps mapped map results visible", async () => {
  const page = await newPage(browser, { width: 390, height: 844 });
  await page.getByRole("button", { name: /show map/i }).click();

  const locationInput = page.getByPlaceholder("City, state, or country");
  await locationInput.click();
  await page.keyboard.type("San");
  await page.keyboard.press("Space");
  await expect(locationInput).toHaveValue("San ");
  await page.keyboard.type("Diego");

  await expect(locationInput).toHaveValue("San Diego");
  await expect(page.locator(".active-filter-chip", { hasText: "Location: San Diego" })).toBeVisible();
  await expect(page.locator(".job-map-heading h2")).toHaveText("1 mapped jobs");
  await expect(page.locator(".map-count-pill")).toContainText("1 of 1");
  await expect(page.locator(".job-card")).toHaveCount(1);
  await expect(page.locator("#job-map-canvas canvas")).toBeVisible({ timeout: 10000 });
  await page.close();
});

await run("QA-002", "Location URL with encoded spaces hydrates map results", async () => {
  const page = await newPage(browser, { width: 390, height: 844 });
  await page.goto(baseUrl + "/?location=San+Diego", { waitUntil: "networkidle" });

  await expect(page.getByPlaceholder("City, state, or country")).toHaveValue("San Diego");
  await expect(page.locator(".active-filter-chip", { hasText: "Location: San Diego" })).toBeVisible();
  await page.getByRole("button", { name: /show map/i }).click();
  await expect(page.locator(".job-map-heading h2")).toHaveText("1 mapped jobs");
  await expect(page.locator(".map-count-pill")).toContainText("1 of 1");
  await expect(page.locator("#job-map-canvas canvas")).toBeVisible({ timeout: 10000 });
  await page.close();
});

await run("QA-003", "Mobile empty state reset restores results after a location miss", async () => {
  const page = await newPage(browser, { width: 390, height: 844 });
  await page.getByPlaceholder("City, state, or country").fill("No Matching City");

  await expect(page.getByText("No matching roles")).toBeVisible();
  await page.getByRole("button", { name: /reset filters/i }).click();
  await expect(page.getByPlaceholder("City, state, or country")).toHaveValue("");
  await expect(page.locator(".job-card").first()).toBeVisible();
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
