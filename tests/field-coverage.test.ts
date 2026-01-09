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
import { toMermaid } from "../index.js";

// Test machine that uses EVERY renderable field
const comprehensiveMachine = setup({
  types: {
    events: {} as
      | { type: "GO" }
      | { type: "BACK" }
      | { type: "DONE" },
    tags: {} as "INV:invariant_a" | "INV:invariant_b" | "category",
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
    // Actor stub: XState requires proper actor implementations, but for testing
    // machine structure we use `as any`. This is standard for XState examples.
    someService: {} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  },
}).createMachine({
  id: "comprehensive",
  initial: "stateA",
  states: {
    stateA: {
      // description: ✅
      description: "FIELD_DESCRIPTION_CHECK",
      // tags: ✅
      tags: ["INV:invariant_a", "category"],
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
      tags: ["INV:invariant_b"],
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
    pattern: /<sup>FIELD_DESCRIPTION_CHECK<\/sup>/,
    description: "State description (superscript, closer to title)",
  },
  {
    field: "tags",
    pattern: /\(Invariant∶invariant_a\).*\(category\)/s,
    description: "Tags in parentheses with full Invariant label",
  },
  {
    field: "meta",
    pattern: /customKey.*FIELD_META_CHECK/,
    description: "Meta key-value pairs",
  },
  {
    field: "entry",
    pattern: /<i>Entry actions<\/i>.*\[ϟ onEnter\]/s,
    description: "Entry actions: italic label, lightning inside brackets",
  },
  {
    field: "exit",
    pattern: /<i>Exit actions<\/i>.*\[ϟ onExit\]/s,
    description: "Exit actions: italic label, lightning inside brackets",
  },
  {
    field: "invoke",
    pattern: /<i>Invoke<\/i>.*\[◉ someService\].*<sub>∟ ID∶ FIELD_INVOKE_CHECK<\/sub>/s,
    description: "Invoke: italic label, actor in brackets, ID as subscript with corner",
  },
  {
    field: "on (transitions)",
    pattern: /stateA --> stateB: <b>GO<\/b>/,
    description: "Event transitions with bold event name",
  },
  {
    field: "on (guards)",
    pattern: /IF isValid/,
    description: "Guards on transitions",
  },
  {
    field: "on (actions)",
    pattern: /\[ϟ transitionAction\]/,
    description: "Actions on transitions: lightning inside brackets",
  },
  {
    field: "after",
    pattern: /<i>after<\/i> 1000ms/,
    description: "Delayed transitions (only 'after' is italic)",
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
