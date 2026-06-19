# FastDAS Growth Engine Demo

Standalone React/Vite demo for the FastDAS Growth Engine control surface.

Canonical source: <https://github.com/anboas/fastdas-growth-engine-demo>

Hosted demo: <https://anboas.gitlab.io/fastdas-growth-engine-demo/>

The app is built as an enterprise operations workbench, not a CRM. It covers the full signal-to-revenue workflow:

`Signal -> Enrichment -> Qualification -> Human Review -> Outreach -> Discovery Call -> Paid Assessment -> Report -> Follow-On Opportunity -> Closed Won`

## Control Surfaces

- Command Center
- Signal Intake and Source Registry
- Opportunity Workbench
- Evidence Review
- Outreach Queue
- Agent Operations
- Synthetic Data Management
- Conversion Board

## Synthetic Demo Data

The `Synthetic Data Management` surface exposes the demo's customer-safe data control plane:

- Golden seed and dataset version controls
- Scenario packs for closeout, portfolio, hospitality, and maintenance walkthroughs
- Managed datasets for opportunities, sources, outreach, agents, and conversion learning
- Quality gates for source safety, technical-claim safety, and repeatable reset/export behavior

## Operational Workflow

The demo is browser-local but operational. It keeps the golden synthetic dataset immutable and layers a runtime control state over it:

- `Run Signal Scan` advances the lifecycle to Signal Intake, increments run counters, and writes an audit event
- Page-level primary actions move records across review, outreach, agent, conversion, and learning states
- Inline expanded-row actions approve, edit, assign, or hold selected records with visible audit feedback
- Synthetic data actions generate scenario variants, stage export bundles, and reset back to the golden seed
- The runtime panel shows active workflow stage, seed, scenario, approval count, signal runs, generated variants, exports, and the latest audit trail

## Local Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm run verify:all
```

## GitLab Pages

GitHub is the canonical repository. GitLab is used as the Pages hosting target.

Local remotes are expected to be:

```bash
origin        https://github.com/anboas/fastdas-growth-engine-demo.git
gitlab-pages  https://gitlab.com/anboas/fastdas-growth-engine-demo.git
```

The GitLab Pages target includes `.gitlab-ci.yml`. GitLab builds `dist/`, copies it to `public/`, and publishes it from the default branch.

After deployment, smoke-check the published site:

```bash
npm run verify:prod-smoke -- --url https://YOUR_NAMESPACE.gitlab.io/fastdas-growth-engine-demo/
```

<!-- pages refresh 2026-06-19T16:11:02Z -->
