import { opportunityRecords, surfaces } from "./data.js";

export const FOCUSED_WORKBENCH_SURFACES = [
  "command-center",
  "signal-intake",
  "opportunity-workbench",
  "evidence-review",
  "outreach-queue",
  "agent-operations",
  "synthetic-data",
  "conversion-board",
];

export const SAVED_VIEWS = [
  {
    id: "score-80-review",
    label: "Score 80+ / Review",
    surfaceId: "opportunity-workbench",
    rowId: "Capital Ridge Senior Living",
    workflowIndex: 3,
    tone: "warning",
  },
  {
    id: "closeout-signals",
    label: "Closeout Signals",
    surfaceId: "signal-intake",
    rowId: "Arlington County Permit Portal",
    workflowIndex: 1,
    tone: "blue",
  },
  {
    id: "paid-assessment-fit",
    label: "Paid Assessment Fit",
    surfaceId: "conversion-board",
    rowId: "Capital Ridge Senior Living",
    workflowIndex: 8,
    tone: "success",
  },
  {
    id: "partner-paths",
    label: "Partner Paths",
    surfaceId: "evidence-review",
    rowId: "Partner route",
    workflowIndex: 3,
    tone: "purple",
  },
];

export const WORKBENCH_SURFACE_CONFIG = {
  "command-center": {
    viewLabel: "Decision view",
    gridHook: "data-fastdas-command-center-grid",
    workbenchHook: "data-fastdas-command-center-workbench",
  },
  "signal-intake": {
    viewLabel: "Source health view",
    gridHook: "data-fastdas-signal-intake-grid",
    workbenchHook: "data-fastdas-signal-intake-workbench",
  },
  "opportunity-workbench": {
    viewLabel: "Qualification view",
    gridHook: "data-fastdas-opportunity-workbench-grid",
    workbenchHook: "data-fastdas-opportunity-workbench-workbench",
  },
  "evidence-review": {
    viewLabel: "Review view",
    gridHook: "data-fastdas-evidence-review-grid",
    workbenchHook: "data-fastdas-evidence-review-workbench",
  },
  "outreach-queue": {
    viewLabel: "Approval queue",
    gridHook: "data-fastdas-outreach-queue-grid",
    workbenchHook: "data-fastdas-outreach-queue-workbench",
  },
  "agent-operations": {
    viewLabel: "Runtime view",
    gridHook: "data-fastdas-agent-operations-grid",
    workbenchHook: "data-fastdas-agent-operations-workbench",
  },
  "synthetic-data": {
    viewLabel: "Dataset control",
    gridHook: "data-fastdas-synthetic-data-grid",
    workbenchHook: "data-fastdas-synthetic-data-workbench",
  },
  "conversion-board": {
    viewLabel: "Learning view",
    gridHook: "data-fastdas-conversion-board-grid",
    workbenchHook: "data-fastdas-conversion-board-workbench",
  },
};

export function isFocusedWorkbenchSurface(surfaceId) {
  return FOCUSED_WORKBENCH_SURFACES.includes(surfaceId);
}

export function workbenchSurfaceConfig(surfaceId) {
  return WORKBENCH_SURFACE_CONFIG[surfaceId] || {};
}

function namedHookAttribute(hookName) {
  return hookName ? { [hookName]: "true" } : {};
}

export function gridSurfaceAttributes(surfaceId) {
  return {
    "data-fastdas-grid-surface": surfaceId,
    ...namedHookAttribute(WORKBENCH_SURFACE_CONFIG[surfaceId]?.gridHook),
  };
}

export function workbenchSurfaceAttributes(surfaceId) {
  return {
    "data-fastdas-workbench-surface": surfaceId,
    ...namedHookAttribute(WORKBENCH_SURFACE_CONFIG[surfaceId]?.workbenchHook),
  };
}

export function defaultDetailOpenRows() {
  return Object.fromEntries(surfaces.map(surface => [surface.id, isFocusedWorkbenchSurface(surface.id) ? "" : surface.selected]));
}

