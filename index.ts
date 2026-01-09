/**
 * xstate-to-mermaid
 * Convert XState v5 state machines to Mermaid stateDiagram-v2 format
 *
 * Uses @xstate/graph's toDirectedGraph() to traverse state machine structure
 * and generates valid Mermaid syntax for rendering.
 */

import {
  toDirectedGraph,
  type DirectedGraphNode,
} from "@xstate/graph";
import { type AnyStateMachine } from "xstate";

export interface MermaidOptions {
  /** Title comment to add at the top of the diagram */
  title?: string;
  /** Whether to include nested state structure (default: false = flat) */
  nested?: boolean;
}

/**
 * Extract the short state name from a fully qualified XState id
 * e.g., "aito.system.running" -> "running"
 */
function getStateName(id: string): string {
  const parts = id.split(".");
  return parts[parts.length - 1];
}

/**
 * Format XState internal event names into human-readable labels
 * e.g., "xstate.after.60000.aito.system..." -> "after 60s"
 */
function formatEventName(event: string): string {
  if (event.startsWith("xstate.after.")) {
    const match = event.match(/xstate\.after\.(\d+)\./);
    if (match) {
      const ms = parseInt(match[1]);
      if (ms >= 60000) {
        const minutes = ms / 60000;
        return `after ${minutes}m`;
      }
      const seconds = ms / 1000;
      return `after ${seconds}s`;
    }
  }
  return event;
}

/**
 * Convert an XState v5 machine to Mermaid stateDiagram-v2 format (flat view)
 *
 * This produces a flat diagram where all states are at the same level,
 * showing all transitions regardless of nesting. Good for overview.
 */
export function toMermaid(
  machine: AnyStateMachine,
  options: MermaidOptions = {}
): string {
  const digraph = toDirectedGraph(machine);
  const lines: string[] = [];
  const seenEdges = new Set<string>();

  lines.push("stateDiagram-v2");
  if (options.title) {
    lines.push(`    %% ${options.title}`);
  }

  // Add initial state transition
  const initial = machine.config.initial;
  if (initial && typeof initial === "string") {
    lines.push(`    [*] --> ${initial}`);
  }

  // Recursively collect all edges from the graph
  function collectEdges(node: DirectedGraphNode): void {
    for (const edge of node.edges) {
      const sourceName = getStateName(edge.source.id);
      const targetName = getStateName(edge.target.id);
      const event = edge.transition.eventType;
      const key = `${sourceName}:${targetName}:${event}`;
      if (!seenEdges.has(key)) {
        seenEdges.add(key);
        lines.push(
          `    ${sourceName} --> ${targetName}: ${formatEventName(event)}`
        );
      }
    }
    for (const child of node.children) {
      collectEdges(child);
    }
  }

  // Process top-level edges
  for (const edge of digraph.edges) {
    const sourceName = getStateName(edge.source.id);
    const targetName = getStateName(edge.target.id);
    const event = edge.transition.eventType;
    const key = `${sourceName}:${targetName}:${event}`;
    if (!seenEdges.has(key)) {
      seenEdges.add(key);
      lines.push(
        `    ${sourceName} --> ${targetName}: ${formatEventName(event)}`
      );
    }
  }

  // Collect from children
  for (const child of digraph.children) {
    collectEdges(child);
  }

  return lines.join("\n");
}

/**
 * Convert an XState v5 machine to Mermaid with nested compound states
 *
 * This preserves the hierarchy using Mermaid's state {} syntax.
 * More accurate representation but can be complex for deep nesting.
 */
export function toMermaidNested(
  machine: AnyStateMachine,
  options: MermaidOptions = {}
): string {
  const digraph = toDirectedGraph(machine);
  const lines: string[] = [];
  const processedEdges = new Set<string>();

  lines.push("stateDiagram-v2");
  if (options.title) {
    lines.push(`    %% ${options.title}`);
  }

  function processNode(node: DirectedGraphNode, indent: number = 1): void {
    const pad = "    ".repeat(indent);
    const name = getStateName(node.id);
    const hasChildren = node.children && node.children.length > 0;

    // Get description if available
    const stateNode = node.stateNode as unknown as Record<string, unknown>;
    const description = stateNode?.description as string | undefined;

    if (hasChildren) {
      lines.push(`${pad}state ${name} {`);

      // Add initial state transition within compound state
      const initial = stateNode?.initial;
      if (initial && typeof initial === "string") {
        lines.push(`${pad}    [*] --> ${initial}`);
      }

      // Process children recursively
      for (const child of node.children) {
        processNode(child, indent + 1);
      }

      // Process edges within this compound state
      for (const edge of node.edges) {
        const edgeKey = `${edge.source.id}->${edge.target.id}:${edge.transition.eventType}`;
        if (!processedEdges.has(edgeKey)) {
          processedEdges.add(edgeKey);
          const sourceName = getStateName(edge.source.id);
          const targetName = getStateName(edge.target.id);
          const event = edge.transition.eventType;
          lines.push(
            `${pad}    ${sourceName} --> ${targetName}: ${formatEventName(event)}`
          );
        }
      }

      lines.push(`${pad}}`);
    } else {
      // Leaf state - add with description as note if present
      if (description) {
        lines.push(`${pad}state ${name}:::hasDesc`);
        const truncated =
          description.length > 50
            ? description.substring(0, 50) + "..."
            : description;
        lines.push(`${pad}note right of ${name}: ${truncated}`);
      }
    }
  }

  // Add initial state for the machine
  const initial = machine.config.initial;
  if (initial && typeof initial === "string") {
    lines.push(`    [*] --> ${initial}`);
  }

  // Process all top-level children
  for (const child of digraph.children) {
    processNode(child, 1);
  }

  // Process top-level edges
  for (const edge of digraph.edges) {
    const edgeKey = `${edge.source.id}->${edge.target.id}:${edge.transition.eventType}`;
    if (!processedEdges.has(edgeKey)) {
      processedEdges.add(edgeKey);
      const sourceName = getStateName(edge.source.id);
      const targetName = getStateName(edge.target.id);
      const event = edge.transition.eventType;
      lines.push(
        `    ${sourceName} --> ${targetName}: ${formatEventName(event)}`
      );
    }
  }

  return lines.join("\n");
}

// Default export for convenience
export default toMermaid;
