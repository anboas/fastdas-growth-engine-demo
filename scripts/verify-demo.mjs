import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const html = readFileSync("index.html", "utf8");
const app = readFileSync("src/App.jsx", "utf8");
const main = readFileSync("src/main.jsx", "utf8");
const css = readFileSync("src/styles.css", "utf8");
const gitlabCi = readFileSync(".gitlab-ci.yml", "utf8");
const viteConfig = readFileSync("vite.config.js", "utf8");
const legacyAssets = readFileSync("scripts/patch-legacy-assets.mjs", "utf8");
const wranglerConfig = readFileSync("wrangler.toml", "utf8");
const cloudflareHeaders = readFileSync("public/_headers", "utf8");

assert.equal(existsSync("src/data.js"), false, "baseline should not keep the old FastDAS data model");
assert.equal(existsSync("src/workbenchModel.js"), false, "baseline should not keep the old FastDAS workbench model");

assert.equal(pkg.name, "fastdas-growth-engine-demo", "package should identify the FastDAS repo");
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
assert.equal(main.includes('import "control-surface-ui/css"'), true, "app should keep the OIP/control-surface stylesheet");
assert.equal(main.includes('import("control-surface-ui")'), true, "app should hydrate OIP/control-surface primitives");

for (const requiredHook of [
  "data-fastdas-demo-app",
  "data-fastdas-baseline-app",
  "data-fastdas-shell-header",
  "data-fastdas-header-route",
  "data-fastdas-header-surface",
  "data-fastdas-header-utilities",
  "data-fastdas-profile-menu",
  "data-profile-menu-trigger",
  "data-profile-menu-surface",
  "data-profile-setting",
  "data-fastdas-baseline-canvas",
  "data-fastdas-release-rail",
  "data-fastdas-footer-status",
]) {
  assert.equal(app.includes(requiredHook), true, `baseline app should expose ${requiredHook}`);
}

for (const frameworkClass of [
  "if-main",
  "if-operations-app",
  "if-product-header",
  "if-product-header--sticky",
  "if-product-header--compact",
  "if-product-header--masthead",
  "if-product-header__inner",
  "if-product-header__brand",
  "if-operations-topnav",
  "if-operations-topnav__link",
  "if-account-menu",
  "if-avatar",
  "if-account-surface",
  "if-content",
  "if-page",
  "if-operations-workspace",
  "if-release-rail",
]) {
  assert.equal(app.includes(frameworkClass), true, `baseline shell should keep OIP class ${frameworkClass}`);
}

for (const baselineStyle of [
  ".fg-baseline-root",
  ".fg-baseline-content",
  ".fg-baseline-canvas",
  ".fg-baseline-footer",
]) {
  assert.equal(css.includes(baselineStyle), true, `baseline stylesheet should define ${baselineStyle}`);
}

for (const removedAppContract of [
  "from \"./data.js\"",
  "from \"./workbenchModel.js\"",
  "CommandCenterOipTable",
  "OpportunityGrid",
  "DataManagement",
  "CommandDock",
  "WorkflowStrip",
  "OperationalWorkflow",
  "GuidedDemoRunner",
  "WorkspaceRail",
  "WorkingSetRibbon",
  "PageHeader",
  "data-fastdas-simplified-shell",
  "data-fastdas-workspace-rail",
  "data-fastdas-working-set-ribbon",
  "data-fastdas-page-header",
  "data-fastdas-page-actions",
  "data-control-surface-nav",
  "data-fastdas-saved-views",
  "data-fastdas-metric-grid",
  "data-fastdas-command-filter-card",
  "data-fastdas-command-center-nav",
  "data-fastdas-grid-surface",
  "data-fastdas-workbench-surface",
  "data-fastdas-opportunity-grid",
  "data-fastdas-command-center-grid",
  "data-fastdas-open-details",
  "data-fastdas-expanded-record",
  "data-fastdas-provenance",
  "data-fastdas-human-approval-boundary",
  "data-fastdas-guided-demo-runner",
  "data-fastdas-guided-record",
  "data-fastdas-data-management",
  "data-fastdas-scenario-packs",
  "data-fastdas-management-area",
  "data-fastdas-operational-workflow",
  "data-fastdas-workflow-stage",
  "data-fastdas-audit-log",
  "data-fastdas-toast",
  "data-fastdas-command-dock",
  "data-fastdas-command-card",
  "data-fastdas-delivery-readiness",
]) {
  assert.equal(app.includes(removedAppContract), false, `baseline App.jsx should not include ${removedAppContract}`);
}

console.log("Verified FastDAS OIP baseline static contract.");
