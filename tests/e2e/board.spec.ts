import { expect, test, type Page } from "@playwright/test";

async function openBoard(page: Page) {
  await page.goto("/board");
  await expect(page.getByRole("heading", { level: 1, name: "Endpoint Jobs" })).toBeVisible();
  // Dev hydration can still be applying the App Router URL after the heading
  // is visible. A select in that window is overwritten back to /board.
  await page.waitForLoadState("networkidle");
}

async function openAdvanced(page: Page) {
  const summary = page.locator("summary.advanced-filters-summary");
  await summary.click();
  await expect(page.locator("details.advanced-filters")).toHaveAttribute("open", "");
}

test("[BOARD-02] coverage rail", async ({ page }, info) => {
  const payload = await (await page.request.get("/api/board")).json() as {
    trackedJobsCount: number;
    total: number;
    metrics: { mappedJobsCount: number; remoteJobsCount: number; salaryJobsCount: number };
  };
  await openBoard(page);
  const rail = info.project.name === "mobile"
    ? page.locator(".search-coverage-mobile .command-status")
    : page.locator(".command-layout > .command-status");
  await expect(rail).toContainText("tracked roles");
  await expect(rail).toHaveAttribute("aria-label", "Search coverage status");
  const labelled = rail.locator(".status-total");
  await expect(labelled).toHaveAttribute("aria-label", `${payload.trackedJobsCount} tracked roles`);
  await expect(rail).not.toContainText("Current view");
  await expect(rail).toContainText("Mapped");
  await expect(rail).toContainText("Remote / hybrid");
  await expect(rail).toContainText("Salary shown");
  if (info.project.name === "desktop") await expect(rail).toBeVisible();
});

test("[BOARD-03] coverage disclosure", async ({ page }) => {
  await openBoard(page);
  const details = page.locator("details.search-coverage-mobile");
  await expect(details.locator("summary")).toHaveText("Coverage stats");
  await expect(details).not.toHaveAttribute("open", "");
  if (await details.isVisible()) {
    await details.locator("summary").click();
    await expect(details).toHaveAttribute("open", "");
    await expect(details.locator(".command-status")).toContainText("tracked roles");
  }
});

test("[BOARD-04] result heading", async ({ page }) => {
  const payload = await (await page.request.get("/api/board")).json() as { total: number };
  await openBoard(page);
  const region = page.getByRole("region", { name: "Job listings" });
  await expect(region).toBeVisible();
  await expect(region.locator("h2")).toContainText("endpoint opportunities");
  await expect(region.locator("h2 .sr-only")).toHaveText(`${payload.total} `);
  await expect(region.getByText("Daily refresh")).toBeVisible();
  await expect(region).not.toHaveAttribute("aria-busy", "true");
});

test("[SEARCH-01] keyword search", async ({ page }) => {
  await openBoard(page);
  const input = page.locator("#job-search-input");
  await expect(page.locator("label[for='job-search-input']")).toHaveText("Search jobs");
  await expect(input).toHaveAttribute("name", "q");
  await expect(input).toHaveAttribute("placeholder", "Search Jamf, Intune, macOS, Kandji/Iru...");
  await input.fill("intune");
  await expect(page).toHaveURL(/q=intune/);
  await expect(page.locator("#job-search-status")).toContainText(/role(s)? found/);
  await expect(page.locator("#job-search-status")).toHaveAttribute("aria-live", "polite");
});

test("[SEARCH-02] slash focuses search", async ({ page }) => {
  await openBoard(page);
  await page.getByRole("heading", { level: 1, name: "Endpoint Jobs" }).click();
  await page.keyboard.press("/");
  await expect(page.locator("#job-search-input")).toBeFocused();
  await expect(page.locator("#job-search-input")).toHaveValue("");
  await page.locator("#location-query").focus();
  await page.keyboard.press("/");
  await expect(page.locator("#location-query")).toBeFocused();
  await page.locator("body").click();
  await page.keyboard.press("Control+/");
  await expect(page.locator("#job-search-input")).not.toBeFocused();
});

test("[SEARCH-03] highlight and clear", async ({ page }) => {
  await openBoard(page);
  const input = page.locator("#job-search-input");
  const title = (await page.locator("a.job-title-link").first().innerText()).replace(/\s+/g, " ").trim();
  const word = title.split(/\s+/).find((part) => part.length >= 4 && /^[A-Za-z]+$/.test(part)) ?? "Intune";
  await input.fill(word.slice(0, 1));
  await expect(page.locator("mark.search-hit")).toHaveCount(0);
  await input.fill(word);
  await expect(page.locator("article.job-card mark.search-hit").first()).toBeVisible();
  await input.fill("(");
  await expect(page.getByRole("region", { name: "Job listings" })).toBeVisible();
  await page.getByRole("button", { name: "Clear job search" }).click();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
});

