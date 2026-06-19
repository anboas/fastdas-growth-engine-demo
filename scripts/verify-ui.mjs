import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE_URL = process.env.FASTDAS_VERIFY_URL || "http://127.0.0.1:5173/";
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || "/usr/bin/chromium-browser";
const OUT_DIR = "test-results";
const SURFACE_IDS = [
  "command-center",
  "signal-intake",
  "opportunity-workbench",
  "evidence-review",
  "outreach-queue",
  "agent-operations",
  "conversion-board",
];

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROMIUM_PATH,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

async function pageOverflow(page) {
  return page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
}

async function assertNoPageOverflow(page, label) {
  const overflow = await pageOverflow(page);
  const maxScrollWidth = Math.max(overflow.scrollWidth, overflow.bodyScrollWidth);
  assert.ok(
    maxScrollWidth <= overflow.width + 2,
    `${label} should not create page-level horizontal overflow: viewport=${overflow.width} scrollWidth=${maxScrollWidth}`,
  );
}

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await desktop.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await desktop.waitForSelector("[data-fastdas-demo-app]");
  await assertNoPageOverflow(desktop, "desktop");

  const surfaceButtons = await desktop.locator("[data-control-surface-nav] button").count();
  assert.equal(surfaceButtons, 7, "desktop nav should expose seven control surfaces");

  for (const surfaceId of SURFACE_IDS) {
    await desktop.goto(`${BASE_URL}#/${surfaceId}`, { waitUntil: "domcontentloaded" });
    await desktop.waitForSelector("[data-fastdas-expanded-record]", { timeout: 5000 });
    const h1 = await desktop.locator("h1").textContent();
    assert.ok(h1 && h1.trim().length > 0, `${surfaceId} should render a page title`);
    const expandedSections = await desktop.locator("[data-fastdas-expanded-record] .fg-expanded__section").count();
    assert.equal(expandedSections, 3, `${surfaceId} should render the three-part expanded detail row`);
  }

  await desktop.screenshot({ path: `${OUT_DIR}/fastdas-desktop.png`, fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 920 }, isMobile: true });
  await mobile.goto(`${BASE_URL}#/command-center`, { waitUntil: "domcontentloaded" });
  await mobile.waitForSelector("[data-fastdas-demo-app]");
  await assertNoPageOverflow(mobile, "mobile");
  await mobile.locator("[data-control-surface-nav] button", { hasText: "Conversion Board" }).click();
  await mobile.waitForSelector("[data-fastdas-expanded-record]");
  await assertNoPageOverflow(mobile, "mobile conversion board");
  const mobileMetrics = await mobile.locator("[data-fastdas-metric-grid] .fg-metric").count();
  assert.equal(mobileMetrics, 6, "mobile surface should keep six metric cards visible");
  await mobile.screenshot({ path: `${OUT_DIR}/fastdas-mobile.png`, fullPage: true });

  console.log("Verified FastDAS UI desktop/mobile screenshots, seven surfaces, expanded rows, and page overflow.");
} finally {
  await browser.close();
}
