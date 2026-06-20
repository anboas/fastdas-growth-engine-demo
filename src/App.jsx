import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { seedOpportunityRows as seedRecords, sidebarKpis, surfaces, workflowStages } from "./data.js";
import {
  COMMAND_CENTER_DEFAULT_FILTER_ID,
  commandCenterFilterIdForMetric,
  commandCenterQuickFilter,
  commandCenterRowsForFilter,
  detailForSurfaceSelection,
  defaultDetailOpenRows,
  firstCommandCenterRowId,
  gridSurfaceAttributes,
  isFocusedWorkbenchSurface,
  SAVED_VIEWS,
  splitCell,
  toneForValue,
  workbenchSurfaceAttributes,
  workbenchSurfaceConfig,
} from "./workbenchModel.js";

const U = {
  primaryDarker: "#162e51",
  primaryDark: "#1a4480",
  primary: "#005ea2",
  primaryLight: "#73b3e7",
  primaryLighter: "#d9e8f6",
  baseDarkest: "#1b1b1b",
  baseDarker: "#3d4551",
  baseDark: "#565c65",
  base: "#71767a",
  baseLighter: "#dfe1e2",
  baseLightest: "#f8fafc",
  white: "#ffffff",
  success: "#00a91c",
  successDark: "#008817",
  accentWarmDark: "#c05600",
  accentCoolDarker: "#07648d",
  error: "#d83933",
};

function Icon({ name }) {
  return <span className="if-icon-slot fg-icon" data-if-icon={name} aria-hidden="true" />;
}

const safeText = (extra = {}) => ({
  minWidth: 0,
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  ...extra,
});

function getInitialSurfaceId() {
  const fromHash = window.location.hash.replace(/^#\/?/, "");
  return surfaces.some(surface => surface.id === fromHash) ? fromHash : surfaces[0].id;
}

function toneClass(tone = "neutral") {
  return `fg-tone-${tone}`;
}

function signalIdForLabel(label) {
  return String(label || "signal").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function clampScore(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 82;
  return Math.min(99, Math.max(50, parsed));
}

function stateForWorkflowIndex(index) {
  return PIPELINE_STATE_BY_INDEX[Math.min(PIPELINE_STATE_BY_INDEX.length - 1, Math.max(0, index))] || "Signal";
}

function confidenceForScore(score) {
  return (Math.min(0.95, Math.max(0.58, score / 108))).toFixed(2);
}

function normalizeSyntheticRecord(draft, sequence) {
  const fallbackName = `Demo Prospect ${sequence}`;
  const name = (draft.name || fallbackName).trim();
  const score = clampScore(draft.score);
  const market = (draft.market || "VA / MD / DC").trim();
  const buildingType = (draft.buildingType || "Commercial property").trim();
  const signal = (draft.signal || "Synthetic growth signal").trim();
  const firstOffer = (draft.firstOffer || "Coverage benchmark").trim();
  const stakeholderPath = (draft.stakeholderPath || "Property manager -> owner rep").trim();

  return {
    name,
    market,
    buildingType,
    signal,
    score,
    confidence: confidenceForScore(score),
    firstOffer,
    state: "Signal",
    stakeholderPath,
    nextAction: "Run enrichment",
    why: `${signal} creates a demo-safe reason to offer a bounded ${firstOffer.toLowerCase()} before any larger project ask.`,
    conversion: `${firstOffer} -> findings -> roadmap -> follow-on work`,
    syntheticUserRecord: true,
  };
}

function generatedSyntheticRecord(sequence, scenarioMode) {
  const scenarios = {
    "Closeout Sprint": ["Arlington Permit Lead", "Arlington, VA", "High-rise / closeout", "Permit closeout + fire alarm activity", "Public safety radio test", "GC PM -> fire alarm partner -> owner rep", 91],
    "Property Portfolio": ["Rockville Portfolio Asset", "Rockville, MD", "Portfolio mixed-use", "Ownership change + multi-site map", "Portfolio risk screen", "Asset manager -> property manager", 84],
    "Hospitality Coverage": ["DC Hotel Coverage Lead", "Washington, DC", "Hotel / hospitality", "Guest coverage complaints", "Coverage benchmark", "General manager -> ownership group", 83],
    "Maintenance Wedge": ["Alexandria Health Check Lead", "Alexandria, VA", "Commercial facility", "Existing system age + facilities signal", "System health check", "Facilities director -> property manager", 86],
  };
  const [name, market, buildingType, signal, firstOffer, stakeholderPath, score] = scenarios[scenarioMode] || scenarios["Closeout Sprint"];
  return normalizeSyntheticRecord({
    name: `${name} ${sequence}`,
    market,
    buildingType,
    signal,
    firstOffer,
    stakeholderPath,
    score: String(score),
  }, sequence);
}

function isRetiredDemoRecordName(name = "") {
  return /^Synthetic Closeout Tower\b/i.test(String(name));
}

function sanitizeRuntimeRecords(records = []) {
  return records.filter(record => !isRetiredDemoRecordName(record?.name));
}

function sanitizePipelineOverrides(overrides = {}) {
  return Object.fromEntries(
    Object.entries(overrides).filter(([recordName]) => !isRetiredDemoRecordName(recordName)),
  );
}

function applyPipelineState(record, overrides) {
  const workflowIndex = overrides[record.name]?.workflowIndex;
  if (!Number.isFinite(workflowIndex)) return record;
  const state = stateForWorkflowIndex(workflowIndex);
  const nextAction = {
    Signal: "Run enrichment",
    Enriching: "Score and qualify",
    Qualified: "Promote to human review",
    "Human Review": "Approve outreach",
    "Outreach Ready": "Send approved first touch",
    "Discovery Call": "Prepare assessment offer",
    "Paid Assessment": "Deliver diagnostic report",
    Report: "Frame follow-on roadmap",
    "Follow-On Opportunity": "Close follow-on scope",
    "Closed Won": "Log outcome",
  }[state] || record.nextAction;
  return { ...record, state, nextAction };
}

function rowsFromRecords(records, mode) {
  return records.map((record, index) => {
    if (mode === "workbench") {
      return {
        id: record.name,
        synthetic: Boolean(record.syntheticUserRecord),
        cells: [`${record.name}|${record.market}`, record.buildingType, record.signal, String(record.score), record.confidence, record.firstOffer, record.state, record.syntheticUserRecord ? "Demo operator" : "Adam / Research"],
      };
    }
    if (mode === "conversion") {
      return {
        id: record.name,
        synthetic: Boolean(record.syntheticUserRecord),
        cells: [`${record.name}|${record.market}`, record.signal, record.firstOffer, record.state, record.score >= 85 ? "Candidate" : "Nurture", "-", record.conversion.split(" -> ").slice(-1)[0], record.why],
      };
    }
    return {
      id: record.name,
      synthetic: Boolean(record.syntheticUserRecord),
      cells: [
        String(index + 1).padStart(2, "0"),
        `${record.name}|${record.market} / ${record.buildingType}`,
        record.signal,
        String(record.score),
        record.firstOffer,
        record.stakeholderPath,
        record.state,
        record.nextAction,
      ],
    };
  });
}

function buildRuntimeSurfaces(syntheticRecords, pipelineOverrides) {
  const runtimeRecords = [...seedRecords, ...syntheticRecords]
    .map(record => applyPipelineState(record, pipelineOverrides))
    .sort((a, b) => b.score - a.score);
  const syntheticRecordCount = syntheticRecords.length;
  const runtimeSyntheticRecords = runtimeRecords.filter(record => record.syntheticUserRecord);
  const outreachRows = runtimeSyntheticRecords
    .filter(record => ["Human Review", "Outreach Ready", "Follow-Up Due", "Discovery Call", "Signal", "Enriching", "Qualified"].includes(record.state))
    .map(record => ({
      id: record.name,
      synthetic: Boolean(record.syntheticUserRecord),
      cells: [
        `${record.name}|${record.stakeholderPath}`,
        "Email + LinkedIn",
        record.state === "Outreach Ready" ? "Approved first touch" : "First touch",
        record.firstOffer,
        record.score >= 85 ? "Low" : "Medium",
        record.state === "Outreach Ready" ? "Approved" : "Approval",
        "Today",
        record.syntheticUserRecord ? "Demo operator" : "Adam",
      ],
    }));
  const evidenceRows = runtimeSyntheticRecords
    .filter(record => record.score >= 80 || record.syntheticUserRecord)
    .map(record => ({
      id: record.name,
      synthetic: Boolean(record.syntheticUserRecord),
      cells: [
        `${record.name}|${record.signal}`,
        record.syntheticUserRecord ? "Synthetic input" : "System source",
        String(record.score),
        "Current",
        record.state === "Outreach Ready" ? "Approved" : "Internal only",
        record.why,
      ],
    }));

  return surfaces.map(surface => {
    if (surface.id === "command-center") {
      return {
        ...surface,
        records: runtimeRecords,
        table: {
          ...surface.table,
          count: `${runtimeRecords.length} records`,
          rows: rowsFromRecords(runtimeRecords, "command"),
        },
      };
    }
    if (surface.id === "opportunity-workbench") {
      return {
        ...surface,
        records: runtimeRecords,
        table: {
          ...surface.table,
          count: `${runtimeRecords.length} opportunities`,
          rows: rowsFromRecords(runtimeRecords, "workbench"),
        },
      };
    }
    if (surface.id === "evidence-review") {
      return {
        ...surface,
        records: runtimeRecords,
        table: {
          ...surface.table,
          count: `${surface.table.rows.length + evidenceRows.length} evidence packets`,
          rows: [...surface.table.rows, ...evidenceRows],
        },
      };
    }
    if (surface.id === "outreach-queue") {
      return {
        ...surface,
        records: runtimeRecords,
        table: {
          ...surface.table,
          count: `${surface.table.rows.length + outreachRows.length} outreach tasks`,
          rows: [...surface.table.rows, ...outreachRows],
        },
      };
    }
    if (surface.id === "conversion-board") {
      return {
        ...surface,
        records: runtimeRecords,
        table: {
          ...surface.table,
          count: `${runtimeRecords.length} conversion records`,
          rows: rowsFromRecords(runtimeRecords, "conversion"),
        },
      };
    }
    if (surface.id === "synthetic-data") {
      const rows = syntheticRecordCount
        ? [
            [`Entered Opportunity Records|Manual and generated runtime records`, String(syntheticRecordCount), "Demo operator", "Browser-local", "Synthetic / user-entered", "Pass", "All pipeline surfaces"],
            ...surface.table.rows.map(row => row.cells),
          ].map((cells, index) => ({ id: cells[0].split("|")[0] || `synthetic-${index}`, cells, synthetic: index === 0 }))
        : surface.table.rows;
      return {
        ...surface,
        records: runtimeRecords,
        table: {
          ...surface.table,
          count: `${rows.length} managed datasets`,
          rows,
        },
      };
    }
    return { ...surface, records: runtimeRecords };
  });
}

function useMobileWorkbenchLayout() {
  const [isMobileWorkbench, setIsMobileWorkbench] = useState(() => window.matchMedia("(max-width: 900px)").matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const update = () => setIsMobileWorkbench(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return isMobileWorkbench;
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

const EMPTY_SYNTHETIC_DRAFT = {
  name: "",
  market: "Baltimore, MD",
  buildingType: "Mixed-use commercial",
  signal: "Coverage complaint + ownership change",
  firstOffer: "Coverage benchmark",
  stakeholderPath: "Property manager -> owner rep",
  score: "86",
};

const RUNTIME_STORAGE_KEY = "fastdas.demo.runtimePipeline.v1";
const DEMO_SESSION_STORAGE_KEY = "fastdas.demo.operatorSession.v1";

const PIPELINE_STATE_BY_INDEX = [
  "Signal",
  "Enriching",
  "Qualified",
  "Human Review",
  "Outreach Ready",
  "Discovery Call",
  "Paid Assessment",
  "Report",
  "Follow-On Opportunity",
  "Closed Won",
];

function readRuntimePipelineState() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RUNTIME_STORAGE_KEY) || "{}");
    const syntheticRecords = sanitizeRuntimeRecords(Array.isArray(parsed.syntheticRecords) ? parsed.syntheticRecords : []);
    const pipelineOverrides = sanitizePipelineOverrides(parsed.pipelineOverrides && typeof parsed.pipelineOverrides === "object" ? parsed.pipelineOverrides : {});
    if (syntheticRecords.length !== (Array.isArray(parsed.syntheticRecords) ? parsed.syntheticRecords.length : 0)) {
      window.localStorage.setItem(RUNTIME_STORAGE_KEY, JSON.stringify({
        syntheticRecords,
        pipelineOverrides,
        savedAt: new Date().toISOString(),
      }));
    }
    return {
      syntheticRecords,
      pipelineOverrides,
    };
  } catch {
    return { syntheticRecords: [], pipelineOverrides: {} };
  }
}

function writeRuntimePipelineState(syntheticRecords, pipelineOverrides) {
  window.localStorage.setItem(RUNTIME_STORAGE_KEY, JSON.stringify({
    syntheticRecords,
    pipelineOverrides,
    savedAt: new Date().toISOString(),
  }));
}

function clearRuntimePipelineState() {
  window.localStorage.removeItem(RUNTIME_STORAGE_KEY);
}

function defaultSelectedRows() {
  return Object.fromEntries(surfaces.map(surface => [surface.id, surface.selected]));
}

function readDemoSessionState() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DEMO_SESSION_STORAGE_KEY) || "{}");
    const selectedRows = parsed.selectedRows && typeof parsed.selectedRows === "object" ? { ...defaultSelectedRows(), ...parsed.selectedRows } : defaultSelectedRows();
    const detailOpenRows = parsed.detailOpenRows && typeof parsed.detailOpenRows === "object" ? { ...defaultDetailOpenRows(), ...parsed.detailOpenRows } : defaultDetailOpenRows();
    for (const [surfaceId, rowId] of Object.entries(selectedRows)) {
      if (isRetiredDemoRecordName(rowId)) selectedRows[surfaceId] = surfaces.find(surface => surface.id === surfaceId)?.selected || "";
    }
    for (const [surfaceId, rowId] of Object.entries(detailOpenRows)) {
      if (isRetiredDemoRecordName(rowId)) detailOpenRows[surfaceId] = "";
    }
    return {
      operationState: parsed.operationState && typeof parsed.operationState === "object"
        ? {
            ...INITIAL_OPERATION_STATE,
            ...parsed.operationState,
            events: Array.isArray(parsed.operationState.events) ? parsed.operationState.events : INITIAL_OPERATION_STATE.events,
          }
        : INITIAL_OPERATION_STATE,
      selectedRows,
      detailOpenRows,
      activeCommandFilterId: parsed.activeCommandFilterId || COMMAND_CENTER_DEFAULT_FILTER_ID,
    };
  } catch {
    return {
      operationState: INITIAL_OPERATION_STATE,
      selectedRows: defaultSelectedRows(),
      detailOpenRows: defaultDetailOpenRows(),
      activeCommandFilterId: COMMAND_CENTER_DEFAULT_FILTER_ID,
    };
  }
}

function writeDemoSessionState(operationState, selectedRows, detailOpenRows, activeCommandFilterId) {
  window.localStorage.setItem(DEMO_SESSION_STORAGE_KEY, JSON.stringify({
    operationState,
    selectedRows,
    detailOpenRows,
    activeCommandFilterId,
    savedAt: new Date().toISOString(),
  }));
}

