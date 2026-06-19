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
  await desktop.waitForSelector("[data-fastdas-command-dock]");
  await desktop.waitForSelector("[data-if-operations-workspace]");
  await desktop.waitForSelector('[data-control-segmented="fastdas-operator-mode"]');
  await desktop.waitForSelector("[data-fg-icon-rendered]:visible");
  await assertNoPageOverflow(desktop, "desktop");

  const shellMain = await desktop.locator(".if-main.if-main--with-sidebar").count();
  assert.equal(shellMain, 1, "app shell should use the framework main-with-sidebar contract");
  const sidebarSections = await desktop.locator(".if-sidebar .if-sidebar__section").count();
  assert.ok(sidebarSections >= 2, "sidebar should use framework sidebar sections");
  const sidebarCounts = await desktop.locator(".if-sidebar .if-sidebar__count").count();
  assert.ok(sidebarCounts >= 2, "sidebar should expose framework count slots");
  const sidebarClaimCards = await desktop.locator(".if-sidebar .if-claim-toolbar .if-claim-summary-card").count();
  assert.equal(sidebarClaimCards, 2, "sidebar trial model should use framework claim summary cards");
  const sidebarAlert = await desktop.locator(".if-sidebar .if-alert.if-alert--info").count();
  assert.equal(sidebarAlert, 1, "sidebar automation boundary should use the framework alert contract");
  const utilityCluster = await desktop.locator(".if-topbar__actions.if-utility-cluster").count();
  assert.equal(utilityCluster, 1, "topbar should use the framework utility cluster");
  const shellHeader = await desktop.locator("[data-fastdas-shell-header].if-topbar").count();
  assert.equal(shellHeader, 1, "header should expose the FastDAS shell header contract");
  const headerRouteStatuses = await desktop.locator("[data-fastdas-header-route].if-topbar__nav .if-route-status").count();
  assert.equal(headerRouteStatuses, 2, "header route area should use framework route status chips");
  const headerStatusControls = await desktop.locator("[data-fastdas-header-status].if-route-demo-controls .if-badge").count();
  assert.equal(headerStatusControls, 3, "header status area should use framework route demo controls");
  const headerActionButtons = await desktop.locator("[data-fastdas-header-actions].if-toolbar__group .if-btn").count();
  assert.equal(headerActionButtons, 2, "header action area should use framework toolbar grouping");
  const topbarSearch = await desktop.locator(".if-topbar .if-search .if-search__icon + .if-sr-only + input.if-input").count();
  assert.equal(topbarSearch, 1, "topbar search should use framework search anatomy");
  const accountMenu = await desktop.locator(".if-topbar .if-account-menu .if-avatar").count();
  assert.equal(accountMenu, 1, "topbar identity should use framework account-menu and avatar anatomy");
  const pageMeta = await desktop.locator("[data-fastdas-page-meta].if-page-header__meta .if-route-status").count();
  assert.equal(pageMeta, 3, "page header should expose framework route-status metadata");
  const pageActions = await desktop.locator("[data-fastdas-page-actions].if-toolbar__group .if-btn").count();
  assert.equal(pageActions, 3, "page header actions should use framework toolbar grouping");

  const surfaceButtons = await desktop.locator("[data-control-surface-nav] button").count();
  assert.equal(surfaceButtons, 8, "desktop nav should expose eight control surfaces");
  const frameworkSignals = await desktop.locator(".if-operations-signal-grid .if-operations-signal").count();
  assert.equal(frameworkSignals, 6, "desktop metric strip should use framework operations signal cards");
  const frameworkSignalButtons = await desktop.locator(".if-operations-signal-grid button.if-operations-signal").count();
  assert.equal(frameworkSignalButtons, 6, "desktop metric signals should be native framework signal buttons");
  const visibleSignalPanels = await desktop.locator(".if-operations-panel-shell .if-operations-panel:visible").count();
  assert.equal(visibleSignalPanels, 1, "operations workspace should show one framework drilldown panel");
  await desktop.locator(".if-operations-signal-grid button.if-operations-signal").nth(1).click();
  await desktop.waitForFunction(() => document.querySelector("[data-if-operations-workspace]")?.dataset.ifOperationsCurrent === "paid-assessment-fit");
  const selectedSignal = await desktop.locator(".if-operations-signal-grid .if-operations-signal.is-selected").textContent();
  assert.ok(selectedSignal.includes("Paid Assessment"), "clicking a metric should move framework operations selection");
  const activePanelText = await desktop.locator(".if-operations-panel-shell .if-operations-panel:visible").textContent();
  assert.ok(activePanelText.includes("Paid Assessment Fit Drilldown"), "metric click should show the matching operations panel");
  const segmentedOptions = await desktop.locator('[data-control-segmented="fastdas-operator-mode"] .if-segmented-control__item').count();
  assert.equal(segmentedOptions, 3, "operator mode should use framework segmented-control options");
  const dataTableShells = await desktop.locator("[data-if-data-table].if-table-shell").count();
  assert.ok(dataTableShells >= 1, "workspace grid should use the framework data-table shell contract");
  const commandBandAnatomy = await desktop.locator(".if-table-command-band__leading, .if-table-command-band__filters, .if-table-command-band__actions").count();
  assert.ok(commandBandAnatomy >= 3, "table command band should use framework leading/filter/action anatomy");
  const tableFilterControls = await desktop.locator("[data-fastdas-opportunity-grid] [data-if-table-filter]").count();
  assert.equal(tableFilterControls, 1, "opportunity grid should expose framework table search");
  const tableStatusCounters = await desktop.locator("[data-fastdas-opportunity-grid] [data-if-table-status]").count();
  assert.ok(tableStatusCounters >= 2, "opportunity grid should expose framework status counters");
  const expandControls = await desktop.locator("[data-fastdas-opportunity-grid] [data-if-table-expand]").count();
  assert.ok(expandControls >= 1, "opportunity grid should expose framework row expand controls");
  const tableDetails = await desktop.locator(".if-table-detail[data-if-table-detail] .if-table-detail__content").count();
  assert.ok(tableDetails >= 1, "expanded records should use framework table-detail anatomy");
  const intelligenceDetails = await desktop.locator("[data-fastdas-expanded-record].if-record-detail--intelligence").count();
  assert.ok(intelligenceDetails >= 1, "expanded records should use framework intelligence detail anatomy");
  const recordDetailSections = await desktop.locator("[data-fastdas-expanded-record] .if-record-detail__section").count();
  assert.equal(recordDetailSections, 3, "expanded record should expose three framework record-detail sections");
  const statusSteps = await desktop.locator("[data-fastdas-expanded-record] .if-status-timeline .if-status-step").count();
  assert.ok(statusSteps >= 5, "expanded workflow state should use framework status timeline steps");
  const reviewWorkflow = await desktop.locator("[data-fastdas-expanded-record] [data-if-review-workflow].if-review-workflow").count();
  assert.equal(reviewWorkflow, 1, "expanded record actions should use framework review-workflow anatomy");
  const reviewActions = await desktop.locator("[data-fastdas-expanded-record] [data-if-review-action]").count();
  assert.equal(reviewActions, 4, "expanded record should expose four framework review actions");
  const reviewCounts = await desktop.locator("[data-fastdas-expanded-record] [data-if-review-count]").count();
  assert.ok(reviewCounts >= 4, "expanded record should expose framework review count slots");
  const reviewLedger = await desktop.locator("[data-fastdas-expanded-record] [data-if-review-ledger]").count();
  assert.equal(reviewLedger, 1, "expanded record should expose framework review ledger");
  const actionQueueItems = await desktop.locator("[data-fastdas-expanded-record] .if-action-queue .if-action-queue__item").count();
  assert.ok(actionQueueItems >= 3, "expanded next actions should use the framework action queue contract");
  const tableCellMain = await desktop.locator(".if-table-cell-main .if-table-cell-meta").count();
  assert.ok(tableCellMain >= 1, "table cells should use framework primary/meta anatomy");
  const progressBars = await desktop.locator(".if-table-progress .if-table-progress__track span").count();
  assert.ok(progressBars >= 1, "score cells should use framework progress anatomy");
  const commandCards = await desktop.locator("[data-fastdas-command-card]").count();
  assert.equal(commandCards, 4, "desktop command dock should expose four operator commands");
  const frameworkStepperSteps = await desktop.locator(".if-stepper .if-stepper__step").count();
  assert.equal(frameworkStepperSteps, 10, "workflow lifecycle should use the framework stepper contract");
  const runtimeKpis = await desktop.locator("[data-fastdas-operational-workflow] .if-agent-runtime-kpi").count();
  assert.ok(runtimeKpis >= 8, "operational runtime should use framework agent-runtime KPIs");
  const ledgerEvents = await desktop.locator("[data-fastdas-audit-log] .if-ledger-list--rich li").count();
  assert.ok(ledgerEvents >= 1, "audit trail should use the framework rich ledger contract");
  const commandPatternCards = await desktop.locator("[data-fastdas-command-card].if-pattern-card").count();
  assert.equal(commandPatternCards, 4, "operator commands should use framework pattern cards");
  await desktop.locator("[data-fastdas-opportunity-grid] [data-if-table-filter]").fill("HarborPoint");
  await desktop.waitForFunction(() => document.querySelector("[data-fastdas-opportunity-grid] [data-if-table-status='filtered']")?.textContent === "1");
  await desktop.locator("[data-fastdas-opportunity-grid] [data-if-table-clear]").click();
  await desktop.waitForFunction(() => Number(document.querySelector("[data-fastdas-opportunity-grid] [data-if-table-status='filtered']")?.textContent || "0") > 1);

  await desktop.locator('[data-control-segmented="fastdas-operator-mode"] [data-control-segmented-option="Customer Review"]').click();
  await assertAuditContains(desktop, "Operator mode changed", "operator mode selector");
  const activeMode = await desktop.locator('[data-control-segmented="fastdas-operator-mode"] .if-segmented-control__item.is-active').textContent();
  assert.equal(activeMode.trim(), "Customer Review", "operator mode segmented control should show the selected mode");
  await desktop.locator('[data-fastdas-action="command-export"]').click();
  await assertAuditContains(desktop, "Command export staged", "command dock export");

  const governancePanelCards = await desktop.locator("[data-fastdas-governance-panels] .if-impact-card, [data-fastdas-governance-panels] .if-ops-runbook-card, [data-fastdas-governance-panels] .if-contract-card").count();
  assert.equal(governancePanelCards, 3, "bottom governance panels should use framework impact, runbook, and contract cards");
  const impactChain = await desktop.locator("[data-fastdas-governance-panels] .if-impact-chain span").count();
  assert.ok(impactChain >= 1, "bottom governance panels should expose framework impact chains");
  const releaseRail = await desktop.locator("[data-fastdas-release-rail].if-panel.if-panel__footer [data-fastdas-footer-status] .if-route-status").count();
  assert.equal(releaseRail, 5, "release footer should use framework panel-footer route status chips");
  const releaseBrand = await desktop.locator("[data-fastdas-release-rail] .fg-footer__brand").textContent();
  assert.ok(releaseBrand.includes("FastDAS Growth Engine"), "release footer should keep a readable product identity");

  await desktop.locator('[data-fastdas-action="run-signal-scan"]').click();
  await assertAuditContains(desktop, "Signal scan completed", "global scan");
  await desktop.waitForSelector("h1", { timeout: 5000 });
  assert.match(await desktop.locator("h1").textContent(), /Signal Intake/, "global scan should move operator to Signal Intake");
  const sourceHealthCards = await desktop.locator("[data-fastdas-source-health] .if-source-health-card .if-ops-meter-list").count();
  assert.ok(sourceHealthCards >= 1, "source cards should use framework source-health meter contracts");

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
  const managementOpsStrip = await desktop.locator("[data-fastdas-data-management] .if-ops-command-strip .if-ops-kpi").count();
  assert.ok(managementOpsStrip >= 1, "synthetic data management should use framework ops KPI strips");
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
  const managementCards = await desktop.locator("[data-fastdas-management-area].if-pattern-card.if-operations-section").count();
  assert.equal(managementCards, 6, "synthetic data surface should render six management areas");
  const provenanceFields = await desktop.locator("[data-fastdas-data-management] .if-provenance-grid .if-provenance-field").count();
  assert.ok(provenanceFields >= 12, "synthetic data management cards should use framework provenance fields");
  const scenarioPacks = await desktop.locator("[data-fastdas-scenario-pack].if-pattern-card.if-operations-section").count();
  assert.equal(scenarioPacks, 4, "synthetic data surface should render four scenario packs");
  const scenarioRuleLines = await desktop.locator("[data-fastdas-scenario-pack] .if-rule-builder-mini .if-rule-line").count();
  assert.equal(scenarioRuleLines, 8, "scenario packs should use framework mini rule lines");
  await assertNoPageOverflow(desktop, "desktop synthetic data");

  await desktop.goto(`${BASE_URL}#/command-center`, { waitUntil: "domcontentloaded" });
  await desktop.waitForSelector("[data-fastdas-expanded-record]", { timeout: 5000 });
  await desktop.locator('[data-fastdas-action="approve-record"]').first().click();
  await assertAuditContains(desktop, "Inline record approved", "inline approval");

  await desktop.screenshot({ path: `${OUT_DIR}/fastdas-desktop.png`, fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 920 }, isMobile: true });
  await mobile.goto(`${BASE_URL}#/command-center`, { waitUntil: "domcontentloaded" });
  await mobile.waitForSelector("[data-fastdas-demo-app]");
  await mobile.waitForSelector("[data-fastdas-command-dock]");
  await mobile.waitForSelector("[data-if-operations-workspace]");
  await mobile.waitForSelector("[data-fg-icon-rendered]:visible");
  await assertNoPageOverflow(mobile, "mobile");
  const mobileHeaderRoute = await mobile.locator("[data-fastdas-header-route] .if-route-status").count();
  assert.equal(mobileHeaderRoute, 2, "mobile header should keep route status context");
  const mobileHeaderActions = await mobile.locator("[data-fastdas-header-actions] .if-btn").count();
  assert.equal(mobileHeaderActions, 2, "mobile header should keep grouped actions");
  const mobilePageMeta = await mobile.locator("[data-fastdas-page-meta] .if-route-status").count();
  assert.equal(mobilePageMeta, 3, "mobile page header should keep route-status metadata");
  const mobileSegmentedOptions = await mobile.locator('[data-control-segmented="fastdas-operator-mode"] .if-segmented-control__item').count();
  assert.equal(mobileSegmentedOptions, 3, "mobile operator dock should preserve framework segmented controls");
  const mobileCommandCards = await mobile.locator("[data-fastdas-command-card]").count();
  assert.equal(mobileCommandCards, 4, "mobile command dock should keep four operator commands");
  await mobile.locator("[data-control-surface-nav] button", { hasText: "Conversion Board" }).click();
  await mobile.waitForSelector("[data-fastdas-expanded-record]");
  await assertNoPageOverflow(mobile, "mobile conversion board");
  const mobileMetrics = await mobile.locator("[data-fastdas-metric-grid] .fg-metric").count();
  assert.equal(mobileMetrics, 6, "mobile surface should keep six metric cards visible");
  const mobileFrameworkSignals = await mobile.locator("[data-fastdas-metric-grid] .if-operations-signal").count();
  assert.equal(mobileFrameworkSignals, 6, "mobile metric cards should keep framework operations signal contracts");
  const mobileSecondSignal = await mobile.locator("[data-fastdas-metric-grid] button.if-operations-signal").nth(1).getAttribute("data-if-operations-signal");
  const mobileSecondSignalLabel = await mobile.locator("[data-fastdas-metric-grid] button.if-operations-signal .if-metric__label").nth(1).textContent();
  await mobile.locator("[data-fastdas-metric-grid] button.if-operations-signal").nth(1).click();
  await mobile.waitForFunction(
    signal => document.querySelector("[data-if-operations-workspace]")?.dataset.ifOperationsCurrent === signal,
    mobileSecondSignal,
  );
  const mobileActivePanelText = await mobile.locator(".if-operations-panel-shell .if-operations-panel:visible").textContent();
  assert.ok(mobileActivePanelText.includes(`${mobileSecondSignalLabel.trim()} Drilldown`), "mobile metric signals should drive framework panels");
  await mobile.locator("[data-control-surface-nav] button", { hasText: "Synthetic Data" }).click();
  await mobile.waitForSelector("[data-fastdas-data-management]");
  await mobile.locator('[data-fastdas-action="generate-variant"]').click();
  await assertAuditContains(mobile, "Generated demo variant", "mobile variant generation");
  await assertNoPageOverflow(mobile, "mobile synthetic data");
  const mobileManagementCards = await mobile.locator("[data-fastdas-management-area].if-pattern-card.if-operations-section").count();
  assert.equal(mobileManagementCards, 6, "mobile synthetic data surface should keep six management areas");
  await mobile.screenshot({ path: `${OUT_DIR}/fastdas-mobile.png`, fullPage: true });

  console.log("Verified FastDAS UI desktop/mobile screenshots, eight surfaces, synthetic data management, expanded rows, and page overflow.");
} finally {
  await browser.close();
  serverProcess?.kill("SIGTERM");
}
