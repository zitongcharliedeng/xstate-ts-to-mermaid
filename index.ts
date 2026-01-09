/**
 * xstate-ts-to-mermaid
 * Convert XState v5 TypeScript state machines to Mermaid stateDiagram-v2 format
 *
 * Uses @xstate/graph's toDirectedGraph() to traverse state machine structure.
 * Aims for visual parity with Stately.ai editor.
 */

import {
  toDirectedGraph,
  type DirectedGraphNode,
} from "@xstate/graph";
import { type AnyStateMachine } from "xstate";

export interface MermaidOptions {
  title?: string;
  /** Max description length (0 = no limit). Default: 0 */
  maxDescriptionLength?: number;
  /** Include guards in transition labels. Default: true */
  includeGuards?: boolean;
  /** Include actions in transition labels. Default: true */
  includeActions?: boolean;
  /** Include entry actions in state descriptions. Default: true */
  includeEntryActions?: boolean;
  /** Include exit actions in state descriptions. Default: true */
  includeExitActions?: boolean;
  /** Include invoke actors in state descriptions. Default: true */
  includeInvokes?: boolean;
  /** Include tags in state descriptions. Default: true */
  includeTags?: boolean;
  /** Include meta in state descriptions. Default: true */
  includeMeta?: boolean;
}

/**
 * Extract short state name from fully qualified XState id
 * "machine.parent.child" -> "child"
 */
export function getStateName(id: string): string {
  const parts = id.split(".");
  return parts[parts.length - 1];
}

/**
 * Format XState internal event names
 * "xstate.after.60000.machine..." -> "after 60000ms"
 * Keeps raw milliseconds for parity with Stately.ai
 */
export function formatEventName(event: string): string {
  if (event.startsWith("xstate.after.")) {
    const match = event.match(/xstate\.after\.(\d+)\./);
    if (match) {
      return `after ${match[1]}ms`;
    }
  }
  return event;
}

/**
 * Escape text for Mermaid state descriptions.
 * Colons break `stateName: description` syntax, so replace with dash.
 */
export function escapeMermaidText(text: string): string {
  return text.replace(/:/g, ' -');
}

/**
 * Get description from state node
 */
export function getDescription(node: DirectedGraphNode): string | undefined {
  const stateNode = node.stateNode as unknown as Record<string, unknown>;
  const desc = stateNode?.description as string | undefined;
  return desc ? escapeMermaidText(desc) : undefined;
}

/**
 * Get entry actions from state node
 */
export function getEntryActions(node: DirectedGraphNode): string[] {
  const stateNode = node.stateNode as unknown as Record<string, unknown>;
  const entry = stateNode?.entry as Array<{ type: string }> | undefined;
  return entry?.map(a => a.type).filter(t => t && !t.startsWith('xstate.')) || [];
}

/**
 * Get exit actions from state node
 */
export function getExitActions(node: DirectedGraphNode): string[] {
  const stateNode = node.stateNode as unknown as Record<string, unknown>;
  const exit = stateNode?.exit as Array<{ type: string }> | undefined;
  return exit?.map(a => a.type).filter(t => t && !t.startsWith('xstate.')) || [];
}

/**
 * Get invoke actors from state node
 */
export function getInvokes(node: DirectedGraphNode): Array<{ src: string; id: string }> {
  const stateNode = node.stateNode as unknown as Record<string, unknown>;
  const invoke = stateNode?.invoke as Array<{ src: string; id: string }> | undefined;
  return invoke || [];
}

/**
 * Get tags from state node
 */
export function getTags(node: DirectedGraphNode): string[] {
  const stateNode = node.stateNode as unknown as Record<string, unknown>;
  const tags = stateNode?.tags as string[] | undefined;
  return tags || [];
}

/**
 * Get meta from state node (generic key-value object)
 */
export function getMeta(node: DirectedGraphNode): Record<string, unknown> | undefined {
  const stateNode = node.stateNode as unknown as Record<string, unknown>;
  return stateNode?.meta as Record<string, unknown> | undefined;
}

/**
 * Format a transition label with event, guard, and actions
 * Stately.ai format: "EVENT IF guard" with "⚡ action" below
 */
export function formatTransitionLabel(
  transition: { eventType: string; guard?: { type: string } | null; actions?: readonly { type: string }[] },
  options: { includeGuards?: boolean; includeActions?: boolean } = {}
): string {
  const { includeGuards = true, includeActions = true } = options;

  let label = formatEventName(transition.eventType);

  if (includeGuards && transition.guard?.type) {
    label += ` IF ${transition.guard.type}`;
  }

  if (includeActions && transition.actions && transition.actions.length > 0) {
    const actionNames = transition.actions
      .map(a => a.type)
      .filter(t => t && !t.startsWith('xstate.'));
    if (actionNames.length > 0) {
      label += `<br/>⚡ ${actionNames.join(', ')}`;
    }
  }

  return label;
}

/**
 * Format meta object as key-value lines with italicized keys
 * Note: meta is valid XState but gets cleansed by Stately.ai visual editor (no UI for it)
 */
