import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const html = readFileSync("index.html", "utf8");
const app = readFileSync("src/App.jsx", "utf8");
const data = readFileSync("src/data.js", "utf8");
const css = readFileSync("src/styles.css", "utf8");
const gitlabCi = readFileSync(".gitlab-ci.yml", "utf8");
const viteConfig = readFileSync("vite.config.js", "utf8");
const legacyAssets = readFileSync("scripts/patch-legacy-assets.mjs", "utf8");
const wranglerConfig = readFileSync("wrangler.toml", "utf8");
const cloudflareHeaders = readFileSync("public/_headers", "utf8");

assert.equal(pkg.name, "fastdas-growth-engine-demo", "package should identify the new repo");
assert.equal(html.includes("<title>FastDAS Growth Engine</title>"), true, "HTML title should identify FastDAS");
assert.equal(viteConfig.includes('base: "./"'), true, "Vite should use relative assets for GitLab Pages project paths");
assert.equal(gitlabCi.includes("pages:"), true, "GitLab Pages job should exist");
assert.equal(gitlabCi.includes("cp -r dist public"), true, "GitLab Pages should publish the Vite dist folder");
assert.equal(pkg.scripts.build.includes("patch-legacy-assets"), true, "build should patch known stale Pages asset bridges");
assert.equal(pkg.scripts["deploy:cloudflare"].includes("wrangler pages deploy dist"), true, "Cloudflare Pages deploy script should publish dist directly");
assert.equal(wranglerConfig.includes('name = "fastdas-growth-engine-demo"'), true, "Cloudflare Pages config should use the FastDAS project name");
assert.equal(wranglerConfig.includes('pages_build_output_dir = "dist"'), true, "Cloudflare Pages config should publish the Vite dist folder");
assert.equal(cloudflareHeaders.includes("X-Content-Type-Options: nosniff"), true, "Cloudflare Pages headers should include basic hardening");
assert.equal(legacyAssets.includes("assets/index-Cnt_SPVg.js"), true, "legacy patch should bridge the stale GitLab Pages entry asset");
assert.equal(legacyAssets.includes("assets/index-DocpHply.css"), true, "legacy patch should bridge stale GitLab Pages CSS assets");
assert.equal(legacyAssets.includes("assets/control-surface-ui-B0ozY_LW.css"), true, "legacy patch should bridge stale framework stylesheet assets");
assert.equal(legacyAssets.includes("assets/react-vendor-DLXOKURV.js"), true, "legacy patch should bridge stale vendor modulepreload assets");
assert.equal(viteConfig.includes('entryFileNames: "assets/[name].js"'), true, "Vite should use stable entry asset names for GitLab Pages");
assert.equal(viteConfig.includes('chunkFileNames: "assets/[name].js"'), true, "Vite should use stable chunk asset names for GitLab Pages");

for (const surface of [
  "command-center",
  "signal-intake",
  "opportunity-workbench",
  "evidence-review",
  "outreach-queue",
  "agent-operations",
  "synthetic-data",
  "conversion-board",
]) {
  assert.equal(data.includes(`id: "${surface}"`), true, `data should include ${surface}`);
}

for (const hook of [
  "data-fastdas-demo-app",
  "data-fastdas-shell-header",
  "data-fastdas-header-route",
  "data-fastdas-header-utilities",
  "data-fastdas-header-status",
  "data-fastdas-header-actions",
  "data-fastdas-page-header",
  "data-fastdas-page-meta",
  "data-fastdas-page-actions",
  "data-control-surface-nav",
  "data-fastdas-metric-grid",
  "data-fastdas-opportunity-grid",
  "data-fastdas-opportunity-workbench-grid",
  "data-fastdas-evidence-review-grid",
  "data-fastdas-outreach-queue-grid",
  "data-fastdas-agent-operations-grid",
  "data-fastdas-synthetic-data-grid",
  "data-fastdas-conversion-board-grid",
  "data-fastdas-command-center-workbench",
  "data-fastdas-signal-intake-workbench",
  "data-fastdas-opportunity-workbench-workbench",
  "data-fastdas-evidence-review-workbench",
  "data-fastdas-outreach-queue-workbench",
  "data-fastdas-agent-operations-workbench",
  "data-fastdas-synthetic-data-workbench",
  "data-fastdas-conversion-board-workbench",
  "data-fastdas-source-focus-panel",
  "data-fastdas-opportunity-focus-panel",
  "data-fastdas-evidence-focus-panel",
  "data-fastdas-outreach-focus-panel",
  "data-fastdas-agent-focus-panel",
  "data-fastdas-dataset-focus-panel",
  "data-fastdas-conversion-focus-panel",
  "data-fastdas-record-focus-panel",
  "data-fastdas-open-details",
  "data-fastdas-expanded-record",
  "data-fastdas-provenance",
  "data-fastdas-human-approval-boundary",
  "data-fastdas-data-management",
  "data-fastdas-scenario-packs",
  "data-fastdas-management-area",
  "data-fastdas-scenario-pack",
  "data-fastdas-operational-workflow",
  "data-fastdas-workflow-stage",
  "data-fastdas-audit-log",
  "data-fastdas-toast",
  "data-fastdas-command-dock",
  "data-fastdas-operator-mode",
  "data-fastdas-command-card",
  "data-fastdas-release-rail",
  "data-fastdas-footer-status",
  "data-fastdas-delivery-readiness",
]) {
  assert.equal(app.includes(hook), true, `app should expose ${hook}`);
}

