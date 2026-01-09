# xstate-ts-to-mermaid

Convert XState v5 TypeScript state machines to Mermaid stateDiagram-v2 format.

## Why?

XState v5 has no built-in Mermaid export. The official recommendation from David Piano is to use `@xstate/graph`'s `toDirectedGraph()` and write your own converter. This is that converter.

## Installation

```bash
npm install xstate-ts-to-mermaid
```

## Usage

```typescript
import { setup } from "xstate";
import { toMermaid } from "xstate-ts-to-mermaid";

// Comprehensive example showing ALL supported XState fields
const orderMachine = setup({
  types: {
    events: {} as
      | { type: "SUBMIT" }
      | { type: "CANCEL" }
      | { type: "PAYMENT_SUCCESS" }
      | { type: "PAYMENT_FAILED" }
      | { type: "RETRY" },
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
  },
  actors: {
    paymentProcessor: {} as any,
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
      description: "INVARIANT: stock reserved, payment not charged",
      entry: [{ type: "notifyUser" }],
      on: {
        CANCEL: { target: "cancelled", actions: [{ type: "releaseStock" }] },
      },
      after: {
        5000: { target: "processing" },
      },
    },
    processing: {
      description: "Processing payment",
      invoke: [{ src: "paymentProcessor", id: "payment" }],
      on: {
        PAYMENT_SUCCESS: { target: "completed" },
        PAYMENT_FAILED: { target: "failed" },
      },
    },
    completed: {
      description: "Order fulfilled. INVARIANT: payment charged, stock shipped",
      entry: [{ type: "chargeCard" }],
    },
    failed: {
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
    },
  },
});

console.log(toMermaid(orderMachine, { title: "Order Processing" }));
```

Output (actual generated output, not manually written):

```mermaid
stateDiagram-v2
    %% Order Processing
    [*] --> idle
    idle: idle\nWaiting for order submission
    idle --> validating: SUBMIT [stockAvailable] / reserveStock
    validating: validating\nINVARIANT - stock reserved, payment not charged | entry - notifyUser
    validating --> cancelled: CANCEL / releaseStock
    validating --> processing: after 5000ms
    processing: processing\nProcessing payment | invoke - paymentProcessor(payment)
    processing --> completed: PAYMENT_SUCCESS
    processing --> failed: PAYMENT_FAILED
    completed: completed\nOrder fulfilled. INVARIANT - payment charged, stock shipped | entry - chargeCard
    failed: failed\nPayment failed. Manual retry available. | entry - releaseStock
    failed --> processing: RETRY [hasValidPayment]
    cancelled: cancelled\nOrder cancelled by user
```

Here is the stately.ai web render for the same Typescript Source of Truth:
<img width="623" height="810" alt="{46F63723-28FE-46BC-B64C-345A93559027}" src="https://github.com/user-attachments/assets/b2c9dd9c-7bb7-464f-aedd-1f8510a60c95" />

This example demonstrates ALL supported fields:
- **State name headers**: Every state shows its name as header (like Stately.ai)
- **State descriptions**: `idle: idle\nWaiting for order submission`
- **Transition guards**: `SUBMIT [stockAvailable]`
- **Transition actions**: `SUBMIT [stockAvailable] / reserveStock`
- **Entry actions**: `validating: validating\n... | entry - notifyUser`
- **Invoke actors**: `processing: processing\n... | invoke - paymentProcessor(payment)`
- **Timeout transitions**: `after 5000ms` (raw milliseconds, matching Stately.ai format)

## API

### `toMermaid(machine, options?)`

Flat diagram - all states at same level. Good for overview.

### `toMermaidNested(machine, options?)`

Preserves hierarchy using Mermaid's `state {}` syntax for compound states.

### Options

```typescript
interface MermaidOptions {
  title?: string;
  maxDescriptionLength?: number; // 0 = no limit (default)
  includeGuards?: boolean; // Show guards on transitions (default: true)
  includeActions?: boolean; // Show transition actions (default: true)
  includeEntryActions?: boolean; // Show entry actions on states (default: true)
  includeInvokes?: boolean; // Show invoke actors on states (default: true)
}
```

### Exported Helpers

```typescript
import {
  getStateName,
  formatEventName,
  getDescription,
  getEntryActions,
  getInvokes,
  formatTransitionLabel,
} from "xstate-ts-to-mermaid";

getStateName("machine.parent.child"); // "child"
formatEventName("xstate.after.60000.machine..."); // "after 60000ms"
```

## Features

- XState v5 TypeScript compatible
- **State name headers**: Every state shows its name as title (Stately.ai parity)
- Preserves state descriptions as labels below the header
- **Guards**: Shows guards on transitions as `event [guardName]`
- **Transition actions**: Shows actions as `event / action1, action2`
- **Entry actions**: Shows entry actions as `state\n... | entry - action1, action2`
- **Invoke actors**: Shows invoked actors as `state\n... | invoke - machine(id)`
- Handles nested/compound states
- Formats timeout events with raw milliseconds (`after 60000ms`)
- Extracts clean state names from dotted paths
- Zero information loss - all metadata from XState is preserved

## License

MIT