function formatMeta(meta: Record<string, unknown>): string[] {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(meta)) {
    if (Array.isArray(value)) {
      lines.push(`<i>${key}</i> - ${value.join(', ')}`);
    } else if (typeof value === 'object' && value !== null) {
      lines.push(`<i>${key}</i> - ${JSON.stringify(value)}`);
    } else {
      lines.push(`<i>${key}</i> - ${String(value)}`);
    }
  }
  return lines;
}

/**
 * Build state label with Stately.ai-style formatting:
 * - State name as bold header
 * - Description below
 * - Tags with 🏷️ prefix
 * - Meta as key-value pairs (italicized keys)
 * - Entry actions section with separator + bold italic label
 * - Exit actions section with separator + bold italic label
 * - Invoke section with separator + bold italic label
 */
function buildStateLabel(
  name: string,
  desc: string | undefined,
  tags: string[],
  meta: Record<string, unknown> | undefined,
  entry: string[],
  exit: string[],
  invokes: Array<{ src: string; id: string }>,
  maxLen: number
): string {
  const lines: string[] = [];

  // State name as bold header
  lines.push(`<b>${name}</b>`);

  // Description (regular text)
  if (desc) {
    lines.push(desc);
  }

  // Tags - each tag on its own line with tag emoji (matches Stately.ai pill styling)
  if (tags.length > 0) {
    for (const tag of tags) {
      lines.push(`🏷️ ${tag}`);
    }
  }

  // Meta as generic key-value pairs (italicized keys)
  if (meta && Object.keys(meta).length > 0) {
    const metaLines = formatMeta(meta);
    for (const line of metaLines) {
      lines.push(line);
    }
  }

  // Entry actions (separator + bold italic label for visual distinction)
  if (entry.length > 0) {
    lines.push(`───────────`);
    lines.push(`<b><i>Entry actions</i></b>`);
    for (const action of entry) {
      lines.push(`⚡ ${action}`);
    }
  }

  // Exit actions (separator + bold italic label for visual distinction)
  if (exit.length > 0) {
    lines.push(`───────────`);
    lines.push(`<b><i>Exit actions</i></b>`);
    for (const action of exit) {
      lines.push(`⚡ ${action}`);
    }
  }

  // Invokes (separator + bold italic label for visual distinction)
  if (invokes.length > 0) {
    lines.push(`───────────`);
    lines.push(`<b><i>Invoke</i></b>`);
    for (const inv of invokes) {
      lines.push(`◉ ${inv.src}`);
      lines.push(`Actor ID - ${inv.id}`);
    }
  }

  let text = lines.join('<br/>');
  if (maxLen > 0 && text.length > maxLen) {
    text = text.substring(0, maxLen) + "...";
  }

  return text;
}

/**
 * Convert XState v5 machine to Mermaid stateDiagram-v2 (flat)
 */
export function toMermaid(
  machine: AnyStateMachine,
  options: MermaidOptions = {}
): string {
  const digraph = toDirectedGraph(machine);
  const lines: string[] = [];
  const seenEdges = new Set<string>();
  const seenStates = new Set<string>();
  const maxLen = options.maxDescriptionLength ?? 0;
  const labelOptions = { includeGuards: options.includeGuards, includeActions: options.includeActions };

  lines.push("stateDiagram-v2");
  // Use machine ID as title if no explicit title provided
  const machineId = (machine.config as { id?: string }).id;
  const title = options.title || machineId;
  if (title) {
    lines.push(`    %% ${title}`);
    lines.push(`    %% ───────────────────────────`);
  }

  const initial = machine.config.initial;
  if (initial && typeof initial === "string") {
    lines.push(`    [*] --> ${initial}`);
  }

  const includeEntry = options.includeEntryActions ?? true;
  const includeExit = options.includeExitActions ?? true;
  const includeInvoke = options.includeInvokes ?? true;
  const includeTagsOpt = options.includeTags ?? true;
  const includeMetaOpt = options.includeMeta ?? true;

  function collectAll(node: DirectedGraphNode): void {
    const name = getStateName(node.id);
    const desc = getDescription(node);
    const entry = includeEntry ? getEntryActions(node) : [];
    const exit = includeExit ? getExitActions(node) : [];
    const invokes = includeInvoke ? getInvokes(node) : [];
    const tags = includeTagsOpt ? getTags(node) : [];
    const meta = includeMetaOpt ? getMeta(node) : undefined;

    if (!seenStates.has(name)) {
      seenStates.add(name);

      const hasContent = desc || tags.length > 0 || (meta && Object.keys(meta).length > 0) || entry.length > 0 || exit.length > 0 || invokes.length > 0;
      if (hasContent) {
        const label = buildStateLabel(name, desc, tags, meta, entry, exit, invokes, maxLen);
        lines.push(`    ${name}: ${label}`);
      } else {
        lines.push(`    ${name}: ${name}`);
      }
    }

    for (const edge of node.edges) {
      const sourceName = getStateName(edge.source.id);
      const targetName = getStateName(edge.target.id);
      const t = edge.transition as { eventType: string; guard?: { type: string } | null; actions?: readonly { type: string }[] };
      const key = `${sourceName}:${targetName}:${t.eventType}`;
      if (!seenEdges.has(key)) {
        seenEdges.add(key);
        lines.push(`    ${sourceName} --> ${targetName}: ${formatTransitionLabel(t, labelOptions)}`);
      }
    }
    for (const child of node.children) {
      collectAll(child);
    }
  }

  for (const edge of digraph.edges) {
    const sourceName = getStateName(edge.source.id);
    const targetName = getStateName(edge.target.id);
    const t = edge.transition as { eventType: string; guard?: { type: string } | null; actions?: readonly { type: string }[] };
    const key = `${sourceName}:${targetName}:${t.eventType}`;
    if (!seenEdges.has(key)) {
      seenEdges.add(key);
      lines.push(`    ${sourceName} --> ${targetName}: ${formatTransitionLabel(t, labelOptions)}`);
    }
  }

  for (const child of digraph.children) {
    collectAll(child);
  }

  return lines.join("\n");
}