function clearDemoSessionState() {
  window.localStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildRuntimeExportPayload(operationState, syntheticRecords, pipelineOverrides, activeSurfaceId) {
  return {
    exportedAt: new Date().toISOString(),
    activeSurfaceId,
    activeSeed: operationState.activeSeed,
    scenarioMode: operationState.scenarioMode,
    datasetVersion: operationState.datasetVersion,
    workflowStage: workflowStages[operationState.workflowIndex] || workflowStages[0],
    operatorMode: operationState.operatorMode,
    syntheticRecords,
    pipelineOverrides,
  };
}

const PRIMARY_ROUTE_IDS = ["command-center", "signal-intake", "opportunity-workbench"];
const EXECUTION_ROUTE_IDS = ["evidence-review", "outreach-queue", "agent-operations"];
const ADMIN_ROUTE_IDS = ["synthetic-data", "conversion-board"];
const PROFILE_SETTINGS = [
  ["source-tracking", "Source Tracking", "Source links and confidence remain visible", "Visible"],
  ["review-queue", "Review Queue", "Human approval surfaces stay in the workspace", "Visible"],
  ["table-density", "Table Density", "Compact scan-first table layout is active", "Compact"],
];

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

function MetricCard({ metric, selected = false, onSelect }) {
  const [label, value, change, meta, tone, icon] = metric;
  const signalId = signalIdForLabel(label);
  const accent = {
    blue: U.primary,
    success: U.success,
    warning: U.accentWarmDark,
    danger: U.error,
    purple: U.accentCoolDarker,
    neutral: U.primaryDark,
  }[tone] || U.primary;
  return (
    <button
      type="button"
      className={`if-card if-metric if-operations-signal if-operations-signal--compact ci-signal-card fg-metric ${selected ? "is-active is-selected" : ""} ${toneClass(tone)}`}
      data-if-operations-signal={signalId}
      data-if-operations-label={label}
      data-if-operations-focus-panel={signalId}
      data-fastdas-command-filter-card={signalId}
      data-fastdas-command-filter-active={selected ? "true" : "false"}
      data-signal-widget-card={signalId}
      data-visual-surface="metric"
      aria-pressed={selected}
      aria-label={`${label}: ${value}. ${change}`}
      title={`${label}: ${value} · ${change}${meta ? ` · ${meta}` : ""}`}
      onClick={onSelect}
      style={{
        background: selected ? "#f7fbff" : U.white,
        borderLeft: `4px solid ${accent}`,
        borderTop: selected ? `1px solid ${accent}` : "1px solid transparent",
        borderRight: selected ? `1px solid ${accent}` : "1px solid transparent",
        borderBottom: selected ? `1px solid ${accent}` : "1px solid transparent",
        borderRadius: 4,
        padding: "12px 14px",
        flex: 1,
        minWidth: 150,
        maxWidth: "100%",
        overflow: "hidden",
        boxShadow: selected ? "0 0 0 1px rgba(0,94,162,0.10), 0 2px 6px rgba(0,0,0,0.10)" : "0 1px 3px rgba(0,0,0,0.08)",
        textAlign: "left",
        fontFamily: "inherit",
      }}
    >
      <div className="if-metric__top fg-metric__top">
        <span className="if-metric__icon if-icon-slot fg-metric__icon" data-if-icon={icon} aria-hidden="true" />
        <p className="if-metric__label fg-metric__label" style={safeText({ fontSize: 10, color: U.baseDark, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800, marginBottom: 5, lineHeight: 1.2, minHeight: 24 })}>{label}</p>
      </div>
      <div className="if-metric__main fg-metric__main">
        <p className="if-metric__value fg-metric__value" style={safeText({ fontSize: 24, fontWeight: 900, color: accent, fontFamily: "'Roboto Mono', monospace", lineHeight: 1 })}>{value}</p>
      </div>
      <span className="if-metric__change fg-metric__change" style={safeText({ fontSize: 11, color: U.baseDark, marginTop: 5 })}>{change}</span>
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

function ProfileSettingToggle({ label }) {
  return (
    <span className="ci-profile-setting-toggle ci-profile-setting-toggle--on" data-profile-setting-state="on">
      <span className="ci-profile-setting-toggle__track" aria-hidden="true">
        <span className="ci-profile-setting-toggle__knob" />
      </span>
      <span className="ci-profile-setting-toggle__label">{label}</span>
    </span>
  );
}

function FastDasProfileMenu({ operationState, onSurfaceSelect, onUtilityAction }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const currentStage = workflowStages[operationState.workflowIndex] || workflowStages[0];

  useEffect(() => {
    function handleOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div ref={ref} className="if-popover if-account-popover ci-profile-menu fg-profile-menu" data-profile-menu data-fastdas-profile-menu>
      <button
        type="button"
        className={`if-account-menu${open ? " is-active" : ""}`}
        data-profile-menu-trigger
        aria-label="Profile menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="fastdas-profile-menu"
        title="FastDAS operator profile"
        onClick={() => setOpen(value => !value)}
      >
        <span className="if-avatar if-profile-avatar" data-profile-avatar aria-hidden="true">AB</span>
        <span className="if-account-menu__name if-desktop-only" data-profile-menu-name>Operator</span>
        <span className="if-icon-slot if-account-menu__chevron" data-if-icon="chevronDown" aria-hidden="true" />
      </button>

      {open ? (
        <section
          id="fastdas-profile-menu"
          className="if-popover__panel if-account-surface ci-profile-menu__surface fg-profile-menu__surface"
          data-profile-menu-surface
          role="dialog"
          aria-label="FastDAS profile controls"
        >
          <header className="if-account-surface__header">
            <span className="if-account-surface__avatar if-profile-avatar if-profile-avatar--large" aria-hidden="true">AB</span>
            <span className="if-account-surface__identity">
              <strong data-profile-active-name>Adam Boas</strong>
              <span>Growth operator</span>
              <span>Browser-local demo workspace</span>
            </span>
          </header>
          <div className="if-account-surface__body">
            <section className="if-account-surface__section" aria-label="Profile source">
              <span className="if-account-surface__label">Identity Source</span>
              <div className="if-account-surface__controls">
                <div className="if-account-surface__control">
                  <span>Provider</span>
                  <strong>Local profile</strong>
                </div>
                <div className="if-account-surface__control">
                  <span>Current stage</span>
                  <strong>{currentStage}</strong>
                </div>
              </div>
            </section>
            <section className="if-account-surface__section" aria-label="Workspace display">
              <span className="if-account-surface__label">Workspace Display</span>
              {PROFILE_SETTINGS.map(([id, label, helper, stateLabel]) => (
                <button
                  type="button"
                  className="if-account-action ci-profile-setting-action ci-profile-setting-action--on"
                  data-profile-setting={id}
                  data-profile-setting-state="on"
                  aria-pressed="true"
                  key={id}
                  onClick={() => onUtilityAction(`${label} confirmed`, `${label} remains active for the FastDAS command workspace.`, "blue")}
                >
                  <span className="if-account-action__icon if-icon-slot ci-profile-setting-icon" data-if-icon={id === "review-queue" ? "eye" : id === "table-density" ? "columns" : "shield"} aria-hidden="true" />
                  <span className="if-account-action__content ci-profile-setting-copy">
                    <strong className="if-account-action__title" data-profile-setting-label={id}>{label}</strong>
                    <span className="if-account-action__meta" data-profile-setting-helper={id}>{helper}</span>
                  </span>
                  <ProfileSettingToggle label={stateLabel} />
                </button>
              ))}
            </section>
            <section className="if-account-surface__section" aria-label="Profile actions">
              <button
                type="button"
                className="if-account-action"
                data-profile-command-center
                onClick={() => {
                  setOpen(false);
                  onSurfaceSelect("command-center");
                }}
              >
                <span className="if-account-action__icon if-icon-slot" data-if-icon="target" aria-hidden="true" />
                <span className="if-account-action__content">
                  <strong className="if-account-action__title">Command Center</strong>
                  <span className="if-account-action__meta">Return to the primary FastDAS work queue</span>
                </span>
              </button>
              <button
                type="button"
                className="if-account-action"
                data-profile-synthetic-data
                onClick={() => {
                  setOpen(false);
                  onSurfaceSelect("synthetic-data");
                }}
              >
                <span className="if-account-action__icon if-icon-slot" data-if-icon="database" aria-hidden="true" />
                <span className="if-account-action__content">
                  <strong className="if-account-action__title">Synthetic Data</strong>
                  <span className="if-account-action__meta">Manage seed, scenarios, exports, and reset state</span>
                </span>
              </button>
            </section>
          </div>
          <footer className="if-account-surface__footer">
            <span className="if-text-xs if-text-muted">{operationState.activeSeed} / {operationState.operatorMode}</span>
          </footer>
        </section>
      ) : null}
    </div>
  );
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

function RecordFocusPanel({ surface, selectedRowId, detailsOpen, onOpenDetails, onRecordAction }) {
  if (!isFocusedWorkbenchSurface(surface.id)) return null;
  const detail = detailForSurfaceSelection(surface, selectedRowId);

  if (surface.id === "signal-intake") {
    const source = detail.source;
    return (
      <aside
        className="if-panel if-record-detail if-operations-section fg-record-focus fg-record-focus--source"
        data-fastdas-record-focus-panel
        data-fastdas-source-focus-panel
        data-fastdas-record-focus-id={source.name}
      >
        <div className="fg-record-focus__header">
          <div>
            <div className="if-record-detail__eyebrow fg-eyebrow">Selected Source</div>
            <h3 className="if-record-detail__title">{source.name}</h3>
            <p className="if-record-detail__text">{detail.description}</p>
          </div>
          <Chip tone={toneForValue(source.exceptions)}>{source.exceptions}</Chip>
        </div>
        <dl className="if-provenance-grid fg-record-focus__facts">
          <div className="if-provenance-field">
            <dt>Lane</dt>
            <dd className="if-provenance-field__value">{source.lane}</dd>
          </div>
          <div className="if-provenance-field">
            <dt>Trust</dt>
            <dd className="if-provenance-field__value">{source.trust}</dd>
          </div>
          <div className="if-provenance-field">
            <dt>Refresh</dt>
            <dd className="if-provenance-field__value">{source.refresh}</dd>
          </div>
          <div className="if-provenance-field">
            <dt>Signals</dt>
            <dd className="if-provenance-field__value">{source.signals}</dd>
          </div>
          <div className="if-provenance-field">
            <dt>Route</dt>
            <dd className="if-provenance-field__value">{source.routedTo}</dd>
          </div>
          <div className="if-provenance-field">
            <dt>Next Run</dt>
            <dd className="if-provenance-field__value">{source.nextRun}</dd>
          </div>
        </dl>
        <div className="if-action-queue if-operations-list fg-record-focus__actions">
          {detail.actions.slice(0, 2).map(action => (
            <div className="if-action-queue__item if-operations-list__item if-operations-list__item--success if-tone-info fg-action-card" key={action}>
              <Icon name="check" />
              <span>
                <strong className="if-operations-list__title">{action}</strong>
                <em className="if-operations-list__description">Source-control action</em>
              </span>
            </div>
          ))}
        </div>
        <div className="if-toolbar__group fg-record-focus__toolbar">
          <button
            className="if-btn if-btn--primary fg-btn fg-btn--primary"
            type="button"
            data-fastdas-action="open-source-details"
            data-fastdas-open-details={source.name}
            onClick={() => onOpenDetails(source.name)}
          >
            <Icon name="arrowUp" />{detailsOpen ? "Details Open" : "Open Source Details"}
          </button>
          <button
            className="if-btn if-btn--secondary fg-btn"
            type="button"
            data-fastdas-action="focus-run-source"
            onClick={() => onRecordAction("run-source", surface, detail)}
          >
            <Icon name="refresh" />Run Source
          </button>
        </div>
      </aside>
    );
  }

  if (surface.id === "evidence-review") {
    const packet = detail.evidencePacket;
    return (
      <aside
        className="if-panel if-record-detail if-operations-section fg-record-focus fg-record-focus--evidence"
        data-fastdas-record-focus-panel
        data-fastdas-evidence-focus-panel
        data-fastdas-record-focus-id={packet.name}
      >
        <div className="fg-record-focus__header">
          <div>
            <div className="if-record-detail__eyebrow fg-eyebrow">Evidence Focus</div>
            <h3 className="if-record-detail__title">{packet.name}</h3>
            <p className="if-record-detail__text">{packet.summary}</p>
          </div>
          <Chip tone={toneForValue(packet.outreachUse)}>{packet.outreachUse}</Chip>
        </div>
        <dl className="if-provenance-grid fg-record-focus__facts">
          <div className="if-provenance-field">
            <dt>Source</dt>
            <dd className="if-provenance-field__value">{packet.sourceType}</dd>
          </div>
          <div className="if-provenance-field">
            <dt>Confidence</dt>
            <dd className="if-provenance-field__value">{packet.confidence}</dd>
          </div>
          <div className="if-provenance-field">
            <dt>Freshness</dt>
            <dd className="if-provenance-field__value">{packet.freshness}</dd>
          </div>
          <div className="if-provenance-field">
            <dt>Use Boundary</dt>
            <dd className="if-provenance-field__value">{packet.outreachUse}</dd>
          </div>
          <div className="if-provenance-field">
            <dt>Review Note</dt>
            <dd className="if-provenance-field__value">{packet.notes}</dd>
          </div>
        </dl>
        <div className="if-action-queue if-operations-list fg-record-focus__actions">
          {detail.actions.slice(0, 2).map(action => (
            <div className="if-action-queue__item if-operations-list__item if-operations-list__item--success if-tone-info fg-action-card" key={action}>
              <Icon name="shield" />
              <span>
                <strong className="if-operations-list__title">{action}</strong>
                <em className="if-operations-list__description">Evidence-review action</em>
              </span>
            </div>
          ))}
        </div>
        <div className="if-toolbar__group fg-record-focus__toolbar">
          <button
            className="if-btn if-btn--primary fg-btn fg-btn--primary"
            type="button"
            data-fastdas-action="open-evidence-details"
            data-fastdas-open-details={packet.name}
            onClick={() => onOpenDetails(packet.name)}
          >
            <Icon name="arrowUp" />{detailsOpen ? "Details Open" : "Open Evidence Details"}
          </button>
          <button
            className="if-btn if-btn--secondary fg-btn"
            type="button"
            data-fastdas-action="focus-approve-evidence"
            onClick={() => onRecordAction("approve-evidence", surface, detail)}
          >
            <Icon name="check" />Approve Evidence
          </button>
        </div>
      </aside>
    );
  }

  if (surface.id === "outreach-queue") {
    const task = detail.outreachTask;
    return (
      <aside
        className="if-panel if-record-detail if-operations-section fg-record-focus fg-record-focus--outreach"
        data-fastdas-record-focus-panel
        data-fastdas-outreach-focus-panel
        data-fastdas-record-focus-id={task.name}
      >
        <div className="fg-record-focus__header">
          <div>
            <div className="if-record-detail__eyebrow fg-eyebrow">Outreach Focus</div>
            <h3 className="if-record-detail__title">{task.name}</h3>
            <p className="if-record-detail__text">{detail.description}</p>
          </div>
          <Chip tone={toneForValue(task.state)}>{task.state}</Chip>
        </div>
        <dl className="if-provenance-grid fg-record-focus__facts">
          <div className="if-provenance-field">
            <dt>Channel</dt>
            <dd className="if-provenance-field__value">{task.channel}</dd>
          </div>
          <div className="if-provenance-field">
            <dt>Draft</dt>
            <dd className="if-provenance-field__value">{task.draftType}</dd>
          </div>
          <div className="if-provenance-field">
            <dt>First Offer</dt>
            <dd className="if-provenance-field__value">{task.firstOffer}</dd>
          </div>
          <div className="if-provenance-field">
            <dt>Risk</dt>
            <dd className="if-provenance-field__value">{task.risk}</dd>
          </div>
          <div className="if-provenance-field">
            <dt>Due / Owner</dt>
            <dd className="if-provenance-field__value">{task.due} / {task.owner}</dd>
          </div>
        </dl>
        <div className="if-action-queue if-operations-list fg-record-focus__actions">
          {detail.actions.slice(0, 2).map(action => (
            <div className="if-action-queue__item if-operations-list__item if-operations-list__item--success if-tone-info fg-action-card" key={action}>
              <Icon name="mail" />
              <span>
                <strong className="if-operations-list__title">{action}</strong>
                <em className="if-operations-list__description">Human-gated outreach action</em>
              </span>
            </div>
          ))}
        </div>
        <div className="if-toolbar__group fg-record-focus__toolbar">
          <button
            className="if-btn if-btn--primary fg-btn fg-btn--primary"
            type="button"
            data-fastdas-action="open-outreach-details"
            data-fastdas-open-details={task.name}
            onClick={() => onOpenDetails(task.name)}
          >
            <Icon name="arrowUp" />{detailsOpen ? "Details Open" : "Open Outreach Details"}
          </button>
          <button
            className="if-btn if-btn--secondary fg-btn"
            type="button"
            data-fastdas-action="focus-approve-outreach"
            onClick={() => onRecordAction("approve-outreach", surface, detail)}
          >
            <Icon name="check" />Approve Outreach
          </button>
        </div>
      </aside>
    );
  }

  if (surface.id === "agent-operations") {
    const agent = detail.agentRun;
    return (
      <aside
        className="if-panel if-record-detail if-operations-section fg-record-focus fg-record-focus--agent"
        data-fastdas-record-focus-panel
        data-fastdas-agent-focus-panel
        data-fastdas-record-focus-id={agent.name}
      >
        <div className="fg-record-focus__header">
          <div>
            <div className="if-record-detail__eyebrow fg-eyebrow">Agent Runtime Focus</div>
            <h3 className="if-record-detail__title">{agent.name}</h3>
            <p className="if-record-detail__text">{agent.scope}</p>
          </div>
          <Chip tone={toneForValue(agent.status)}>{agent.status}</Chip>
        </div>
        <dl className="if-provenance-grid fg-record-focus__facts">
          <div className="if-provenance-field">
            <dt>Trigger</dt>
            <dd className="if-provenance-field__value">{agent.trigger}</dd>
          </div>
          <div className="if-provenance-field">
            <dt>Output</dt>
            <dd className="if-provenance-field__value">{agent.output}</dd>
          </div>
          <div className="if-provenance-field">
            <dt>Owner</dt>
            <dd className="if-provenance-field__value">{agent.owner}</dd>
          </div>
          <div className="if-provenance-field">
            <dt>Status</dt>
            <dd className="if-provenance-field__value">{agent.status}</dd>
          </div>
          <div className="if-provenance-field">
            <dt>Tool Chain</dt>
            <dd className="if-provenance-field__value">{agent.toolsTouched}</dd>
          </div>
        </dl>
        <div className="if-action-queue if-operations-list fg-record-focus__actions">
          {detail.actions.slice(0, 2).map(action => (
            <div className="if-action-queue__item if-operations-list__item if-operations-list__item--success if-tone-info fg-action-card" key={action}>
              <Icon name="settings" />
              <span>
                <strong className="if-operations-list__title">{action}</strong>
                <em className="if-operations-list__description">Agent-control action</em>
              </span>
            </div>
          ))}
        </div>
        <div className="if-toolbar__group fg-record-focus__toolbar">
          <button
            className="if-btn if-btn--primary fg-btn fg-btn--primary"
            type="button"
            data-fastdas-action="open-agent-details"
            data-fastdas-open-details={agent.name}
            onClick={() => onOpenDetails(agent.name)}
          >
            <Icon name="arrowUp" />{detailsOpen ? "Details Open" : "Open Agent Details"}
          </button>
          <button
            className="if-btn if-btn--secondary fg-btn"
            type="button"
            data-fastdas-action="focus-run-agent"
            onClick={() => onRecordAction("run-agent", surface, detail)}
          >
            <Icon name="refresh" />Run Agent
          </button>
        </div>
      </aside>
    );
  }

  if (surface.id === "synthetic-data") {
    const dataset = detail.dataset;
    return (
      <aside
        className="if-panel if-record-detail if-operations-section fg-record-focus fg-record-focus--dataset"
        data-fastdas-record-focus-panel
        data-fastdas-dataset-focus-panel
        data-fastdas-record-focus-id={dataset.name}
      >
        <div className="fg-record-focus__header">
          <div>
            <div className="if-record-detail__eyebrow fg-eyebrow">Dataset Focus</div>
            <h3 className="if-record-detail__title">{dataset.name}</h3>
            <p className="if-record-detail__text">{dataset.scope}</p>
          </div>
          <Chip tone={toneForValue(dataset.qualityGate)}>{dataset.qualityGate}</Chip>
        </div>
        <dl className="if-provenance-grid fg-record-focus__facts">
          <div className="if-provenance-field">
            <dt>Records</dt>
            <dd className="if-provenance-field__value">{dataset.records}</dd>
          </div>
          <div className="if-provenance-field">
            <dt>Owner</dt>
            <dd className="if-provenance-field__value">{dataset.owner}</dd>
          </div>
          <div className="if-provenance-field">
            <dt>Freshness</dt>
            <dd className="if-provenance-field__value">{dataset.freshness}</dd>
          </div>
          <div className="if-provenance-field">
            <dt>Provenance</dt>
            <dd className="if-provenance-field__value">{dataset.provenance}</dd>
          </div>
          <div className="if-provenance-field">
            <dt>Demo Use</dt>
            <dd className="if-provenance-field__value">{dataset.demoUse}</dd>
          </div>
        </dl>
        <div className="if-action-queue if-operations-list fg-record-focus__actions">
          {detail.actions.slice(0, 2).map(action => (
            <div className="if-action-queue__item if-operations-list__item if-operations-list__item--success if-tone-info fg-action-card" key={action}>
              <Icon name="database" />
              <span>
                <strong className="if-operations-list__title">{action}</strong>
                <em className="if-operations-list__description">Dataset-control action</em>
              </span>
            </div>
          ))}
        </div>
        <div className="if-toolbar__group fg-record-focus__toolbar">
          <button
            className="if-btn if-btn--primary fg-btn fg-btn--primary"
            type="button"
            data-fastdas-action="open-dataset-details"
            data-fastdas-open-details={dataset.name}
            onClick={() => onOpenDetails(dataset.name)}
          >
            <Icon name="arrowUp" />{detailsOpen ? "Details Open" : "Open Dataset Details"}
          </button>
          <button
            className="if-btn if-btn--secondary fg-btn"
            type="button"
            data-fastdas-action="focus-validate-dataset"
            onClick={() => onRecordAction("validate-dataset", surface, detail)}
          >
            <Icon name="check" />Validate Dataset
          </button>
        </div>
      </aside>
    );
  }

  if (surface.id === "conversion-board") {
    const conversion = detail.conversionRecord;
    return (
      <aside
        className="if-panel if-record-detail if-operations-section fg-record-focus fg-record-focus--conversion"
        data-fastdas-record-focus-panel
        data-fastdas-conversion-focus-panel
        data-fastdas-record-focus-id={conversion.name}
      >
        <div className="fg-record-focus__header">
          <div>
            <div className="if-record-detail__eyebrow fg-eyebrow">Conversion Focus</div>
            <h3 className="if-record-detail__title">{conversion.name}</h3>
            <p className="if-record-detail__text">{detail.description}</p>
          </div>
          <Chip tone={toneForValue(conversion.assessment)}>{conversion.assessment}</Chip>
        </div>
        <dl className="if-provenance-grid fg-record-focus__facts">
          <div className="if-provenance-field">
            <dt>Market</dt>
            <dd className="if-provenance-field__value">{conversion.market}</dd>
          </div>
          <div className="if-provenance-field">
            <dt>First Step</dt>
            <dd className="if-provenance-field__value">{conversion.firstPaidStep}</dd>
          </div>
          <div className="if-provenance-field">
            <dt>Conversation</dt>
            <dd className="if-provenance-field__value">{conversion.conversation}</dd>
          </div>
          <div className="if-provenance-field">
            <dt>Follow-On</dt>
            <dd className="if-provenance-field__value">{conversion.followOn}</dd>
          </div>
          <div className="if-provenance-field">
            <dt>Learning</dt>
            <dd className="if-provenance-field__value">{conversion.learning}</dd>
          </div>
        </dl>
        <div className="if-action-queue if-operations-list fg-record-focus__actions">
          {detail.actions.slice(0, 2).map(action => (
            <div className="if-action-queue__item if-operations-list__item if-operations-list__item--success if-tone-info fg-action-card" key={action}>
              <Icon name="chart" />
              <span>
                <strong className="if-operations-list__title">{action}</strong>
                <em className="if-operations-list__description">Conversion-learning action</em>
              </span>
            </div>
          ))}
        </div>
        <div className="if-toolbar__group fg-record-focus__toolbar">
          <button
            className="if-btn if-btn--primary fg-btn fg-btn--primary"
            type="button"
            data-fastdas-action="open-conversion-details"
            data-fastdas-open-details={conversion.name}
            onClick={() => onOpenDetails(conversion.name)}
          >
            <Icon name="arrowUp" />{detailsOpen ? "Details Open" : "Open Conversion Details"}
          </button>
          <button
            className="if-btn if-btn--secondary fg-btn"
            type="button"
            data-fastdas-action="focus-log-conversion"
            onClick={() => onRecordAction("log-conversion", surface, detail)}
          >
            <Icon name="check" />Log Outcome
          </button>
        </div>
      </aside>
    );
  }

  const record = detail.record;
  const isQualificationWorkbench = surface.id === "opportunity-workbench";

  return (
    <aside
      className={`if-panel if-record-detail if-operations-section fg-record-focus ${isQualificationWorkbench ? "fg-record-focus--qualification" : ""}`}
      data-fastdas-record-focus-panel
      data-fastdas-opportunity-focus-panel={isQualificationWorkbench ? "true" : undefined}
      data-fastdas-record-focus-id={record.name}
    >
      <div className="fg-record-focus__header">
        <div>
          <div className="if-record-detail__eyebrow fg-eyebrow">{isQualificationWorkbench ? "Qualification Focus" : "Selected Opportunity"}</div>
          <h3 className="if-record-detail__title">{record.name}</h3>
          <p className="if-record-detail__text">{detail.description}</p>
        </div>
        <Chip tone={toneForValue(record.state)}>{record.state}</Chip>
      </div>
      <dl className="if-provenance-grid fg-record-focus__facts">
        <div className="if-provenance-field">
          <dt>Market</dt>
          <dd className="if-provenance-field__value">{record.market}</dd>
        </div>
        <div className="if-provenance-field">
          <dt>Score</dt>
          <dd className="if-provenance-field__value">{record.score}</dd>
        </div>
        {isQualificationWorkbench ? (
          <div className="if-provenance-field">
            <dt>Signal</dt>
            <dd className="if-provenance-field__value">{record.signal}</dd>
          </div>
        ) : null}
        <div className="if-provenance-field">
          <dt>First Offer</dt>
          <dd className="if-provenance-field__value">{record.firstOffer}</dd>
        </div>
        <div className="if-provenance-field">
          <dt>Confidence</dt>
          <dd className="if-provenance-field__value">{record.confidence}</dd>
        </div>
      </dl>
      <div className="if-action-queue if-operations-list fg-record-focus__actions">
        {detail.actions.slice(0, 2).map(action => (
          <div className="if-action-queue__item if-operations-list__item if-operations-list__item--success if-tone-info fg-action-card" key={action}>
            <Icon name="check" />
            <span>
              <strong className="if-operations-list__title">{action}</strong>
              <em className="if-operations-list__description">Operator-gated action</em>
            </span>
          </div>
        ))}
      </div>
      <div className="if-toolbar__group fg-record-focus__toolbar">
        <button
          className="if-btn if-btn--primary fg-btn fg-btn--primary"
          type="button"
          data-fastdas-action={isQualificationWorkbench ? "open-opportunity-details" : "open-record-details"}
          data-fastdas-open-details={record.name}
          onClick={() => onOpenDetails(record.name)}
        >
          <Icon name="arrowUp" />{detailsOpen ? "Details Open" : isQualificationWorkbench ? "Open Opportunity Details" : "Open Details"}
        </button>
        <button
          className="if-btn if-btn--secondary fg-btn"
          type="button"
          data-fastdas-action={isQualificationWorkbench ? "focus-promote-opportunity" : "focus-approve"}
          onClick={() => onRecordAction(isQualificationWorkbench ? "promote-opportunity" : "approve", surface, detail)}
        >
          <Icon name="check" />{isQualificationWorkbench ? "Promote Review" : "Approve Gate"}
        </button>
      </div>
    </aside>
  );
}

function SourceCards({ cards = [] }) {
  if (!cards.length) return null;
  return (
    <section className="if-pattern-grid if-pattern-grid--ops fg-source-grid" aria-label="Signal source lanes" data-fastdas-source-health>
      {cards.map(([title, status, body], index) => (
        <article className="if-pattern-card if-source-health-card if-operations-section fg-source-card" key={title}>
          <div className="if-pattern-card__header fg-source-card__top">
            <span className="if-source-card__icon fg-source-card__mark if-icon-slot" data-if-icon={index % 2 === 0 ? "source" : "shield"} aria-hidden="true" />
            <div>
              <h3 className="if-card__title">{title}</h3>
              <p>{body}</p>
            </div>
            <Chip tone={toneForValue(status)}>{status}</Chip>
          </div>
          <div className="if-ops-meter-list">
            <div>
              <span>Freshness</span>
              <strong>{index === 2 ? "Weekly" : "Current"}</strong>
              <i style={{ width: `${index === 2 ? 68 : 92}%` }} />
            </div>
            <div>
              <span>Source trust</span>
              <strong>{index === 2 ? "0.68" : index === 1 ? "0.79" : "0.87"}</strong>
              <i style={{ width: `${index === 2 ? 68 : index === 1 ? 79 : 87}%` }} />
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

function ExpandedRecord({ surface, selectedRowId, detail, onRecordAction, columnSpan = surface.table.columns.length }) {
  return (
    <tr className="if-table-detail is-expanded fg-expanded-row" data-if-table-detail data-opportunity-focus-row>
      <td colSpan={columnSpan} data-opportunity-focus-card>
        <div data-opportunity-focus-frame>
          <div className="if-table-detail__content if-record-detail if-record-detail--intelligence if-operations-section-grid fg-expanded" data-workspace-detail-panel data-fastdas-expanded-record data-fastdas-expanded-record-id={selectedRowId}>
          <section className="if-record-detail__section if-operations-section fg-expanded__section">
            <div className="if-record-detail__eyebrow fg-eyebrow">Selected Record</div>
            <h3 className="if-record-detail__title">{detail.title}</h3>
            <p className="if-record-detail__text">{detail.description}</p>
            <div className="if-status-timeline fg-flow" aria-label="Workflow state">
              {detail.gates.map((gate, index) => {
                const gateState = index < Math.max(1, detail.gates.length - 3)
                  ? "if-status-step--complete is-complete"
                  : index === Math.max(1, detail.gates.length - 3)
                    ? "if-status-step--active is-active"
                    : "if-status-step--pending";
                return (
                  <div className={`if-status-step ${gateState}`} key={gate}>
                    <strong>{gate}</strong>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="if-record-detail__section if-operations-section fg-expanded__section" data-fastdas-provenance>
            <div className="if-record-detail__eyebrow fg-eyebrow">Evidence + Provenance</div>
            <div className="if-source-feed-grid fg-evidence-grid">
              {detail.evidence.map(([title, badge, text]) => (
                <article className={`if-evidence-panel if-provenance-layer if-source-feed-card if-source-feed-card--balanced is-${toneForValue(badge) === "danger" ? "error" : toneForValue(badge)} fg-evidence`} key={title}>
                  <div className="if-source-feed-card__header">
                    <div>
                      <strong className="if-source-feed-card__title">{title}</strong>
                      <span className="if-source-feed-card__meta">Provenance layer</span>
                    </div>
                    <span className={`if-source-badge if-source-badge--${toneForValue(badge) === "success" ? "system" : toneForValue(badge) === "blue" ? "derived" : toneForValue(badge) === "warning" ? "manual" : "compact"} fg-chip ${toneClass(toneForValue(badge))}`}>{badge}</span>
                  </div>
                  <p className="if-source-feed-card__description">{text}</p>
                </article>
              ))}
            </div>
          </section>
          <section className="if-record-detail__section if-operations-section fg-expanded__section" data-fastdas-human-approval-boundary>
            <div className="if-record-detail__eyebrow fg-eyebrow">Operator Workbench</div>
            <div className="if-alert if-alert--info fg-callout">
              <strong>First paid step:</strong> Keep the ask bounded to survey, inspection, benchmark, testing engagement, troubleshooting visit, or system review.
            </div>
            <div className="if-review-workflow fg-review-workflow" data-if-review-workflow data-fastdas-review-workflow>
              <div className="if-review-workflow__main">
                <div className="if-review-workflow__toolbar fg-action-row" role="toolbar" aria-label={`${detail.title} review actions`}>
                  <button
                    type="button"
                    className="if-btn if-btn--success fg-btn fg-btn--primary"
                    data-if-review-action="approve"
                    data-fastdas-action="approve-record"
                    onClick={() => onRecordAction("approve", surface, detail)}
                  >
                    <Icon name="check" />Approve
                  </button>
                  <button
                    type="button"
                    className="if-btn if-btn--secondary fg-btn"
                    data-if-review-action="reopen"
                    data-fastdas-action="edit-record"
                    onClick={() => onRecordAction("edit", surface, detail)}
                  >
                    <Icon name="edit" />Edit
                  </button>
                  <button
                    type="button"
                    className="if-btn if-btn--secondary fg-btn"
                    data-if-review-action="assign"
                    data-fastdas-action="assign-record"
                    onClick={() => onRecordAction("assign", surface, detail)}
                  >
                    <Icon name="users" />Assign
                  </button>
                  <button
                    type="button"
                    className="if-btn if-btn--danger fg-btn fg-btn--danger"
                    data-if-review-action="snooze"
                    data-fastdas-action="hold-record"
                    onClick={() => onRecordAction("hold", surface, detail)}
                  >
                    <Icon name="x" />Hold
                  </button>
                </div>
                <div className="if-review-workflow__summary" aria-label="Selected record review counts">
                  <span><strong data-if-review-count="open">1</strong><em>Open</em></span>
                  <span><strong data-if-review-count="approved">0</strong><em>Approved</em></span>
                  <span><strong data-if-review-count="assigned">0</strong><em>Assigned</em></span>
                  <span><strong data-if-review-count="snoozed">0</strong><em>Held</em></span>
                </div>
                <div className="if-review-workflow__queue" role="listbox" aria-label="Selected record review queue">
                  <button
                    type="button"
                    className="if-review-workflow__item is-selected"
                    data-if-review-item={selectedRowId}
                    data-if-review-title={detail.title}
                    data-if-review-status="open"
                    data-if-review-severity="high"
                    aria-selected="true"
                  >
                    <span>
                      <strong>{detail.title}</strong>
                      <em>{detail.description}</em>
                    </span>
                    <span className="if-badge if-badge--review-status" data-if-review-item-status>Open</span>
                  </button>
                </div>
              </div>
              <aside className="if-review-workflow__detail">
                <div className="if-review-workflow__detail-header">
                  <div>
                    <p data-if-review-current-id>{selectedRowId}</p>
                    <h4 data-if-review-current-title>{detail.title}</h4>
                  </div>
                  <span className="if-badge if-badge--review-status" data-if-review-current-status>Open</span>
                </div>
                <section className="if-review-workflow__panel" data-if-review-panel={selectedRowId}>
                  <div className="if-action-queue if-operations-list fg-action-list">
                    {detail.actions.map(action => (
                      <div className="if-action-queue__item if-operations-list__item if-operations-list__item--success if-tone-info fg-action-card" key={action}>
                        <Icon name="check" />
                        <span>
                          <strong className="if-operations-list__title">{action}</strong>
                          <em className="if-operations-list__description">Human-gated next step</em>
                        </span>
                        <Chip tone="blue">Action</Chip>
                      </div>
                    ))}
                  </div>
                </section>
                <label className="if-field">
                  <span className="if-field__label">Decision reason</span>
                  <textarea className="if-textarea" data-if-review-reason defaultValue="Bounded first paid step, source-safe evidence, and human approval retained." />
                </label>
                <div className="if-review-workflow__shortcuts" aria-label="Review keyboard shortcuts">
                  <span><kbd>A</kbd> Approve</span>
                  <span><kbd>R</kbd> Reopen</span>
                  <span><kbd>N</kbd> Notes</span>
                </div>
                <ol className="if-review-workflow__ledger" data-if-review-ledger aria-label="Inline review action ledger" />
              </aside>
            </div>
          </section>
        </div>
        </div>
      </td>
    </tr>
  );
}

function recordCardFieldIndexes(columns) {
  const lower = columns.map(column => column.toLowerCase());
  const titleIndex = lower.findIndex(column => /opportunity|dataset|source|evidence|agent/.test(column));
  const stateIndex = lower.findIndex(column => /state|status|gate|demo use|quality/.test(column));
  const leadIndexes = columns
    .map((column, index) => ({ column, index }))
    .filter(({ index }) => index !== titleIndex && index !== stateIndex)
    .slice(0, 4);

  return {
    titleIndex: titleIndex >= 0 ? titleIndex : 0,
    stateIndex: stateIndex >= 0 ? stateIndex : Math.min(columns.length - 1, 3),
    leadIndexes,
  };
}

function MobileWorkbenchCards({ surface, rows, selectedRowId, detailOpenRowId, onSelect, onOpenDetails, onRecordAction }) {
  const columns = surface.table.columns;
  const { titleIndex, stateIndex, leadIndexes } = recordCardFieldIndexes(columns);

  return (
    <div className="fg-mobile-record-list" data-fastdas-mobile-record-list>
      {rows.map(row => {
        const selected = row.id === selectedRowId;
        const detailsOpen = selected && detailOpenRowId === row.id;
        const title = splitCell(row.cells[titleIndex] || row.id);
        const signal = splitCell(row.cells[0] || row.id);
        const status = splitCell(row.cells[stateIndex] || "Active");
        const detail = detailForSurfaceSelection(surface, row.id);

        return (
          <article
            className={`fg-mobile-record-card${selected ? " is-selected" : ""}${detailsOpen ? " is-expanded" : ""}`}
            data-fastdas-mobile-record-card
            data-fastdas-mobile-record-card-id={row.id}
            key={`${surface.id}-${row.id}-mobile-card`}
          >
            <button
              type="button"
              className="fg-mobile-record-card__summary"
              data-fastdas-mobile-record-card-button
              aria-expanded={selected}
              aria-selected={selected}
              onClick={() => onSelect(row.id)}
              title={`Inspect ${title.primary}`}
            >
              <span className="fg-mobile-record-card__topline">
                <span className="fg-mobile-record-card__signal">{signal.primary}</span>
                <span className={`fg-mobile-record-card__status ${toneClass(toneForValue(status.primary))}`}>{status.primary}</span>
              </span>
              <strong className="fg-mobile-record-card__title">{title.primary}</strong>
              {title.secondary ? <span className="fg-mobile-record-card__subtitle">{title.secondary}</span> : null}
            </button>
            <div className="fg-mobile-record-card__meta" data-fastdas-mobile-record-fields>
              {leadIndexes.map(({ column, index }) => {
                const value = splitCell(row.cells[index] || "");
                return (
                  <div className="fg-mobile-record-card__field" data-fastdas-mobile-record-field={column} key={`${row.id}-${column}`}>
                    <span>{column}</span>
                    <strong>{value.primary}</strong>
                    {value.secondary ? <em>{value.secondary}</em> : null}
                  </div>
                );
              })}
            </div>
            <div className="fg-mobile-record-card__actions">
              <button
                type="button"
                className={`if-btn fg-btn ${selected ? "if-btn--primary fg-btn--primary" : "if-btn--secondary"}`}
                data-fastdas-mobile-select-record={row.id}
                onClick={() => onSelect(row.id)}
              >
                {selected ? "Selected" : "Select"}
              </button>
              <button
                type="button"
                className="if-btn if-btn--secondary fg-btn"
                data-fastdas-mobile-open-details={row.id}
                aria-expanded={detailsOpen}
                onClick={() => {
                  onSelect(row.id);
                  onOpenDetails(row.id);
                }}
              >
                {detailsOpen ? "Collapse" : "Details"}
              </button>
            </div>
            {selected && !detailsOpen && surface.id !== "command-center" ? (
              <div className="fg-mobile-record-card__focus" data-fastdas-mobile-focus-card data-fastdas-mobile-focus-card-id={row.id}>
                <RecordFocusPanel
                  surface={surface}
                  selectedRowId={row.id}
                  detailsOpen={detailsOpen}
                  onOpenDetails={onOpenDetails}
                  onRecordAction={onRecordAction}
                />
              </div>
            ) : null}
            {detailsOpen ? (
              <div className="fg-mobile-record-card__detail" data-fastdas-mobile-expanded-card data-fastdas-mobile-expanded-card-id={row.id}>
                <table className="fg-mobile-expanded-table" aria-label={`${title.primary} detail`}>
                  <tbody>
                    <ExpandedRecord
                      surface={surface}
                      selectedRowId={row.id}
                      detail={detail}
                      onRecordAction={onRecordAction}
                    />
                  </tbody>
                </table>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

const COMMAND_CENTER_COLUMN_WIDTHS = [72, 260, 220, 92, 180, 190, 150, 210];

function CommandCenterOipTable({ surface, selectedRowId, detailOpenRowId, commandQuickFilterId, onSelect, onOpenDetails, onRecordAction }) {
  const columns = surface.table.columns;
  const rows = commandCenterRowsForFilter(surface, commandQuickFilterId);
  const activeCommandFilter = commandCenterQuickFilter(commandQuickFilterId);
  const isMobileWorkbench = useMobileWorkbenchLayout();
  const tableMinWidth = COMMAND_CENTER_COLUMN_WIDTHS.reduce((sum, width) => sum + width, 0) + 82;

  function toggleRow(rowId) {
    onSelect(rowId);
    onOpenDetails(rowId);
  }

  return (
    <section
      className="if-panel if-data-table if-table-shell ci-contract-table-panel ci-page-band ci-page-band--table fg-panel fg-panel--command-center fg-oip-command-table"
      data-fastdas-opportunity-grid
      data-page-band="opportunities-table"
      {...gridSurfaceAttributes(surface.id)}
      data-fastdas-active-command-filter={activeCommandFilter.id}
      data-if-data-table
      data-if-table-density="compact"
      data-opportunity-table-focus
    >
      <div data-bulk-state-toolbar className="ci-opportunity-bulk-toolbar fg-oip-command-toolbar">
        <div className="fg-oip-command-toolbar__selection">
          <span className="fg-oip-command-toolbar__count">{selectedRowId ? "1 selected" : "0 selected"}</span>
          <button type="button" className="if-btn if-btn--sm" onClick={() => rows[0] && onSelect(rows[0].id)}>
            Select filtered
          </button>
          <button
            type="button"
            className="if-btn if-btn--sm"
            data-close-focus-rows
            onClick={() => detailOpenRowId && onOpenDetails(detailOpenRowId)}
            disabled={!detailOpenRowId}
            title={detailOpenRowId ? "Close the embedded focus row in the datatable" : "No embedded focus row is open"}
          >
            Close Focus
          </button>
        </div>
        <span className="if-badge fg-oip-command-toolbar__filter" data-fastdas-command-filter-label>{activeCommandFilter.label}</span>
      </div>

      <div
        className={`fg-focused-workbench fg-command-center-workbench fg-command-center-workbench--oip ${detailOpenRowId ? "fg-focused-workbench--details-open fg-command-center-workbench--details-open" : ""}`}
        data-fastdas-record-workbench="true"
        {...workbenchSurfaceAttributes(surface.id)}
      >
        <div className="if-table-wrap if-table-scroll fg-table-wrap">
          <table className="if-table if-table--sticky if-table--public-records if-table--dense ci-contract-table fg-table fg-oip-command-grid" style={{ minWidth: `${tableMinWidth}px` }}>
            <colgroup>
              <col className="fg-oip-command-grid__select-col" />
              {columns.map((column, index) => <col key={column} style={{ width: COMMAND_CENTER_COLUMN_WIDTHS[index] }} />)}
              <col className="fg-oip-command-grid__expand-col" />
            </colgroup>
            <thead>
              <tr>
                <th className="fg-table-select-header" aria-label="Select row"></th>
                {columns.map(column => <th key={column}>{column}</th>)}
                <th className="fg-table-expand-header" aria-label="Expand row"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => {
                const selected = row.id === selectedRowId;
                const expanded = selected && detailOpenRowId === row.id;
                const title = splitCell(row.cells[1] || row.id);
                const selectedDetail = detailForSurfaceSelection(surface, row.id);
                return (
                  <Fragment key={row.id}>
                    <tr
                      className={`ci-contract-data-row ${rowIndex % 2 === 0 ? "is-even" : "is-odd"}${selected ? " is-selected" : ""}${expanded ? " is-expanded" : ""}`}
                      data-if-table-row
                      data-fastdas-table-row-id={row.id}
                      data-opportunity-row-id={row.id}
                      data-opportunity-row-title={title.primary}
                      data-if-table-expanded={expanded ? "true" : "false"}
                      data-if-table-search={row.cells.join(" ")}
                      aria-selected={selected}
                      tabIndex={0}
                      onClick={() => toggleRow(row.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleRow(row.id);
                        }
                      }}
                    >
                      <td className="fg-table-select-cell" data-if-table-cell="select">
                        <input
                          type="checkbox"
                          checked={selected}
                          aria-label={`Select ${title.primary}`}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => onSelect(row.id)}
                        />
                      </td>
                      {row.cells.map((cell, index) => (
                        <td key={`${row.id}-${columns[index]}`} data-if-table-cell={columns[index].toLowerCase().replace(/[^a-z0-9]+/g, "-")}>
                          <TableCell value={cell} column={columns[index]} />
                        </td>
                      ))}
                      <td className="fg-table-expand-cell" data-if-table-cell="row-actions">
                        <button
                          className="if-table-expand if-icon-btn fg-expand-btn"
                          type="button"
                          data-if-table-expand
                          aria-expanded={expanded}
                          aria-label={`${expanded ? "Collapse" : "Expand"} ${title.primary}`}
                          title={expanded ? "Collapse embedded focus" : "Expand embedded focus"}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleRow(row.id);
                          }}
                        >
                          {expanded ? "▲" : "▼"}
                        </button>
                      </td>
                    </tr>
                    {!isMobileWorkbench && expanded ? (
                      <ExpandedRecord
                        key={`${row.id}-expanded`}
                        surface={surface}
                        selectedRowId={row.id}
                        detail={selectedDetail}
                        onRecordAction={onRecordAction}
                        columnSpan={columns.length + 2}
                      />
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {isMobileWorkbench ? (
          <MobileWorkbenchCards
            surface={surface}
            rows={rows}
            selectedRowId={selectedRowId}
            detailOpenRowId={detailOpenRowId}
            onSelect={onSelect}
            onOpenDetails={onOpenDetails}
            onRecordAction={onRecordAction}
          />
        ) : null}
      </div>

      <nav className="if-pagination if-pagination--full fg-command-pagination" data-ui-pagination aria-label="Command Center rows pagination">
        <div className="if-pagination__summary" aria-live="polite">Showing 1-{rows.length} of {rows.length} records</div>
        <div className="if-pagination__controls">
          <label className="if-pagination__label">
            Rows
            <select className="if-select if-pagination__select" aria-label="Command Center rows per page" value={10} onChange={() => {}}>
              <option value={10}>10</option>
            </select>
          </label>
          <div className="if-pagination__pages">
            <button type="button" className="if-btn if-btn--sm" disabled>First</button>
            <button type="button" className="if-btn if-btn--sm" disabled>Prev</button>
            <span className="if-pagination__page" aria-label="Page 1 of 1">1 / 1</span>
            <button type="button" className="if-btn if-btn--sm" disabled>Next</button>
            <button type="button" className="if-btn if-btn--sm" disabled>Last</button>
          </div>
        </div>
      </nav>
    </section>
  );
}

function OpportunityGrid({ surface, selectedRowId, detailOpenRowId, commandQuickFilterId, onSelect, onOpenDetails, onPrimaryAction, onUtilityAction, onRecordAction }) {
  const columns = surface.table.columns;
  const selectedDetail = detailForSurfaceSelection(surface, selectedRowId);
  const detailsOpen = detailOpenRowId === selectedRowId;
  const isMobileWorkbench = useMobileWorkbenchLayout();
  const isCommandCenter = surface.id === "command-center";
  const isFocusedWorkbench = isFocusedWorkbenchSurface(surface.id);
  const workbenchConfig = workbenchSurfaceConfig(surface.id);
  const visibleFilters = isCommandCenter ? [] : isFocusedWorkbench ? surface.filters.slice(0, 3) : surface.filters;
  const rows = isCommandCenter ? commandCenterRowsForFilter(surface, commandQuickFilterId) : surface.table.rows;
  const activeCommandFilter = isCommandCenter ? commandCenterQuickFilter(commandQuickFilterId) : null;
  function handleRowActivate(rowId) {
    onSelect(rowId);
    if (isCommandCenter) onOpenDetails(rowId);
  }

  if (isCommandCenter) {
    return (
      <CommandCenterOipTable
        surface={surface}
        selectedRowId={selectedRowId}
        detailOpenRowId={detailOpenRowId}
        commandQuickFilterId={commandQuickFilterId}
        onSelect={onSelect}
        onOpenDetails={onOpenDetails}
        onRecordAction={onRecordAction}
      />
    );
  }

  return (
    <section
      className={`if-panel if-data-table if-table-shell ci-contract-table-panel ci-page-band ci-page-band--table fg-panel ${isFocusedWorkbench ? "fg-panel--focused-workbench" : ""} ${isCommandCenter ? "fg-panel--command-center" : ""}`}
      data-fastdas-opportunity-grid
      data-page-band="opportunities-table"
      {...gridSurfaceAttributes(surface.id)}
      data-fastdas-active-command-filter={isCommandCenter ? activeCommandFilter.id : undefined}
      data-if-data-table
      data-if-table-density="compact"
      data-opportunity-table-focus
    >
      {!isCommandCenter ? <div className="if-panel__header fg-panel__header">
        <div>
          <h2 className="if-panel__title">{surface.title === "Command Center" ? "Top Opportunities" : surface.title}</h2>
          <p className="if-panel__subtitle">
            {isFocusedWorkbench
              ? `${surface.table.count}. Click a row to inspect it, then open full details only when needed.`
              : `${surface.table.count}. Selected records expand inline for evidence, provenance, scoring, actions, and approval gates.`}
          </p>
        </div>
        {isCommandCenter ? null : (
          <div className="fg-panel__header-actions">
            <Chip tone="blue">Selected: {selectedRowId}</Chip>
            <Chip tone="warning">Human approval</Chip>
          </div>
        )}
      </div> : null}
      {!isCommandCenter ? <div className="if-table-command-band if-toolbar fg-command-band">
        <div className="if-table-command-band__leading fg-command-band__leading">
          <label className="if-search fg-table-search">
            <Icon name="search" />
            <input
              className="if-input"
              type="search"
              data-if-table-filter
              placeholder={isFocusedWorkbench ? "Search current view..." : "Search records, owners, sources..."}
              aria-label="Search current table"
            />
          </label>
          <span className="if-badge fg-counter"><strong data-if-table-status="filtered">{rows.length}</strong> visible</span>
          {!isFocusedWorkbench ? <span className="if-badge fg-counter"><strong data-if-table-status="selected">1</strong> selected</span> : null}
        </div>
        <div className="if-table-command-band__filters fg-command-band__filters">
          {visibleFilters.map(filter => (
            <button
              className="if-btn if-btn--secondary if-btn--sm fg-filter"
              type="button"
              key={filter}
              onClick={() => onUtilityAction("Filter staged", `${filter} is now staged for the customer demo view.`, "blue")}
            >
              {filter}
            </button>
          ))}
          {!isCommandCenter && workbenchConfig.viewLabel ? <span className="if-badge fg-counter">{workbenchConfig.viewLabel}</span> : null}
          {activeCommandFilter ? <span className="if-badge fg-counter" data-fastdas-command-filter-label>{activeCommandFilter.label}</span> : null}
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
          {isCommandCenter ? null : (
            <>
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
            </>
          )}
        </div>
      </div> : null}
      {isCommandCenter ? (
        <div
          data-bulk-state-toolbar
          className="ci-opportunity-bulk-toolbar"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "8px 10px",
            borderBottom: `1px solid ${U.baseLighter}`,
            background: detailOpenRowId ? U.primaryLighter : U.baseLightest,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: detailOpenRowId ? U.primaryDarker : U.baseDark }}>
              {selectedRowId ? "1 selected" : "0 selected"}
            </span>
            <button
              type="button"
              title={`Select all ${rows.length} command-center rows matching the current filter`}
              style={{ border: `1px solid ${U.baseLighter}`, background: U.white, color: U.primary, borderRadius: 4, padding: "5px 8px", fontSize: 11, fontWeight: 900, cursor: "pointer" }}
              onClick={() => rows[0] && onSelect(rows[0].id)}
            >
              Select filtered
            </button>
            <button
              type="button"
              data-close-focus-rows
              onClick={() => detailOpenRowId && onOpenDetails(detailOpenRowId)}
              disabled={!detailOpenRowId}
              title={detailOpenRowId ? "Close the embedded focus row in the datatable" : "No embedded focus row is open"}
              style={{
                border: `1px solid ${U.baseLighter}`,
                background: U.white,
                color: detailOpenRowId ? U.primary : U.base,
                borderRadius: 4,
                padding: "5px 8px",
                fontSize: 11,
                fontWeight: 900,
                cursor: detailOpenRowId ? "pointer" : "not-allowed",
                whiteSpace: "nowrap",
              }}
            >
              Close Focus
            </button>
          </div>
          <span className="if-badge" data-fastdas-command-filter-label>{activeCommandFilter?.label}</span>
        </div>
      ) : null}
      <div
        className={isFocusedWorkbench ? `fg-focused-workbench fg-command-center-workbench ${detailsOpen ? "fg-focused-workbench--details-open fg-command-center-workbench--details-open" : ""}` : ""}
        data-fastdas-record-workbench={isFocusedWorkbench ? "true" : undefined}
        {...workbenchSurfaceAttributes(surface.id)}
      >
        <div className="if-table-wrap if-table-scroll fg-table-wrap">
          <table className="if-table if-table--sticky if-table--public-records if-table--dense ci-contract-table fg-table">
            <thead>
              <tr>
                {columns.map((column, index) => <th key={column} data-if-table-width={index === 1 ? "16rem" : undefined}>{column}</th>)}
                {isCommandCenter ? <th className="fg-table-expand-header" aria-label="Expand row"></th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <Fragment key={row.id}>
                  <tr
                    className={`ci-contract-data-row${row.id === selectedRowId ? " is-selected" : ""}${row.id === selectedRowId && detailOpenRowId === row.id ? " is-expanded" : ""}`}
                    data-if-table-row
                    data-fastdas-table-row-id={row.id}
                    data-opportunity-row-id={row.id}
                    data-opportunity-row-title={splitCell(row.cells[0]).primary}
                    data-if-table-expanded={row.id === selectedRowId && detailOpenRowId === row.id ? "true" : "false"}
                    data-if-table-search={row.cells.join(" ")}
                    aria-selected={row.id === selectedRowId}
                    tabIndex={0}
                    onClick={() => handleRowActivate(row.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleRowActivate(row.id);
                      }
                    }}
                  >
                    {row.cells.map((cell, index) => (
                      <td key={`${row.id}-${columns[index]}`} data-if-table-cell={columns[index].toLowerCase().replace(/[^a-z0-9]+/g, "-")}>
                        {index === 0 && !isCommandCenter ? (
                          <span className="if-table-actions fg-table-record-cell">
                            <button
                              className="if-icon-btn fg-expand-btn"
                              type="button"
                              data-if-table-expand
                              aria-expanded={row.id === selectedRowId && detailOpenRowId === row.id}
                              aria-label={`Toggle ${splitCell(cell).primary}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                onSelect(row.id);
                                onOpenDetails(row.id);
                              }}
                            >
                              <Icon name="chevronDown" />
                            </button>
                            <TableCell value={cell} column={columns[index]} />
                          </span>
                        ) : <TableCell value={cell} column={columns[index]} />}
                      </td>
                    ))}
                    {isCommandCenter ? (
                      <td className="fg-table-expand-cell" data-if-table-cell="row-actions">
                        <button
                          className="if-table-expand if-icon-btn fg-expand-btn"
                          type="button"
                          data-if-table-expand
                          aria-expanded={row.id === selectedRowId && detailOpenRowId === row.id}
                          aria-label={`Toggle ${splitCell(row.cells[0]).primary}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelect(row.id);
                            onOpenDetails(row.id);
                          }}
                        >
                          <Icon name="chevronDown" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                  {!isMobileWorkbench && row.id === selectedRowId && detailOpenRowId === row.id ? (
                    <ExpandedRecord
                      key={`${row.id}-expanded`}
                      surface={surface}
                      selectedRowId={row.id}
                      detail={selectedDetail}
                      onRecordAction={onRecordAction}
                      columnSpan={columns.length + (isCommandCenter ? 1 : 0)}
                    />
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {isCommandCenter ? (
          <nav
            className="if-pagination if-pagination--full fg-command-pagination"
            data-ui-pagination
            aria-label="Command Center rows pagination"
          >
            <div className="if-pagination__summary" aria-live="polite">
              Showing 1-{rows.length} of {rows.length} records
            </div>
            <div className="if-pagination__controls">
              <label className="if-pagination__label">
                Rows
                <select className="if-select if-pagination__select" aria-label="Command Center rows per page" value={10} onChange={() => {}}>
                  <option value={10}>10</option>
                </select>
              </label>
              <div className="if-pagination__pages">
                <button type="button" className="if-btn if-btn--sm" disabled>First</button>
                <button type="button" className="if-btn if-btn--sm" disabled>Prev</button>
                <span className="if-pagination__page" aria-label="Page 1 of 1">1 / 1</span>
                <button type="button" className="if-btn if-btn--sm" disabled>Next</button>
                <button type="button" className="if-btn if-btn--sm" disabled>Last</button>
              </div>
            </div>
          </nav>
        ) : null}
        {isFocusedWorkbench && isMobileWorkbench ? (
          <MobileWorkbenchCards
            surface={surface}
            rows={rows}
            selectedRowId={selectedRowId}
            detailOpenRowId={detailOpenRowId}
            onSelect={onSelect}
            onOpenDetails={onOpenDetails}
            onRecordAction={onRecordAction}
          />
        ) : null}
        {!detailsOpen && !isMobileWorkbench && !isCommandCenter ? (
          <RecordFocusPanel
            surface={surface}
            selectedRowId={selectedRowId}
            detailsOpen={detailsOpen}
            onOpenDetails={onOpenDetails}
            onRecordAction={onRecordAction}
          />
        ) : null}
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
          <h2 className="if-panel__title">Seed + Dataset Controls</h2>
          <p className="if-panel__subtitle">Keep the walkthrough repeatable: generate a scenario, export the browser-local runtime bundle, or reset to the golden seed.</p>
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

      <div className="if-ops-command-strip fg-management__control-grid">
        {management.controls.map(([label, value, body]) => (
          <article className="if-ops-kpi fg-management-control-card" key={label}>
            <span>{label}</span>
            <strong>{valueOverrides[label] || value}</strong>
            <p>{body}</p>
          </article>
        ))}
      </div>

      <details className="if-panel fg-management-details" data-fastdas-synthetic-management-details>
        <summary>
          <span>
            <strong>Dataset inventory and scenario packs</strong>
            <em>Quality gates, scenario coverage, and demo safety contracts</em>
          </span>
          <Chip tone="blue">Open details</Chip>
        </summary>
        <div className="if-pattern-grid if-pattern-grid--ops fg-management-grid">
          {management.areas.map(area => (
            <article className="if-pattern-card if-operations-section fg-management-card" data-fastdas-management-area key={area.title}>
              <div className="if-pattern-card__header fg-management-card__top">
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
              <ul className="if-check-list">
                {area.checks.map(check => <li key={check}>{check}</li>)}
              </ul>
            </article>
          ))}
        </div>

        <section className="fg-scenario-panel" data-fastdas-scenario-packs>
          <div className="if-panel__header fg-panel__header">
            <div>
              <h2 className="if-panel__title">Scenario Packs</h2>
              <p className="if-panel__subtitle">Switchable synthetic narratives for customer-specific walkthroughs while keeping the same operating model.</p>
            </div>
            <Chip tone="blue">4 packs ready</Chip>
          </div>
          <div className="if-pattern-grid fg-scenario-grid">
            {management.scenarioPacks.map(([title, body, count]) => (
              <article className="if-pattern-card if-operations-section fg-scenario-card" data-fastdas-scenario-pack key={title}>
                <div className="if-pattern-card__header fg-scenario-card__header">
                  <Icon name="layers" />
                  <div>
                    <h3 className="if-card__title">{title}</h3>
                    <p className="if-panel__subtitle">{body}</p>
                  </div>
                </div>
                <div className="if-rule-builder-mini">
                  <div className="if-rule-line">
                    <span>Scenario range</span>
                    <Chip tone={toneForValue(count)}>{count}</Chip>
                  </div>
                  <div className="if-rule-line">
                    <span>Synthetic guardrail</span>
                    <strong>Customer safe</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </details>
    </section>
  );
}

function SyntheticPipelineConsole({
  visible,
  draft,
  syntheticRecords,
  pipelineOverrides,
  onDraftChange,
  onSubmit,
  onGenerateRecord,
  onPipelineStep,
  onOpenRecord,
  onRemoveRecord,
}) {
  if (!visible) return null;

  return (
    <section className="if-panel if-operations-section fg-synthetic-console" data-fastdas-synthetic-console>
      <div className="if-panel__header fg-panel__header">
        <div>
          <div className="fg-eyebrow">Runtime Demo Input</div>
          <h2 className="if-panel__title">Enter Synthetic Opportunity</h2>
          <p className="if-panel__subtitle">Create browser-local, customer-safe records and push them through the same pipeline surfaces as the seeded demo data.</p>
        </div>
        <div className="if-toolbar__group fg-synthetic-console__actions">
          <button className="if-btn if-btn--secondary fg-btn" type="button" data-fastdas-action="generate-scenario-record" onClick={onGenerateRecord}>
            <Icon name="plus" />Generate Scenario Record
          </button>
        </div>
      </div>

      <form className="fg-synthetic-entry-form" data-fastdas-synthetic-entry-form onSubmit={onSubmit}>
        <label className="if-field">
          <span className="if-field__label">Opportunity</span>
          <input className="if-input" data-fastdas-synthetic-input="name" value={draft.name} onChange={event => onDraftChange("name", event.target.value)} placeholder="Example: Metro Center Garage" required />
        </label>
        <label className="if-field">
          <span className="if-field__label">Market</span>
          <input className="if-input" data-fastdas-synthetic-input="market" value={draft.market} onChange={event => onDraftChange("market", event.target.value)} />
        </label>
        <label className="if-field">
          <span className="if-field__label">Building Type</span>
          <input className="if-input" data-fastdas-synthetic-input="buildingType" value={draft.buildingType} onChange={event => onDraftChange("buildingType", event.target.value)} />
        </label>
        <label className="if-field">
          <span className="if-field__label">Signal</span>
          <input className="if-input" data-fastdas-synthetic-input="signal" value={draft.signal} onChange={event => onDraftChange("signal", event.target.value)} />
        </label>
        <label className="if-field">
          <span className="if-field__label">First Paid Step</span>
          <input className="if-input" data-fastdas-synthetic-input="firstOffer" value={draft.firstOffer} onChange={event => onDraftChange("firstOffer", event.target.value)} />
        </label>
        <label className="if-field">
          <span className="if-field__label">Stakeholder Path</span>
          <input className="if-input" data-fastdas-synthetic-input="stakeholderPath" value={draft.stakeholderPath} onChange={event => onDraftChange("stakeholderPath", event.target.value)} />
        </label>
        <label className="if-field">
          <span className="if-field__label">Score</span>
          <input className="if-input" data-fastdas-synthetic-input="score" type="number" min="50" max="99" value={draft.score} onChange={event => onDraftChange("score", event.target.value)} />
        </label>
        <button className="if-btn if-btn--primary fg-btn fg-btn--primary" type="submit" data-fastdas-action="add-synthetic-record">
          <Icon name="check" />Add to Pipeline
        </button>
      </form>

      <div className="fg-synthetic-runtime" data-fastdas-synthetic-runtime>
        <div className="fg-synthetic-runtime__summary">
          <span className="if-route-status"><strong>Runtime records</strong><span data-fastdas-synthetic-record-count>{syntheticRecords.length}</span></span>
          <span className="if-route-status"><strong>Storage</strong><span>Browser-local</span></span>
          <span className="if-route-status"><strong>Safety</strong><span>Synthetic only</span></span>
        </div>
        {syntheticRecords.length ? (
          <div className="fg-synthetic-record-list">
            {syntheticRecords.map(record => {
              const workflowIndex = pipelineOverrides[record.name]?.workflowIndex ?? 0;
              const stage = workflowStages[workflowIndex] || workflowStages[0];
              return (
                <article className="if-pattern-card if-operations-section fg-synthetic-record" data-fastdas-synthetic-runtime-record={record.name} key={record.name}>
                  <div className="if-pattern-card__header fg-synthetic-record__header">
                    <div>
                      <h3 className="if-card__title">{record.name}</h3>
                      <p className="if-panel__subtitle">{record.market} / {record.buildingType}</p>
                    </div>
                    <Chip tone={workflowIndex >= 4 ? "success" : workflowIndex >= 3 ? "warning" : "blue"}>{stage}</Chip>
                  </div>
                  <div className="if-provenance-grid fg-synthetic-record__meta">
                    <span className="if-provenance-field"><strong className="if-provenance-field__value">{record.score}</strong> Score</span>
                    <span className="if-provenance-field"><strong className="if-provenance-field__value">{record.firstOffer}</strong> First paid step</span>
                    <span className="if-provenance-field"><strong className="if-provenance-field__value">{record.signal}</strong> Signal</span>
                  </div>
                  <div className="fg-synthetic-pipeline-actions" role="toolbar" aria-label={`${record.name} pipeline controls`}>
                    {workflowStages.map((stageLabel, index) => (
                      <button
                        className={`if-btn if-btn--secondary if-btn--sm fg-btn ${index === workflowIndex ? "is-active" : ""}`}
                        type="button"
                        data-fastdas-pipeline-step={stageLabel}
                        data-fastdas-pipeline-record={record.name}
                        aria-pressed={index === workflowIndex}
                        key={stageLabel}
                        onClick={() => onPipelineStep(record.name, index)}
                      >
                        {stageLabel}
                      </button>
                    ))}
                  </div>
                  <div className="if-toolbar__group fg-synthetic-record__actions">
                    <button className="if-btn if-btn--secondary if-btn--sm fg-btn" type="button" data-fastdas-action="open-runtime-record" data-fastdas-runtime-record={record.name} onClick={() => onOpenRecord(record.name)}>
                      <Icon name="arrowUp" />Open
                    </button>
                    <button className="if-btn if-btn--danger if-btn--sm fg-btn fg-btn--danger" type="button" data-fastdas-action="remove-runtime-record" data-fastdas-runtime-record={record.name} onClick={() => onRemoveRecord(record.name)}>
                      <Icon name="x" />Remove
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="if-empty-state fg-synthetic-empty" data-fastdas-synthetic-empty>
            Add or generate a synthetic record to exercise the pipeline.
          </div>
        )}
      </div>
    </section>
  );
}

function demoArtifactForStage(record, workflowIndex) {
  if (!record) {
    return {
      title: "No active artifact",
      body: "Create or generate a synthetic lead to produce workflow artifacts.",
      items: ["Lead profile", "Source evidence", "Outreach draft"],
    };
  }
  if (workflowIndex >= 8) {
    return {
      title: "Follow-on learning captured",
      body: `${record.firstOffer} learning is ready to feed scoring, follow-on path, and segment calibration.`,
      items: ["Outcome logged", "Offer performance tagged", "Next experiment queued"],
    };
  }
  if (workflowIndex >= 6) {
    return {
      title: "Assessment offer ready",
      body: `${record.name} has a paid first step framed around ${record.firstOffer.toLowerCase()}.`,
      items: ["Discovery brief", "Assessment scope", "Follow-on roadmap"],
    };
  }
  if (workflowIndex >= 4) {
    return {
      title: "Approved outreach package",
      body: `${record.stakeholderPath} path is approved with human-gated language and source-safe evidence.`,
      items: ["First-touch draft", "Cadence plan", "Approval reason"],
    };
  }
  if (workflowIndex >= 2) {
    return {
      title: "Qualified opportunity packet",
      body: `${record.signal} supports a bounded ${record.firstOffer.toLowerCase()} offer.`,
      items: ["Score rationale", "Stakeholder route", "Evidence notes"],
    };
  }
  return {
    title: "Signal captured",
    body: `${record.signal} is captured for ${record.market} and ready for enrichment.`,
    items: ["Lead created", "Synthetic-safe source", "Enrichment queued"],
  };
}

function demoBriefForStage(record, workflowIndex, scenarioMode) {
  if (!record) {
    return `Scenario: ${scenarioMode}\nStatus: No active lead yet\nNext: create a synthetic opportunity, qualify it, approve outreach, and convert it into a paid assessment candidate.`;
  }
  const stage = workflowStages[workflowIndex] || workflowStages[0];
  return [
    `Scenario: ${scenarioMode}`,
    `Opportunity: ${record.name}`,
    `Market: ${record.market}`,
    `Stage: ${stage}`,
    `Signal: ${record.signal}`,
    `First paid step: ${record.firstOffer}`,
    `Stakeholder path: ${record.stakeholderPath}`,
    `Decision: ${workflowIndex >= 6 ? "Ready to pitch a bounded paid assessment." : workflowIndex >= 4 ? "Approved for outreach with human gate retained." : "Continue qualification before outreach."}`,
  ].join("\n");
}

function GuidedDemoRunner({
  activeRecord,
  workflowIndex,
  syntheticRecordCount,
  scenarioMode,
  onCreateRecord,
  onAdvance,
  onRunWalkthrough,
  onScenarioSelect,
  onOpenInput,
  onExport,
  onReset,
}) {
  const currentStage = workflowStages[workflowIndex] || workflowStages[0];
  const nextStage = workflowStages[Math.min(workflowStages.length - 1, workflowIndex + 1)] || currentStage;
  const artifact = demoArtifactForStage(activeRecord, workflowIndex);
  const brief = demoBriefForStage(activeRecord, workflowIndex, scenarioMode);
  const scenarioPresets = SCENARIO_SEQUENCE.filter(scenario => scenario !== "Balanced pipeline");
  const runnerSteps = [
    ["Create", syntheticRecordCount > 0],
    ["Qualify", workflowIndex >= 2],
    ["Approve", workflowIndex >= 4],
    ["Sell", workflowIndex >= 6],
    ["Export", workflowIndex >= 8],
  ];

  return (
    <section
      className="if-panel if-operations-section fg-guided-demo"
      data-fastdas-guided-demo-runner
      data-fastdas-guided-record={activeRecord?.name || ""}
    >
      <div className="fg-guided-demo__main">
        <div>
          <div className="fg-eyebrow">Working Demo Runner</div>
          <h2 className="if-panel__title">{activeRecord?.name || "Create a demo opportunity"}</h2>
          <p className="if-panel__subtitle">
            {activeRecord
              ? `${activeRecord.market} / ${activeRecord.firstOffer}. Current stage: ${currentStage}.`
              : "Start with a customer-safe synthetic lead, then push it through the real pipeline controls."}
          </p>
        </div>
        <div className="if-route-demo-controls fg-guided-demo__status">
          <span className="if-route-status"><strong>Records</strong><span>{syntheticRecordCount}</span></span>
          <span className="if-route-status"><strong>Scenario</strong><span>{scenarioMode}</span></span>
          <span className="if-route-status"><strong>Stage</strong><span>{currentStage}</span></span>
          <span className="if-route-status"><strong>Next</strong><span>{activeRecord ? nextStage : "Create"}</span></span>
        </div>
      </div>
      <div className="fg-guided-demo__scenarios" data-fastdas-scenario-presets>
        {scenarioPresets.map(scenario => (
          <button
            className={`if-btn if-btn--secondary if-btn--sm fg-btn ${scenarioMode === scenario ? "is-active" : ""}`}
            type="button"
            data-fastdas-action="select-scenario-preset"
            data-fastdas-scenario-preset={scenario}
            aria-pressed={scenarioMode === scenario}
            key={scenario}
            onClick={() => onScenarioSelect(scenario)}
          >
            {scenario}
          </button>
        ))}
      </div>
      <ol className="fg-guided-demo__steps" aria-label="Working demo milestones">
        {runnerSteps.map(([label, complete], index) => (
          <li className={complete ? "is-complete" : index === 0 && !activeRecord ? "is-active" : ""} key={label}>
            <span>{index + 1}</span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>
      <div className="fg-guided-demo__artifact" data-fastdas-stage-artifacts>
        <span>Stage Artifact</span>
        <strong>{artifact.title}</strong>
        <p>{artifact.body}</p>
        <ul>
          {artifact.items.map(item => <li key={item}>{item}</li>)}
        </ul>
        <textarea className="if-textarea fg-guided-demo__brief" data-fastdas-output-brief readOnly value={brief} aria-label="Generated demo brief" />
      </div>
      <div className="if-toolbar__group fg-guided-demo__actions">
        <button className="if-btn if-btn--primary fg-btn fg-btn--primary" type="button" data-fastdas-action="guided-create-record" onClick={onCreateRecord}>
          <Icon name="plus" />{activeRecord ? "Add Lead" : "Create Lead"}
        </button>
        <button className="if-btn if-btn--secondary fg-btn" type="button" data-fastdas-action="guided-advance-stage" disabled={!activeRecord} onClick={onAdvance}>
          <Icon name="arrowUp" />Advance Stage
        </button>
        <button className="if-btn if-btn--primary fg-btn fg-btn--primary" type="button" data-fastdas-action="guided-run-walkthrough" onClick={onRunWalkthrough}>
          <Icon name="check" />Run Walkthrough
        </button>
        <button className="if-btn if-btn--secondary fg-btn" type="button" data-fastdas-action="guided-open-input" onClick={onOpenInput}>
          <Icon name="database" />Input
        </button>
        <button className="if-btn if-btn--secondary fg-btn" type="button" data-fastdas-action="guided-export-run" onClick={onExport}>
          <Icon name="download" />Export
        </button>
        <button className="if-btn if-btn--danger fg-btn fg-btn--danger" type="button" data-fastdas-action="guided-reset-run" onClick={onReset}>
          <Icon name="rotate" />Reset
        </button>
      </div>
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
    <ol className="if-stepper if-stepper--semantic if-stepper--boxed if-stepper--compact fg-workflow" aria-label="FastDAS lifecycle" style={{ "--step-count": workflowStages.length }}>
      {workflowStages.map((stage, index) => (
        <li
          key={stage}
          className={`if-stepper__step ${index < activeIndex ? "is-complete" : index === activeIndex ? "is-active" : ""}`}
          data-if-wizard-state={index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending"}
        >
          <span className="if-stepper__item">
            <span className="if-stepper__dot">{index < activeIndex ? "✓" : index + 1}</span>
            <span className="if-stepper__label">{stage}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function OperationalWorkflow({ state }) {
  const currentStage = workflowStages[state.workflowIndex] || workflowStages[0];
  return (
    <section className="if-panel if-operations-panel if-agent-runtime fg-ops-panel" data-fastdas-operational-workflow>
      <div className="fg-ops-panel__main if-agent-runtime__summary">
        <div className="fg-ops-panel__summary if-agent-runtime__notice">
          <div className="fg-eyebrow">Operational Runtime</div>
          <h2 className="if-panel__title" data-fastdas-workflow-stage>{currentStage}</h2>
          <p>{state.lastAction}</p>
          {state.toast ? (
            <div className={`if-toast if-alert fg-toast ${toneClass(state.toast.tone)}`} data-fastdas-toast>
              <Icon name={state.toast.tone === "warning" ? "warning" : state.toast.tone === "danger" ? "alert" : "check"} />
              <div>
                <strong>{state.toast.title}</strong>
                <span>{state.toast.body}</span>
              </div>
            </div>
          ) : null}
        </div>
        <div className="if-agent-runtime__grid fg-ops-stats" aria-label="Operational counters">
          <div className="if-agent-runtime-kpi if-agent-runtime-kpi--running"><span>Active seed</span><strong>{state.activeSeed}</strong></div>
          <div className="if-agent-runtime-kpi if-agent-runtime-kpi--queued"><span>Scenario</span><strong>{state.scenarioMode}</strong></div>
          <div className="if-agent-runtime-kpi"><span>Mode</span><strong>{state.operatorMode}</strong></div>
          <div className="if-agent-runtime-kpi if-agent-runtime-kpi--running"><span>Signal runs</span><strong>{state.signalRuns}</strong></div>
          <div className="if-agent-runtime-kpi"><span>Records</span><strong>{state.generatedRecords}</strong></div>
          <div className="if-agent-runtime-kpi if-agent-runtime-kpi--warning"><span>Approvals due</span><strong>{state.approvalCount}</strong></div>
          <div className="if-agent-runtime-kpi"><span>Variants</span><strong>{state.variantCount}</strong></div>
          <div className="if-agent-runtime-kpi"><span>Exports</span><strong>{state.exportCount}</strong></div>
        </div>
      </div>
      <div className="if-agent-runtime__log fg-audit" data-fastdas-audit-log>
        <div className="if-agent-runtime__log-header fg-audit__header">
          <strong>Audit Trail</strong>
          <Chip tone="blue">{state.events.length} events</Chip>
        </div>
        <ol className="if-ledger-list if-ledger-list--rich">
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
      <div className="if-pattern-grid if-pattern-grid--ops fg-command-grid">
        {commands.map(command => (
          <article className="if-pattern-card if-operations-section fg-command-card" data-fastdas-command-card key={command.id}>
            <div className="if-pattern-card__header fg-command-card__body">
              <span className="fg-command-card__icon"><Icon name={command.icon} /></span>
              <div>
                <h3 className="if-card__title">{command.title}</h3>
                <p>{command.body}</p>
              </div>
              <Chip tone={command.tone}>{command.meta}</Chip>
            </div>
            <div className="if-rule-builder-mini">
              <div className="if-rule-line">
                <span>Operator command</span>
                <Chip tone={command.tone}>{command.meta}</Chip>
              </div>
              <div className="if-rule-line">
                <span>Action gate</span>
                <strong>{command.action}</strong>
              </div>
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

function CommandCenterOperationsDrawer({ operationState, onCommandAction, onModeChange }) {
  return (
    <details className="if-panel fg-command-center-drawer" data-fastdas-command-center-ops-drawer>
      <summary className="if-panel__header fg-command-center-drawer__summary">
        <span>
          <strong>Operations Controls</strong>
          <em>Workflow, runtime, audit, and demo commands</em>
        </span>
        <span className="if-badge if-badge--info">Open tools</span>
      </summary>
      <div className="fg-command-center-drawer__body">
        <WorkflowStrip activeIndex={operationState.workflowIndex} />
        <OperationalWorkflow state={operationState} />
        <CommandDock state={operationState} onCommandAction={onCommandAction} onModeChange={onModeChange} />
      </div>
    </details>
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
    <section className="if-pattern-grid if-pattern-grid--ops fg-bottom-grid" data-fastdas-governance-panels>
      {activePanels.map(([title, items], index) => (
        <article
          className={`if-pattern-card if-operations-section fg-panel fg-panel--compact ${index === 0 ? "if-impact-card" : index === 1 ? "if-ops-runbook-card" : "if-contract-card"}`}
          key={title}
        >
          <div className="if-pattern-card__header fg-panel__header">
            <span className="if-icon-slot" data-if-icon={index === 0 ? "trend" : index === 1 ? "task" : "database"} aria-hidden="true" />
            <div>
              <h2 className="if-panel__title">{title}</h2>
              <p className="if-panel__subtitle">{index === 0 ? "Impact path" : index === 1 ? "Operator runbook" : "Demo contract"}</p>
            </div>
          </div>
          {index === 0 ? (
            <div className="if-impact-chain">
              {items.map(item => <span key={item}>{item}</span>)}
            </div>
          ) : index === 1 ? (
            <ol className="if-runbook-list">
              {items.map((item, itemIndex) => <li key={item}><strong>Step {itemIndex + 1}</strong><span>{item}</span></li>)}
            </ol>
          ) : (
            <div className="if-artifact-row">
              <Icon name="database" />
              <strong>{title}</strong>
              <em>{items.join(" · ")}</em>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

function HeaderSurfaceNav({ surface, onSelect }) {
  const [executionOpen, setExecutionOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [menuTop, setMenuTop] = useState(90);
  const executionRef = useRef(null);
  const adminRef = useRef(null);
  const mobileMoreRef = useRef(null);
  const surfaceById = new Map(surfaces.map(item => [item.id, item]));
  const primarySurfaces = PRIMARY_ROUTE_IDS.map(id => surfaceById.get(id)).filter(Boolean);
  const executionSurfaces = EXECUTION_ROUTE_IDS.map(id => surfaceById.get(id)).filter(Boolean);
  const adminSurfaces = ADMIN_ROUTE_IDS.map(id => surfaceById.get(id)).filter(Boolean);
  const executionActive = EXECUTION_ROUTE_IDS.includes(surface.id);
  const adminActive = ADMIN_ROUTE_IDS.includes(surface.id);

  useEffect(() => {
    function handleDocumentClick(event) {
      if (executionRef.current && !executionRef.current.contains(event.target)) setExecutionOpen(false);
      if (adminRef.current && !adminRef.current.contains(event.target)) setAdminOpen(false);
      if (mobileMoreRef.current && !mobileMoreRef.current.contains(event.target)) setMobileMoreOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setExecutionOpen(false);
        setAdminOpen(false);
        setMobileMoreOpen(false);
      }
    }

    document.addEventListener("mousedown", handleDocumentClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function closeMenus() {
    setExecutionOpen(false);
    setAdminOpen(false);
    setMobileMoreOpen(false);
  }

  function selectSurface(id) {
    closeMenus();
    onSelect(id);
  }

  function updateMenuPosition(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    setMenuTop(Math.ceil(rect.bottom + 7));
  }

  function renderMenuItem(item, group) {
    return (
      <button
        type="button"
        role="menuitem"
        aria-current={item.id === surface.id ? "page" : undefined}
        className={`if-btn if-operations-topnav__menu-item${item.id === surface.id ? " is-active" : ""}`}
        data-fastdas-header-secondary-item={item.id}
        data-fastdas-header-secondary-active={item.id === surface.id ? "true" : "false"}
        data-fastdas-header-menu-group={group}
        key={item.id}
        onClick={() => selectSurface(item.id)}
      >
        <span className="ci-topnav-menu-copy">
          <span className="ci-topnav-menu-label">{item.nav}</span>
          <span className="ci-topnav-menu-description">{item.summary}</span>
        </span>
        <span className="if-status-pill if-status-pill--compact ci-topnav-menu-badge">{item.table.count}</span>
      </button>
    );
  }

  return (
    <nav
      className="if-operations-topnav ci-header-nav fg-operations-topnav"
      data-fastdas-header-route
      data-fastdas-active-route={surface.id}
      aria-label="FastDAS operations surfaces"
      style={{ "--fastdas-nav-menu-top": `${menuTop}px` }}
    >
      {primarySurfaces.map(item => (
        <button
          type="button"
          className={`if-operations-topnav__link ci-header-nav__primary-link${item.id === surface.id ? " is-active" : ""}`}
          aria-current={item.id === surface.id ? "page" : undefined}
          data-fastdas-header-surface={item.id}
          data-fastdas-header-surface-active={item.id === surface.id ? "true" : "false"}
          key={item.id}
          onClick={() => selectSurface(item.id)}
        >
          {item.nav}
        </button>
      ))}
      <div ref={executionRef} className="if-operations-topnav__secondary ci-header-nav__desktop-menu">
        <button
          className={`if-operations-topnav__secondary-button ci-header-nav__menu-trigger${executionActive ? " has-active-child" : ""}`}
          type="button"
          aria-controls="fastdas-execution-menu"
          aria-expanded={executionOpen}
          aria-haspopup="menu"
          data-fastdas-header-secondary-toggle
          data-fastdas-header-execution-toggle
          data-nav-group-trigger="execution"
          data-nav-group-active-child={executionActive ? surface.id : undefined}
          onClick={(event) => {
            updateMenuPosition(event);
            setAdminOpen(false);
            setMobileMoreOpen(false);
            setExecutionOpen(open => !open);
          }}
        >
          <span className="ci-header-nav__menu-trigger-label">Execution</span>
          {executionActive ? <span className="ci-header-nav__menu-trigger-context">{surface.nav}</span> : null}
          <span className="ci-header-nav__menu-trigger-chevron" aria-hidden="true">{executionOpen ? "▲" : "▼"}</span>
        </button>
        {executionOpen ? (
          <div id="fastdas-execution-menu" className="if-operations-topnav__menu" role="menu" data-fastdas-header-secondary-menu data-fastdas-header-execution-menu>
            <span className="if-operations-topnav__menu-label">Execution Surfaces</span>
            {executionSurfaces.map(item => renderMenuItem(item, "execution"))}
          </div>
        ) : null}
      </div>
      <div ref={adminRef} className="if-operations-topnav__secondary ci-header-nav__desktop-menu">
        <button
          className={`if-operations-topnav__secondary-button ci-header-nav__menu-trigger${adminActive ? " has-active-child" : ""}`}
          type="button"
          aria-controls="fastdas-admin-menu"
          aria-expanded={adminOpen}
          aria-haspopup="menu"
          data-fastdas-header-admin-toggle
          data-nav-group-trigger="platform-admin"
          data-nav-group-active-child={adminActive ? surface.id : undefined}
          onClick={(event) => {
            updateMenuPosition(event);
            setExecutionOpen(false);
            setMobileMoreOpen(false);
            setAdminOpen(open => !open);
          }}
        >
          <span className="ci-header-nav__menu-trigger-label">Admin</span>
          {adminActive ? <span className="ci-header-nav__menu-trigger-context">{surface.nav}</span> : null}
          <span className="ci-header-nav__menu-trigger-chevron" aria-hidden="true">{adminOpen ? "▲" : "▼"}</span>
        </button>
        {adminOpen ? (
          <div id="fastdas-admin-menu" className="if-operations-topnav__menu" role="menu" data-fastdas-header-admin-menu>
            <span className="if-operations-topnav__menu-label">Platform Admin</span>
            {adminSurfaces.map(item => renderMenuItem(item, "platform-admin"))}
          </div>
        ) : null}
      </div>
      <div ref={mobileMoreRef} className="if-operations-topnav__secondary ci-header-nav__mobile-more">
        <button
          type="button"
          className={`if-operations-topnav__secondary-button${executionActive || adminActive ? " is-active" : ""}`}
          aria-haspopup="menu"
          aria-expanded={mobileMoreOpen}
          aria-controls="fastdas-mobile-more-menu"
          data-mobile-more-menu-button
          onClick={(event) => {
            updateMenuPosition(event);
            setExecutionOpen(false);
            setAdminOpen(false);
            setMobileMoreOpen(open => !open);
          }}
        >
          More {mobileMoreOpen ? "▲" : "▼"}
        </button>
        {mobileMoreOpen ? (
          <div id="fastdas-mobile-more-menu" className="if-operations-topnav__menu ci-header-nav__mobile-menu" data-mobile-more-menu role="menu">
            <span className="if-operations-topnav__menu-label">Primary</span>
            {primarySurfaces.map(item => renderMenuItem(item, "primary"))}
            <span className="if-operations-topnav__menu-label">Execution</span>
            {executionSurfaces.map(item => renderMenuItem(item, "execution"))}
            <span className="if-operations-topnav__menu-label">Platform Admin</span>
            {adminSurfaces.map(item => renderMenuItem(item, "platform-admin"))}
          </div>
        ) : null}
      </div>
    </nav>
  );
}

function WorkspaceRail({ surface, activeSavedViewId, onSurfaceSelect, onSavedView }) {
  return (
    <aside className="if-sidebar fg-sidebar fg-workspace-rail" data-fastdas-workspace-rail>
      <section className="if-sidebar__section fg-sidebar-section fg-workspace-rail__section">
        <div className="if-sidebar__group-header">
          <h2 className="if-sidebar__title fg-nav__heading">Workspace</h2>
          <span className="if-sidebar__count">{surfaces.length}</span>
        </div>
        <nav
          className="if-sidebar__nav fg-nav"
          data-control-surface-nav
          data-fastdas-active-route={surface.id}
          aria-label="Workspace navigation"
        >
          {surfaces.map(item => (
            <button
              type="button"
              className={`if-sidebar__link ${item.id === surface.id ? "is-active" : ""}`}
              aria-current={item.id === surface.id ? "page" : undefined}
              data-fastdas-nav-surface={item.id}
              data-fastdas-nav-active={item.id === surface.id ? "true" : "false"}
              key={item.id}
              onClick={() => onSurfaceSelect(item.id)}
            >
              <span />
              <span className="if-sidebar__link-label">{item.nav}</span>
            </button>
          ))}
        </nav>
      </section>
      <section className="if-sidebar__section fg-sidebar-section fg-workspace-rail__section">
        <div className="if-sidebar__group-header">
          <h2 className="if-sidebar__title fg-nav__heading">Saved Views</h2>
          <span className="if-sidebar__count">{SAVED_VIEWS.length}</span>
        </div>
        <div className="if-sidebar__subnav fg-nav fg-nav--saved" data-fastdas-saved-views>
          {SAVED_VIEWS.map(view => (
            <button
              className={`if-sidebar__link ${activeSavedViewId === view.id ? "is-active" : ""}`}
              type="button"
              key={view.id}
              data-fastdas-saved-view={view.id}
              data-fastdas-saved-view-active={activeSavedViewId === view.id ? "true" : "false"}
              data-fastdas-target-surface={view.surfaceId}
              onClick={() => onSavedView(view)}
            >
              <span />
              <span className="if-sidebar__link-label">{view.label}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="if-sidebar__section fg-sidebar-section fg-workspace-rail__section fg-workspace-rail__kpis">
        <div className="if-sidebar__group-header">
          <h2 className="if-sidebar__title fg-nav__heading">Trial Model</h2>
          <span className="if-sidebar__count">2</span>
        </div>
        <div className="if-claim-toolbar fg-sidebar-kpis">
          {sidebarKpis.map(([value, label]) => (
            <div className="if-claim-summary-card" key={label}>
              <Icon name="target" />
              <span><strong>{value}</strong><em>{label}</em></span>
            </div>
          ))}
        </div>
      </section>
      <section className="if-sidebar__section fg-sidebar-section fg-workspace-rail__section fg-workspace-rail__note">
        <div className="if-alert if-alert--info fg-sidebar-note">
          <strong>Automation Boundary</strong>
          Agents and offshore support can find, enrich, score, draft, and queue. Humans approve outreach, technical claims, pricing, discovery, and close strategy.
        </div>
      </section>
    </aside>
  );
}

function WorkingSetRibbon({ surface, selectedRowId, operationState, activeCommandFilterId, onReset, onRunScan }) {
  const commandFilter = surface.id === "command-center" ? commandCenterQuickFilter(activeCommandFilterId) : null;
  const currentStage = workflowStages[operationState.workflowIndex] || workflowStages[0];
  const chips = [
    ["Route", surface.nav],
    ["Selected", selectedRowId],
    ["Workflow", currentStage],
    ["Mode", operationState.operatorMode],
  ];
  if (commandFilter) chips.push(["View", commandFilter.label]);

  return (
    <section
      className="ci-working-set-ribbon fg-working-set-ribbon has-context"
      data-fastdas-working-set-ribbon
      data-fastdas-working-set-route={surface.id}
      aria-label="Current FastDAS working set"
    >
      <div className="fg-working-set-ribbon__copy">
        <span className="ci-working-set-ribbon__kicker">Working Set</span>
        <strong>{surface.title}</strong>
        <em>{surface.summary}</em>
      </div>
      <div className="fg-working-set-ribbon__chips">
        {chips.map(([label, value]) => (
          <span className="if-route-status" key={label}>
            <strong>{label}</strong>
            <span>{value}</span>
          </span>
        ))}
      </div>
      <div className="fg-working-set-ribbon__actions">
        <button className="if-btn if-btn--secondary fg-btn" type="button" onClick={onReset}>
          <Icon name="rotate" />Reset
        </button>
        <button className="if-btn if-btn--primary fg-btn fg-btn--primary" type="button" onClick={onRunScan}>
          <Icon name="refresh" />Scan
        </button>
      </div>
    </section>
  );
}

function ReleaseRail({ surface, operationState }) {
  const currentStage = workflowStages[operationState.workflowIndex] || workflowStages[0];
  const releaseLanes = [
    ["Route Contract", "Current walkthrough state", surface.nav, surface.primaryAction, "route"],
    ["Data Contract", "Synthetic customer-safe state", operationState.activeSeed, operationState.scenarioMode, "database"],
    ["Approval Contract", "Human boundary status", `${operationState.approvalCount} approvals due`, currentStage, "shield"],
    ["Delivery Contract", "GitHub source with Cloudflare-ready static artifact", "GitHub -> dist", "Cloudflare Pages direct upload", "cloud"],
  ];

  return (
    <footer className="if-panel if-panel__footer if-release-controls fg-footer" data-fastdas-release-rail>
      <div className="fg-footer__brand">
        <strong>FastDAS Growth Engine</strong>
        <span>Control Surface demo / customer walkthrough build / delivery-ready artifact</span>
      </div>
      <div className="if-release-summary if-route-demo-controls fg-footer__status" data-fastdas-footer-status>
        <span className="if-route-status"><strong>Route</strong><span>{surface.title}</span></span>
        <span className="if-route-status"><strong>Workflow</strong><span>{currentStage}</span></span>
        <span className="if-route-status"><strong>Seed</strong><span>{operationState.activeSeed}</span></span>
        <span className="if-route-status"><strong>Source</strong><span>GitHub canonical</span></span>
        <span className="if-route-status"><strong>Host</strong><span>Cloudflare Pages</span></span>
        <span className="if-route-status"><strong>Cloudflare</strong><span>Deploy path ready</span></span>
      </div>
      <section className="if-release-lane-grid fg-release-lanes" aria-label="Release readiness lanes" data-fastdas-delivery-readiness>
        {releaseLanes.map(([title, body, keyValue, detail, icon]) => (
          <article className={`if-release-lane fg-release-lane ${title === "Delivery Contract" ? "fg-release-lane--delivery" : ""}`} key={title}>
            <header>
              <span className="if-release-lane__icon if-icon-slot" data-if-icon={icon} aria-hidden="true" />
              <div>
                <h3>{title}</h3>
                <span>{body}</span>
              </div>
            </header>
            <dl className="if-release-lane__kv">
              <div>
                <dt>Current</dt>
                <dd>{keyValue}</dd>
              </div>
              <div>
                <dt>Next check</dt>
                <dd>{detail}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>
    </footer>
  );
}

export default function App() {
  const runtimePipelineState = useMemo(() => readRuntimePipelineState(), []);
  const demoSessionState = useMemo(() => readDemoSessionState(), []);
  const [activeSurfaceId, setActiveSurfaceId] = useState(getInitialSurfaceId);
  const [selectedRows, setSelectedRows] = useState(demoSessionState.selectedRows);
  const [detailOpenRows, setDetailOpenRows] = useState(demoSessionState.detailOpenRows);
  const [operationState, setOperationState] = useState(demoSessionState.operationState);
  const [activeSavedViewId, setActiveSavedViewId] = useState("");
  const [activeCommandFilterId, setActiveCommandFilterId] = useState(demoSessionState.activeCommandFilterId);
  const [syntheticRecords, setSyntheticRecords] = useState(runtimePipelineState.syntheticRecords);
  const [pipelineOverrides, setPipelineOverrides] = useState(runtimePipelineState.pipelineOverrides);
  const [syntheticDraft, setSyntheticDraft] = useState(EMPTY_SYNTHETIC_DRAFT);

  useEffect(() => {
    const onHashChange = () => setActiveSurfaceId(getInitialSurfaceId());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    writeRuntimePipelineState(syntheticRecords, pipelineOverrides);
  }, [pipelineOverrides, syntheticRecords]);

  useEffect(() => {
    writeDemoSessionState(operationState, selectedRows, detailOpenRows, activeCommandFilterId);
  }, [activeCommandFilterId, detailOpenRows, operationState, selectedRows]);

  const runtimeSurfaces = useMemo(
    () => buildRuntimeSurfaces(syntheticRecords, pipelineOverrides),
    [syntheticRecords, pipelineOverrides],
  );

  const surface = useMemo(
    () => runtimeSurfaces.find(item => item.id === activeSurfaceId) || runtimeSurfaces[0],
    [activeSurfaceId, runtimeSurfaces],
  );
  const isFocusedWorkbench = isFocusedWorkbenchSurface(surface.id);
  const activeMetricSignalId = surface.id === "command-center" ? activeCommandFilterId : signalIdForLabel(surface.metrics[0]?.[0]);
  const activeDemoRecord = useMemo(() => (
    syntheticRecords.find(record => record.name === selectedRows[surface.id]) || syntheticRecords[0] || null
  ), [selectedRows, surface.id, syntheticRecords]);
  const activeDemoWorkflowIndex = activeDemoRecord ? pipelineOverrides[activeDemoRecord.name]?.workflowIndex ?? 0 : 0;

  const setSurface = useCallback((id) => {
    setActiveSavedViewId("");
    setActiveSurfaceId(id);
    window.location.hash = `/${id}`;
  }, []);

  const recordOperation = useCallback((event) => {
    setOperationState(current => appendEvent(current, event));
  }, []);

  const handleUtilityAction = useCallback((title, body, tone = "blue") => {
    recordOperation({ title, body, tone });
  }, [recordOperation]);

  const applyCommandCenterFilter = useCallback((filterId, shouldRecord = true) => {
    const filter = commandCenterQuickFilter(filterId);
    const commandSurface = runtimeSurfaces.find(item => item.id === "command-center") || runtimeSurfaces[0];
    const nextRowId = firstCommandCenterRowId(commandSurface, filter.id);

    setActiveCommandFilterId(filter.id);
    setActiveSavedViewId("");
    setSelectedRows(current => ({ ...current, "command-center": nextRowId }));
    setDetailOpenRows(current => ({ ...current, "command-center": "" }));

    if (shouldRecord) {
      recordOperation({
        title: "Command filter applied",
        body: `${filter.label} moved Command Center focus to ${nextRowId}.`,
        tone: "blue",
      });
    }
  }, [recordOperation, runtimeSurfaces]);

  const handleModeChange = useCallback((mode) => {
    setOperationState(current => appendEvent(current, {
      title: "Operator mode changed",
      body: `${mode} mode is active for the walkthrough control dock.`,
      tone: mode === "Customer Review" ? "success" : mode === "Synthetic Variant" ? "purple" : "blue",
      updates: { operatorMode: mode },
    }));
  }, []);

  const routeForPipelineIndex = useCallback((workflowIndex) => {
    if (workflowIndex <= 1) return "signal-intake";
    if (workflowIndex === 2) return "opportunity-workbench";
    if (workflowIndex === 3) return "evidence-review";
    if (workflowIndex <= 5) return "outreach-queue";
    if (workflowIndex >= 6) return "conversion-board";
    return "command-center";
  }, []);

  const focusRecordAcrossPipeline = useCallback((recordName, workflowIndex = operationState.workflowIndex) => {
    setSelectedRows(current => ({
      ...current,
      "command-center": recordName,
      "opportunity-workbench": recordName,
      "evidence-review": recordName,
      "outreach-queue": recordName,
      "conversion-board": recordName,
    }));
    setDetailOpenRows(current => ({
      ...current,
      "command-center": "",
      "opportunity-workbench": "",
      "evidence-review": "",
      "outreach-queue": "",
      "conversion-board": "",
    }));
    setPipelineOverrides(current => ({ ...current, [recordName]: { workflowIndex } }));
  }, [operationState.workflowIndex]);

  const handlePipelineStep = useCallback((recordName, workflowIndex) => {
    const stage = workflowStages[workflowIndex] || workflowStages[0];
    focusRecordAcrossPipeline(recordName, workflowIndex);
    recordOperation({
      title: "Pipeline stage advanced",
      body: `${recordName} moved to ${stage} and is now available in the matching work surface.`,
      tone: workflowIndex >= 4 ? "success" : workflowIndex >= 3 ? "warning" : "blue",
      workflowIndex,
    });
    setSurface(routeForPipelineIndex(workflowIndex));
  }, [focusRecordAcrossPipeline, recordOperation, routeForPipelineIndex, setSurface]);

  const addSyntheticRecord = useCallback((record, title = "Synthetic record entered", { routeToCommand = false, workflowIndex = 0 } = {}) => {
    const names = new Set([...seedRecords, ...syntheticRecords].map(item => item.name));
    const safeRecord = names.has(record.name)
      ? { ...record, name: `${record.name} ${syntheticRecords.length + 1}` }
      : record;
    setSyntheticRecords(current => [...current, safeRecord]);
    focusRecordAcrossPipeline(safeRecord.name, workflowIndex);
    setActiveCommandFilterId(COMMAND_CENTER_DEFAULT_FILTER_ID);
    recordOperation({
      title,
      body: `${safeRecord.name} was added to the browser-local synthetic opportunity pipeline.`,
      tone: "success",
      workflowIndex,
      updates: state => ({ generatedRecords: state.generatedRecords + 1 }),
    });
    if (routeToCommand) setSurface("command-center");
    return safeRecord;
  }, [focusRecordAcrossPipeline, recordOperation, setSurface, syntheticRecords]);

  const handleSyntheticDraftChange = useCallback((field, value) => {
    setSyntheticDraft(current => ({ ...current, [field]: value }));
  }, []);

  const handleSyntheticSubmit = useCallback((event) => {
    event.preventDefault();
    const record = normalizeSyntheticRecord(syntheticDraft, syntheticRecords.length + 1);
    addSyntheticRecord(record, "Synthetic record entered", { routeToCommand: true });
    setSyntheticDraft(EMPTY_SYNTHETIC_DRAFT);
  }, [addSyntheticRecord, syntheticDraft, syntheticRecords.length]);

  const handleGenerateSyntheticRecord = useCallback(() => {
    const record = generatedSyntheticRecord(syntheticRecords.length + 1, operationState.scenarioMode);
    addSyntheticRecord(record, "Scenario record generated");
  }, [addSyntheticRecord, operationState.scenarioMode, syntheticRecords.length]);

  const handleSavedView = useCallback((view) => {
    const targetSurface = runtimeSurfaces.find(item => item.id === view.surfaceId);
    setSurface(view.surfaceId);
    setActiveSavedViewId(view.id);
    setSelectedRows(current => ({ ...current, [view.surfaceId]: view.rowId }));
    setDetailOpenRows(current => ({ ...current, [view.surfaceId]: "" }));
    recordOperation({
      title: "Saved view loaded",
      body: `${view.label} opened ${targetSurface?.title || view.surfaceId} with ${view.rowId} selected.`,
      tone: view.tone,
      workflowIndex: view.workflowIndex,
    });
  }, [recordOperation, runtimeSurfaces, setSurface]);

  const handleCommandAction = useCallback((commandId) => {
    if (commandId === "scan") {
      addSyntheticRecord(generatedSyntheticRecord(syntheticRecords.length + 1, "Closeout Sprint"), "Command scan captured lead", { workflowIndex: 1 });
    }
    if (commandId === "approve" && activeDemoRecord) {
      focusRecordAcrossPipeline(activeDemoRecord.name, 4);
    }
    if (commandId === "export") {
      downloadJson(`fastdas-command-export-${operationState.activeSeed}.json`, buildRuntimeExportPayload(operationState, syntheticRecords, pipelineOverrides, activeSurfaceId));
    }
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
  }, [activeDemoRecord, activeSurfaceId, addSyntheticRecord, focusRecordAcrossPipeline, operationState, pipelineOverrides, recordOperation, syntheticRecords]);

  const handlePrimaryAction = useCallback((surfaceId) => {
    if (surfaceId === "global-signal-scan") {
      addSyntheticRecord(generatedSyntheticRecord(syntheticRecords.length + 1, "Closeout Sprint"), "Signal scan captured lead", { workflowIndex: 1 });
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
      const nextVariant = operationState.variantCount + 1;
      const scenarioMode = SCENARIO_SEQUENCE[nextVariant % SCENARIO_SEQUENCE.length];
      addSyntheticRecord(generatedSyntheticRecord(syntheticRecords.length + 1, scenarioMode), "Scenario record generated", { workflowIndex: 2 });
      setOperationState(current => {
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
    const selectedRecordName = selectedRows[surfaceId];
    const isRuntimeRecord = runtimeSurfaces.some(item => item.records?.some(record => record.name === selectedRecordName));
    if (isRuntimeRecord && Number.isFinite(action.workflowIndex)) {
      focusRecordAcrossPipeline(selectedRecordName, action.workflowIndex);
    }
    recordOperation(action);
    if (action.surfaceId) setSurface(action.surfaceId);
  }, [addSyntheticRecord, focusRecordAcrossPipeline, operationState.variantCount, recordOperation, runtimeSurfaces, selectedRows, setSurface, syntheticRecords.length]);

  const handleRecordAction = useCallback((kind, activeSurface, recordDetail) => {
    const recordTitle = recordDetail?.title || activeSurface.expanded.title;
    const labels = {
      approve: {
        title: "Inline record approved",
        body: `${recordTitle} moved through its operator gate and is ready for the next workflow step.`,
        tone: "success",
        workflowIndex: Math.min(workflowStages.length - 1, operationState.workflowIndex + 1),
        updates: state => ({ approvalCount: Math.max(0, state.approvalCount - 1) }),
      },
      edit: {
        title: "Draft opened for edit",
        body: `${recordTitle} is staged for message, evidence, or scoring edits without changing the golden seed.`,
        tone: "blue",
      },
      assign: {
        title: "Research task assigned",
        body: `${recordTitle} now has an offshore verification packet and human owner handoff.`,
        tone: "purple",
      },
      hold: {
        title: "Record placed on hold",
        body: `${recordTitle} is blocked from outbound action until source, role, or technical claim risk is resolved.`,
        tone: "danger",
      },
      "run-source": {
        title: "Selected source run queued",
        body: `${recordTitle} is queued for a source-safe refresh with parser warnings and routing gates retained.`,
        tone: "blue",
        workflowIndex: 1,
        updates: state => ({ signalRuns: state.signalRuns + 1 }),
      },
      "promote-opportunity": {
        title: "Opportunity promoted to review",
        body: `${recordTitle} is staged for human review with scoring, source, and contact gates retained.`,
        tone: "warning",
        workflowIndex: 3,
      },
      "approve-evidence": {
        title: "Evidence packet approved",
        body: `${recordTitle} is approved for the human review packet with outreach boundaries retained.`,
        tone: "success",
        workflowIndex: 3,
      },
      "approve-outreach": {
        title: "Outreach task approved",
        body: `${recordTitle} is approved for the human-gated send queue with cadence and risk notes retained.`,
        tone: "success",
        workflowIndex: 4,
        updates: state => ({ approvalCount: Math.max(0, state.approvalCount - 1) }),
      },
      "run-agent": {
        title: "Agent workflow queued",
        body: `${recordTitle} is queued for a controlled replay with runtime, exception, and human-gate boundaries retained.`,
        tone: "blue",
        workflowIndex: 1,
        updates: state => ({ signalRuns: state.signalRuns + 1 }),
      },
      "validate-dataset": {
        title: "Dataset validation queued",
        body: `${recordTitle} is queued for quality-gate validation with provenance and reset boundaries retained.`,
        tone: "blue",
        workflowIndex: 2,
      },
      "log-conversion": {
        title: "Conversion outcome logged",
        body: `${recordTitle} learning was captured for first-offer scoring and follow-on path calibration.`,
        tone: "success",
        workflowIndex: 8,
      },
    };
    const event = labels[kind];
    const isRuntimeRecord = runtimeSurfaces.some(item => item.records?.some(record => record.name === recordTitle));
    if (event && isRuntimeRecord && Number.isFinite(event.workflowIndex)) {
      setPipelineOverrides(current => ({ ...current, [recordTitle]: { workflowIndex: event.workflowIndex } }));
    }
    recordOperation(event);
  }, [operationState.workflowIndex, recordOperation, runtimeSurfaces]);

  const handleSyntheticAction = useCallback((kind) => {
    if (kind === "reset") {
      clearRuntimePipelineState();
      clearDemoSessionState();
      setSyntheticRecords([]);
      setPipelineOverrides({});
      setSyntheticDraft(EMPTY_SYNTHETIC_DRAFT);
      setSelectedRows(defaultSelectedRows());
      setDetailOpenRows(defaultDetailOpenRows());
      setActiveSavedViewId("");
      setActiveCommandFilterId(COMMAND_CENTER_DEFAULT_FILTER_ID);
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
      downloadJson(`fastdas-synthetic-runtime-${operationState.activeSeed}.json`, buildRuntimeExportPayload(operationState, syntheticRecords, pipelineOverrides, activeSurfaceId));
      recordOperation({
        title: "Export bundle downloaded",
        body: "Customer-safe JSON runtime bundle downloaded with entered records, pipeline state, scenario manifest, and seed metadata.",
        tone: "blue",
        updates: state => ({ exportCount: state.exportCount + 1 }),
      });
      return;
    }

    const nextVariant = operationState.variantCount + 1;
    const scenarioMode = SCENARIO_SEQUENCE[nextVariant % SCENARIO_SEQUENCE.length];
    addSyntheticRecord(generatedSyntheticRecord(syntheticRecords.length + 1, scenarioMode), "Scenario record generated", { workflowIndex: 2 });
    setOperationState(current => (
      appendEvent(current, {
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
      })
    ));
  }, [activeSurfaceId, addSyntheticRecord, operationState, pipelineOverrides, recordOperation, syntheticRecords]);

  const handleSurfaceExport = useCallback(() => {
    downloadJson(`fastdas-${surface.id}-export-${operationState.activeSeed}.json`, buildRuntimeExportPayload(operationState, syntheticRecords, pipelineOverrides, surface.id));
    handleUtilityAction("Surface export downloaded", `${surface.title} export bundle downloaded with source-safe synthetic data only.`, "blue");
  }, [handleUtilityAction, operationState, pipelineOverrides, surface.id, surface.title, syntheticRecords]);

  const handleGuidedCreateRecord = useCallback(() => {
    const record = generatedSyntheticRecord(syntheticRecords.length + 1, operationState.scenarioMode);
    addSyntheticRecord(record, "Working demo lead created", { routeToCommand: true, workflowIndex: 1 });
  }, [addSyntheticRecord, operationState.scenarioMode, syntheticRecords.length]);

  const handleScenarioPreset = useCallback((scenarioMode) => {
    setOperationState(current => appendEvent(current, {
      title: "Demo scenario selected",
      body: `${scenarioMode} is now the active guided-demo scenario for new synthetic leads and exports.`,
      tone: "purple",
      updates: {
        scenarioMode,
        operatorMode: "Synthetic Variant",
        activeSeed: `FD-GE-DEMO-0619-${signalIdForLabel(scenarioMode).toUpperCase()}`,
      },
    }));
  }, []);

  const handleGuidedAdvance = useCallback(() => {
    const record = activeDemoRecord || addSyntheticRecord(generatedSyntheticRecord(syntheticRecords.length + 1, operationState.scenarioMode), "Working demo lead created", { routeToCommand: true, workflowIndex: 1 });
    const currentIndex = pipelineOverrides[record.name]?.workflowIndex ?? 0;
    handlePipelineStep(record.name, Math.min(workflowStages.length - 1, currentIndex + 1));
  }, [activeDemoRecord, addSyntheticRecord, handlePipelineStep, operationState.scenarioMode, pipelineOverrides, syntheticRecords.length]);

  const handleGuidedWalkthrough = useCallback(() => {
    const record = activeDemoRecord || addSyntheticRecord(generatedSyntheticRecord(syntheticRecords.length + 1, operationState.scenarioMode), "Working demo lead created", { workflowIndex: 1 });
    const targetWorkflowIndex = 6;
    focusRecordAcrossPipeline(record.name, targetWorkflowIndex);
    recordOperation({
      title: "Guided walkthrough completed",
      body: `${record.name} advanced from captured signal to paid assessment candidate with artifacts ready for customer review.`,
      tone: "success",
      workflowIndex: targetWorkflowIndex,
      updates: state => ({ approvalCount: Math.max(0, state.approvalCount - 1), generatedRecords: state.generatedRecords + (activeDemoRecord ? 0 : 1) }),
    });
    setSurface("conversion-board");
  }, [activeDemoRecord, addSyntheticRecord, focusRecordAcrossPipeline, operationState.scenarioMode, recordOperation, setSurface, syntheticRecords.length]);

  const handleOpenRuntimeRecord = useCallback((recordName) => {
    const workflowIndex = pipelineOverrides[recordName]?.workflowIndex ?? 0;
    focusRecordAcrossPipeline(recordName, workflowIndex);
    setSurface(routeForPipelineIndex(workflowIndex));
    recordOperation({
      title: "Runtime record opened",
      body: `${recordName} opened on its active pipeline surface.`,
      tone: "blue",
      workflowIndex,
    });
  }, [focusRecordAcrossPipeline, pipelineOverrides, recordOperation, routeForPipelineIndex, setSurface]);

  const handleRemoveRuntimeRecord = useCallback((recordName) => {
    setSyntheticRecords(current => current.filter(record => record.name !== recordName));
    setPipelineOverrides(current => {
      const next = { ...current };
      delete next[recordName];
      return next;
    });
    setSelectedRows(current => Object.fromEntries(
      Object.entries(current).map(([surfaceId, selectedRowId]) => [
        surfaceId,
        selectedRowId === recordName ? surfaces.find(item => item.id === surfaceId)?.selected || selectedRowId : selectedRowId,
      ]),
    ));
    recordOperation({
      title: "Runtime record removed",
      body: `${recordName} was removed from the browser-local demo pipeline.`,
      tone: "danger",
    });
  }, [recordOperation]);

  return (
    <div
      className="if-main if-operations-app if-operations-app--wide if-operations-app--sticky-header ci-opportunity-app fg-root"
      data-theme="light"
      data-density="compact"
      data-fastdas-demo-app
    >
        <header className="if-product-header if-product-header--masthead if-product-header--compact if-product-header--sticky ci-sticky-header fg-product-header" data-fastdas-shell-header>
          <div className="if-product-header__inner fg-product-header__inner" data-fastdas-header-utilities>
            <button
              type="button"
              className="if-brand if-product-header__brand fg-product-header__brand"
              data-home-link
              aria-label="Go to FastDAS Command Center"
              onClick={() => setSurface("command-center")}
            >
              <div className="if-brand__mark fg-brand__mark">FD</div>
              <div>
                <span className="if-product-header__eyebrow">FastDAS Growth Engine</span>
                <strong className="if-product-header__title" data-active-page-title>{surface.nav}</strong>
              </div>
            </button>
            <HeaderSurfaceNav surface={surface} onSelect={setSurface} />
            <FastDasProfileMenu operationState={operationState} onSurfaceSelect={setSurface} onUtilityAction={handleUtilityAction} />
          </div>
        </header>

        <section
          className="if-content if-page if-operations-workspace if-operations-workspace--compact ci-opportunity-content fg-content"
          data-if-operations-workspace
          data-fastdas-simplified-shell={surface.id === "command-center" ? "command-center" : "route"}
          data-visual-density="compact"
          data-if-operations-current={activeMetricSignalId}
        >
          {surface.id === "command-center" ? null : <div className="if-operations-page__topbar fg-page-topbar">
            <nav className="if-breadcrumbs" aria-label="Current route">
              <span>FastDAS</span>
              <span className="if-breadcrumbs__separator">/</span>
              <span>Growth Engine</span>
              <span className="if-breadcrumbs__separator">/</span>
              <span className="if-breadcrumbs__current">{surface.nav}</span>
            </nav>
            <div className="if-operations-page__actions fg-page-topbar__actions">
              <span className="if-badge if-badge--info">Source tracking</span>
              <span className="if-badge if-badge--status-needs-review">Human approval</span>
              <span className="if-badge if-badge--status-on-track">{operationState.operatorMode}</span>
            </div>
          </div>}

          {surface.id === "command-center" ? null : (
            <WorkspaceRail
              surface={surface}
              activeSavedViewId={activeSavedViewId}
              onSurfaceSelect={setSurface}
              onSavedView={handleSavedView}
            />
          )}

          {surface.id === "command-center" ? null : <WorkingSetRibbon
            surface={surface}
            selectedRowId={selectedRows[surface.id]}
            operationState={operationState}
            activeCommandFilterId={activeCommandFilterId}
            onReset={() => {
              if (surface.id === "command-center") {
                applyCommandCenterFilter(COMMAND_CENTER_DEFAULT_FILTER_ID, false);
              }
              handleUtilityAction("Working set reset", `${surface.title} returned to its default FastDAS working set.`, "blue");
            }}
            onRunScan={() => handlePrimaryAction("global-signal-scan")}
          />}

          {surface.id === "command-center" ? null : <header className={`if-page-header if-operations-page__hero fg-page-header ${isFocusedWorkbench ? "fg-page-header--focused-workbench fg-page-header--command-center" : ""}`} data-fastdas-page-header>
            <div className="fg-page-header__copy">
              <div className="if-page-header__eyebrow if-operations-page__eyebrow fg-eyebrow">{surface.eyebrow}</div>
              <h1 className="if-page-header__title if-operations-page__title">{surface.title}</h1>
              <p className="if-panel__subtitle if-operations-page__summary">{surface.summary}</p>
              <div className="if-page-header__meta if-route-demo-controls fg-page-meta" data-fastdas-page-meta>
                <span className="if-route-status"><strong>Selected</strong><span>{selectedRows[surface.id]}</span></span>
                <span className="if-route-status"><strong>Primary action</strong><span>{surface.primaryAction}</span></span>
                <span className="if-route-status"><strong>Human gate</strong><span>{operationState.approvalCount} approvals due</span></span>
              </div>
            </div>
            <div className="if-page-header__actions if-toolbar__group fg-page-actions" data-fastdas-page-actions>
              <button
                className="if-btn if-btn--secondary fg-btn"
                type="button"
                onClick={() => {
                  if (surface.id === "command-center") {
                    applyCommandCenterFilter(COMMAND_CENTER_DEFAULT_FILTER_ID, false);
                  }
                  handleUtilityAction("Filters reset", `${surface.title} returned to the default demo view.`, "blue");
                }}
              >
                <Icon name="rotate" />Reset Filters
              </button>
              <button
                className="if-btn if-btn--secondary fg-btn"
                type="button"
                data-fastdas-action="surface-export"
                onClick={handleSurfaceExport}
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
          </header>}

          {surface.id === "command-center" ? null : (
            <GuidedDemoRunner
              activeRecord={activeDemoRecord}
              workflowIndex={activeDemoWorkflowIndex}
              syntheticRecordCount={syntheticRecords.length}
              scenarioMode={operationState.scenarioMode}
              onCreateRecord={handleGuidedCreateRecord}
              onAdvance={handleGuidedAdvance}
              onRunWalkthrough={handleGuidedWalkthrough}
              onScenarioSelect={handleScenarioPreset}
              onOpenInput={() => setSurface("synthetic-data")}
              onExport={() => handleSyntheticAction("export")}
              onReset={() => handleSyntheticAction("reset")}
            />
          )}

          {surface.id === "synthetic-data" ? (
            <SyntheticPipelineConsole
              visible
              draft={syntheticDraft}
              syntheticRecords={syntheticRecords}
              pipelineOverrides={pipelineOverrides}
              onDraftChange={handleSyntheticDraftChange}
              onSubmit={handleSyntheticSubmit}
              onGenerateRecord={handleGenerateSyntheticRecord}
              onPipelineStep={handlePipelineStep}
              onOpenRecord={handleOpenRuntimeRecord}
              onRemoveRecord={handleRemoveRuntimeRecord}
            />
          ) : null}

          {!isFocusedWorkbench ? (
            <>
              <WorkflowStrip activeIndex={operationState.workflowIndex} />
              <OperationalWorkflow state={operationState} />
              <CommandDock state={operationState} onCommandAction={handleCommandAction} onModeChange={handleModeChange} />
            </>
          ) : null}

          <div className={`if-operations-signal-section ci-page-band ci-page-band--dashboard ${surface.id === "command-center" ? "fg-command-dashboard" : ""}`} data-page-band={surface.id === "command-center" ? "command-center-dashboard" : undefined}>
            {surface.id === "command-center" ? (
              <div className="fg-command-dashboard__heading">
                <div className="if-page-header__eyebrow">FastDAS Growth Summary</div>
              </div>
            ) : null}
            <section
              className={`if-metric-grid if-operations-metric-grid if-operations-signal-grid if-operations-signal-grid--balanced if-balanced-grid fg-metric-grid ${isFocusedWorkbench ? "fg-metric-grid--focused-workbench fg-metric-grid--command-center" : ""}`}
              data-fastdas-metric-grid
              data-if-balanced-grid
              data-if-balanced-grid-min="168"
            >
              {(surface.id === "command-center" ? surface.metrics.slice(0, 4) : surface.metrics).map((metric, index) => {
                const metricFilterId = commandCenterFilterIdForMetric(metric[0]);
                const selected = surface.id === "command-center" ? activeCommandFilterId === metricFilterId : index === 0;
                return (
                  <MetricCard
                    key={metric[0]}
                    metric={metric}
                    selected={selected}
                    onSelect={surface.id === "command-center" ? () => applyCommandCenterFilter(metricFilterId) : undefined}
                  />
                );
              })}
            </section>
          </div>

          <OpportunityGrid
            surface={surface}
            selectedRowId={selectedRows[surface.id]}
            detailOpenRowId={detailOpenRows[surface.id]}
            commandQuickFilterId={activeCommandFilterId}
            onSelect={rowId => {
              setSelectedRows(current => ({ ...current, [surface.id]: rowId }));
              setDetailOpenRows(current => ({ ...current, [surface.id]: current[surface.id] === rowId ? current[surface.id] : "" }));
            }}
            onOpenDetails={rowId => {
              setDetailOpenRows(current => ({ ...current, [surface.id]: current[surface.id] === rowId ? "" : rowId }));
            }}
            onPrimaryAction={handlePrimaryAction}
            onUtilityAction={handleUtilityAction}
            onRecordAction={handleRecordAction}
          />

          {surface.id === "command-center" ? null : <OperationsSignalPanels metrics={surface.metrics} />}

          {isFocusedWorkbench && surface.id !== "command-center" ? (
            <CommandCenterOperationsDrawer operationState={operationState} onCommandAction={handleCommandAction} onModeChange={handleModeChange} />
          ) : null}

          {surface.id === "command-center" ? null : <SourceCards cards={surface.sourceCards} />}

          {surface.id === "command-center" ? null : <DataManagement management={surface.management} operationState={operationState} onSyntheticAction={handleSyntheticAction} />}

          {surface.id === "command-center" ? null : <BottomPanels surface={surface} />}

          {surface.id === "command-center" ? null : <ReleaseRail surface={surface} operationState={operationState} />}
        </section>
    </div>
  );
}