test("[FILT-01] location field", async ({ page }) => {
  await openBoard(page);
  const input = page.getByRole("searchbox", { name: "Search locations" });
  await expect(input).toHaveAttribute("id", "location-query");
  await expect(input).toHaveAttribute("placeholder", "City, state, or country");
  await input.fill("Austin");
  await expect(page).toHaveURL(/location=Austin/);
});

test("[FILT-02] workplace", async ({ page }) => {
  await openBoard(page);
  const group = page.getByRole("group", { name: "Workplace" });
  for (const label of ["Any", "Remote", "Hybrid", "On-site"]) {
    await expect(group.getByRole("button", { name: new RegExp(`^${label}\\b`) })).toBeVisible();
  }
  const remote = group.getByRole("button", { name: /^Remote\b/ });
  const before = await remote.innerText();
  await remote.click();
  await expect(remote).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/workplace=Remote/);
  await expect(remote).toContainText(before.replace(/\s+/g, " ").trim().split(" ").pop()!);
});

test("[FILT-03] salary shown toggle", async ({ page }) => {
  await openBoard(page);
  const toggle = page.getByRole("button", { name: "Salary shown", exact: true });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/salary=1/);
  const chip = page.getByRole("button", { name: "Remove filter: Salary shown" });
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
});

test("[FILT-04] leadership toggle", async ({ page }) => {
  await openBoard(page);
  const toggle = page.getByRole("button", { name: "Leadership", exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/leadership=1/);
  await expect(page.getByRole("button", { name: "Remove filter: Leadership" })).toBeVisible();
});

test("[FILT-05] role family", async ({ page }) => {
  await openBoard(page);
  const select = page.locator("#role-family");
  const labels = await select.locator("option").allTextContents();
  for (const family of [
    "All", "Endpoint Engineering", "macOS Platform", "Windows Platform", "Workplace Systems",
    "Endpoint Security", "Device Compliance", "Systems Administration", "Automation"
  ]) {
    expect(labels).toContain(family);
  }
  await select.selectOption("Endpoint Security");
  await expect(page).toHaveURL(/family=Endpoint(\+|%20)Security/);
});

test("[FILT-06] freshness window", async ({ page }) => {
  await openBoard(page);
  const select = page.locator("#freshness");
  const labels = await select.locator("option").allTextContents();
  expect(labels).toEqual(["Any", "Last 1 day", "Last 7 days", "Last 14 days", "Last 30 days"]);
  await select.selectOption("7");
  await expect(page).toHaveURL(/freshness=7/);
});

test("[FILT-07] platforms", async ({ page }) => {
  await openBoard(page);
  const mac = page.locator(".quick-filters").getByRole("button", { name: "macOS", exact: true });
  await mac.click();
  await expect(mac).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/platforms=macOS/);
  await expect(page.getByRole("button", { name: "Remove filter: macOS" })).toBeVisible();
});

test("[FILT-08] tools", async ({ page }) => {
  await openBoard(page);
  await openAdvanced(page);
  const tools = page.locator(".facet-group").filter({ has: page.locator(".facet-title", { hasText: "Tools" }) });
  for (const tool of ["Jamf", "Intune", "SCCM", "Fleet MDM", "Kandji/Iru", "NinjaOne", "Workspace ONE", "Tanium", "Okta", "Google Workspace", "Entra ID", "Autopilot", "PowerShell", "Defender"]) {
    await expect(tools.getByRole("link", { name: tool, exact: true })).toBeVisible();
  }
});

