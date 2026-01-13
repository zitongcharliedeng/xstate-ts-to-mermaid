#!/usr/bin/env npx tsx
/**
 * NESTED STATE MACHINE COVERAGE TEST
 *
 * Ensures both toMermaid() and toMermaidNested() correctly render:
 * 1. Flat machines (no nesting)
 * 2. Nested/compound states
 * 3. All transitions in both cases
 *
 * This test catches the bug where toMermaidNested() failed to output
 * transitions for flat machines.
 */
import { setup } from "xstate";
import { toMermaid, toMermaidNested } from "../index.js";

// ============================================================================
// TEST MACHINE 1: FLAT (no nesting)
// ============================================================================
const flatMachine = setup({
  types: {
    events: {} as
      | { type: "START" }
      | { type: "HEALTH_PASS" }
      | { type: "HEALTH_FAIL" }
      | { type: "RECOVER" },
  },
}).createMachine({
  id: "flat",
  initial: "stopped",
  states: {
    stopped: {
      on: { START: "running" },
    },
    running: {
      on: {
        HEALTH_PASS: "healthy",
        HEALTH_FAIL: "failed",
      },
    },
    healthy: {
      on: { HEALTH_FAIL: "failed" },
    },
    failed: {
      on: { RECOVER: "stopped" },
    },
  },
});

// ============================================================================
// TEST MACHINE 2: NESTED (compound states)
// ============================================================================
const nestedMachine = setup({
  types: {
    events: {} as
      | { type: "BOOT" }
      | { type: "MOUNT_OK" }
      | { type: "START_OK" }
      | { type: "SHUTDOWN" }
      | { type: "REBOOT" },
  },
}).createMachine({
  id: "nested",
  initial: "booting",
  states: {
    booting: {
      initial: "mounting",
      states: {
        mounting: {
          on: { MOUNT_OK: "starting" },
        },
        starting: {
          on: { START_OK: "#nested.running" },
        },
      },
    },
    running: {
      description: "System operational",
      on: {
        SHUTDOWN: "off",
        REBOOT: "booting",
      },
    },
    off: {
      on: { BOOT: "booting" },
    },
  },
});

// ============================================================================
// TESTS
// ============================================================================
console.log("=== NESTED STATE MACHINE COVERAGE TEST ===\n");

interface TestCase {
  name: string;
  machine: typeof flatMachine | typeof nestedMachine;
  converter: "toMermaid" | "toMermaidNested";
  expectedTransitions: string[];
}

const testCases: TestCase[] = [
  // Flat machine with toMermaid - should work
  {
    name: "Flat machine + toMermaid",
    machine: flatMachine,
    converter: "toMermaid",
    expectedTransitions: [
      "stopped --> running",
      "running --> healthy",
      "running --> failed",
      "healthy --> failed",
      "failed --> stopped",
    ],
  },
  // Flat machine with toMermaidNested - THIS IS THE BUG WE FIXED
  {
    name: "Flat machine + toMermaidNested",
    machine: flatMachine,
    converter: "toMermaidNested",
    expectedTransitions: [
      "stopped --> running",
      "running --> healthy",
      "running --> failed",
      "healthy --> failed",
      "failed --> stopped",
    ],
  },
  // Nested machine with toMermaid - flattens structure
  {
    name: "Nested machine + toMermaid",
    machine: nestedMachine,
    converter: "toMermaid",
    expectedTransitions: [
      "mounting --> starting",  // Internal nested transition
      "running --> off",
      "running --> booting",
      "off --> booting",
    ],
  },
  // Nested machine with toMermaidNested - preserves structure
  {
    name: "Nested machine + toMermaidNested",
    machine: nestedMachine,
    converter: "toMermaidNested",
    expectedTransitions: [
      "mounting --> starting",  // Should be inside booting { }
      "running --> off",
      "running --> booting",
      "off --> booting",
    ],
  },
];

let allPassed = true;

for (const testCase of testCases) {
  console.log(`\n--- ${testCase.name} ---\n`);

  const output =
    testCase.converter === "toMermaid"
      ? toMermaid(testCase.machine)
      : toMermaidNested(testCase.machine);

  console.log("Generated Mermaid:\n");
  console.log(output);
  console.log("\nTransition checks:");

  let casePassed = true;
  for (const transition of testCase.expectedTransitions) {
    const found = output.includes(transition);
    const status = found ? "✅" : "❌";
    console.log(`  ${status} ${transition}`);
    if (!found) {
      casePassed = false;
      allPassed = false;
    }
  }

  if (!casePassed) {
    console.log(`\n❌ FAILED: Missing transitions in ${testCase.name}`);
  }
}

// ============================================================================
// STRUCTURAL CHECKS FOR toMermaidNested
// ============================================================================
console.log("\n\n--- Structural checks for toMermaidNested ---\n");

const nestedOutput = toMermaidNested(nestedMachine);

const structuralChecks = [
  {
    name: "Contains 'state booting {' compound block",
    pattern: /state booting \{/,
  },
  {
    name: "Contains nested initial '[*] --> mounting'",
    pattern: /\[\*\] --> mounting/,
  },
  {
    name: "Closing brace for compound state",
    pattern: /\}/,
  },
];

for (const check of structuralChecks) {
  const found = check.pattern.test(nestedOutput);
  const status = found ? "✅" : "❌";
  console.log(`${status} ${check.name}`);
  if (!found) {
    allPassed = false;
  }
}

// ============================================================================
// SUMMARY
// ============================================================================
console.log("\n\n=== SUMMARY ===\n");

if (allPassed) {
  console.log("✅ ALL TESTS PASSED");
  console.log("   - toMermaid works on flat and nested machines");
  console.log("   - toMermaidNested works on flat and nested machines");
  console.log("   - All transitions are rendered correctly");
  process.exit(0);
} else {
  console.log("❌ TESTS FAILED");
  console.log("   Some transitions or structural elements are missing.");
  process.exit(1);
}
