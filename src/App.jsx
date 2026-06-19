import { Fragment, useEffect, useMemo, useState } from "react";
import { sidebarKpis, surfaces, workflowStages } from "./data.js";

function Icon({ name }) {
  return <span className="if-icon-slot fg-icon" data-if-icon={name} aria-hidden="true" />;
}

function getInitialSurfaceId() {
  const fromHash = window.location.hash.replace(/^#\/?/, "");
  return surfaces.some(surface => surface.id === fromHash) ? fromHash : surfaces[0].id;
}

function toneClass(tone = "neutral") {
  return `fg-tone-${tone}`;
}

function splitCell(value) {
  const [primary, secondary] = String(value).split("|");
  return { primary, secondary };
}

function MetricCard({ metric }) {
  const [label, value, change, meta, tone, icon] = metric;
  return (
    <article className={`if-card if-metric fg-card fg-metric ${toneClass(tone)}`}>
      <div className="if-metric__top fg-metric__top">
        <span className="if-metric__icon fg-metric__icon"><Icon name={icon} /></span>
        <p className="if-metric__label fg-metric__label">{label}</p>
      </div>
      <div className="if-metric__main fg-metric__main">
        <p className="if-metric__value fg-metric__value">{value}</p>
      </div>
      <span className="if-metric__change fg-metric__change">{change}</span>
      <div className="if-metric__meta fg-metric__meta"><span>{meta}</span></div>
    </article>
  );
}

function Chip({ children, tone = "neutral" }) {
  const ifTone = {
    blue: "if-badge--info",
    success: "if-badge--status-approved",
    warning: "if-badge--warning",
    danger: "if-badge--danger",
    purple: "if-badge--status-in-review",
    neutral: "",
  }[tone] || "";
  return <span className={`if-badge fg-chip ${ifTone} ${toneClass(tone)}`}>{children}</span>;
}

function toneForValue(value) {
  const text = String(value).toLowerCase();
  if (text.includes("risk") || text.includes("radio") || text.includes("reject") || text.includes("stop")) return "danger";
  if (text.includes("review") || text.includes("approval") || text.includes("warning") || text.includes("hold") || text.includes("needs")) return "warning";
  if (text.includes("healthy") || text.includes("ready") || text.includes("clean") || text.includes("pass") || text.includes("low")) return "success";
  if (text.includes("agent") || text.includes("human") || text.includes("follow")) return "purple";
  if (text.includes("source") || text.includes("benchmark") || text.includes("health") || text.includes("current")) return "blue";
  return "neutral";
}

function ScoreCell({ value }) {
  const score = Number(value);
  if (!Number.isFinite(score)) return <span>{value}</span>;
  return (
    <div className="fg-score">
      <span>{score}</span>
      <div className="if-source-signal__bar fg-scorebar" aria-hidden="true"><i style={{ width: `${Math.min(100, score)}%` }} /></div>
    </div>
  );
}

function TableCell({ value, column }) {
  const { primary, secondary } = splitCell(value);
  if (["Score", "Trust", "Confidence"].includes(column) && Number.isFinite(Number(primary))) {
    return <ScoreCell value={primary} />;
  }
  if (["State", "Status", "Risk", "First Offer", "Recommended First Offer", "Use in Outreach?", "Assessment", "Conversation"].includes(column)) {
    return <Chip tone={toneForValue(primary)}>{primary}</Chip>;
  }
  return (
    <span className="fg-cell-text">
      <strong>{primary}</strong>
      {secondary ? <small>{secondary}</small> : null}
    </span>
  );
}

function SourceCards({ cards = [] }) {
  if (!cards.length) return null;
  return (
    <section className="fg-source-grid" aria-label="Signal source lanes">
      {cards.map(([title, status, body]) => (
        <article className="if-card if-source-card fg-source-card" key={title}>
          <div className="fg-source-card__top">
            <span className="if-source-card__icon fg-source-card__mark">{title.slice(0, 1)}</span>
            <div>
              <h3>{title}</h3>
              <Chip tone={toneForValue(status)}>{status}</Chip>
            </div>
          </div>
          <p>{body}</p>
        </article>
      ))}
    </section>
  );
}

function ExpandedRecord({ surface }) {
  const detail = surface.expanded;
  return (
    <tr className="fg-expanded-row">
      <td colSpan={surface.table.columns.length}>
        <div className="fg-expanded" data-fastdas-expanded-record>
          <section className="fg-expanded__section">
            <div className="fg-eyebrow">Selected Record</div>
            <h3>{detail.title}</h3>
            <p>{detail.description}</p>
            <div className="fg-flow" aria-label="Workflow state">
              {detail.gates.map((gate, index) => (
                <span className={index < Math.max(1, detail.gates.length - 3) ? "is-complete" : index === Math.max(1, detail.gates.length - 3) ? "is-active" : ""} key={gate}>
                  {gate}
                </span>
              ))}
            </div>
          </section>
          <section className="fg-expanded__section" data-fastdas-provenance>
            <div className="fg-eyebrow">Evidence + Provenance</div>
            {detail.evidence.map(([title, badge, text]) => (
              <article className="if-evidence-panel fg-evidence" key={title}>
                <div>
                  <strong>{title}</strong>
                  <Chip tone={toneForValue(badge)}>{badge}</Chip>
                </div>
                <p>{text}</p>
              </article>
            ))}
          </section>
          <section className="fg-expanded__section" data-fastdas-human-approval-boundary>
            <div className="fg-eyebrow">Operator Workbench</div>
            <div className="if-alert if-alert--info fg-callout">
              <strong>First paid step:</strong> Keep the ask bounded to survey, inspection, benchmark, testing engagement, troubleshooting visit, or system review.
            </div>
            <div className="fg-action-list">
              {detail.actions.map(action => (
                <div className="if-card fg-action-card" key={action}>{action}</div>
              ))}
            </div>
            <div className="fg-action-row">
              <button type="button" className="if-btn if-btn--success fg-btn fg-btn--primary"><Icon name="check" />Approve</button>
              <button type="button" className="if-btn if-btn--secondary fg-btn"><Icon name="edit" />Edit</button>
              <button type="button" className="if-btn if-btn--secondary fg-btn"><Icon name="users" />Assign</button>
              <button type="button" className="if-btn if-btn--danger fg-btn fg-btn--danger"><Icon name="x" />Hold</button>
            </div>
          </section>
        </div>
      </td>
    </tr>
  );
}

function OpportunityGrid({ surface, selectedRowId, onSelect }) {
  const columns = surface.table.columns;
  return (
    <section className="if-panel fg-panel" data-fastdas-opportunity-grid data-if-data-table>
      <div className="if-panel__header fg-panel__header">
        <div>
          <h2>{surface.title === "Command Center" ? "Top Opportunities" : surface.title}</h2>
          <p>{surface.table.count}. Selected records expand inline for evidence, provenance, scoring, actions, and approval gates.</p>
        </div>
        <div className="fg-panel__header-actions">
          <Chip tone="blue">Selected: {surface.selected}</Chip>
          <Chip tone="warning">Human approval</Chip>
        </div>
      </div>
      <div className="if-toolbar fg-command-band">
        <span className="fg-counter">{surface.table.count}</span>
        {surface.filters.map(filter => <button className="if-btn if-btn--secondary if-btn--sm fg-filter" type="button" key={filter}>{filter}</button>)}
        <span className="fg-command-band__spacer" />
        <button className="if-btn if-btn--secondary fg-btn" type="button"><Icon name="columns" />Columns</button>
        <button className="if-btn if-btn--primary fg-btn fg-btn--primary" type="button"><Icon name="arrowUp" />{surface.primaryAction}</button>
      </div>
      <div className="if-table-scroll fg-table-wrap">
        <table className="if-table fg-table">
          <thead>
            <tr>{columns.map(column => <th key={column}>{column}</th>)}</tr>
          </thead>
          <tbody>
            {surface.table.rows.map(row => (
              <Fragment key={row.id}>
                <tr
                  className={row.id === selectedRowId ? "is-selected" : ""}
                  data-if-table-row
                  onClick={() => onSelect(row.id)}
                >
                  {row.cells.map((cell, index) => (
                    <td key={`${row.id}-${columns[index]}`}>
                      <TableCell value={cell} column={columns[index]} />
                    </td>
                  ))}
                </tr>
                {row.id === selectedRowId ? <ExpandedRecord key={`${row.id}-expanded`} surface={surface} /> : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DataManagement({ management }) {
  if (!management) return null;

  return (
    <section className="if-stack fg-management" data-fastdas-data-management>
      <div className="if-panel fg-management__control">
        <div>
          <div className="fg-eyebrow">Demo Data Control Plane</div>
          <h2>Synthetic Dataset Operations</h2>
          <p>Control the seed, scenario mix, validation gates, and export/reset behavior that make the demo repeatable and customer-safe.</p>
        </div>
        <div className="fg-management__actions">
          <button className="if-btn if-btn--primary fg-btn fg-btn--primary" type="button"><Icon name="refresh" />Generate Variant</button>
          <button className="if-btn if-btn--secondary fg-btn" type="button"><Icon name="download" />Export Bundle</button>
          <button className="if-btn if-btn--danger fg-btn fg-btn--danger" type="button"><Icon name="rotate" />Reset Demo</button>
        </div>
      </div>

      <div className="fg-management__control-grid">
        {management.controls.map(([label, value, body]) => (
          <article className="if-card fg-management-control-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <p>{body}</p>
          </article>
        ))}
      </div>

      <div className="fg-management-grid">
        {management.areas.map(area => (
          <article className="if-card fg-management-card" key={area.title}>
            <div className="fg-management-card__top">
              <div>
                <h3>{area.title}</h3>
                <p>{area.body}</p>
              </div>
              <Chip tone={toneForValue(area.status)}>{area.status}</Chip>
            </div>
            <div className="fg-management-card__meta">
              <span><strong>{area.count}</strong> Records / gates</span>
              <span><strong>{area.owner}</strong> Owner</span>
            </div>
            <ul>
              {area.checks.map(check => <li key={check}>{check}</li>)}
            </ul>
          </article>
        ))}
      </div>

      <section className="if-panel fg-scenario-panel" data-fastdas-scenario-packs>
        <div className="if-panel__header fg-panel__header">
          <div>
            <h2>Scenario Packs</h2>
            <p>Switchable synthetic narratives for customer-specific walkthroughs while keeping the same operating model.</p>
          </div>
          <Chip tone="blue">4 packs ready</Chip>
        </div>
        <div className="fg-scenario-grid">
          {management.scenarioPacks.map(([title, body, count]) => (
            <article className="if-card fg-scenario-card" key={title}>
              <strong>{title}</strong>
              <p>{body}</p>
              <Chip tone={toneForValue(count)}>{count}</Chip>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function WorkflowStrip() {
  return (
    <section className="fg-workflow" aria-label="FastDAS lifecycle">
      {workflowStages.map((stage, index) => (
        <span key={stage} className={index < 4 ? "is-complete" : index === 4 ? "is-active" : ""}>
          {stage}
        </span>
      ))}
    </section>
  );
}

function BottomPanels({ surface }) {
  const panels = {
    "command-center": [
      ["Active Signal Lanes", ["Construction / Closeout: 42 captured / 12 high score", "Existing Building Risk: 33 captured / 9 health-check fits", "Partner Ecosystem: 27 captured / 6 warm paths"]],
      ["Human Decision Boundary", ["First outbound message", "Technical claims and pricing language", "Discovery scheduling and handoff"]],
      ["30-Day Measurement", ["150-250 candidate leads identified", "30-50 high-score outreach targets", "5-10 qualified conversations", "1-3 paid assessment candidates"]],
    ],
    "outreach-queue": [
      ["Reply Triage", ["2 positive replies", "3 referral replies", "Route to discovery scheduling"]],
      ["Message Library", ["Property manager benchmark", "General contractor closeout risk", "Fire alarm partner referral", "Facilities health check"]],
      ["Human Boundary", ["First-touch approval", "Technical questions", "Pricing and scope", "Discovery and closing"]],
    ],
    "agent-operations": [
      ["Offshore Work Packets", ["Verify 20 property manager contacts", "Enrich fire alarm partner list", "Clean duplicate building records"]],
      ["MVP Tech Stack", ["OpenClaw or Hermes Agent orchestration", "OpenAI/Azure OpenAI reasoning", "Airtable, HubSpot, Sheets, or PostgreSQL tracker"]],
      ["Exception Rules", ["Source confidence below .65", "Duplicate risk above 10%", "Generated technical language"]],
    ],
    "synthetic-data": [
      ["Data Stewardship", ["Golden seed is versioned", "Scenario packs are customer-safe", "Exports omit private payloads"]],
      ["Management Actions", ["Generate variant", "Export dataset bundle", "Reset golden demo state"]],
      ["Quality Gates", ["No real contacts", "No unsupported claims", "Every score has evidence"]],
    ],
    "conversion-board": [
      ["First Offer Performance", ["Radio testing: high fit", "Cellular benchmark: high fit", "Health check: medium fit"]],
      ["Segment Learning", ["Garages and senior living show strong pain-to-offer match", "Hotels need careful complaint validation", "Partner path reduces cold-start friction"]],
      ["Next Experiments", ["Portfolio risk screen", "Fire alarm contractor referral kit", "Closeout-risk outreach by project phase"]],
    ],
  };
  const activePanels = panels[surface.id] || [
    ["State Model", ["Captured -> Enriched -> Scored -> Review -> Outreach -> Discovery -> Assessment"]],
    ["Assignment Rules", ["Score 80+ goes to Adam review", "Missing contact goes to offshore research", "Technical/pricing goes to Farzin"]],
    ["Quality Gates", ["No source, no score promotion", "No first-touch send without human approval", "Confidence below .65 requires review"]],
  ];

  return (
    <section className="fg-bottom-grid">
      {activePanels.map(([title, items]) => (
        <article className="if-panel fg-panel fg-panel--compact" key={title}>
          <div className="if-panel__header fg-panel__header"><h2>{title}</h2></div>
          <div className="if-panel__body fg-panel__body">
            <ul>
              {items.map(item => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </article>
      ))}
    </section>
  );
}

export default function App() {
  const [activeSurfaceId, setActiveSurfaceId] = useState(getInitialSurfaceId);
  const [selectedRows, setSelectedRows] = useState(() => Object.fromEntries(surfaces.map(surface => [surface.id, surface.selected])));

  useEffect(() => {
    const onHashChange = () => setActiveSurfaceId(getInitialSurfaceId());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const surface = useMemo(
    () => surfaces.find(item => item.id === activeSurfaceId) || surfaces[0],
    [activeSurfaceId],
  );

  const setSurface = id => {
    setActiveSurfaceId(id);
    window.location.hash = `/${id}`;
  };

  return (
    <div className="if-shell if-operations-app if-operations-app--wide fg-root fg-shell" data-theme="light" data-density="compact" data-fastdas-demo-app>
      <aside className="if-sidebar fg-sidebar">
        <div className="if-brand fg-brand">
          <div className="if-brand__mark fg-brand__mark">FD</div>
          <div>
            <strong>FastDAS Growth Engine</strong>
            <span>Control Surface</span>
          </div>
        </div>
        <nav className="if-sidebar__nav fg-nav" data-control-surface-nav aria-label="Workspace navigation">
          <div className="if-sidebar__title fg-nav__heading">Workspace</div>
          {surfaces.map(item => (
            <button
              type="button"
              className={`if-sidebar__link ${item.id === surface.id ? "is-active" : ""}`}
              key={item.id}
              onClick={() => setSurface(item.id)}
            >
              <span />
              {item.nav}
            </button>
          ))}
        </nav>
        <div className="if-sidebar__nav fg-nav fg-nav--saved">
          <div className="if-sidebar__title fg-nav__heading">Saved Views</div>
          {["Score 80+ / Review", "Closeout Signals", "Paid Assessment Fit", "Partner Paths"].map(view => (
            <button className="if-sidebar__link" type="button" key={view}><span />{view}</button>
          ))}
        </div>
        <div className="fg-sidebar-kpis">
          {sidebarKpis.map(([value, label]) => (
            <div key={label}><strong>{value}</strong><span>{label}</span></div>
          ))}
        </div>
        <div className="fg-sidebar-note">
          <strong>Automation Boundary</strong>
          Agents and offshore support can find, enrich, score, draft, and queue. Humans approve outreach, technical claims, pricing, discovery, and close strategy.
        </div>
      </aside>

      <main className="if-main fg-main">
        <header className="if-topbar fg-topbar">
          <div className="if-search if-utility-search fg-search"><Icon name="search" />Global search: property, signal, owner, contact, source...</div>
          <Chip tone="blue">VA / MD / DC</Chip>
          <Chip tone="success">Source tracking on</Chip>
          <Chip tone="warning">7 human approvals due</Chip>
          <span className="fg-topbar__spacer" />
          <button className="if-btn if-btn--secondary fg-btn" type="button"><Icon name="save" />Save View</button>
          <button className="if-btn if-btn--primary fg-btn fg-btn--primary" type="button"><Icon name="refresh" />Run Signal Scan</button>
          <div className="fg-user"><span>AB</span>Growth Operator</div>
        </header>

        <section className="if-content if-page fg-content">
          <header className="if-page-header fg-page-header">
            <div>
              <div className="fg-eyebrow">{surface.eyebrow}</div>
              <h1>{surface.title}</h1>
              <p>{surface.summary}</p>
            </div>
            <div className="fg-page-actions">
              <button className="if-btn if-btn--secondary fg-btn" type="button"><Icon name="rotate" />Reset Filters</button>
              <button className="if-btn if-btn--secondary fg-btn" type="button"><Icon name="download" />Export</button>
              <button className="if-btn if-btn--primary fg-btn fg-btn--primary" type="button"><Icon name="check" />{surface.primaryAction}</button>
            </div>
          </header>

          <WorkflowStrip />

          <section className="if-metric-grid fg-metric-grid" data-fastdas-metric-grid>
            {surface.metrics.map(metric => <MetricCard key={metric[0]} metric={metric} />)}
          </section>

          <SourceCards cards={surface.sourceCards} />

          <DataManagement management={surface.management} />

          <OpportunityGrid
            surface={surface}
            selectedRowId={selectedRows[surface.id]}
            onSelect={rowId => setSelectedRows(current => ({ ...current, [surface.id]: rowId }))}
          />

          <BottomPanels surface={surface} />

          <footer className="fg-footer">
            FastDAS Growth Engine / {surface.title} / Control-surface UI demo / GitLab Pages ready
          </footer>
        </section>
      </main>
    </div>
  );
}