for (const frameworkClass of [
  "if-shell",
  "if-sidebar",
  "if-sidebar__section",
  "if-sidebar__group-header",
  "if-topbar",
  "if-topbar__nav",
  "if-topbar__actions",
  "if-product-header",
  "if-product-header--sticky",
  "if-product-header--compact",
  "if-product-header--masthead",
  "if-product-header__inner",
  "if-product-header__brand",
  "if-product-header__eyebrow",
  "if-product-header__title",
  "if-operations-topnav",
  "if-operations-topnav__link",
  "if-operations-topnav__secondary-button",
  "if-operations-topnav__menu",
  "if-operations-page",
  "if-operations-page__topbar",
  "if-breadcrumbs",
  "if-breadcrumbs__current",
  "if-operations-page__hero",
  "if-operations-page__title",
  "if-operations-section-grid",
  "if-main--with-sidebar",
  "if-utility-cluster",
  "if-utility-search",
  "if-account-menu",
  "if-avatar",
  "if-search__icon",
  "if-content",
  "if-page-header",
  "if-page-header__eyebrow",
  "if-page-header__title",
  "if-page-header__actions",
  "if-metric-grid",
  "if-operations-workspace",
  "if-operations-signal-grid",
  "if-operations-metric-grid",
  "if-operations-signal",
  "if-operations-panel-shell",
  "if-operations-section",
  "if-operations-panel",
  "if-operations-summary-grid",
  "if-operations-insight",
  "if-agent-runtime",
  "if-agent-runtime__summary",
  "if-agent-runtime-kpi",
  "if-agent-runtime__log",
  "if-ledger-list",
  "if-record-detail--intelligence",
  "if-record-detail__eyebrow",
  "if-record-detail__section",
  "if-record-detail__title",
  "if-record-detail__text",
  "if-stepper",
  "if-stepper__step",
  "if-stepper__label",
  "if-status-timeline",
  "if-status-step",
  "if-pattern-grid",
  "if-pattern-card",
  "if-pattern-card__header",
  "if-ops-command-strip",
  "if-ops-kpi",
  "if-claim-toolbar",
  "if-claim-summary-card",
  "if-source-health-card",
  "if-ops-meter-list",
  "if-impact-card",
  "if-impact-chain",
  "if-ops-runbook-card",
  "if-runbook-list",
  "if-contract-card",
  "if-artifact-row",
  "if-rule-builder-mini",
  "if-rule-line",
  "if-check-list",
  "if-toast",
  "if-review-workflow",
  "if-review-workflow__toolbar",
  "if-review-workflow__summary",
  "if-review-workflow__queue",
  "if-review-workflow__detail",
  "if-review-workflow__ledger",
  "if-action-queue",
  "if-action-queue__item",
  "if-operations-list",
  "if-operations-list__item",
  "if-operations-list__title",
  "if-source-feed-grid",
  "if-source-feed-card",
  "if-source-feed-card__header",
  "if-source-feed-card__description",
  "if-balanced-grid",
  "if-card",
  "if-card__title",
  "if-metric",
  "if-panel",
  "if-panel__title",
  "if-panel__subtitle",
  "if-toolbar",
  "if-toolbar__group",
  "if-table-command-band__leading",
  "if-table-command-band__filters",
  "if-table-command-band__actions",
  "if-table-shell",
  "if-table-wrap",
  "if-table-actions",
  "if-table",
  "if-data-table",
  "if-table-detail",
  "if-table-detail__content",
  "if-table-cell-main",
  "if-table-cell-meta",
  "if-table-progress",
  "if-table-progress__track",
  "if-provenance-grid",
  "if-provenance-field",
  "if-provenance-field__value",
  "if-source-badge",
  "if-panel__footer",
  "if-release-controls",
  "if-release-summary",
  "if-release-lane-grid",
  "if-release-lane",
  "if-release-lane__icon",
  "if-release-lane__kv",
  "if-route-demo-controls",
  "if-route-status",
  "if-segmented-control",
  "if-segmented-control__item",
  "if-btn",
  "if-badge",
  "if-icon-slot",
]) {
  assert.equal(app.includes(frameworkClass), true, `app should use Control Surface UI class ${frameworkClass}`);
}

