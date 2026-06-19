# FastDAS Growth Engine Demo

Standalone React/Vite demo for the FastDAS Growth Engine control surface.

The app is built as an enterprise operations workbench, not a CRM. It covers the full signal-to-revenue workflow:

`Signal -> Enrichment -> Qualification -> Human Review -> Outreach -> Discovery Call -> Paid Assessment -> Report -> Follow-On Opportunity -> Closed Won`

## Control Surfaces

- Command Center
- Signal Intake and Source Registry
- Opportunity Workbench
- Evidence Review
- Outreach Queue
- Agent Operations
- Conversion Board

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

The repository includes `.gitlab-ci.yml`. GitLab Pages builds `dist/`, copies it to `public/`, and publishes it from the default branch.

After deployment, smoke-check the published site:

```bash
npm run verify:prod-smoke -- --url https://YOUR_NAMESPACE.gitlab.io/fastdas-growth-engine-demo/
```