export function splitCell(value) {
  const [primary, secondary] = String(value).split("|");
  return { primary, secondary };
}

export function toneForValue(value) {
  const text = String(value).toLowerCase();
  if (text.includes("risk") || text.includes("radio") || text.includes("reject") || text.includes("stop")) return "danger";
  if (text.includes("review") || text.includes("approval") || text.includes("warning") || text.includes("hold") || text.includes("needs")) return "warning";
  if (text.includes("healthy") || text.includes("ready") || text.includes("clean") || text.includes("pass") || text.includes("low")) return "success";
  if (text.includes("agent") || text.includes("human") || text.includes("follow")) return "purple";
  if (text.includes("source") || text.includes("benchmark") || text.includes("health") || text.includes("current")) return "blue";
  return "neutral";
}

function opportunityRecordForId(rowId) {
  return opportunityRecords.find(record => record.name === rowId);
}

function tableRowForId(surface, selectedRowId) {
  return surface.table?.rows.find(row => row.id === selectedRowId) || surface.table?.rows[0];
}

function recordDetailForSelection(surface, selectedRowId) {
  const record = opportunityRecordForId(selectedRowId || surface.selected);
  if (!record) return surface.expanded;

  return {
    title: record.name,
    description: record.why,
    record,
    evidence: [
      [record.signal, `Signal / ${record.confidence}`, `${record.market} ${record.buildingType}. ${record.why}`],
      [record.firstOffer, "First paid step", `Recommended opening offer: ${record.firstOffer}. Conversion path: ${record.conversion}.`],
      [record.stakeholderPath, "Stakeholder path", `Human review should verify this path before outbound action: ${record.stakeholderPath}.`],
    ],
    actions: [
      record.nextAction,
      `Validate stakeholder path: ${record.stakeholderPath}`,
      `Open ${record.firstOffer.toLowerCase()} details for the operator review packet.`,
    ],
    gates: surface.expanded.gates,
  };
}

function sourceDetailForSelection(surface, selectedRowId) {
  const row = tableRowForId(surface, selectedRowId || surface.selected);
  if (!row) return surface.expanded;

  const [sourceCell, lane, refresh, trust, signals, exceptions, routedTo, nextRun] = row.cells;
  const { primary: sourceName, secondary: sourceDescription } = splitCell(sourceCell);
  const hasException = !String(exceptions).toLowerCase().includes("clean");

  return {
    title: sourceName,
    description: sourceDescription || surface.expanded.description,
    source: {
      name: sourceName,
      description: sourceDescription || surface.expanded.description,
      lane,
      refresh,
      trust,
      signals,
      exceptions,
      routedTo,
      nextRun,
    },
    evidence: [
      [lane, `Trust / ${trust}`, sourceDescription || "Source contract retained for operator review."],
      [signals, "Signal yield", `Current routing target: ${routedTo}. Next scheduled run: ${nextRun}.`],
      [exceptions, hasException ? "Needs review" : "Clean", hasException ? "Operator should resolve or classify the exception before trusting automated enrichment." : "No active parser or sampling blocker on this source."],
    ],
    actions: [
      `Run ${sourceName} at ${nextRun}.`,
      hasException ? `Classify exception: ${exceptions}.` : `Keep ${sourceName} on the current refresh cadence.`,
      `Route captured signals to ${routedTo}.`,
    ],
    gates: surface.expanded.gates,
  };
}

