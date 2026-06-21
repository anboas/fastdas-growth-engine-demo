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
  assert.equal(await page.locator("[data-fastdas-shell-header].if-product-header.ci-sticky-header").count(), 1, `${label} should keep the OIP product header`);
  assert.equal(await page.locator("[data-fastdas-header-route].ci-header-nav .if-operations-topnav__link").count(), 3, `${label} should keep OIP primary nav links`);
  assert.equal(await page.locator("[data-response-assets-menu-button].ci-header-nav__menu-trigger").count(), 1, `${label} should keep the OIP Response Assets nav group`);
  assert.equal(await page.locator("[data-platform-admin-menu-button].ci-header-nav__menu-trigger").count(), 1, `${label} should keep the OIP Admin nav group`);
  assert.equal(await page.locator("[data-mobile-more-menu-button]").count(), 1, `${label} should keep the OIP mobile More nav trigger`);
  assert.equal(await page.locator("[data-fastdas-profile-menu].ci-profile-menu [data-profile-menu-trigger]").count(), 1, `${label} should keep the main profile dropdown trigger`);
  assert.equal(await page.locator("[data-fastdas-baseline-canvas]").count(), 1, `${label} should expose an empty OIP baseline canvas`);
  assert.equal(await page.locator("[data-opportunity-footer].ci-opportunity-footer.if-panel__footer").count(), 1, `${label} should keep the OIP footer`);
  assert.equal(await page.locator("[data-fastdas-release-rail].ci-opportunity-footer").count(), 1, `${label} should map FastDAS footer hook onto the OIP footer`);
  assert.equal(await page.locator(".fg-footer, .if-release-rail, .fg-product-header, .fg-operations-topnav").count(), 0, `${label} should not render old FastDAS shell classes`);
  const headerStyle = await page.locator("[data-fastdas-shell-header]").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderBottomColor: style.borderBottomColor,
      borderBottomWidth: style.borderBottomWidth,
    };
  });
  assert.deepEqual(
    headerStyle,
    { backgroundColor: "rgb(22, 46, 81)", borderBottomColor: "rgb(0, 94, 162)", borderBottomWidth: "3px" },
    `${label} header should use OIP dark masthead colors`,
  );
  const footerRelease = await page.locator("[data-footer-release] span").evaluateAll(nodes => nodes.map(node => node.textContent.trim()));
  assert.deepEqual(footerRelease, ["Version v0.1.0", "control-surface-ui", "Browser-local"], `${label} footer release metadata should match OIP`);
  const shellGeometry = await page.evaluate(() => {
    const content = document.querySelector("[data-if-operations-workspace]");
    const footer = document.querySelector("[data-opportunity-footer]");
    const contentRect = content?.getBoundingClientRect();
    const footerRect = footer?.getBoundingClientRect();
    const contentStyle = content ? getComputedStyle(content) : null;
    return {
      footerInsideContent: Boolean(content && footer && footer.parentElement === content),
      contentDisplay: contentStyle?.display || "",
      contentPaddingLeft: contentStyle?.paddingLeft || "",
      contentPaddingRight: contentStyle?.paddingRight || "",
      contentLeft: contentRect?.left || 0,
      contentRight: contentRect?.right || 0,
      footerLeft: footerRect?.left || 0,
      footerRight: footerRect?.right || 0,
    };
  });
  assert.equal(shellGeometry.footerInsideContent, true, `${label} footer should sit inside the OIP workspace content container: ${JSON.stringify(shellGeometry)}`);
  assert.equal(shellGeometry.contentDisplay, "grid", `${label} workspace content should keep OIP grid layout: ${JSON.stringify(shellGeometry)}`);
  assert.ok(
    shellGeometry.footerLeft > shellGeometry.contentLeft && shellGeometry.footerRight < shellGeometry.contentRight,
    `${label} footer should inherit OIP content padding instead of spanning the app edge: ${JSON.stringify(shellGeometry)}`,
  );
  assert.notEqual(shellGeometry.contentPaddingLeft, "0px", `${label} workspace should keep OIP horizontal padding: ${JSON.stringify(shellGeometry)}`);
  assert.notEqual(shellGeometry.contentPaddingRight, "0px", `${label} workspace should keep OIP horizontal padding: ${JSON.stringify(shellGeometry)}`);
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
  assert.equal(await page.locator("[data-profile-menu-surface] [data-profile-lead-list]").count(), 1, `${label} profile menu should keep OIP Active Profile section`);
  assert.equal(await page.locator("[data-profile-menu-surface] [data-profile-setting]").count(), 6, `${label} profile menu should keep OIP workspace-display settings`);
  assert.equal(await page.locator("[data-profile-menu-surface] [data-profile-manage-leads]").count(), 1, `${label} profile menu should keep OIP profile actions`);
  assert.equal(await page.locator("[data-profile-menu-surface] .ci-profile-setting-toggle").count(), 6, `${label} profile settings should use OIP state toggles`);
  await page.keyboard.press("Escape");
  assert.equal(await profileTrigger.getAttribute("aria-expanded"), "false", `${label} Escape should close profile menu`);
}

