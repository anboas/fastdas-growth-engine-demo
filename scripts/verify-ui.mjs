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
  await desktop.waitForSelector("[data-fastdas-command-center-ops-drawer]");
  await desktop.waitForSelector("[data-if-operations-workspace]");
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
  const productHeader = await desktop.locator("[data-fastdas-shell-header].if-product-header.if-product-header--sticky.if-product-header--compact.if-product-header--masthead").count();
  assert.equal(productHeader, 1, "header should use the framework product masthead contract");
  const operationsTopnav = await desktop.locator("[data-fastdas-header-route].if-operations-topnav .if-operations-topnav__link").count();
  assert.equal(operationsTopnav, 4, "header should expose primary surfaces through framework operations topnav links");
  const secondaryTopnavItems = await desktop.locator("[data-fastdas-header-route] .if-operations-topnav__menu .if-operations-topnav__menu-item").count();
  assert.equal(secondaryTopnavItems, 4, "header should expose secondary surfaces through the framework operations topnav menu");
  const secondaryToggle = desktop.locator("[data-fastdas-header-secondary-toggle]");
  const secondaryMenu = desktop.locator("[data-fastdas-header-secondary-menu]");
  assert.equal(await secondaryToggle.getAttribute("aria-expanded"), "false", "secondary topnav menu should start closed");
  await secondaryToggle.click();
  assert.equal(await secondaryToggle.getAttribute("aria-expanded"), "true", "secondary topnav toggle should expose open state");
  const visibleSecondaryItems = await desktop.locator("[data-fastdas-header-route] .if-operations-topnav__menu .if-operations-topnav__menu-item:visible").count();
  assert.equal(visibleSecondaryItems, 4, "secondary operations topnav menu should open from the header control");
  assert.equal(await secondaryMenu.getAttribute("role"), "menu", "secondary topnav should expose a menu role");
  await desktop.keyboard.press("Escape");
  assert.equal(await secondaryToggle.getAttribute("aria-expanded"), "false", "Escape should close the secondary topnav menu");
  await secondaryToggle.click();
  await desktop.locator('[data-fastdas-header-secondary-item="agent-operations"]').click();
  await desktop.waitForFunction(() => document.querySelector("h1")?.textContent?.includes("Agent Operations"));
  assert.equal(await secondaryToggle.getAttribute("aria-expanded"), "false", "selecting a secondary surface should close the topnav menu");
  assert.equal(await desktop.locator("[data-fastdas-header-route]").getAttribute("data-fastdas-active-route"), "agent-operations", "header route should expose the current secondary surface");
  assert.equal(await desktop.locator('[data-fastdas-header-secondary-item="agent-operations"]').getAttribute("data-fastdas-header-secondary-active"), "true", "secondary menu item should expose active state");
  assert.equal(await desktop.locator('[data-fastdas-nav-surface="agent-operations"]').getAttribute("data-fastdas-nav-active"), "true", "sidebar nav should mirror secondary header navigation state");
  await desktop.locator("[data-fastdas-header-route] .if-operations-topnav__link", { hasText: "Command Center" }).click();
  await desktop.waitForFunction(() => document.querySelector("h1")?.textContent?.includes("Command Center"));
  assert.equal(await desktop.locator("[data-control-surface-nav]").getAttribute("data-fastdas-active-route"), "command-center", "sidebar nav should expose the active route");
  assert.equal(await desktop.locator('[data-fastdas-header-surface="command-center"]').getAttribute("data-fastdas-header-surface-active"), "true", "primary header nav should expose active route state");
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
  const operationsPage = await desktop.locator("[data-if-operations-workspace].if-operations-page .if-operations-page__topbar .if-breadcrumbs").count();
  assert.equal(operationsPage, 1, "content should use the framework operations-page topbar and breadcrumbs");
  const operationsHero = await desktop.locator("[data-fastdas-page-header].if-operations-page__hero .if-operations-page__title").count();
  assert.equal(operationsHero, 1, "page header should use the framework operations-page hero contract");
  const pageActions = await desktop.locator("[data-fastdas-page-actions].if-toolbar__group .if-btn").count();
  assert.equal(pageActions, 3, "page header actions should use framework toolbar grouping");

  const surfaceButtons = await desktop.locator("[data-control-surface-nav] button").count();
  assert.equal(surfaceButtons, 8, "desktop nav should expose eight control surfaces");
  const surfaceRouteButtons = await desktop.locator("[data-control-surface-nav] [data-fastdas-nav-surface]").count();
  assert.equal(surfaceRouteButtons, 8, "desktop nav should expose route-state hooks for every surface");
  const savedViewButtons = await desktop.locator("[data-fastdas-saved-views] [data-fastdas-saved-view]").count();
  assert.equal(savedViewButtons, 4, "sidebar should expose four functional saved views");
  await desktop.locator('[data-fastdas-saved-view="paid-assessment-fit"]').click();
  await desktop.waitForFunction(() => document.querySelector("h1")?.textContent?.includes("Conversion Board"));
  await desktop.waitForFunction(() => document.querySelector("[data-fastdas-conversion-focus-panel]")?.getAttribute("data-fastdas-record-focus-id") === "Capital Ridge Senior Living");
  const paidAssessmentSavedViewActive = await desktop.locator('[data-fastdas-saved-view="paid-assessment-fit"]').getAttribute("data-fastdas-saved-view-active");
  assert.equal(paidAssessmentSavedViewActive, "true", "selected saved view should expose active state");
  const paidAssessmentSavedViewText = await desktop.locator("[data-fastdas-conversion-focus-panel]").textContent();
  assert.ok(paidAssessmentSavedViewText.includes("Public safety radio testing"), "saved view should select the configured conversion row");
  await assertAuditContains(desktop, "Saved view loaded", "saved view selection");
  await desktop.locator("[data-control-surface-nav] button", { hasText: "Command Center" }).click();
  await desktop.waitForFunction(() => document.querySelector("h1")?.textContent?.includes("Command Center"));
  const frameworkSignals = await desktop.locator(".if-operations-signal-grid .if-operations-signal").count();
  assert.equal(frameworkSignals, 6, "desktop metric strip should use framework operations signal cards");
  const frameworkSignalButtons = await desktop.locator(".if-operations-signal-grid button.if-operations-signal").count();
  assert.equal(frameworkSignalButtons, 6, "desktop metric signals should be native framework signal buttons");
  const visibleSignalPanels = await desktop.locator(".if-operations-panel-shell .if-operations-panel:visible").count();
  assert.equal(visibleSignalPanels, 1, "operations workspace should show one framework drilldown panel");
  const commandCenterNav = await desktop.locator("[data-fastdas-command-center-nav]").count();
  assert.equal(commandCenterNav, 1, "command center should expose a compact top control nav");
  const commandFilterTabs = await desktop.locator("[data-fastdas-command-filter-tab]").count();
  assert.equal(commandFilterTabs, 4, "command center should expose top quick-filter tabs");
  const commandFilterSelects = await desktop.locator("[data-fastdas-command-filter-select], [data-fastdas-command-segment-select], [data-fastdas-command-owner-select]").count();
  assert.equal(commandFilterSelects, 3, "command center should expose view, segment, and owner dropdown controls");
  assert.equal(await desktop.locator("[data-fastdas-opportunity-grid]").getAttribute("data-fastdas-active-command-filter"), "high-score-opportunities", "command center should start on the high-score quick filter");
  await desktop.locator("[data-fastdas-command-filter-select]").selectOption("follow-ups-due");
  await desktop.waitForFunction(() => document.querySelector("[data-fastdas-opportunity-grid]")?.getAttribute("data-fastdas-active-command-filter") === "follow-ups-due");
  await desktop.waitForFunction(() => document.querySelector("[data-fastdas-record-focus-panel]")?.getAttribute("data-fastdas-record-focus-id") === "Mosaic West Hotel");
  const followUpRows = await desktop.locator("[data-fastdas-opportunity-grid] tr[data-if-table-row]").count();
  assert.equal(followUpRows, 2, "command center view dropdown should filter the table rows");
  assert.equal(await desktop.locator("[data-fastdas-opportunity-grid] [data-if-table-status='filtered']").textContent(), "2", "command center filtered counter should follow quick filters");
  await desktop.locator(".if-operations-signal-grid button.if-operations-signal").nth(1).click();
  await desktop.waitForFunction(() => document.querySelector("[data-if-operations-workspace]")?.dataset.ifOperationsCurrent === "paid-assessment-fit");
  await desktop.waitForFunction(() => document.querySelector("[data-fastdas-opportunity-grid]")?.getAttribute("data-fastdas-active-command-filter") === "paid-assessment-fit");
  const selectedSignal = await desktop.locator(".if-operations-signal-grid .if-operations-signal.is-selected").textContent();
  assert.ok(selectedSignal.includes("Paid Assessment"), "clicking a metric should move framework operations selection");
  assert.equal(await desktop.locator('[data-fastdas-command-filter-card="paid-assessment-fit"]').getAttribute("data-fastdas-command-filter-active"), "true", "metric cards should expose active quick-filter state");
  const activePanelText = await desktop.locator(".if-operations-panel-shell .if-operations-panel:visible").textContent();
  assert.ok(activePanelText.includes("Paid Assessment Fit Drilldown"), "metric click should show the matching operations panel");
  const segmentedOptions = await desktop.locator('[data-control-segmented="fastdas-operator-mode"] .if-segmented-control__item').count();
  assert.equal(segmentedOptions, 3, "operator mode should use framework segmented-control options");
  const dataTableShells = await desktop.locator("[data-if-data-table].if-table-shell").count();
  assert.ok(dataTableShells >= 1, "workspace grid should use the framework data-table shell contract");
  const commandCenterOrder = await desktop.evaluate(() => {
    const grid = document.querySelector("[data-fastdas-opportunity-grid]");
    const dock = document.querySelector("[data-fastdas-command-dock]");
    return Boolean(grid && dock && (grid.compareDocumentPosition(dock) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  assert.equal(commandCenterOrder, true, "command center should put the work queue before demo command controls");
  const commandWorkbenchColumns = await desktop.locator("[data-fastdas-command-center-workbench]").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").filter(Boolean).length);
  assert.ok(commandWorkbenchColumns >= 2, "command center table should share the workspace with the selected-record panel on desktop");
  const commandBandAnatomy = await desktop.locator(".if-table-command-band__leading, .if-table-command-band__filters, .if-table-command-band__actions").count();
  assert.ok(commandBandAnatomy >= 3, "table command band should use framework leading/filter/action anatomy");
  const tableFilterControls = await desktop.locator("[data-fastdas-opportunity-grid] [data-if-table-filter]").count();
  assert.equal(tableFilterControls, 1, "opportunity grid should expose framework table search");
  const tableStatusCounters = await desktop.locator("[data-fastdas-opportunity-grid] [data-if-table-status]").count();
  assert.ok(tableStatusCounters >= 1, "opportunity grid should expose framework status counters without duplicating selected-row state");
  const expandControls = await desktop.locator("[data-fastdas-opportunity-grid] [data-if-table-expand]").count();
  assert.ok(expandControls >= 1, "opportunity grid should expose framework row expand controls");
  const focusPanel = desktop.locator("[data-fastdas-record-focus-panel]");
  await focusPanel.waitFor({ timeout: 5000 });
  let focusText = await focusPanel.textContent();
  assert.ok(focusText.includes("Capital Ridge Senior Living"), "command-center should start with the selected opportunity in the focus panel");
  await desktop.locator("[data-fastdas-opportunity-grid] tr[data-if-table-row]", { hasText: "HarborPoint Garage" }).click();
  await desktop.waitForFunction(() => document.querySelector("[data-fastdas-record-focus-panel]")?.getAttribute("data-fastdas-record-focus-id") === "HarborPoint Garage");
  focusText = await focusPanel.textContent();
  assert.ok(focusText.includes("HarborPoint Garage"), "clicking a table row should move the focus panel to that opportunity");
  assert.ok(focusText.includes("Cellular / DAS benchmark"), "focus panel should show the selected row's first-offer detail");
  const closedFocusedDetails = await desktop.locator('[data-fastdas-expanded-record-id="HarborPoint Garage"]').count();
  assert.equal(closedFocusedDetails, 0, "row click should focus the panel before opening full details");
  await desktop.locator('[data-fastdas-action="open-record-details"]').click();
  await desktop.waitForSelector('[data-fastdas-expanded-record-id="HarborPoint Garage"]', { timeout: 5000 });
  const tableDetails = await desktop.locator(".if-table-detail[data-if-table-detail] .if-table-detail__content").count();
  assert.ok(tableDetails >= 1, "expanded records should use framework table-detail anatomy");
  const intelligenceDetails = await desktop.locator("[data-fastdas-expanded-record].if-record-detail--intelligence").count();
  assert.ok(intelligenceDetails >= 1, "expanded records should use framework intelligence detail anatomy");
  const expandedRecordText = await desktop.locator('[data-fastdas-expanded-record-id="HarborPoint Garage"]').textContent();
  assert.ok(expandedRecordText.includes("HarborPoint Garage"), "opened detail row should match the clicked opportunity");
  assert.ok(expandedRecordText.includes("below-grade"), "opened detail row should use the selected opportunity's evidence, not static default copy");
  const recordDetailSections = await desktop.locator("[data-fastdas-expanded-record] .if-record-detail__section").count();
  assert.equal(recordDetailSections, 3, "expanded record should expose three framework record-detail sections");
  const recordOperationsSections = await desktop.locator("[data-fastdas-expanded-record].if-operations-section-grid .if-operations-section").count();
  assert.equal(recordOperationsSections, 3, "expanded record should use framework operations-section grid contracts");
  const statusSteps = await desktop.locator("[data-fastdas-expanded-record] .if-status-timeline .if-status-step").count();
  assert.ok(statusSteps >= 5, "expanded workflow state should use framework status timeline steps");
  const evidenceSourceCards = await desktop.locator("[data-fastdas-expanded-record] [data-fastdas-provenance] .if-source-feed-grid .if-source-feed-card").count();
  assert.ok(evidenceSourceCards >= 3, "expanded evidence should use framework source-feed cards");
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
  const operationsListActions = await desktop.locator("[data-fastdas-expanded-record] .if-operations-list .if-operations-list__item .if-operations-list__title").count();
  assert.ok(operationsListActions >= 3, "expanded next actions should use framework operations-list rows");
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
  await desktop.locator("[data-fastdas-command-center-ops-drawer] > summary").click();
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
  assert.equal(releaseRail, 6, "release footer should use framework panel-footer route status chips");
  const releaseControls = await desktop.locator("[data-fastdas-release-rail].if-release-controls .if-release-summary .if-route-status").count();
  assert.equal(releaseControls, 6, "release footer should use framework release summary status controls");
  const releaseLanes = await desktop.locator("[data-fastdas-release-rail] .if-release-lane-grid .if-release-lane .if-release-lane__kv").count();
  assert.equal(releaseLanes, 4, "release footer should expose framework release lanes");
  const deliveryReadinessText = await desktop.locator("[data-fastdas-delivery-readiness]").textContent();
  assert.ok(deliveryReadinessText.includes("Cloudflare Pages direct upload"), "release footer should expose Cloudflare delivery readiness");
  const releaseBrand = await desktop.locator("[data-fastdas-release-rail] .fg-footer__brand").textContent();
  assert.ok(releaseBrand.includes("FastDAS Growth Engine"), "release footer should keep a readable product identity");

  await desktop.locator('[data-fastdas-action="run-signal-scan"]').click();
  await assertAuditContains(desktop, "Signal scan completed", "global scan");
  await desktop.waitForSelector("h1", { timeout: 5000 });
  assert.match(await desktop.locator("h1").textContent(), /Signal Intake/, "global scan should move operator to Signal Intake");
  const sourceHealthCards = await desktop.locator("[data-fastdas-source-health] .if-source-health-card .if-ops-meter-list").count();
  assert.ok(sourceHealthCards >= 1, "source cards should use framework source-health meter contracts");
  const signalWorkbenchColumns = await desktop.locator("[data-fastdas-signal-intake-workbench]").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").filter(Boolean).length);
  assert.ok(signalWorkbenchColumns >= 2, "signal intake should share the source table with a selected-source panel on desktop");
  const signalDrawerOrder = await desktop.evaluate(() => {
    const grid = document.querySelector("[data-fastdas-signal-intake-grid]");
    const drawer = document.querySelector("[data-fastdas-command-center-ops-drawer]");
    return Boolean(grid && drawer && (grid.compareDocumentPosition(drawer) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  assert.equal(signalDrawerOrder, true, "signal intake should put the source registry before operational controls");
  const sourceFocusPanel = desktop.locator("[data-fastdas-source-focus-panel]");
  await sourceFocusPanel.waitFor({ timeout: 5000 });
  let sourceFocusText = await sourceFocusPanel.textContent();
  assert.ok(sourceFocusText.includes("Arlington County Permit Portal"), "signal intake should start with the selected source in the focus panel");
  await desktop.locator("[data-fastdas-signal-intake-grid] tr[data-if-table-row]", { hasText: "Google Reviews / Hospitality Coverage" }).click();
  await desktop.waitForFunction(() => document.querySelector("[data-fastdas-source-focus-panel]")?.getAttribute("data-fastdas-record-focus-id") === "Google Reviews / Hospitality Coverage");
  sourceFocusText = await sourceFocusPanel.textContent();
  assert.ok(sourceFocusText.includes("Google Reviews / Hospitality Coverage"), "clicking a source row should move the source focus panel");
  assert.ok(sourceFocusText.includes("Complaint pattern agent"), "source focus panel should show the selected row's routing target");
  const closedSourceDetails = await desktop.locator('[data-fastdas-expanded-record-id="Google Reviews / Hospitality Coverage"]').count();
  assert.equal(closedSourceDetails, 0, "source row click should focus the panel before opening full details");
  await desktop.locator('[data-fastdas-action="open-source-details"]').click();
  await desktop.waitForSelector('[data-fastdas-expanded-record-id="Google Reviews / Hospitality Coverage"]', { timeout: 5000 });
  const sourceDetailText = await desktop.locator('[data-fastdas-expanded-record-id="Google Reviews / Hospitality Coverage"]').textContent();
  assert.ok(sourceDetailText.includes("Google Reviews / Hospitality Coverage"), "opened source detail row should match the clicked source");
  assert.ok(sourceDetailText.includes("Needs sample"), "opened source detail should use source-specific exception context");

  await desktop.goto(`${BASE_URL}#/opportunity-workbench`, { waitUntil: "domcontentloaded" });
  await desktop.waitForSelector("[data-fastdas-opportunity-focus-panel]", { timeout: 5000 });
  const opportunityWorkbenchColumns = await desktop.locator("[data-fastdas-opportunity-workbench-workbench]").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").filter(Boolean).length);
  assert.ok(opportunityWorkbenchColumns >= 2, "opportunity workbench should share the opportunity table with a selected-opportunity panel on desktop");
  const opportunityDrawerOrder = await desktop.evaluate(() => {
    const grid = document.querySelector("[data-fastdas-opportunity-workbench-grid]");
    const drawer = document.querySelector("[data-fastdas-command-center-ops-drawer]");
    return Boolean(grid && drawer && (grid.compareDocumentPosition(drawer) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  assert.equal(opportunityDrawerOrder, true, "opportunity workbench should put the qualification table before operational controls");
  const opportunityFocusPanel = desktop.locator("[data-fastdas-opportunity-focus-panel]");
  let opportunityFocusText = await opportunityFocusPanel.textContent();
  assert.ok(opportunityFocusText.includes("HarborPoint Garage"), "opportunity workbench should start with the selected opportunity in the focus panel");
  await desktop.locator("[data-fastdas-opportunity-workbench-grid] tr[data-if-table-row]", { hasText: "Capital Ridge Senior Living" }).click();
  await desktop.waitForFunction(() => document.querySelector("[data-fastdas-opportunity-focus-panel]")?.getAttribute("data-fastdas-record-focus-id") === "Capital Ridge Senior Living");
  opportunityFocusText = await opportunityFocusPanel.textContent();
  assert.ok(opportunityFocusText.includes("Capital Ridge Senior Living"), "clicking an opportunity row should move the qualification focus panel");
  assert.ok(opportunityFocusText.includes("Public safety radio testing"), "opportunity focus panel should show the selected row's first-offer detail");
  await desktop.locator('[data-fastdas-action="focus-promote-opportunity"]').click();
  await assertAuditContains(desktop, "Opportunity promoted to review", "opportunity promotion");
  const closedOpportunityDetails = await desktop.locator('[data-fastdas-expanded-record-id="Capital Ridge Senior Living"]').count();
  assert.equal(closedOpportunityDetails, 0, "opportunity row click should focus the panel before opening full details");
  await desktop.locator('[data-fastdas-action="open-opportunity-details"]').click();
  await desktop.waitForSelector('[data-fastdas-expanded-record-id="Capital Ridge Senior Living"]', { timeout: 5000 });
  const opportunityDetailText = await desktop.locator('[data-fastdas-expanded-record-id="Capital Ridge Senior Living"]').textContent();
  assert.ok(opportunityDetailText.includes("Capital Ridge Senior Living"), "opened opportunity detail row should match the clicked opportunity");
  assert.ok(opportunityDetailText.includes("Potential closeout risk"), "opened opportunity detail should use opportunity-specific evidence");

  await desktop.goto(`${BASE_URL}#/evidence-review`, { waitUntil: "domcontentloaded" });
  await desktop.waitForSelector("[data-fastdas-evidence-focus-panel]", { timeout: 5000 });
  const evidenceWorkbenchColumns = await desktop.locator("[data-fastdas-evidence-review-workbench]").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").filter(Boolean).length);
  assert.ok(evidenceWorkbenchColumns >= 2, "evidence review should share the packet table with a selected-evidence panel on desktop");
  const evidenceDrawerOrder = await desktop.evaluate(() => {
    const grid = document.querySelector("[data-fastdas-evidence-review-grid]");
    const drawer = document.querySelector("[data-fastdas-command-center-ops-drawer]");
    return Boolean(grid && drawer && (grid.compareDocumentPosition(drawer) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  assert.equal(evidenceDrawerOrder, true, "evidence review should put evidence packets before operational controls");
  const evidenceFocusPanel = desktop.locator("[data-fastdas-evidence-focus-panel]");
  let evidenceFocusText = await evidenceFocusPanel.textContent();
  assert.ok(evidenceFocusText.includes("Fire alarm permit pattern"), "evidence review should start with the selected evidence packet");
  await desktop.locator("[data-fastdas-evidence-review-grid] tr[data-if-table-row]", { hasText: "Partner route" }).click();
  await desktop.waitForFunction(() => document.querySelector("[data-fastdas-evidence-focus-panel]")?.getAttribute("data-fastdas-record-focus-id") === "Partner route");
  evidenceFocusText = await evidenceFocusPanel.textContent();
  assert.ok(evidenceFocusText.includes("Partner route"), "clicking an evidence row should move the evidence focus panel");
  assert.ok(evidenceFocusText.includes("Verify contacts before outreach"), "evidence focus panel should show the selected row's review note");
  await desktop.locator('[data-fastdas-action="focus-approve-evidence"]').click();
  await assertAuditContains(desktop, "Evidence packet approved", "evidence approval");
  const closedEvidenceDetails = await desktop.locator('[data-fastdas-expanded-record-id="Partner route"]').count();
  assert.equal(closedEvidenceDetails, 0, "evidence row click should focus the panel before opening full details");
  await desktop.locator('[data-fastdas-action="open-evidence-details"]').click();
  await desktop.waitForSelector('[data-fastdas-expanded-record-id="Partner route"]', { timeout: 5000 });
  const evidenceDetailText = await desktop.locator('[data-fastdas-expanded-record-id="Partner route"]').textContent();
  assert.ok(evidenceDetailText.includes("Partner route"), "opened evidence detail row should match the clicked packet");
  assert.ok(evidenceDetailText.includes("Manual review"), "opened evidence detail should use evidence-specific source context");

  await desktop.goto(`${BASE_URL}#/outreach-queue`, { waitUntil: "domcontentloaded" });
  await desktop.waitForSelector("[data-fastdas-outreach-focus-panel]", { timeout: 5000 });
  const outreachWorkbenchColumns = await desktop.locator("[data-fastdas-outreach-queue-workbench]").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").filter(Boolean).length);
  assert.ok(outreachWorkbenchColumns >= 2, "outreach queue should share the task table with a selected-outreach panel on desktop");
  const outreachDrawerOrder = await desktop.evaluate(() => {
    const grid = document.querySelector("[data-fastdas-outreach-queue-grid]");
    const drawer = document.querySelector("[data-fastdas-command-center-ops-drawer]");
    return Boolean(grid && drawer && (grid.compareDocumentPosition(drawer) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  assert.equal(outreachDrawerOrder, true, "outreach queue should put outreach tasks before operational controls");
  const outreachFocusPanel = desktop.locator("[data-fastdas-outreach-focus-panel]");
  let outreachFocusText = await outreachFocusPanel.textContent();
  assert.ok(outreachFocusText.includes("HarborPoint Garage"), "outreach queue should start with the selected outreach task");
  await desktop.locator("[data-fastdas-outreach-queue-grid] tr[data-if-table-row]", { hasText: "Capital Ridge Senior Living" }).click();
  await desktop.waitForFunction(() => document.querySelector("[data-fastdas-outreach-focus-panel]")?.getAttribute("data-fastdas-record-focus-id") === "Capital Ridge Senior Living");
  outreachFocusText = await outreachFocusPanel.textContent();
  assert.ok(outreachFocusText.includes("Capital Ridge Senior Living"), "clicking an outreach row should move the outreach focus panel");
  assert.ok(outreachFocusText.includes("Technical review"), "outreach focus panel should show the selected row's approval state");
  await desktop.locator('[data-fastdas-action="focus-approve-outreach"]').click();
  await assertAuditContains(desktop, "Outreach task approved", "outreach approval");
  const closedOutreachDetails = await desktop.locator('[data-fastdas-expanded-record-id="Capital Ridge Senior Living"]').count();
  assert.equal(closedOutreachDetails, 0, "outreach row click should focus the panel before opening full details");
  await desktop.locator('[data-fastdas-action="open-outreach-details"]').click();
  await desktop.waitForSelector('[data-fastdas-expanded-record-id="Capital Ridge Senior Living"]', { timeout: 5000 });
  const outreachDetailText = await desktop.locator('[data-fastdas-expanded-record-id="Capital Ridge Senior Living"]').textContent();
  assert.ok(outreachDetailText.includes("Capital Ridge Senior Living"), "opened outreach detail row should match the clicked task");
  assert.ok(outreachDetailText.includes("Radio testing"), "opened outreach detail should use outreach-specific first-offer context");

  await desktop.goto(`${BASE_URL}#/agent-operations`, { waitUntil: "domcontentloaded" });
  await desktop.waitForSelector("[data-fastdas-agent-focus-panel]", { timeout: 5000 });
  const agentWorkbenchColumns = await desktop.locator("[data-fastdas-agent-operations-workbench]").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").filter(Boolean).length);
  assert.ok(agentWorkbenchColumns >= 2, "agent operations should share the workflow table with a selected-agent panel on desktop");
  const agentDrawerOrder = await desktop.evaluate(() => {
    const grid = document.querySelector("[data-fastdas-agent-operations-grid]");
    const drawer = document.querySelector("[data-fastdas-command-center-ops-drawer]");
    return Boolean(grid && drawer && (grid.compareDocumentPosition(drawer) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  assert.equal(agentDrawerOrder, true, "agent operations should put workflow runs before operational controls");
  const agentFocusPanel = desktop.locator("[data-fastdas-agent-focus-panel]");
  let agentFocusText = await agentFocusPanel.textContent();
  assert.ok(agentFocusText.includes("Permit Monitor Agent"), "agent operations should start with the selected agent workflow");
  await desktop.locator("[data-fastdas-agent-operations-grid] tr[data-if-table-row]", { hasText: "Complaint Pattern Agent" }).click();
  await desktop.waitForFunction(() => document.querySelector("[data-fastdas-agent-focus-panel]")?.getAttribute("data-fastdas-record-focus-id") === "Complaint Pattern Agent");
  agentFocusText = await agentFocusPanel.textContent();
  assert.ok(agentFocusText.includes("Complaint Pattern Agent"), "clicking an agent row should move the runtime focus panel");
  assert.ok(agentFocusText.includes("Needs sample"), "agent focus panel should show the selected row's runtime status");
  await desktop.locator('[data-fastdas-action="focus-run-agent"]').click();
  await assertAuditContains(desktop, "Agent workflow queued", "agent workflow replay");
  const closedAgentDetails = await desktop.locator('[data-fastdas-expanded-record-id="Complaint Pattern Agent"]').count();
  assert.equal(closedAgentDetails, 0, "agent row click should focus the panel before opening full details");
  await desktop.locator('[data-fastdas-action="open-agent-details"]').click();
  await desktop.waitForSelector('[data-fastdas-expanded-record-id="Complaint Pattern Agent"]', { timeout: 5000 });
  const agentDetailText = await desktop.locator('[data-fastdas-expanded-record-id="Complaint Pattern Agent"]').textContent();
  assert.ok(agentDetailText.includes("Complaint Pattern Agent"), "opened agent detail row should match the clicked workflow");
  assert.ok(agentDetailText.includes("Search/API"), "opened agent detail should use agent-specific toolchain context");

  await desktop.goto(`${BASE_URL}#/synthetic-data`, { waitUntil: "domcontentloaded" });
  await desktop.waitForSelector("[data-fastdas-dataset-focus-panel]", { timeout: 5000 });
  const datasetWorkbenchColumns = await desktop.locator("[data-fastdas-synthetic-data-workbench]").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").filter(Boolean).length);
  assert.ok(datasetWorkbenchColumns >= 2, "synthetic data should share the dataset table with a selected-dataset panel on desktop");
  const datasetDrawerOrder = await desktop.evaluate(() => {
    const grid = document.querySelector("[data-fastdas-synthetic-data-grid]");
    const drawer = document.querySelector("[data-fastdas-command-center-ops-drawer]");
    return Boolean(grid && drawer && (grid.compareDocumentPosition(drawer) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  assert.equal(datasetDrawerOrder, true, "synthetic data should put managed datasets before operational controls");
  const datasetFocusPanel = desktop.locator("[data-fastdas-dataset-focus-panel]");
  let datasetFocusText = await datasetFocusPanel.textContent();
  assert.ok(datasetFocusText.includes("Opportunity Dataset"), "synthetic data should start with the selected dataset");
  await desktop.locator("[data-fastdas-synthetic-data-grid] tr[data-if-table-row]", { hasText: "Source Registry Dataset" }).click();
  await desktop.waitForFunction(() => document.querySelector("[data-fastdas-dataset-focus-panel]")?.getAttribute("data-fastdas-record-focus-id") === "Source Registry Dataset");
  datasetFocusText = await datasetFocusPanel.textContent();
  assert.ok(datasetFocusText.includes("Source Registry Dataset"), "clicking a dataset row should move the dataset focus panel");
  assert.ok(datasetFocusText.includes("Synthetic source model"), "dataset focus panel should show the selected row's provenance");
  await desktop.locator('[data-fastdas-action="focus-validate-dataset"]').click();
  await assertAuditContains(desktop, "Dataset validation queued", "dataset validation");
  const closedDatasetDetails = await desktop.locator('[data-fastdas-expanded-record-id="Source Registry Dataset"]').count();
  assert.equal(closedDatasetDetails, 0, "dataset row click should focus the panel before opening full details");
  await desktop.locator('[data-fastdas-action="open-dataset-details"]').click();
  await desktop.waitForSelector('[data-fastdas-expanded-record-id="Source Registry Dataset"]', { timeout: 5000 });
  const datasetDetailText = await desktop.locator('[data-fastdas-expanded-record-id="Source Registry Dataset"]').textContent();
  assert.ok(datasetDetailText.includes("Source Registry Dataset"), "opened dataset detail row should match the clicked dataset");
  assert.ok(datasetDetailText.includes("Signal Intake"), "opened dataset detail should use dataset-specific demo-surface context");

  await desktop.goto(`${BASE_URL}#/conversion-board`, { waitUntil: "domcontentloaded" });
  await desktop.waitForSelector("[data-fastdas-conversion-focus-panel]", { timeout: 5000 });
  const conversionWorkbenchColumns = await desktop.locator("[data-fastdas-conversion-board-workbench]").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").filter(Boolean).length);
  assert.ok(conversionWorkbenchColumns >= 2, "conversion board should share the conversion table with a selected-conversion panel on desktop");
  const conversionDrawerOrder = await desktop.evaluate(() => {
    const grid = document.querySelector("[data-fastdas-conversion-board-grid]");
    const drawer = document.querySelector("[data-fastdas-command-center-ops-drawer]");
    return Boolean(grid && drawer && (grid.compareDocumentPosition(drawer) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  assert.equal(conversionDrawerOrder, true, "conversion board should put conversion records before operational controls");
  const conversionFocusPanel = desktop.locator("[data-fastdas-conversion-focus-panel]");
  let conversionFocusText = await conversionFocusPanel.textContent();
  assert.ok(conversionFocusText.includes("Capital Ridge Senior Living"), "conversion board should start with the selected conversion record");
  await desktop.locator("[data-fastdas-conversion-board-grid] tr[data-if-table-row]", { hasText: "Mosaic West Hotel" }).click();
  await desktop.waitForFunction(() => document.querySelector("[data-fastdas-conversion-focus-panel]")?.getAttribute("data-fastdas-record-focus-id") === "Mosaic West Hotel");
  conversionFocusText = await conversionFocusPanel.textContent();
  assert.ok(conversionFocusText.includes("Mosaic West Hotel"), "clicking a conversion row should move the conversion focus panel");
  assert.ok(conversionFocusText.includes("Coverage benchmark"), "conversion focus panel should show the selected row's first paid step");
  await desktop.locator('[data-fastdas-action="focus-log-conversion"]').click();
  await assertAuditContains(desktop, "Conversion outcome logged", "conversion outcome logging");
  const closedConversionDetails = await desktop.locator('[data-fastdas-expanded-record-id="Mosaic West Hotel"]').count();
  assert.equal(closedConversionDetails, 0, "conversion row click should focus the panel before opening full details");
  await desktop.locator('[data-fastdas-action="open-conversion-details"]').click();
  await desktop.waitForSelector('[data-fastdas-expanded-record-id="Mosaic West Hotel"]', { timeout: 5000 });
  const conversionDetailText = await desktop.locator('[data-fastdas-expanded-record-id="Mosaic West Hotel"]').textContent();
  assert.ok(conversionDetailText.includes("Mosaic West Hotel"), "opened conversion detail row should match the clicked record");
  assert.ok(conversionDetailText.includes("Hospitality pain language"), "opened conversion detail should use conversion-specific learning context");

  for (const surfaceId of SURFACE_IDS) {
    await desktop.goto(`${BASE_URL}#/${surfaceId}`, { waitUntil: "domcontentloaded" });
    await desktop.waitForSelector(`[data-fastdas-grid-surface="${surfaceId}"]`, { timeout: 5000 });
    await desktop.waitForSelector(`[data-fastdas-workbench-surface="${surfaceId}"]`, { timeout: 5000 });
    if (surfaceId === "command-center" || surfaceId === "signal-intake" || surfaceId === "opportunity-workbench" || surfaceId === "evidence-review" || surfaceId === "outreach-queue" || surfaceId === "agent-operations" || surfaceId === "synthetic-data" || surfaceId === "conversion-board") {
      if (await desktop.locator("[data-fastdas-expanded-record]").count() === 0) {
        await desktop.waitForSelector("[data-fastdas-record-focus-panel]", { timeout: 5000 });
        const openSelector = surfaceId === "signal-intake"
          ? '[data-fastdas-action="open-source-details"]'
          : surfaceId === "opportunity-workbench"
            ? '[data-fastdas-action="open-opportunity-details"]'
            : surfaceId === "evidence-review"
              ? '[data-fastdas-action="open-evidence-details"]'
              : surfaceId === "outreach-queue"
                ? '[data-fastdas-action="open-outreach-details"]'
                : surfaceId === "agent-operations"
                  ? '[data-fastdas-action="open-agent-details"]'
                  : surfaceId === "synthetic-data"
                    ? '[data-fastdas-action="open-dataset-details"]'
                    : surfaceId === "conversion-board"
                      ? '[data-fastdas-action="open-conversion-details"]'
                      : '[data-fastdas-action="open-record-details"]';
        await desktop.locator(openSelector).click();
      }
    }
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
  if (await desktop.locator("[data-fastdas-expanded-record]").count() === 0) {
    await desktop.waitForSelector("[data-fastdas-record-focus-panel]", { timeout: 5000 });
    await desktop.locator('[data-fastdas-action="open-record-details"]').click();
  }
  await desktop.waitForSelector("[data-fastdas-expanded-record]", { timeout: 5000 });
  await desktop.locator('[data-fastdas-action="approve-record"]').first().click();
  await assertAuditContains(desktop, "Inline record approved", "inline approval");

  await desktop.screenshot({ path: `${OUT_DIR}/fastdas-desktop.png`, fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 920 }, isMobile: true });
  await mobile.goto(`${BASE_URL}#/command-center`, { waitUntil: "domcontentloaded" });
  await mobile.waitForSelector("[data-fastdas-demo-app]");
  await mobile.waitForSelector("[data-fastdas-command-center-ops-drawer]");
  await mobile.waitForSelector("[data-if-operations-workspace]");
  await mobile.waitForSelector("[data-fg-icon-rendered]:visible");
  await assertNoPageOverflow(mobile, "mobile");
  const mobileHeaderRoute = await mobile.locator("[data-fastdas-header-route] .if-route-status").count();
  assert.equal(mobileHeaderRoute, 2, "mobile header should keep route status context");
  const mobileTopnavLinks = await mobile.locator("[data-fastdas-header-route] .if-operations-topnav__link").count();
  assert.equal(mobileTopnavLinks, 4, "mobile header should keep framework operations topnav links");
  const mobileHeaderActions = await mobile.locator("[data-fastdas-header-actions] .if-btn").count();
  assert.equal(mobileHeaderActions, 2, "mobile header should keep grouped actions");
  const mobileBreadcrumbs = await mobile.locator(".if-operations-page__topbar .if-breadcrumbs__current").count();
  assert.equal(mobileBreadcrumbs, 1, "mobile content should keep operations-page breadcrumbs");
  const mobilePageMeta = await mobile.locator("[data-fastdas-page-meta] .if-route-status").count();
  assert.equal(mobilePageMeta, 3, "mobile page header should keep route-status metadata");
  const mobileSegmentedOptions = await mobile.locator('[data-control-segmented="fastdas-operator-mode"] .if-segmented-control__item').count();
  assert.equal(mobileSegmentedOptions, 3, "mobile operator dock should preserve framework segmented controls");
  const mobileCommandCards = await mobile.locator("[data-fastdas-command-card]").count();
  assert.equal(mobileCommandCards, 4, "mobile command dock should keep four operator commands");
  await mobile.locator("[data-control-surface-nav] button", { hasText: "Conversion Board" }).click();
  await mobile.waitForSelector("[data-fastdas-conversion-focus-panel]");
  await mobile.locator('[data-fastdas-action="open-conversion-details"]').click();
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