test("[FILT-09] metro areas", async ({ page }) => {
  await openBoard(page);
  await openAdvanced(page);
  for (const metro of ["London, UK", "Berlin, Germany", "Munich, Germany", "Madrid, Spain", "Zurich, Switzerland", "Mexico City, Mexico", "São Paulo, Brazil"]) {
    await expect(page.getByRole("button", { name: metro, exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "London, UK", exact: true }).click();
  await expect(page).toHaveURL(/metroAreas=London/);
  await expect(page.getByRole("button", { name: "Remove filter: Metro: London, UK" })).toBeVisible();
});

test("[FILT-10] seniority", async ({ page }) => {
  await openBoard(page);
  await openAdvanced(page);
  const labels = await page.locator("#seniority option").allTextContents();
  expect(labels).toEqual(["All", "Associate", "Mid", "Senior", "Staff", "Lead", "Manager"]);
  await page.locator("#seniority").selectOption("Senior");
  await expect(page).toHaveURL(/seniority=Senior/);
});

test("[FILT-11] visa sponsorship", async ({ page }) => {
  await openBoard(page);
  await openAdvanced(page);
  const labels = await page.locator("#visa-sponsorship option").allTextContents();
  expect(labels).toEqual(["Any", "Available", "Case-by-case", "Unavailable", "Not stated"]);
  await page.locator("#visa-sponsorship").selectOption("available");
  await expect(page).toHaveURL(/sponsorship=available/);
  await expect(page.getByRole("button", { name: /Remove filter: Visa:/ })).toBeVisible();
});

test("[FILT-12] minimum salary", async ({ page }) => {
  await openBoard(page);
  await openAdvanced(page);
  const labels = await page.locator("#minimum-salary option").allTextContents();
  expect(labels).toEqual(["Any salary", "$80k+", "$100k+", "$120k+", "$150k+", "$180k+", "$200k+"]);
  await page.locator("#minimum-salary").selectOption("100000");
  await expect(page).toHaveURL(/minSalary=100000/);
  await expect(page.getByRole("button", { name: "Remove filter: Minimum: $100k+" })).toBeVisible();
});

test("[FILT-13] active chips and clear", async ({ page }) => {
  await openBoard(page);
  await expect(page.locator(".sticky-active-filters")).toBeHidden();
  await page.getByRole("button", { name: "Salary shown" }).click();
  const region = page.locator(".sticky-active-filters");
  await expect(region).toBeVisible();
  await expect(region).toHaveAttribute("aria-label", "Active filters");
  await page.getByRole("button", { name: "Clear all" }).click();
  await expect(page).not.toHaveURL(/salary=/);
  await expect(region).toBeHidden();
});

test("[FILT-14] single tool path", async ({ page }) => {
  await openBoard(page);
  await openAdvanced(page);
  await page.getByRole("link", { name: "Jamf", exact: true }).click();
  await expect(page).toHaveURL(/\/jamf$/);
  await expect(page).not.toHaveURL(/[?&]page=/);
});

test("[FILT-15] back restores filters", async ({ page }) => {
  await page.goto("/board?workplace=Remote");
  await expect(page.getByRole("button", { name: /^Remote\b/ })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/board?workplace=Hybrid");
  await expect(page.getByRole("button", { name: /^Hybrid\b/ })).toHaveAttribute("aria-pressed", "true");
  await page.goBack();
  await expect(page).toHaveURL(/workplace=Remote/);
  await expect(page.getByRole("button", { name: /^Remote\b/ })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/board?workplace=Nope&platforms=not-a-platform&sort=sideways");
  await expect(page.getByRole("button", { name: /^Any\b/ }).first()).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#sort")).toHaveValue("newest");
});

test("[FILT-17] legacy remote parameter", async ({ page }) => {
  await page.goto("/board?remote=1");
  await expect(page.getByRole("button", { name: /^Remote\b/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^Hybrid\b/ }).click();
  await expect(page).toHaveURL(/workplace=Hybrid/);
  await expect(page).not.toHaveURL(/remote=/);
});

test("[FILT-18] advanced filters start closed", async ({ page }) => {
  await openBoard(page);
  const details = page.locator("details.advanced-filters");
  await expect(details).toBeVisible();
  await expect(details).not.toHaveAttribute("open", "");
  await expect(details.locator("summary")).toContainText("Optional");
  await page.goto("/board?seniority=Senior");
  await expect(details).toHaveAttribute("open", "");
  await expect(details.locator("summary")).toContainText("1 active");
});

test("[FILT-19] request a missing place", async ({ page }) => {
  await openBoard(page);
  const link = page.getByRole("link", { name: /Don’t see your city or region/ });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
  const href = await link.getAttribute("href");
  expect(href).toContain("github.com");
  expect(href).toContain("issues/new");
  expect(decodeURIComponent(href ?? "")).toMatch(/city/i);
  expect(decodeURIComponent(href ?? "")).toMatch(/country/i);
});

test("[SORT-01] sort controls", async ({ page }) => {
  await openBoard(page);
  await openAdvanced(page);
  for (const id of ["#sort", "#results-sort"]) {
    const labels = await page.locator(`${id} option`).allTextContents();
    expect(labels).toEqual(["Newest", "Compensation", "Company"]);
  }
  await page.locator("#results-sort").selectOption("company");
  await expect(page).toHaveURL(/sort=company/);
  await expect(page.getByRole("button", { name: "Remove filter: Sort: Company" })).toBeVisible();
  await expect(page).not.toHaveURL(/page=/);
});

test("[PAGE-01] board pages", async ({ page }) => {
  await openBoard(page);
  const bars = page.getByRole("navigation", { name: "Job result pages" });
  await expect(bars).toHaveCount(2);
  await expect(bars.first()).toContainText(/Showing \d+-\d+ of /);
  await expect(bars.first().getByRole("button", { name: "Go to previous job page" })).toBeDisabled();
  const pageTwo = bars.first().getByRole("button", { name: "Go to job page 2" });
  await pageTwo.click();
  await expect(pageTwo).toHaveAttribute("aria-current", "page");
  await expect(page).not.toHaveURL(/[?&]page=/);
  const request = page.waitForRequest((item) => item.url().includes("/api/board") && item.url().includes("page=3"));
  await bars.first().getByRole("button", { name: "Go to job page 3" }).click();
  expect((await request).url()).toContain("page=3");
});

test("[MAP-01] show and hide the map", async ({ page }) => {
  await openBoard(page);
  const section = page.getByRole("region", { name: "Mapped job locations" });
  const toggle = section.getByRole("button", { name: "Show map" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(section.locator("canvas")).toHaveCount(0);
  const mapRequest = page.waitForResponse((response) => response.url().includes("/api/board/map"));
  await toggle.click();
  expect((await mapRequest).ok()).toBeTruthy();
  await expect(section.getByRole("button", { name: "Hide map" })).toHaveAttribute("aria-expanded", "true");
  await expect(section.locator("canvas")).toBeVisible({ timeout: 20_000 });
  await section.getByRole("button", { name: "Hide map" }).click();
  await expect(section.locator("canvas")).toHaveCount(0);
});

test("[MAP-02] mapped jobs heading", async ({ page }) => {
  await openBoard(page);
  const section = page.getByRole("region", { name: "Mapped job locations" });
  await section.getByRole("button", { name: "Show map" }).click();
  await expect(section.getByRole("heading", { level: 2 })).toHaveText("Locations");
  await expect(section).not.toContainText(/\d+ of \d+/);
});

test("[MAP-03] zoom controls", async ({ page }) => {
  await openBoard(page);
  const section = page.getByRole("region", { name: "Mapped job locations" });
  await section.getByRole("button", { name: "Show map" }).click();
  const controls = section.locator(".job-map-controls");
  await expect(controls.getByRole("button", { name: "Zoom in map" })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Zoom out map" })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Fit map to jobs" })).toBeVisible();
  await expect(controls).toContainText(/%/);
});

test("[ERR-01] no matching roles", async ({ page }) => {
  await page.goto("/board?q=zzzz-phase2-nomatch");
  await expect(page.getByRole("heading", { name: "No matching roles" })).toBeVisible();
  await expect(page.getByText(/Nothing matches search “zzzz-phase2-nomatch”/)).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(page).not.toHaveURL(/q=/);
  await expect(page.locator("article.job-card").first()).toBeVisible();
});

test("[JOB-01] job card", async ({ page }) => {
  await openBoard(page);
  const card = page.locator("article.job-card").first();
  await expect(card.locator("a.job-title-link")).toHaveAttribute("href", /\/jobs\//);
  await expect(card.locator(".metadata-row")).toBeVisible();
  await expect(card.locator(".attribution-label")).not.toBeEmpty();
  const id = await card.getAttribute("id");
  expect(id).toMatch(/^job-/);
});

test("[JOB-02] apply or seed listing", async ({ page }) => {
  await openBoard(page);
  const card = page.locator("article.job-card").first();
  const apply = card.getByRole("link", { name: "Apply" });
  if (await apply.count()) {
    await expect(apply).toHaveAttribute("target", "_blank");
    await expect(apply).toHaveAttribute("rel", /noopener/);
  } else {
    await expect(card.getByText("Seed listing")).toBeVisible();
  }
});

test("[JOB-05] more description", async ({ page }) => {
  await openBoard(page);
  const card = page.locator("article.job-card").filter({ has: page.locator("summary") }).first();
  await card.locator("summary").click();
  await expect(card.getByText(/Why this role is here|Why this role is included|Description did not load/)).toBeVisible();
});

test("[JOB-06] match chips", async ({ page }) => {
  await openBoard(page);
  const card = page.locator("article.job-card").filter({ has: page.locator("summary") }).first();
  await card.locator("summary").click();
  const chips = card.getByRole("list", { name: "Matched tools and platforms" });
  if (await chips.count()) await expect(chips).toBeVisible();
});

test("[JOB-09] compare roles", async ({ page }) => {
  await openBoard(page);
  const buttons = page.locator("article.job-card .compare-button");
  await buttons.nth(0).click();
  await expect(page.getByText("1 role selected")).toBeVisible();
  await expect(page.getByText("Select one more role to compare.")).toBeVisible();
  await buttons.nth(1).click();
  await expect(page.getByRole("heading", { name: "Compare 2 roles" })).toBeVisible();
  const table = page.getByRole("table", { name: "Job comparison" });
  await expect(table).toBeVisible();
  await expect(table).toContainText(/Salary|Not shown/);
  await buttons.nth(2).click();
  await buttons.nth(3).click();
  await expect(buttons.nth(4)).toBeDisabled();
  await page.getByRole("button", { name: "Clear comparison" }).click();
  await expect(page.getByRole("heading", { name: /Compare / })).toHaveCount(0);
  await expect(page).not.toHaveURL(/compare/);
});

test("[RESP-01] comparison remove clears the title", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "390px measurement");
  await page.setViewportSize({ width: 390, height: 844 });
  await openBoard(page);
  const buttons = page.locator("article.job-card .compare-button");
  await buttons.nth(0).click();
  await buttons.nth(1).click();
  const headings = page.locator(".comparison-job-heading");
  await expect(headings).toHaveCount(2);
  const overlaps = await headings.evaluateAll((cells) => cells.map((cell) => {
    const remove = cell.querySelector(".comparison-remove");
    const title = cell.querySelector("strong");
    if (!remove || !title) return { missing: true, title: "" };
    const button = remove.getBoundingClientRect();
    const text = title.getBoundingClientRect();
    return {
      missing: false,
      title: title.textContent?.replace(/\s+/g, " ").trim() ?? "",
      intersects: button.left < text.right && button.right > text.left && button.top < text.bottom && button.bottom > text.top,
      width: Math.round(button.width),
      height: Math.round(button.height)
    };
  }));
  expect(overlaps.every((item) => item.missing === false)).toBe(true);
  for (const overlap of overlaps) {
    expect(overlap.width).toBeGreaterThanOrEqual(44);
    expect(overlap.height).toBeGreaterThanOrEqual(44);
  }
  expect(overlaps.filter((item) => item.intersects), JSON.stringify(overlaps)).toEqual([]);
});

test("[RESP-01] narrow hit areas", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "390px measurement");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/board?e2e-auth=in");
  await expect(page.getByRole("heading", { level: 1, name: "Endpoint Jobs" })).toBeVisible();
  await page.locator("summary.advanced-filters-summary").click();
  await expect(page.locator("details.advanced-filters")).toHaveAttribute("open", "");
  await expect(page.locator("#role-family")).toBeVisible();
  await expect(page.locator("#freshness")).toBeVisible();
  await expect(page.locator("#location-query")).toBeVisible();
  await expect(page.locator(".quick-filters .facet-button").first()).toBeVisible();
  await expect(page.locator(".advanced-filters .facet-button").first()).toBeVisible();
  await expect(page.locator(".pagination-button").first()).toBeVisible();
  await expect(page.locator("article.job-card .compare-button").first()).toBeVisible();
  await expect(page.locator("article.job-card .save-button").first()).toBeVisible();
  await expect(page.locator("article.job-card .description-details summary").first()).toBeVisible();
  await expect(page.locator("article.job-card a.apply-link").first()).toBeVisible();
  await expect(page.locator(".hide-viewed-button")).toBeVisible();
  await expect(page.locator(".saved-only-button")).toBeVisible();
  const offenders = await page.evaluate(() => {
    const selectors = [
      "#role-family",
      "#freshness",
      "#location-query",
      ".quick-filters .facet-button",
      ".advanced-filters .facet-button",
      ".pagination-button",
      "article.job-card .compare-button",
      "article.job-card .save-button",
      "article.job-card .description-details summary",
      "article.job-card a.apply-link",
      ".hide-viewed-button",
      ".saved-only-button",
      ".mode-button",
      ".advanced-filters-summary",
      ".workplace-filter-button",
      "#job-search-input",
      ".topbar .roadmap-link",
      ".topbar .mcp-docs-link",
      ".site-footer .api-docs-link",
      ".site-footer .support-link",
      ".site-footer .footer-link"
    ];
    return selectors.flatMap((selector) => [...document.querySelectorAll(selector)].map((element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const name = (element.getAttribute("aria-label") || element.textContent || selector).replace(/\s+/g, " ").trim().slice(0, 80);
      return {
        selector,
        name,
        width: Math.round(box.width),
        height: Math.round(box.height),
        hidden: style.display === "none" || box.width === 0 || box.height === 0
      };
    })).filter((item) => !item.hidden && (item.width < 44 || item.height < 44));
  });
  expect(offenders, JSON.stringify(offenders)).toEqual([]);
  await expect(page.locator("details.advanced-filters")).toBeVisible();
  const card = page.locator("article.job-card").first();
  const box = await card.boundingBox();
  expect(box && box.x + box.width).toBeLessThanOrEqual(391);
  await expect(page.locator(".command-layout > .command-status")).toBeHidden();
  await expect(page.locator("details.search-coverage-mobile")).toBeVisible();
});

test("[NAV-01] brand and footer", async ({ page }) => {
  await openBoard(page);
  const brand = page.getByRole("link", { name: "Endpoint Jobs home" });
  await expect(brand).toHaveAttribute("href", "/");
  const footer = page.getByRole("navigation", { name: "Project links" });
  await expect(footer.getByRole("link", { name: "Job board" })).toHaveAttribute("href", "/board");
  await expect(footer.getByRole("link", { name: "All jobs" })).toHaveAttribute("href", "/jobs");
  await expect(footer.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  const repo = footer.getByRole("link", { name: /GitHub repository/ });
  await expect(repo).toHaveAttribute("href", "https://github.com/jorgeasaurus/EndpointJobs");
  await expect(repo).toHaveAttribute("target", "_blank");
  await expect(repo).toHaveAttribute("rel", /noopener/);
  await expect(page.locator(".footer-meta")).toContainText(/v0\.\d+\.\d+/);
});

test("[FEED-01] feedback links", async ({ page }) => {
  await openBoard(page);
  const footer = page.getByRole("navigation", { name: "Project links" }).getByRole("link", { name: "Report an issue or request a feature on GitHub" });
  await expect(footer).toBeVisible();
  await expect(footer).toHaveAttribute("href", /report-or-request\.yml/);
  await expect(footer).toHaveAttribute("target", "_blank");
  await expect(footer).toHaveAttribute("rel", /noopener/);
  await expect(page.locator("header").getByRole("link", { name: "Open feedback form on GitHub" })).toHaveCount(0);
  await expect(page.locator("header").getByRole("link", { name: "Learning roadmap" })).toBeVisible();
  await expect(page.locator("header").getByRole("link", { name: "MCP guide" })).toBeVisible();
});

test("[FEED-02] support and project links", async ({ page }) => {
  await openBoard(page);
  const support = page.getByRole("navigation", { name: "Project links" }).getByRole("link", { name: "Support the board on Buy Me a Coffee" });
  await expect(support).toBeVisible();
  await expect(support).toHaveAttribute("href", "https://buymeacoffee.com/jorgeasaurus");
  await expect(support).toHaveAttribute("rel", /noopener/);
  await expect(page.locator(".footer-meta")).toContainText("Made by Jorgeasaurus");
  await expect(page.locator(".footer-meta")).toContainText(/UTC|Pending refresh/);
  const powershell = page.getByRole("link", { name: "Open PowerShell module documentation on GitHub" });
  await expect(powershell).toHaveAttribute("href", /powershell\/EndpointJobs\/README\.md/);
  await expect(powershell).toHaveAttribute("target", "_blank");
});

test("[A11Y-01] pressed toggles and focus", async ({ page }) => {
  await openBoard(page);
  const salary = page.getByRole("button", { name: "Salary shown" });
  await expect(salary).toHaveAttribute("aria-pressed", /^(true|false)$/);
  await expect(salary).toHaveAttribute("type", "button");
  await salary.focus();
  const outline = await salary.evaluate((element) => {
    const style = getComputedStyle(element);
    return `${style.outlineStyle} ${style.outlineWidth} ${style.boxShadow}`;
  });
  expect(outline).not.toMatch(/^none 0px none$/);
  const title = page.locator("a.job-title-link").first();
  await title.focus();
  await expect(title).toBeFocused();
});
