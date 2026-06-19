import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
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

function signalIdForLabel(label) {
  return String(label || "signal").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const BASE_EVENTS = [
  {
    id: "evt-golden-load",
    time: "09:34",
    tone: "success",
    title: "Golden demo loaded",
    body: "Customer-safe synthetic records, source registry, outreach queue, and conversion board are aligned to FD-GE-DEMO-0619.",
  },
  {
    id: "evt-evidence-ready",
    time: "09:36",
    tone: "blue",
    title: "Evidence packets staged",
    body: "112 evidence packets are linked to scoring, provenance, stakeholder paths, and first-offer recommendations.",
  },
  {
    id: "evt-human-gate",
    time: "09:39",
    tone: "warning",
    title: "Human review gate active",
    body: "Outbound, pricing, technical claims, and close strategy require operator approval.",
  },
];

const INITIAL_OPERATION_STATE = {
  workflowIndex: 3,
  activeSeed: "FD-GE-DEMO-0619",
  scenarioMode: "Balanced pipeline",
  operatorMode: "Live Walkthrough",
  datasetVersion: "2026.06.19-a",
  resetTarget: "Golden demo state",
  variantCount: 0,
  exportCount: 0,
  signalRuns: 12,
  approvalCount: 7,
  generatedRecords: 485,
  lastAction: "Ready for operator approval",
  toast: null,
  events: BASE_EVENTS,
};

const SCENARIO_SEQUENCE = [
  "Closeout Sprint",
  "Property Portfolio",
  "Hospitality Coverage",
  "Maintenance Wedge",
  "Balanced pipeline",
];

const OPERATOR_MODES = ["Live Walkthrough", "Synthetic Variant", "Customer Review"];

const PRIMARY_ACTIONS = {
  "command-center": {
    title: "Next best action approved",
    body: "Capital Ridge advanced from Human Review into the human-gated outreach queue.",
    workflowIndex: 4,
    tone: "success",
    surfaceId: "outreach-queue",
    updates: state => ({ approvalCount: Math.max(0, state.approvalCount - 1) }),
  },
  "signal-intake": {
    title: "Selected source run completed",
    body: "Arlington permit monitor refreshed, parser warning retained, and 6 records routed to enrichment.",
    workflowIndex: 1,
    tone: "blue",
    updates: state => ({ signalRuns: state.signalRuns + 1, generatedRecords: state.generatedRecords + 6 }),
  },
  "opportunity-workbench": {
    title: "Opportunity promoted to review",
    body: "HarborPoint Garage moved into Human Review with source notes and contact verification gates attached.",
    workflowIndex: 3,
    tone: "warning",
    surfaceId: "evidence-review",
  },
  "evidence-review": {
    title: "Outreach draft approved",
    body: "Evidence passed source safety, technical safety, and first-offer fit checks before outreach.",
    workflowIndex: 4,
    tone: "success",
    surfaceId: "outreach-queue",
    updates: state => ({ approvalCount: Math.max(0, state.approvalCount - 1) }),
  },
  "outreach-queue": {
    title: "Selected outreach approved",
    body: "PM benchmark draft released to approved-send state and follow-up cadence was scheduled.",
    workflowIndex: 4,
    tone: "success",
    updates: state => ({ approvalCount: Math.max(0, state.approvalCount - 1) }),
  },
  "agent-operations": {
    title: "Agent workflow replayed",
    body: "Permit Monitor Agent completed a replay run, produced 18 signals, and created 3 offshore verification tasks.",
    workflowIndex: 1,
    tone: "blue",
    updates: state => ({ signalRuns: state.signalRuns + 1, generatedRecords: state.generatedRecords + 18 }),
  },
  "synthetic-data": {
    title: "Generated demo variant",
    body: "Scenario-safe synthetic variant created with the same evidence, scoring, and workflow contracts.",
    workflowIndex: 2,
    tone: "purple",
  },
  "conversion-board": {
    title: "Outcome logged",
    body: "Assessment candidate outcome captured and learning loop queued for scoring calibration.",
    workflowIndex: 8,
    tone: "success",
  },
};

function currentTimeLabel() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function createEvent(title, body, tone = "blue") {
  return {
    id: `${Date.now()}-${title}`,
    time: currentTimeLabel(),
    title,
    body,
    tone,
  };
}

function appendEvent(state, { title, body, tone = "blue", workflowIndex, updates = {} }) {
  const patch = typeof updates === "function" ? updates(state) : updates;
  return {
    ...state,
    ...patch,
    workflowIndex: workflowIndex ?? state.workflowIndex,
    lastAction: title,
    toast: { title, body, tone },
    events: [createEvent(title, body, tone), ...state.events].slice(0, 8),
  };
}

function MetricCard({ metric, selected = false }) {
  const [label, value, change, meta, tone, icon] = metric;
  const signalId = signalIdForLabel(label);
  return (
    <button
      type="button"
      className={`if-card if-metric if-operations-signal fg-card fg-metric ${selected ? "is-selected" : ""} ${toneClass(tone)}`}
      data-if-operations-signal={signalId}
      data-if-operations-label={label}
      data-if-operations-focus-panel={signalId}
      aria-pressed={selected}
    >
      <div className="if-metric__top fg-metric__top">
        <span className="if-metric__icon fg-metric__icon"><Icon name={icon} /></span>
        <p className="if-metric__label fg-metric__label">{label}</p>
      </div>
      <div className="if-metric__main fg-metric__main">
        <p className="if-metric__value fg-metric__value">{value}</p>
      </div>
      <span className="if-metric__change fg-metric__change">{change}</span>
      <div className="if-metric__meta fg-metric__meta"><span>{meta}</span></div>
    </button>
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
    <div className="if-table-progress if-table-progress--success fg-score">
      <span>{score}</span>
      <div className="if-table-progress__track if-source-signal__bar fg-scorebar" aria-hidden="true"><span style={{ width: `${Math.min(100, score)}%` }} /></div>
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
    <span className="if-table-cell-main fg-cell-text">
      <strong>{primary}</strong>
      {secondary ? <small className="if-table-cell-meta">{secondary}</small> : null}
    </span>
  );
}

function SourceCards({ cards = [] }) {
  if (!cards.length) return null;
  return (
    <section className="if-operations-section-grid fg-source-grid" aria-label="Signal source lanes">
      {cards.map(([title, status, body]) => (
        <article className="if-card if-source-card if-operations-section fg-source-card" key={title}>
          <div className="fg-source-card__top">
            <span className="if-source-card__icon fg-source-card__mark">{title.slice(0, 1)}</span>
            <div>
              <h3 className="if-card__title">{title}</h3>
              <Chip tone={toneForValue(status)}>{status}</Chip>
            </div>
          </div>
          <p>{body}</p>
        </article>
      ))}
    </section>
  );
}

function ExpandedRecord({ surface, onRecordAction }) {
  const detail = surface.expanded;
  return (
    <tr className="if-table-detail is-expanded fg-expanded-row" data-if-table-detail>
      <td colSpan={surface.table.columns.length}>
        <div className="if-table-detail__content fg-expanded" data-fastdas-expanded-record>
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
              <article className="if-evidence-panel if-provenance-layer fg-evidence" key={title}>
                <div>
                  <strong>{title}</strong>
                  <span className={`if-source-badge if-source-badge--${toneForValue(badge) === "success" ? "system" : toneForValue(badge) === "blue" ? "derived" : toneForValue(badge) === "warning" ? "manual" : "compact"} fg-chip ${toneClass(toneForValue(badge))}`}>{badge}</span>
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
              <button
                type="button"
                className="if-btn if-btn--success fg-btn fg-btn--primary"
                data-fastdas-action="approve-record"
                onClick={() => onRecordAction("approve", surface)}
              >
                <Icon name="check" />Approve
              </button>
              <button
                type="button"
                className="if-btn if-btn--secondary fg-btn"
                data-fastdas-action="edit-record"
                onClick={() => onRecordAction("edit", surface)}
              >
                <Icon name="edit" />Edit
              </button>
              <button
                type="button"
                className="if-btn if-btn--secondary fg-btn"
                data-fastdas-action="assign-record"
                onClick={() => onRecordAction("assign", surface)}
              >
                <Icon name="users" />Assign
              </button>
              <button
                type="button"
                className="if-btn if-btn--danger fg-btn fg-btn--danger"
                data-fastdas-action="hold-record"
                onClick={() => onRecordAction("hold", surface)}
              >
                <Icon name="x" />Hold
              </button>
            </div>
          </section>
        </div>
      </td>
    </tr>
  );
}

function OpportunityGrid({ surface, selectedRowId, onSelect, onPrimaryAction, onUtilityAction, onRecordAction }) {
  const columns = surface.table.columns;
  return (
    <section className="if-panel if-data-table if-table-shell fg-panel" data-fastdas-opportunity-grid data-if-data-table data-if-table-density="compact">
      <div className="if-panel__header fg-panel__header">
        <div>
          <h2 className="if-panel__title">{surface.title === "Command Center" ? "Top Opportunities" : surface.title}</h2>
          <p className="if-panel__subtitle">{surface.table.count}. Selected records expand inline for evidence, provenance, scoring, actions, and approval gates.</p>
        </div>
        <div className="fg-panel__header-actions">
          <Chip tone="blue">Selected: {surface.selected}</Chip>
          <Chip tone="warning">Human approval</Chip>
        </div>
      </div>
      <div className="if-table-command-band if-toolbar fg-command-band">
        <div className="if-table-command-band__leading fg-command-band__leading">
          <label className="if-search fg-table-search">
            <Icon name="search" />
            <input
              className="if-input"
              type="search"
              data-if-table-filter
              placeholder="Search records, owners, sources..."
              aria-label="Search current table"
            />
          </label>
          <span className="if-badge fg-counter"><strong data-if-table-status="filtered">{surface.table.rows.length}</strong> visible</span>
          <span className="if-badge fg-counter"><strong data-if-table-status="selected">0</strong> selected</span>
        </div>
        <div className="if-table-command-band__filters fg-command-band__filters">
          {surface.filters.map(filter => (
            <button
              className="if-btn if-btn--secondary if-btn--sm fg-filter"
              type="button"
              key={filter}
              onClick={() => onUtilityAction("Filter staged", `${filter} is now staged for the customer demo view.`, "blue")}
            >
              {filter}
            </button>
          ))}
        </div>
        <div className="if-table-command-band__actions if-toolbar__group fg-command-band__actions">
          <button
            className="if-btn if-btn--secondary fg-btn"
            type="button"
            data-if-table-clear
            onClick={(event) => {
              const control = event.currentTarget;
              import("control-surface-ui").then(({ clearDataTableFilters }) => clearDataTableFilters(control));
            }}
          >
            <Icon name="rotate" />Clear
          </button>
          <button
            className="if-btn if-btn--secondary fg-btn"
            type="button"
            onClick={() => onUtilityAction("Column layout saved", "Decision-view columns are locked for this walkthrough.", "blue")}
          >
            <Icon name="columns" />Columns
          </button>
          <button
            className="if-btn if-btn--primary fg-btn fg-btn--primary"
            type="button"
            data-fastdas-action="grid-primary"
            onClick={() => onPrimaryAction(surface.id)}
          >
            <Icon name="arrowUp" />{surface.primaryAction}
          </button>
        </div>
      </div>
      <div className="if-table-wrap if-table-scroll fg-table-wrap">
        <table className="if-table if-table--sticky if-table--public-records if-table--dense fg-table">
          <thead>
            <tr>{columns.map((column, index) => <th key={column} data-if-table-width={index === 1 ? "16rem" : undefined}>{column}</th>)}</tr>
          </thead>
          <tbody>
            {surface.table.rows.map(row => (
              <Fragment key={row.id}>
                <tr
                  className={row.id === selectedRowId ? "is-selected" : ""}
                  data-if-table-row
                  data-if-table-expanded={row.id === selectedRowId ? "true" : "false"}
                  data-if-table-search={row.cells.join(" ")}
                  onClick={() => onSelect(row.id)}
                >
                  {row.cells.map((cell, index) => (
                    <td key={`${row.id}-${columns[index]}`} data-if-table-cell={columns[index].toLowerCase().replace(/[^a-z0-9]+/g, "-")}>
                      {index === 0 ? (
                        <span className="if-table-actions fg-table-record-cell">
                          <button
                            className="if-icon-btn fg-expand-btn"
                            type="button"
                            data-if-table-expand
                            aria-expanded={row.id === selectedRowId}
                            aria-label={`Toggle ${splitCell(cell).primary}`}
                            onClick={() => onSelect(row.id)}
                          >
                            <Icon name="chevronDown" />
                          </button>
                          <TableCell value={cell} column={columns[index]} />
                        </span>
                      ) : <TableCell value={cell} column={columns[index]} />}
                    </td>
                  ))}
                </tr>
                {row.id === selectedRowId ? <ExpandedRecord key={`${row.id}-expanded`} surface={surface} onRecordAction={onRecordAction} /> : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DataManagement({ management, operationState, onSyntheticAction }) {
  if (!management) return null;

  const valueOverrides = {
    "Active seed": operationState.activeSeed,
    "Scenario mode": operationState.scenarioMode,
    "Dataset version": operationState.datasetVersion,
    "Reset target": operationState.resetTarget,
  };

  return (
    <section className="if-stack fg-management" data-fastdas-data-management>
      <div className="if-panel if-operations-section fg-management__control">
        <div>
          <div className="fg-eyebrow">Demo Data Control Plane</div>
          <h2 className="if-panel__title">Synthetic Dataset Operations</h2>
          <p className="if-panel__subtitle">Control the seed, scenario mix, validation gates, and export/reset behavior that make the demo repeatable and customer-safe.</p>
        </div>
        <div className="fg-management__actions">
          <button
            className="if-btn if-btn--primary fg-btn fg-btn--primary"
            type="button"
            data-fastdas-action="generate-variant"
            onClick={() => onSyntheticAction("variant")}
          >
            <Icon name="refresh" />Generate Variant
          </button>
          <button
            className="if-btn if-btn--secondary fg-btn"
            type="button"
            data-fastdas-action="export-bundle"
            onClick={() => onSyntheticAction("export")}
          >
            <Icon name="download" />Export Bundle
          </button>
          <button
            className="if-btn if-btn--danger fg-btn fg-btn--danger"
            type="button"
            data-fastdas-action="reset-demo"
            onClick={() => onSyntheticAction("reset")}
          >
            <Icon name="rotate" />Reset Demo
          </button>
        </div>
      </div>

      <div className="fg-management__control-grid">
        {management.controls.map(([label, value, body]) => (
          <article className="if-card fg-management-control-card" key={label}>
            <span>{label}</span>
            <strong>{valueOverrides[label] || value}</strong>
            <p>{body}</p>
          </article>
        ))}
      </div>

      <div className="fg-management-grid">
        {management.areas.map(area => (
          <article className="if-card if-operations-section fg-management-card" key={area.title}>
            <div className="fg-management-card__top">
              <div>
                <h3 className="if-card__title">{area.title}</h3>
                <p className="if-panel__subtitle">{area.body}</p>
              </div>
              <Chip tone={toneForValue(area.status)}>{area.status}</Chip>
            </div>
            <div className="if-provenance-grid fg-management-card__meta">
              <span className="if-provenance-field"><strong className="if-provenance-field__value">{area.count}</strong> Records / gates</span>
              <span className="if-provenance-field"><strong className="if-provenance-field__value">{area.owner}</strong> Owner</span>
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
            <h2 className="if-panel__title">Scenario Packs</h2>
            <p className="if-panel__subtitle">Switchable synthetic narratives for customer-specific walkthroughs while keeping the same operating model.</p>
          </div>
          <Chip tone="blue">4 packs ready</Chip>
        </div>
        <div className="fg-scenario-grid">
          {management.scenarioPacks.map(([title, body, count]) => (
            <article className="if-card fg-scenario-card" key={title}>
              <strong className="if-card__title">{title}</strong>
              <p>{body}</p>
              <Chip tone={toneForValue(count)}>{count}</Chip>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function OperationsSignalPanels({ metrics = [] }) {
  if (!metrics.length) return null;
  return (
    <section className="if-operations-panel-shell fg-signal-panels" aria-label="Metric drilldown panels">
      {metrics.map(([label, value, change, meta, tone], index) => {
        const signalId = signalIdForLabel(label);
        return (
          <article
            className="if-operations-panel fg-signal-panel"
            data-if-operations-panel={signalId}
            key={label}
            hidden={index !== 0}
          >
            <div className="if-operations-panel__header">
              <div>
                <h2 className="if-panel__title">{label} Drilldown</h2>
                <p className="if-panel__subtitle">Current selected signal: <strong data-if-operations-current-label>{metrics[0][0]}</strong>.</p>
              </div>
              <button className="if-btn if-btn--secondary if-btn--sm fg-btn" type="button" data-if-operations-reset>
                Clear signal
              </button>
            </div>
            <div className="if-operations-summary-grid fg-signal-panel__summary">
              <div className="if-operations-insight"><span>Value</span><strong>{value}</strong></div>
              <div className="if-operations-insight"><span>Movement</span><strong>{change}</strong></div>
              <div className="if-operations-insight"><span>Operator Meaning</span><strong>{meta}</strong></div>
              <div className="if-operations-insight"><span>Review Lane</span><strong>{tone === "danger" ? "High attention" : tone === "warning" ? "Operator review" : "Normal flow"}</strong></div>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function WorkflowStrip({ activeIndex }) {
  return (
    <section className="fg-workflow" aria-label="FastDAS lifecycle">
      {workflowStages.map((stage, index) => (
        <span key={stage} className={index < activeIndex ? "is-complete" : index === activeIndex ? "is-active" : ""}>
          {stage}
        </span>
      ))}
    </section>
  );
}

function OperationalWorkflow({ state }) {
  const currentStage = workflowStages[state.workflowIndex] || workflowStages[0];
  return (
    <section className="if-panel if-operations-panel fg-ops-panel" data-fastdas-operational-workflow>
      <div className="fg-ops-panel__main">
        <div className="fg-ops-panel__summary">
          <div className="fg-eyebrow">Operational Runtime</div>
          <h2 className="if-panel__title" data-fastdas-workflow-stage>{currentStage}</h2>
          <p>{state.lastAction}</p>
          {state.toast ? (
            <div className={`if-alert fg-toast ${toneClass(state.toast.tone)}`} data-fastdas-toast>
              <strong>{state.toast.title}</strong>
              <span>{state.toast.body}</span>
            </div>
          ) : null}
        </div>
        <div className="fg-ops-stats" aria-label="Operational counters">
          <div><span>Active seed</span><strong>{state.activeSeed}</strong></div>
          <div><span>Scenario</span><strong>{state.scenarioMode}</strong></div>
          <div><span>Mode</span><strong>{state.operatorMode}</strong></div>
          <div><span>Signal runs</span><strong>{state.signalRuns}</strong></div>
          <div><span>Records</span><strong>{state.generatedRecords}</strong></div>
          <div><span>Approvals due</span><strong>{state.approvalCount}</strong></div>
          <div><span>Variants</span><strong>{state.variantCount}</strong></div>
          <div><span>Exports</span><strong>{state.exportCount}</strong></div>
        </div>
      </div>
      <div className="fg-audit" data-fastdas-audit-log>
        <div className="fg-audit__header">
          <strong>Audit Trail</strong>
          <Chip tone="blue">{state.events.length} events</Chip>
        </div>
        <ol>
          {state.events.map(event => (
            <li key={event.id} className={toneClass(event.tone)}>
              <time>{event.time}</time>
              <div>
                <strong>{event.title}</strong>
                <span>{event.body}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function CommandDock({ state, onCommandAction, onModeChange }) {
  const commands = [
    {
      id: "scan",
      title: "Signal Scan",
      body: "Capture source deltas, route matches, and refresh confidence.",
      meta: `${state.signalRuns} runs`,
      tone: "blue",
      icon: "refresh",
      action: "Run",
    },
    {
      id: "approve",
      title: "Human Gate",
      body: "Clear one approval while preserving technical and source boundaries.",
      meta: `${state.approvalCount} due`,
      tone: state.approvalCount > 0 ? "warning" : "success",
      icon: "check",
      action: "Approve",
    },
    {
      id: "queue",
      title: "Outreach Cadence",
      body: "Queue follow-up timing, meeting brief, and reply triage handoff.",
      meta: "11 due",
      tone: "purple",
      icon: "mail",
      action: "Queue",
    },
    {
      id: "export",
      title: "Demo Bundle",
      body: "Prepare the customer-safe dataset, manifest, and evidence summary.",
      meta: `${state.exportCount} exports`,
      tone: "success",
      icon: "download",
      action: "Export",
    },
  ];

  return (
    <section className="if-panel if-operations-panel fg-command-dock" data-fastdas-command-dock>
      <div className="fg-command-dock__top">
        <div>
          <div className="fg-eyebrow">Workflow Command Queue</div>
          <h2 className="if-panel__title">Operator Control Dock</h2>
        </div>
        <div
          className="if-segmented-control if-segmented-control--stretch fg-segmented"
          role="group"
          aria-label="Operator mode"
          data-fastdas-operator-mode
          data-control-segmented="fastdas-operator-mode"
        >
          {OPERATOR_MODES.map(mode => (
            <button
              type="button"
              className={`if-segmented-control__item${mode === state.operatorMode ? " is-active" : ""}`}
              aria-pressed={mode === state.operatorMode}
              data-control-segmented-option={mode}
              key={mode}
              onClick={() => onModeChange(mode)}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
      <div className="fg-command-grid">
        {commands.map(command => (
          <article className="if-card if-operations-section fg-command-card" data-fastdas-command-card key={command.id}>
            <div className="fg-command-card__icon"><Icon name={command.icon} /></div>
            <div className="fg-command-card__body">
              <div>
                <h3 className="if-card__title">{command.title}</h3>
                <Chip tone={command.tone}>{command.meta}</Chip>
              </div>
              <p>{command.body}</p>
            </div>
            <button
              className="if-btn if-btn--secondary fg-btn"
              type="button"
              data-fastdas-action={`command-${command.id}`}
              onClick={() => onCommandAction(command.id)}
            >
              {command.action}
            </button>
          </article>
        ))}
      </div>
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
    <section className="if-operations-section-grid fg-bottom-grid">
      {activePanels.map(([title, items]) => (
        <article className="if-panel if-operations-section fg-panel fg-panel--compact" key={title}>
          <div className="if-panel__header fg-panel__header"><h2 className="if-panel__title">{title}</h2></div>
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
  const [operationState, setOperationState] = useState(INITIAL_OPERATION_STATE);

  useEffect(() => {
    const onHashChange = () => setActiveSurfaceId(getInitialSurfaceId());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const surface = useMemo(
    () => surfaces.find(item => item.id === activeSurfaceId) || surfaces[0],
    [activeSurfaceId],
  );
  const activeMetricSignalId = signalIdForLabel(surface.metrics[0]?.[0]);

  const setSurface = useCallback((id) => {
    setActiveSurfaceId(id);
    window.location.hash = `/${id}`;
  }, []);

  const recordOperation = useCallback((event) => {
    setOperationState(current => appendEvent(current, event));
  }, []);

  const handleUtilityAction = useCallback((title, body, tone = "blue") => {
    recordOperation({ title, body, tone });
  }, [recordOperation]);

  const handleModeChange = useCallback((mode) => {
    setOperationState(current => appendEvent(current, {
      title: "Operator mode changed",
      body: `${mode} mode is active for the walkthrough control dock.`,
      tone: mode === "Customer Review" ? "success" : mode === "Synthetic Variant" ? "purple" : "blue",
      updates: { operatorMode: mode },
    }));
  }, []);

  const handleCommandAction = useCallback((commandId) => {
    const commandEvents = {
      scan: {
        title: "Command scan run",
        body: "Control dock scan captured 37 synthetic signals and routed high-fit records to enrichment.",
        tone: "blue",
        workflowIndex: 1,
        updates: state => ({ signalRuns: state.signalRuns + 1, generatedRecords: state.generatedRecords + 37 }),
      },
      approve: {
        title: "Command approval cleared",
        body: "One human-gated record advanced with source-safe and technical-safe checks retained.",
        tone: "success",
        workflowIndex: 4,
        updates: state => ({ approvalCount: Math.max(0, state.approvalCount - 1) }),
      },
      queue: {
        title: "Command cadence queued",
        body: "Follow-up timing, meeting brief, and reply triage handoff were queued for the selected opportunity.",
        tone: "purple",
        workflowIndex: 4,
      },
      export: {
        title: "Command export staged",
        body: "Customer-safe demo bundle, scenario manifest, and evidence summary are ready for review.",
        tone: "blue",
        updates: state => ({ exportCount: state.exportCount + 1 }),
      },
    };
    recordOperation(commandEvents[commandId]);
  }, [recordOperation]);

  const handlePrimaryAction = useCallback((surfaceId) => {
    if (surfaceId === "global-signal-scan") {
      recordOperation({
        title: "Signal scan completed",
        body: "37 synthetic signals captured, 11 routed to enrichment, and 3 high-score records surfaced for review.",
        tone: "blue",
        workflowIndex: 1,
        updates: state => ({ signalRuns: state.signalRuns + 1, generatedRecords: state.generatedRecords + 37 }),
      });
      setSurface("signal-intake");
      return;
    }

    const action = PRIMARY_ACTIONS[surfaceId] || PRIMARY_ACTIONS["command-center"];
    if (surfaceId === "synthetic-data") {
      setOperationState(current => {
        const nextVariant = current.variantCount + 1;
        const scenarioMode = SCENARIO_SEQUENCE[nextVariant % SCENARIO_SEQUENCE.length];
        return appendEvent(current, {
          ...action,
          body: `${scenarioMode} variant created with source-safe records and complete workflow provenance.`,
          updates: {
            variantCount: nextVariant,
            activeSeed: `FD-GE-DEMO-0619-V${String(nextVariant).padStart(2, "0")}`,
            datasetVersion: `2026.06.19-${String.fromCharCode(98 + ((nextVariant - 1) % 24))}`,
            scenarioMode,
            generatedRecords: current.generatedRecords + 24,
          },
        });
      });
      return;
    }
    recordOperation(action);
    if (action.surfaceId) setSurface(action.surfaceId);
  }, [recordOperation, setSurface]);

  const handleRecordAction = useCallback((kind, activeSurface) => {
    const labels = {
      approve: {
        title: "Inline record approved",
        body: `${activeSurface.expanded.title} moved through its operator gate and is ready for the next workflow step.`,
        tone: "success",
        workflowIndex: Math.min(workflowStages.length - 1, operationState.workflowIndex + 1),
        updates: state => ({ approvalCount: Math.max(0, state.approvalCount - 1) }),
      },
      edit: {
        title: "Draft opened for edit",
        body: `${activeSurface.expanded.title} is staged for message, evidence, or scoring edits without changing the golden seed.`,
        tone: "blue",
      },
      assign: {
        title: "Research task assigned",
        body: `${activeSurface.expanded.title} now has an offshore verification packet and human owner handoff.`,
        tone: "purple",
      },
      hold: {
        title: "Record placed on hold",
        body: `${activeSurface.expanded.title} is blocked from outbound action until source, role, or technical claim risk is resolved.`,
        tone: "danger",
      },
    };
    recordOperation(labels[kind]);
  }, [operationState.workflowIndex, recordOperation]);

  const handleSyntheticAction = useCallback((kind) => {
    if (kind === "reset") {
      setSelectedRows(Object.fromEntries(surfaces.map(item => [item.id, item.selected])));
      setOperationState({
        ...INITIAL_OPERATION_STATE,
        toast: {
          title: "Reset demo state",
          body: "Golden seed, selected rows, scenario mode, counters, and workflow stage were restored.",
          tone: "success",
        },
        events: [
          createEvent("Reset demo state", "Golden seed, selected rows, scenario mode, counters, and workflow stage were restored.", "success"),
          ...BASE_EVENTS,
        ],
      });
      return;
    }

    if (kind === "export") {
      recordOperation({
        title: "Export bundle prepared",
        body: "Customer-safe JSON, evidence summary, scenario manifest, and reset instructions were staged for review.",
        tone: "blue",
        updates: state => ({ exportCount: state.exportCount + 1 }),
      });
      return;
    }

    setOperationState(current => {
      const nextVariant = current.variantCount + 1;
      const scenarioMode = SCENARIO_SEQUENCE[nextVariant % SCENARIO_SEQUENCE.length];
      return appendEvent(current, {
        title: "Generated demo variant",
        body: `${scenarioMode} variant created with source-safe records and complete workflow provenance.`,
        tone: "purple",
        workflowIndex: 2,
        updates: {
          variantCount: nextVariant,
          activeSeed: `FD-GE-DEMO-0619-V${String(nextVariant).padStart(2, "0")}`,
          datasetVersion: `2026.06.19-${String.fromCharCode(98 + ((nextVariant - 1) % 24))}`,
          scenarioMode,
          generatedRecords: current.generatedRecords + 24,
        },
      });
    });
  }, [recordOperation]);

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
          <Chip tone="warning">{operationState.approvalCount} human approvals due</Chip>
          <span className="fg-topbar__spacer" />
          <button
            className="if-btn if-btn--secondary fg-btn"
            type="button"
            onClick={() => handleUtilityAction("View saved", `${surface.title} filters, selected record, and workflow focus were saved.`, "blue")}
          >
            <Icon name="save" />Save View
          </button>
          <button
            className="if-btn if-btn--primary fg-btn fg-btn--primary"
            type="button"
            data-fastdas-action="run-signal-scan"
            onClick={() => handlePrimaryAction("global-signal-scan")}
          >
            <Icon name="refresh" />Run Signal Scan
          </button>
          <div className="fg-user"><span>AB</span>Growth Operator</div>
        </header>

        <section
          className="if-content if-page if-operations-workspace if-operations-workspace--compact fg-content"
          data-if-operations-workspace
          data-if-operations-current={activeMetricSignalId}
        >
          <header className="if-page-header fg-page-header">
            <div>
              <div className="if-page-header__eyebrow fg-eyebrow">{surface.eyebrow}</div>
              <h1 className="if-page-header__title">{surface.title}</h1>
              <p className="if-panel__subtitle">{surface.summary}</p>
            </div>
            <div className="if-page-header__actions fg-page-actions">
              <button
                className="if-btn if-btn--secondary fg-btn"
                type="button"
                onClick={() => handleUtilityAction("Filters reset", `${surface.title} returned to the default demo view.`, "blue")}
              >
                <Icon name="rotate" />Reset Filters
              </button>
              <button
                className="if-btn if-btn--secondary fg-btn"
                type="button"
                onClick={() => handleUtilityAction("Surface export staged", `${surface.title} export bundle is ready with source-safe synthetic data only.`, "blue")}
              >
                <Icon name="download" />Export
              </button>
              <button
                className="if-btn if-btn--primary fg-btn fg-btn--primary"
                type="button"
                data-fastdas-action="page-primary"
                onClick={() => handlePrimaryAction(surface.id)}
              >
                <Icon name="check" />{surface.primaryAction}
              </button>
            </div>
          </header>

          <WorkflowStrip activeIndex={operationState.workflowIndex} />
          <OperationalWorkflow state={operationState} />
          <CommandDock state={operationState} onCommandAction={handleCommandAction} onModeChange={handleModeChange} />

          <section
            className="if-metric-grid if-operations-metric-grid if-operations-signal-grid if-operations-signal-grid--balanced if-balanced-grid fg-metric-grid"
            data-fastdas-metric-grid
            data-if-balanced-grid
            data-if-balanced-grid-min="168"
          >
            {surface.metrics.map((metric, index) => <MetricCard key={metric[0]} metric={metric} selected={index === 0} />)}
          </section>
          <OperationsSignalPanels metrics={surface.metrics} />

          <SourceCards cards={surface.sourceCards} />

          <DataManagement management={surface.management} operationState={operationState} onSyntheticAction={handleSyntheticAction} />

          <OpportunityGrid
            surface={surface}
            selectedRowId={selectedRows[surface.id]}
            onSelect={rowId => setSelectedRows(current => ({ ...current, [surface.id]: rowId }))}
            onPrimaryAction={handlePrimaryAction}
            onUtilityAction={handleUtilityAction}
            onRecordAction={handleRecordAction}
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