function evidenceDetailForSelection(surface, selectedRowId) {
  const row = tableRowForId(surface, selectedRowId || surface.selected);
  if (!row) return surface.expanded;

  const [evidenceCell, sourceType, confidence, freshness, outreachUse, notes] = row.cells;
  const { primary: evidenceName, secondary: evidenceSummary } = splitCell(evidenceCell);
  const useTone = toneForValue(outreachUse);
  const needsVerification = String(freshness).toLowerCase().includes("needs") || String(outreachUse).toLowerCase() === "no";

  return {
    title: evidenceName,
    description: evidenceSummary || notes || surface.expanded.description,
    evidencePacket: {
      name: evidenceName,
      summary: evidenceSummary || notes || surface.expanded.description,
      sourceType,
      confidence,
      freshness,
      outreachUse,
      notes,
      needsVerification,
    },
    evidence: [
      [sourceType, `Confidence / ${confidence}`, evidenceSummary || "Evidence packet retained for operator review."],
      [freshness, needsVerification ? "Needs review" : "Review ready", needsVerification ? "Verify freshness, contact route, or source boundaries before approving outreach use." : "Fresh enough for scoring and operator review."],
      [outreachUse, useTone === "danger" ? "Do not use" : "Use boundary", notes],
    ],
    actions: [
      needsVerification ? `Verify ${evidenceName.toLowerCase()} before outreach approval.` : `Approve ${evidenceName.toLowerCase()} for the review packet.`,
      `Keep outreach use bounded to: ${outreachUse}.`,
      notes,
    ],
    gates: surface.expanded.gates,
  };
}

function outreachDetailForSelection(surface, selectedRowId) {
  const row = tableRowForId(surface, selectedRowId || surface.selected);
  if (!row) return surface.expanded;

  const [opportunityCell, channel, draftType, firstOffer, risk, state, due, owner] = row.cells;
  const { primary: opportunityName, secondary: stakeholderPath } = splitCell(opportunityCell);
  const isBlocked = ["technical review", "research needed"].includes(String(state).toLowerCase());

  return {
    title: opportunityName,
    description: `${draftType} via ${channel} for ${stakeholderPath || "the selected stakeholder path"}. First offer: ${firstOffer}.`,
    outreachTask: {
      name: opportunityName,
      stakeholderPath,
      channel,
      draftType,
      firstOffer,
      risk,
      state,
      due,
      owner,
      isBlocked,
    },
    evidence: [
      [channel, `Risk / ${risk}`, `${draftType} queued for ${stakeholderPath || opportunityName}. Owner: ${owner}.`],
      [firstOffer, "First offer", `Keep the ask bounded to ${firstOffer.toLowerCase()} and avoid unsupported technical claims.`],
      [state, isBlocked ? "Needs review" : "Ready for approval", isBlocked ? `Resolve ${state.toLowerCase()} before any send action.` : `Due ${due}; ready for human approval before send.`],
    ],
    actions: [
      isBlocked ? `Resolve ${state.toLowerCase()} before approving ${opportunityName}.` : `Approve ${draftType.toLowerCase()} for ${opportunityName}.`,
      `Keep channel posture to ${channel}.`,
      `Schedule next cadence check for ${due}.`,
    ],
    gates: surface.expanded.gates,
  };
}

function agentDetailForSelection(surface, selectedRowId) {
  const row = tableRowForId(surface, selectedRowId || surface.selected);
  if (!row) return surface.expanded;

  const [agentCell, purpose, trigger, toolsTouched, output, status, owner] = row.cells;
  const { primary: agentName, secondary: agentScope } = splitCell(agentCell);
  const needsOperator = ["needs sample", "human gate"].includes(String(status).toLowerCase());

  return {
    title: agentName,
    description: agentScope || purpose || surface.expanded.description,
    agentRun: {
      name: agentName,
      scope: agentScope || purpose,
      purpose,
      trigger,
      toolsTouched,
      output,
      status,
      owner,
      needsOperator,
    },
    evidence: [
      [trigger, `Status / ${status}`, `${agentName} runs for: ${purpose}.`],
      [toolsTouched, "Tool chain", `Current output: ${output}. Owner: ${owner}.`],
      [output, needsOperator ? "Needs operator" : "Healthy", needsOperator ? "Keep the workflow gated until the sample, approval, or exception is cleared." : "Workflow can continue under normal monitoring."],
    ],
    actions: [
      needsOperator ? `Triage ${agentName.toLowerCase()} before trusting new output.` : `Replay ${agentName.toLowerCase()} using the current trigger contract.`,
      `Review tool chain: ${toolsTouched}.`,
      `Route output to operator owner: ${owner}.`,
    ],
    gates: surface.expanded.gates,
  };
}

