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
const SURFACE_IDS = [
  "command-center",
  "signal-intake",
  "opportunity-workbench",
  "evidence-review",
  "outreach-queue",
  "agent-operations",
  "synthetic-data",
  "conversion-board",
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

async function assertAuditContains(page, text, label) {
  await page.waitForFunction(
    ({ selector, expected }) => document.querySelector(selector)?.textContent?.includes(expected),
    { selector: "[data-fastdas-audit-log]", expected: text },
    { timeout: 5000 },
  );
  const auditText = await page.locator("[data-fastdas-audit-log]").textContent();
  assert.ok(auditText.includes(text), `${label} should record ${text} in the audit log`);
}

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await desktop.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await desktop.waitForSelector("[data-fastdas-demo-app]");
  await desktop.waitForSelector("[data-fastdas-operational-workflow]");
  await assertNoPageOverflow(desktop, "desktop");

  const surfaceButtons = await desktop.locator("[data-control-surface-nav] button").count();
  assert.equal(surfaceButtons, 8, "desktop nav should expose eight control surfaces");

  await desktop.locator('[data-fastdas-action="run-signal-scan"]').click();
  await assertAuditContains(desktop, "Signal scan completed", "global scan");
  await desktop.waitForSelector("h1", { timeout: 5000 });
  assert.match(await desktop.locator("h1").textContent(), /Signal Intake/, "global scan should move operator to Signal Intake");

  for (const surfaceId of SURFACE_IDS) {
    await desktop.goto(`${BASE_URL}#/${surfaceId}`, { waitUntil: "domcontentloaded" });
    await desktop.waitForSelector("[data-fastdas-expanded-record]", { timeout: 5000 });
    const h1 = await desktop.locator("h1").textContent();
    assert.ok(h1 && h1.trim().length > 0, `${surfaceId} should render a page title`);
    const expandedSections = await desktop.locator("[data-fastdas-expanded-record] .fg-expanded__section").count();
    assert.equal(expandedSections, 3, `${surfaceId} should render the three-part expanded detail row`);
  }

  await desktop.goto(`${BASE_URL}#/synthetic-data`, { waitUntil: "domcontentloaded" });
  await desktop.waitForSelector("[data-fastdas-data-management]");
  const initialSeedText = await desktop.locator("[data-fastdas-data-management]").textContent();
  assert.ok(initialSeedText.includes("FD-GE-DEMO-0619"), "synthetic data should start from the golden seed");
  await desktop.locator('[data-fastdas-action="generate-variant"]').click();
  await assertAuditContains(desktop, "Generated demo variant", "variant generation");
  const variantSeedText = await desktop.locator("[data-fastdas-data-management]").textContent();
  assert.ok(variantSeedText.includes("FD-GE-DEMO-0619-V01"), "variant generation should update the active seed");
  await desktop.locator('[data-fastdas-action="export-bundle"]').click();
  await assertAuditContains(desktop, "Export bundle prepared", "bundle export");
  await desktop.locator('[data-fastdas-action="reset-demo"]').click();
  await assertAuditContains(desktop, "Reset demo state", "demo reset");
  const resetSeedText = await desktop.locator("[data-fastdas-data-management]").textContent();
  assert.ok(resetSeedText.includes("FD-GE-DEMO-0619"), "reset should restore the golden seed");
  assert.ok(!resetSeedText.includes("FD-GE-DEMO-0619-V01"), "reset should remove the generated variant seed from the control cards");
  const managementCards = await desktop.locator(".fg-management-card").count();
  assert.equal(managementCards, 6, "synthetic data surface should render six management areas");
  const scenarioPacks = await desktop.locator("[data-fastdas-scenario-packs] .fg-scenario-card").count();
  assert.equal(scenarioPacks, 4, "synthetic data surface should render four scenario packs");
  await assertNoPageOverflow(desktop, "desktop synthetic data");

  await desktop.goto(`${BASE_URL}#/command-center`, { waitUntil: "domcontentloaded" });
  await desktop.waitForSelector("[data-fastdas-expanded-record]", { timeout: 5000 });
  await desktop.locator('[data-fastdas-action="approve-record"]').first().click();
  await assertAuditContains(desktop, "Inline record approved", "inline approval");

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
  await mobile.locator("[data-control-surface-nav] button", { hasText: "Synthetic Data" }).click();
  await mobile.waitForSelector("[data-fastdas-data-management]");
  await mobile.locator('[data-fastdas-action="generate-variant"]').click();
  await assertAuditContains(mobile, "Generated demo variant", "mobile variant generation");
  await assertNoPageOverflow(mobile, "mobile synthetic data");
  const mobileManagementCards = await mobile.locator(".fg-management-card").count();
  assert.equal(mobileManagementCards, 6, "mobile synthetic data surface should keep six management areas");
  await mobile.screenshot({ path: `${OUT_DIR}/fastdas-mobile.png`, fullPage: true });

  console.log("Verified FastDAS UI desktop/mobile screenshots, eight surfaces, synthetic data management, expanded rows, and page overflow.");
} finally {
  await browser.close();
  serverProcess?.kill("SIGTERM");
}
