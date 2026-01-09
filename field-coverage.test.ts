#!/usr/bin/env npx tsx
/**
 * DETERMINISTIC FIELD COVERAGE TEST
 *
 * This test ensures that EVERY XState v5 StateNodeConfig field that should be
 * rendered is actually captured in the Mermaid output.
 *
 * If this test fails, it means either:
 * 1. A new XState field was added that we don't support yet
 * 2. A regression broke support for an existing field
 *
 * XState v5 StateNodeConfig fields (from source):
 * - initial: structural, not rendered in state labels
 * - type: structural (atomic/compound/parallel/final/history)
 * - history: structural (shallow/deep)
 * - states: structural, child states
 * - invoke: ✅ MUST RENDER - invoked actors
 * - on: ✅ MUST RENDER - event transitions
 * - entry: ✅ MUST RENDER - entry actions
 * - exit: ✅ MUST RENDER - exit actions
 * - onDone: renders as transition edge
 * - after: ✅ MUST RENDER - delayed transitions
 * - always: renders as transition edge (if present)
 * - parent: internal, not user-configured
 * - meta: ✅ MUST RENDER - metadata object
 * - output: final state output (if present)
 * - id: structural
 * - order: internal
 * - tags: ✅ MUST RENDER - array of tags
 * - description: ✅ MUST RENDER - text description
 * - target: history default target
 */
import { setup } from "xstate";
import { toMermaid } from "./index.js";

// Test machine that uses EVERY renderable field
const comprehensiveMachine = setup({
  types: {
    events: {} as
      | { type: "GO" }
      | { type: "BACK" }
      | { type: "DONE" },
    tags: {} as "🔒 invariant_a" | "🔒 invariant_b" | "category",
  },
  guards: {
    isValid: () => true,
  },
  actions: {
    onEnter: () => {},
    onExit: () => {},
    transitionAction: () => {},
  },
  actors: {
    someService: {} as any,
  },
}).createMachine({
  id: "comprehensive",
  initial: "stateA",
  states: {
    stateA: {
      // description: ✅
      description: "FIELD_DESCRIPTION_CHECK",
      // tags: ✅
      tags: ["🔒 invariant_a", "category"],
      // meta: ✅
      meta: { customKey: "FIELD_META_CHECK" },
      // entry: ✅
      entry: [{ type: "onEnter" }],
      // exit: ✅
      exit: [{ type: "onExit" }],
      // invoke: ✅
      invoke: [{ src: "someService", id: "FIELD_INVOKE_CHECK" }],
      // on: ✅ (with guard and action)
      on: {
        GO: {
          target: "stateB",
          guard: { type: "isValid" },
          actions: [{ type: "transitionAction" }],
        },
      },
      // after: ✅
      after: {
        1000: { target: "stateB" },
      },
    },
    stateB: {
      tags: ["🔒 invariant_b"],
      on: {
        BACK: { target: "stateA" },
      },
    },
  },
});

const output = toMermaid(comprehensiveMachine, { title: "Field Coverage Test" });

// Field presence checks
const checks: { field: string; pattern: RegExp; description: string }[] = [
  {
    field: "description",
    pattern: /FIELD_DESCRIPTION_CHECK/,
    description: "State description text",
  },
  {
    field: "tags",
    pattern: /🏷️.*🔒 invariant_a.*category/,
    description: "Tags with emoji prefix",
  },
  {
    field: "meta",
    pattern: /customKey.*FIELD_META_CHECK/,
    description: "Meta key-value pairs",
  },
  {
    field: "entry",
    pattern: /Entry actions.*⚡ onEnter/s,
    description: "Entry actions section",
  },
  {
    field: "exit",
    pattern: /Exit actions.*⚡ onExit/s,
    description: "Exit actions section",
  },
  {
    field: "invoke",
    pattern: /Invoke.*◉ someService.*FIELD_INVOKE_CHECK/s,
    description: "Invoke actors section",
  },
  {
    field: "on (transitions)",
    pattern: /stateA --> stateB: GO/,
    description: "Event transitions",
  },
  {
    field: "on (guards)",
    pattern: /IF isValid/,
    description: "Guards on transitions",
  },
  {
    field: "on (actions)",
    pattern: /⚡ transitionAction/,
    description: "Actions on transitions",
  },
  {
    field: "after",
    pattern: /after 1000ms/,
    description: "Delayed transitions",
  },
];

console.log("=== FIELD COVERAGE TEST ===\n");
console.log("Generated Mermaid:\n");
console.log(output);
console.log("\n=== FIELD CHECKS ===\n");

let allPassed = true;

for (const check of checks) {
  const passed = check.pattern.test(output);
  const status = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`${status} | ${check.field}: ${check.description}`);
  if (!passed) {
    console.log(`       Expected pattern: ${check.pattern}`);
    allPassed = false;
  }
}

console.log("\n=== SUMMARY ===\n");

if (allPassed) {
  console.log("✅ ALL FIELDS COVERED - Library captures all XState v5 renderable fields");
  process.exit(0);
} else {
  console.log("❌ FIELD COVERAGE INCOMPLETE - Some XState fields are not being rendered");
  process.exit(1);
}
