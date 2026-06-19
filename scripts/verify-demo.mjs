import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const html = readFileSync("index.html", "utf8");
const app = readFileSync("src/App.jsx", "utf8");
const data = readFileSync("src/data.js", "utf8");
const css = readFileSync("src/styles.css", "utf8");
const gitlabCi = readFileSync(".gitlab-ci.yml", "utf8");
const viteConfig = readFileSync("vite.config.js", "utf8");

assert.equal(pkg.name, "fastdas-growth-engine-demo", "package should identify the new repo");
assert.equal(html.includes("<title>FastDAS Growth Engine</title>"), true, "HTML title should identify FastDAS");
assert.equal(viteConfig.includes('base: "./"'), true, "Vite should use relative assets for GitLab Pages project paths");
assert.equal(gitlabCi.includes("pages:"), true, "GitLab Pages job should exist");
assert.equal(gitlabCi.includes("cp -r dist public"), true, "GitLab Pages should publish the Vite dist folder");

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
  "data-control-surface-nav",
  "data-fastdas-metric-grid",
  "data-fastdas-opportunity-grid",
  "data-fastdas-expanded-record",
  "data-fastdas-provenance",
  "data-fastdas-human-approval-boundary",
  "data-fastdas-data-management",
  "data-fastdas-scenario-packs",
  "data-fastdas-operational-workflow",
  "data-fastdas-workflow-stage",
  "data-fastdas-audit-log",
  "data-fastdas-toast",
]) {
  assert.equal(app.includes(hook), true, `app should expose ${hook}`);
}

for (const frameworkClass of [
  "if-shell",
  "if-sidebar",
  "if-topbar",
  "if-content",
  "if-page-header",
  "if-metric-grid",
  "if-card",
  "if-metric",
  "if-panel",
  "if-toolbar",
  "if-table",
  "if-btn",
  "if-badge",
  "if-icon-slot",
]) {
  assert.equal(app.includes(frameworkClass), true, `app should use Control Surface UI class ${frameworkClass}`);
}

assert.equal(app.includes("data-if-data-table"), true, "tables should expose Control Surface UI data-table behavior hooks");
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
  "Conversion Board",
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
]) {
  assert.equal(app.includes(actionHook), true, `demo should expose action hook ${actionHook}`);
}

assert.equal(css.includes("linear-gradient"), false, "demo CSS should avoid gradient-heavy UI surfaces");
assert.equal(css.includes(".fg-shell"), true, "demo CSS should define the FastDAS shell");

console.log("Verified FastDAS demo identity, routes, provenance hooks, synthetic data management, human gates, and GitLab Pages config.");