/**
 * Convert XState v5 machine to Mermaid with nested compound states
 */
export function toMermaidNested(
  machine: AnyStateMachine,
  options: MermaidOptions = {}
): string {
  const digraph = toDirectedGraph(machine);
  const lines: string[] = [];
  const processedEdges = new Set<string>();
  const maxLen = options.maxDescriptionLength ?? 0;
  const labelOptions = { includeGuards: options.includeGuards, includeActions: options.includeActions };
  const includeEntry = options.includeEntryActions ?? true;
  const includeExit = options.includeExitActions ?? true;
  const includeInvoke = options.includeInvokes ?? true;
  const includeTagsOpt = options.includeTags ?? true;
  const includeMetaOpt = options.includeMeta ?? true;

  lines.push("stateDiagram-v2");
  // Use machine ID as title if no explicit title provided
  const machineId = (machine.config as { id?: string }).id;
  const title = options.title || machineId;
  if (title) {
    lines.push(`    %% ${title}`);
    lines.push(`    %% ───────────────────────────`);
  }

  function processNode(node: DirectedGraphNode, indent: number = 1): void {
    const pad = "    ".repeat(indent);
    const name = getStateName(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const desc = getDescription(node);
    const entry = includeEntry ? getEntryActions(node) : [];
    const exit = includeExit ? getExitActions(node) : [];
    const invokes = includeInvoke ? getInvokes(node) : [];
    const tags = includeTagsOpt ? getTags(node) : [];
    const meta = includeMetaOpt ? getMeta(node) : undefined;
    const stateNode = node.stateNode as unknown as Record<string, unknown>;

    if (hasChildren) {
      lines.push(`${pad}state ${name} {`);

      const initial = stateNode?.initial;
      if (initial && typeof initial === "string") {
        lines.push(`${pad}    [*] --> ${initial}`);
      }

      for (const child of node.children) {
        processNode(child, indent + 1);
      }

      for (const edge of node.edges) {
        const t = edge.transition as { eventType: string; guard?: { type: string } | null; actions?: readonly { type: string }[] };
        const edgeKey = `${edge.source.id}->${edge.target.id}:${t.eventType}`;
        if (!processedEdges.has(edgeKey)) {
          processedEdges.add(edgeKey);
          const sourceName = getStateName(edge.source.id);
          const targetName = getStateName(edge.target.id);
          lines.push(`${pad}    ${sourceName} --> ${targetName}: ${formatTransitionLabel(t, labelOptions)}`);
        }
      }

      lines.push(`${pad}}`);

      if (desc) {
        const text = maxLen > 0 && desc.length > maxLen ? desc.substring(0, maxLen) + "..." : desc;
        lines.push(`${pad}note right of ${name}: ${text}`);
      }
    } else {
      const hasContent = desc || tags.length > 0 || (meta && Object.keys(meta).length > 0) || entry.length > 0 || exit.length > 0 || invokes.length > 0;
      if (hasContent) {
        const label = buildStateLabel(name, desc, tags, meta, entry, exit, invokes, maxLen);
        lines.push(`${pad}${name}: ${label}`);
      } else {
        lines.push(`${pad}${name}: ${name}`);
      }
    }
  }

  const initial = machine.config.initial;
  if (initial && typeof initial === "string") {
    lines.push(`    [*] --> ${initial}`);
  }

  for (const child of digraph.children) {
    processNode(child, 1);
  }

  for (const edge of digraph.edges) {
    const t = edge.transition as { eventType: string; guard?: { type: string } | null; actions?: readonly { type: string }[] };
    const edgeKey = `${edge.source.id}->${edge.target.id}:${t.eventType}`;
    if (!processedEdges.has(edgeKey)) {
      processedEdges.add(edgeKey);
      const sourceName = getStateName(edge.source.id);
      const targetName = getStateName(edge.target.id);
      lines.push(`    ${sourceName} --> ${targetName}: ${formatTransitionLabel(t, labelOptions)}`);
    }
  }

  return lines.join("\n");
}

export default toMermaid;
