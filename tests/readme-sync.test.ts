#!/usr/bin/env npx tsx
/**
 * README SYNC TEST
 *
 * Verifies that the Mermaid code block in README.md matches
 * the actual output from toMermaid(orderMachine).
 *
 * This prevents documentation drift - if the library output changes,
 * this test will fail until README.md is updated.
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { setup } from "xstate";
import { toMermaid } from "../index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Same machine definition as examples/order-machine.ts (source of truth)
const orderMachine = setup({
  types: {
    events: {} as
      | { type: "SUBMIT" }
      | { type: "CANCEL" }
      | { type: "PAYMENT_SUCCESS" }
      | { type: "PAYMENT_FAILED" }
      | { type: "RETRY" },
    tags: {} as
      | "loading"
      | "error"
      | "success"
      | "🔒 stock_reserved"
      | "🔒 payment_not_charged"
      | "🔒 payment_charged"
      | "🔒 stock_shipped"
      | "🔒 stock_released",
  },
  guards: {
    hasValidPayment: () => true,
    stockAvailable: () => true,
  },
  actions: {
    notifyUser: () => {},
    reserveStock: () => {},
    chargeCard: () => {},
    releaseStock: () => {},
    logCancellation: () => {},
    cleanupResources: () => {},
  },
  actors: {
    // XState actors require proper implementations (Promise/Callback/Observable creators).
    // For examples demonstrating machine structure, we use `as any` stubs.
    // This is the recommended pattern from Stately.ai for documentation examples.
    // See: https://stately.ai/docs/actors#actor-logic-creators
    paymentProcessor: {} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  },
}).createMachine({
  id: "order",
  initial: "idle",
  states: {
    idle: {
      description: "Waiting for order submission",
      on: {
        SUBMIT: {
          target: "validating",
          guard: { type: "stockAvailable" },
          actions: [{ type: "reserveStock" }],
        },
      },
    },
    validating: {
      tags: ["loading", "🔒 stock_reserved", "🔒 payment_not_charged"],
      entry: [{ type: "notifyUser" }],
      on: {
        CANCEL: { target: "cancelled", actions: [{ type: "releaseStock" }] },
      },
      after: {
        5000: { target: "processing" },
      },
    },
    processing: {
      tags: ["loading", "🔒 stock_reserved"],
      description: "Processing payment",
      invoke: [{ src: "paymentProcessor", id: "payment" }],
      on: {
        PAYMENT_SUCCESS: { target: "completed" },
        PAYMENT_FAILED: { target: "failed" },
      },
    },
    completed: {
      tags: ["success", "🔒 payment_charged", "🔒 stock_shipped"],
      description: "Order fulfilled",
      entry: [{ type: "chargeCard" }],
    },
    failed: {
      tags: ["error", "🔒 stock_released"],
      description: "Payment failed. Manual retry available.",
      entry: [{ type: "releaseStock" }],
      on: {
        RETRY: {
          target: "processing",
          guard: { type: "hasValidPayment" },
        },
      },
    },
    cancelled: {
      description: "Order cancelled by user",
      entry: [{ type: "logCancellation" }],
      exit: [{ type: "cleanupResources" }],
    },
  },
});

// Generate actual output (no title - README shows raw output)
const actualOutput = toMermaid(orderMachine);

// Read README and extract mermaid code block
const readmePath = join(__dirname, "..", "README.md");
const readme = readFileSync(readmePath, "utf-8");

// Find the "Generated Output" mermaid block (second mermaid block in README)
const mermaidBlocks = readme.match(/```mermaid\n([\s\S]*?)```/g);

if (!mermaidBlocks || mermaidBlocks.length < 1) {
  console.error("❌ FAIL: No mermaid code blocks found in README.md");
  process.exit(1);
}

// The generated output is the first (and only) mermaid block after "Generated Output"
const generatedOutputSection = readme.indexOf("### Generated Output");
if (generatedOutputSection === -1) {
  console.error("❌ FAIL: Could not find '### Generated Output' section in README.md");
  process.exit(1);
}

const readmeAfterSection = readme.slice(generatedOutputSection);
const mermaidMatch = readmeAfterSection.match(/```mermaid\n([\s\S]*?)```/);

if (!mermaidMatch) {
  console.error("❌ FAIL: No mermaid block found after 'Generated Output' section");
  process.exit(1);
}

const expectedOutput = mermaidMatch[1].trim();
const actualTrimmed = actualOutput.trim();

console.log("=== README SYNC TEST ===\n");

if (expectedOutput === actualTrimmed) {
  console.log("✅ PASS: README mermaid output matches actual toMermaid() output");
  console.log("\n--- Verified Output ---\n");
  console.log(actualTrimmed);
  process.exit(0);
} else {
  console.log("❌ FAIL: README mermaid output does NOT match actual toMermaid() output\n");
  console.log("--- Expected (from README) ---\n");
  console.log(expectedOutput);
  console.log("\n--- Actual (from toMermaid) ---\n");
  console.log(actualTrimmed);
  console.log("\n--- Diff hints ---");

  // Simple line-by-line diff hint
  const expectedLines = expectedOutput.split("\n");
  const actualLines = actualTrimmed.split("\n");
  const maxLines = Math.max(expectedLines.length, actualLines.length);

  for (let i = 0; i < maxLines; i++) {
    if (expectedLines[i] !== actualLines[i]) {
      console.log(`Line ${i + 1} differs:`);
      console.log(`  Expected: ${expectedLines[i] ?? "(missing)"}`);
      console.log(`  Actual:   ${actualLines[i] ?? "(missing)"}`);
    }
  }

  process.exit(1);
}