assert.equal(app.includes("data-if-data-table"), true, "tables should expose Control Surface UI data-table behavior hooks");
assert.equal(app.includes("data-if-operations-workspace"), true, "app content should expose the operations workspace contract");
assert.equal(app.includes("data-if-operations-signal"), true, "metrics should expose operations signal contracts");
assert.equal(app.includes("data-if-operations-focus-panel"), true, "metrics should target operations drilldown panels");
assert.equal(app.includes("data-if-operations-panel"), true, "operations signals should have matching framework panels");
assert.equal(app.includes("data-if-operations-current-label"), true, "operations panels should expose current-label slots");
assert.equal(app.includes("data-if-operations-reset"), true, "operations panels should expose reset controls");
assert.equal(app.includes("data-if-balanced-grid"), true, "metric grids should expose balanced-grid behavior hooks");
assert.equal(app.includes("data-if-table-detail"), true, "expanded rows should expose framework table-detail hooks");
assert.equal(app.includes("data-if-table-filter"), true, "tables should expose framework search/filter controls");
assert.equal(app.includes("data-if-table-status"), true, "tables should expose framework status counters");
assert.equal(app.includes("data-if-table-clear"), true, "tables should expose framework clear controls");
assert.equal(app.includes("data-if-table-expand"), true, "tables should expose native row expansion controls");
assert.equal(app.includes("data-if-review-workflow"), true, "inline operator approval should expose framework review workflow roots");
assert.equal(app.includes("data-if-review-item"), true, "inline operator approval should expose framework review queue items");
assert.equal(app.includes("data-if-review-action"), true, "inline operator approval should expose framework review actions");
assert.equal(app.includes("data-if-review-count"), true, "inline operator approval should expose framework review count slots");
assert.equal(app.includes("data-if-review-ledger"), true, "inline operator approval should expose framework review ledger slots");
assert.equal(app.includes('data-control-segmented="fastdas-operator-mode"'), true, "operator mode should use the framework segmented-control contract");
assert.equal(app.includes("data-control-segmented-option"), true, "segmented options should be identified by framework hooks");
assert.equal(app.includes("fg-root fg-shell"), true, "FastDAS customization should layer on top of the framework shell");

for (const phrase of [
  "first paid step",
  "No auto-send",
  "Source tracking",
  "Human approval",
  "Agent Operations",
  "Synthetic Data Management",
  "Golden demo state",
  "Scenario Packs",
  "Generated demo variant",
  "Reset demo state",
  "Export bundle prepared",
  "Signal scan completed",
  "Operator Control Dock",
  "Command export staged",
  "Operator mode changed",
  "Conversion Board",
  "Deploy path ready",
  "Cloudflare Pages direct upload",
]) {
  assert.equal(app.includes(phrase) || data.includes(phrase), true, `demo should include ${phrase}`);
}

for (const handler of [
  "handlePrimaryAction",
  "handleSyntheticAction",
  "handleRecordAction",
  "appendEvent",
]) {
  assert.equal(app.includes(handler), true, `demo should include operational handler ${handler}`);
}

for (const actionHook of [
  'data-fastdas-action="run-signal-scan"',
  'data-fastdas-action="page-primary"',
  'data-fastdas-action="approve-record"',
  'data-fastdas-action="generate-variant"',
  'data-fastdas-action="export-bundle"',
  'data-fastdas-action="reset-demo"',
  'data-fastdas-action={`command-${command.id}`}',
]) {
  assert.equal(app.includes(actionHook), true, `demo should expose action hook ${actionHook}`);
}

assert.equal(css.includes("linear-gradient"), false, "demo CSS should avoid gradient-heavy UI surfaces");
assert.equal(css.includes(".fg-shell"), true, "demo CSS should define the FastDAS shell");

console.log("Verified FastDAS demo identity, routes, provenance hooks, synthetic data management, human gates, and GitLab Pages config.");
