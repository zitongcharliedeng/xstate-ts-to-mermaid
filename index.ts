/**
 * xstate-ts-to-mermaid
 * Convert XState v5 TypeScript state machines to Mermaid stateDiagram-v2 format
 *
 * Uses @xstate/graph's toDirectedGraph() to traverse state machine structure.
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
 * Format XState internal event names to human-readable
 * "xstate.after.60000.machine..." -> "after 60s"
 */
export function formatEventName(event: string): string {
  if (event.startsWith("xstate.after.")) {
    const match = event.match(/xstate\.after\.(\d+)\./);
    if (match) {
      const ms = parseInt(match[1]);
      if (ms >= 60000) return `after ${ms / 60000}m`;
      return `after ${ms / 1000}s`;
    }
  }
  return event;
}

/**
 * Get description from state node
 */
export function getDescription(node: DirectedGraphNode): string | undefined {
  const stateNode = node.stateNode as unknown as Record<string, unknown>;
  return stateNode?.description as string | undefined;
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

  lines.push("stateDiagram-v2");
  if (options.title) {
    lines.push(`    %% ${options.title}`);
  }

  const initial = machine.config.initial;
  if (initial && typeof initial === "string") {
    lines.push(`    [*] --> ${initial}`);
  }

  function collectAll(node: DirectedGraphNode): void {
    const name = getStateName(node.id);
    const desc = getDescription(node);

    // Add state with description as note
    if (desc && !seenStates.has(name)) {
      seenStates.add(name);
      const text = maxLen > 0 && desc.length > maxLen
        ? desc.substring(0, maxLen) + "..."
        : desc;
      lines.push(`    ${name}: ${text}`);
    }

    for (const edge of node.edges) {
      const sourceName = getStateName(edge.source.id);
      const targetName = getStateName(edge.target.id);
      const event = edge.transition.eventType;
      const key = `${sourceName}:${targetName}:${event}`;
      if (!seenEdges.has(key)) {
        seenEdges.add(key);
        lines.push(`    ${sourceName} --> ${targetName}: ${formatEventName(event)}`);
      }
    }
    for (const child of node.children) {
      collectAll(child);
    }
  }

  for (const edge of digraph.edges) {
    const sourceName = getStateName(edge.source.id);
    const targetName = getStateName(edge.target.id);
    const event = edge.transition.eventType;
    const key = `${sourceName}:${targetName}:${event}`;
    if (!seenEdges.has(key)) {
      seenEdges.add(key);
      lines.push(`    ${sourceName} --> ${targetName}: ${formatEventName(event)}`);
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

  lines.push("stateDiagram-v2");
  if (options.title) {
    lines.push(`    %% ${options.title}`);
  }

  function processNode(node: DirectedGraphNode, indent: number = 1): void {
    const pad = "    ".repeat(indent);
    const name = getStateName(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const desc = getDescription(node);
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
        const edgeKey = `${edge.source.id}->${edge.target.id}:${edge.transition.eventType}`;
        if (!processedEdges.has(edgeKey)) {
          processedEdges.add(edgeKey);
          const sourceName = getStateName(edge.source.id);
          const targetName = getStateName(edge.target.id);
          const event = edge.transition.eventType;
          lines.push(`${pad}    ${sourceName} --> ${targetName}: ${formatEventName(event)}`);
        }
      }

      lines.push(`${pad}}`);

      if (desc) {
        const text = maxLen > 0 && desc.length > maxLen ? desc.substring(0, maxLen) + "..." : desc;
        lines.push(`${pad}note right of ${name}: ${text}`);
      }
    } else if (desc) {
      const text = maxLen > 0 && desc.length > maxLen ? desc.substring(0, maxLen) + "..." : desc;
      lines.push(`${pad}${name}: ${text}`);
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
    const edgeKey = `${edge.source.id}->${edge.target.id}:${edge.transition.eventType}`;
    if (!processedEdges.has(edgeKey)) {
      processedEdges.add(edgeKey);
      const sourceName = getStateName(edge.source.id);
      const targetName = getStateName(edge.target.id);
      const event = edge.transition.eventType;
      lines.push(`    ${sourceName} --> ${targetName}: ${formatEventName(event)}`);
    }
  }

  return lines.join("\n");
}

export default toMermaid;