function datasetDetailForSelection(surface, selectedRowId) {
  const row = tableRowForId(surface, selectedRowId || surface.selected);
  if (!row) return surface.expanded;

  const [datasetCell, records, owner, freshness, provenance, qualityGate, demoUse] = row.cells;
  const { primary: datasetName, secondary: datasetScope } = splitCell(datasetCell);
  const isRequired = String(qualityGate).toLowerCase().includes("required") || String(qualityGate).toLowerCase().includes("human");

  return {
    title: datasetName,
    description: datasetScope || surface.expanded.description,
    dataset: {
      name: datasetName,
      scope: datasetScope || surface.expanded.description,
      records,
      owner,
      freshness,
      provenance,
      qualityGate,
      demoUse,
      isRequired,
    },
    evidence: [
      [records, `Owner / ${owner}`, datasetScope || "Managed synthetic dataset retained for the customer demo."],
      [provenance, "Provenance", `Freshness: ${freshness}. Demo surface: ${demoUse}.`],
      [qualityGate, isRequired ? "Human gate" : "Quality gate", isRequired ? "Keep this dataset behind explicit operator review before customer-facing use." : "Dataset is ready for seeded walkthrough use."],
    ],
    actions: [
      `Validate ${datasetName.toLowerCase()} quality gate: ${qualityGate}.`,
      `Keep provenance bounded to ${provenance}.`,
      `Use dataset in ${demoUse}.`,
    ],
    gates: surface.expanded.gates,
  };
}

function conversionDetailForSelection(surface, selectedRowId) {
  const row = tableRowForId(surface, selectedRowId || surface.selected);
  const record = opportunityRecordForId(selectedRowId || surface.selected);
  if (!row || !record) return surface.expanded;

  const [opportunityCell, signal, firstPaidStep, conversation, assessment, report, followOn, learning] = row.cells;
  const { primary: opportunityName, secondary: market } = splitCell(opportunityCell);
  const isAssessmentCandidate = String(assessment).toLowerCase().includes("candidate");

  return {
    title: opportunityName,
    description: learning || record.why || surface.expanded.description,
    conversionRecord: {
      name: opportunityName,
      market,
      signal,
      firstPaidStep,
      conversation,
      assessment,
      report,
      followOn,
      learning,
      isAssessmentCandidate,
    },
    evidence: [
      [signal, `Conversation / ${conversation}`, `${opportunityName} is tracking toward ${firstPaidStep}.`],
      [firstPaidStep, "First paid step", `Conversion path: ${record.conversion}. Follow-on target: ${followOn}.`],
      [assessment, isAssessmentCandidate ? "Assessment candidate" : "Learning signal", learning],
    ],
    actions: [
      isAssessmentCandidate ? `Promote ${opportunityName} into assessment follow-up.` : `Keep ${opportunityName} in learning/nurture state.`,
      `Tune scoring based on ${firstPaidStep.toLowerCase()} performance.`,
      `Capture learning: ${learning}`,
    ],
    gates: surface.expanded.gates,
  };
}

const detailBuilders = {
  "command-center": recordDetailForSelection,
  "opportunity-workbench": recordDetailForSelection,
  "signal-intake": sourceDetailForSelection,
  "evidence-review": evidenceDetailForSelection,
  "outreach-queue": outreachDetailForSelection,
  "agent-operations": agentDetailForSelection,
  "synthetic-data": datasetDetailForSelection,
  "conversion-board": conversionDetailForSelection,
};

export function detailForSurfaceSelection(surface, selectedRowId) {
  return (detailBuilders[surface.id] || (() => surface.expanded))(surface, selectedRowId);
}
