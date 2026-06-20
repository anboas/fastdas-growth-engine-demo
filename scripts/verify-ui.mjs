import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const DEFAULT_BASE_URL = "http://127.0.0.1:5173/";
const BASE_URL = process.env.FASTDAS_VERIFY_URL || DEFAULT_BASE_URL;
const SHOULD_START_SERVER = !process.env.FASTDAS_VERIFY_URL;
const CHROMIUM_PATH = [
  process.env.CHROMIUM_PATH,
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
].find((candidate) => candidate && existsSync(candidate));
const OUT_DIR = "test-results";

const REMOVED_SURFACES = [
  "[data-fastdas-workspace-rail]",
  "[data-fastdas-working-set-ribbon]",
  "[data-fastdas-page-header]",
  "[data-fastdas-page-actions]",
  "[data-control-surface-nav]",
  "[data-fastdas-saved-views]",
  "[data-fastdas-metric-grid]",
  "[data-fastdas-command-filter-card]",
  "[data-fastdas-command-center-nav]",
  "[data-fastdas-grid-surface]",
  "[data-fastdas-workbench-surface]",
  "[data-fastdas-opportunity-grid]",
  "[data-fastdas-command-center-grid]",
  "[data-fastdas-open-details]",
  "[data-fastdas-expanded-record]",
  "[data-fastdas-provenance]",
  "[data-fastdas-human-approval-boundary]",
  "[data-fastdas-guided-demo-runner]",
  "[data-fastdas-guided-record]",
  "[data-fastdas-data-management]",
  "[data-fastdas-scenario-packs]",
  "[data-fastdas-management-area]",
  "[data-fastdas-operational-workflow]",
  "[data-fastdas-workflow-stage]",
  "[data-fastdas-audit-log]",
  "[data-fastdas-toast]",
  "[data-fastdas-command-dock]",
  "[data-fastdas-command-card]",
  "[data-fastdas-delivery-readiness]",
];

mkdirSync(OUT_DIR, { recursive: true });

async function waitForServer(url, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for local verification server at ${url}`);
}

let serverProcess;
if (SHOULD_START_SERVER) {
  serverProcess = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "5173", "--strictPort"], {
    stdio: "ignore",
  });
  await waitForServer(BASE_URL);
}

const browser = await chromium.launch({
  ...(CHROMIUM_PATH ? { executablePath: CHROMIUM_PATH } : {}),
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

async function assertBaselineOnly(page, label) {
  assert.equal(await page.locator("[data-fastdas-baseline-app]").count(), 1, `${label} should render the baseline app`);
  assert.equal(await page.locator("[data-fastdas-shell-header].if-product-header").count(), 1, `${label} should keep the OIP product header`);
  assert.equal(await page.locator("[data-fastdas-header-route] .if-operations-topnav__link").count(), 3, `${label} should keep only the header primary nav`);
  assert.equal(await page.locator("[data-fastdas-profile-menu] [data-profile-menu-trigger]").count(), 1, `${label} should keep the main profile dropdown trigger`);
  assert.equal(await page.locator("[data-fastdas-baseline-canvas]").count(), 1, `${label} should expose an empty OIP baseline canvas`);
  assert.equal(await page.locator("[data-fastdas-release-rail]").count(), 1, `${label} should keep the footer/release rail`);
  for (const selector of REMOVED_SURFACES) {
    assert.equal(await page.locator(selector).count(), 0, `${label} should not render removed surface ${selector}`);
  }
  const appText = await page.locator("[data-fastdas-baseline-app]").textContent();
  for (const removedText of [
    "Synthetic Closeout Tower 1",
    "Priority Queue",
    "Expansion Signals",
    "Partner Bench",
    "Audit log",
    "Guided demo",
    "Scenario packs",
    "Opportunity Grid",
  ]) {
    assert.equal(appText.includes(removedText), false, `${label} should not show old FastDAS text: ${removedText}`);
  }
}

async function assertProfileMenu(page, label) {
  const profileTrigger = page.locator("[data-profile-menu-trigger]");
  assert.equal(await profileTrigger.getAttribute("aria-expanded"), "false", `${label} profile menu should start closed`);
  await profileTrigger.click();
  assert.equal(await profileTrigger.getAttribute("aria-expanded"), "true", `${label} profile menu should open`);
  assert.equal(await page.locator("[data-profile-menu-surface]").count(), 1, `${label} profile surface should mount`);
  assert.equal(await page.locator("[data-profile-menu-surface] [data-profile-setting]").count(), 3, `${label} profile menu should keep three settings`);
  await page.keyboard.press("Escape");
  assert.equal(await profileTrigger.getAttribute("aria-expanded"), "false", `${label} Escape should close profile menu`);
}

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await desktop.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await desktop.waitForSelector("[data-fastdas-baseline-app]");
  await desktop.waitForSelector("[data-fg-icon-rendered]:visible");
  await assertNoPageOverflow(desktop, "desktop");
  await assertBaselineOnly(desktop, "desktop");
  await assertProfileMenu(desktop, "desktop");
  await desktop.screenshot({ path: `${OUT_DIR}/fastdas-baseline-desktop.png`, fullPage: true });
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await mobile.waitForSelector("[data-fastdas-baseline-app]");
  await mobile.waitForSelector("[data-fg-icon-rendered]:visible");
  await assertNoPageOverflow(mobile, "mobile");
  await assertBaselineOnly(mobile, "mobile");
  await assertProfileMenu(mobile, "mobile");
  await mobile.screenshot({ path: `${OUT_DIR}/fastdas-baseline-mobile.png`, fullPage: true });
  await mobile.close();

  console.log("Verified FastDAS OIP baseline shell desktop/mobile.");
} finally {
  await browser.close();
  if (serverProcess) serverProcess.kill("SIGTERM");
}
