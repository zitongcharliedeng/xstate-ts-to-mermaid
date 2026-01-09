#!/bin/bash
# Test that README example output matches actual generated output
set -e

cd "$(dirname "$0")/.."

# Generate actual output
npx tsx test-example.ts > /tmp/actual-output.txt

# Extract expected output from README (between ```mermaid and ``` after "Output (actual")
sed -n '/Output (actual/,/^```$/p' README.md | sed -n '/```mermaid/,/```/p' | tail -n +2 | head -n -1 > /tmp/expected-output.txt

# Compare
if diff /tmp/expected-output.txt /tmp/actual-output.txt; then
    echo "✓ README example matches actual output"
else
    echo "✗ README example does NOT match actual output"
    echo "Expected:"
    cat /tmp/expected-output.txt
    echo ""
    echo "Actual:"
    cat /tmp/actual-output.txt
    exit 1
fi