async function assertHeaderMenus(page, label) {
  if (label === "mobile") {
    const mobileMore = page.locator("[data-mobile-more-menu-button]");
    await mobileMore.click();
    assert.equal(await mobileMore.getAttribute("aria-expanded"), "true", `${label} More menu should open`);
    assert.equal(await page.locator("[data-mobile-more-menu] .if-operations-topnav__menu-label").count(), 3, `${label} More menu should group Primary, Response Assets, and Platform Admin`);
    assert.equal(await page.locator("[data-mobile-more-menu] .if-operations-topnav__menu-item").count(), 7, `${label} More menu should expose OIP baseline routes`);
    await page.keyboard.press("Escape");
    assert.equal(await mobileMore.getAttribute("aria-expanded"), "false", `${label} Escape should close More menu`);
    return;
  }

  const responseAssets = page.locator("[data-response-assets-menu-button]");
  await responseAssets.click();
  assert.equal(await responseAssets.getAttribute("aria-expanded"), "true", `${label} Response Assets menu should open`);
  assert.equal(await page.locator("[data-response-assets-menu] .if-operations-topnav__menu-label").textContent(), "Response Assets", `${label} Response Assets menu should use the OIP menu label`);
  assert.equal(await page.locator("[data-response-assets-menu] .if-operations-topnav__menu-item").count(), 2, `${label} Response Assets menu should expose two rows`);
  await page.keyboard.press("Escape");
  assert.equal(await responseAssets.getAttribute("aria-expanded"), "false", `${label} Escape should close Response Assets menu`);

  const admin = page.locator("[data-platform-admin-menu-button]");
  await admin.click();
  assert.equal(await admin.getAttribute("aria-expanded"), "true", `${label} Admin menu should open`);
  assert.equal(await page.locator("[data-platform-admin-menu] .if-operations-topnav__menu-label").textContent(), "Platform Admin", `${label} Admin menu should use the OIP menu label`);
  assert.equal(await page.locator("[data-platform-admin-menu] .if-operations-topnav__menu-item").count(), 2, `${label} Admin menu should expose baseline admin rows`);
  await page.keyboard.press("Escape");
  assert.equal(await admin.getAttribute("aria-expanded"), "false", `${label} Escape should close Admin menu`);
}

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await desktop.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await desktop.waitForSelector("[data-fastdas-baseline-app]");
  await desktop.waitForSelector("[data-fg-icon-rendered]:visible");
  await assertNoPageOverflow(desktop, "desktop");
  await assertBaselineOnly(desktop, "desktop");
  await assertHeaderMenus(desktop, "desktop");
  await assertProfileMenu(desktop, "desktop");
  await desktop.screenshot({ path: `${OUT_DIR}/fastdas-baseline-desktop.png`, fullPage: true });
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await mobile.waitForSelector("[data-fastdas-baseline-app]");
  await mobile.waitForSelector("[data-fg-icon-rendered]:visible");
  await assertNoPageOverflow(mobile, "mobile");
  await assertBaselineOnly(mobile, "mobile");
  await assertHeaderMenus(mobile, "mobile");
  await assertProfileMenu(mobile, "mobile");
  await mobile.screenshot({ path: `${OUT_DIR}/fastdas-baseline-mobile.png`, fullPage: true });
  await mobile.close();

  console.log("Verified FastDAS OIP baseline shell desktop/mobile.");
} finally {
  await browser.close();
  if (serverProcess) serverProcess.kill("SIGTERM");
}
