#!/usr/bin/env npx tsx
/**
 * README SYNC TEST
 *
 * Verifies that the Mermaid code block in README.md matches
 * the actual output from toMermaid(orderMachine).
 *
 * This prevents documentation drift - if the library output changes,
 * this test will fail until README.md is updated.
 *
 * DRY: Imports orderMachine from examples/order-machine.ts (single source of truth)
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { toMermaid } from "../index.js";
import { orderMachine } from "../examples/order-machine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Generate actual output (no title option - README shows raw output)
const actualOutput = toMermaid(orderMachine);

// Read README and extract mermaid code block
const readmePath = join(__dirname, "..", "README.md");
const readme = readFileSync(readmePath, "utf-8");

// Find the "Generated Output" mermaid block
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
