# xstate-ts-to-mermaid

Convert XState v5 TypeScript state machines to Mermaid stateDiagram-v2 format with Stately.ai visual parity.

## Why?

XState v5 has no built-in Mermaid export. The official recommendation from David Piano is to use `@xstate/graph`'s `toDirectedGraph()` and write your own converter. This is an example converter that aims for visual parity with Stately.ai's editor, unlike the simplified Mermaid export Stately.ai currently provides.

## Installation

```bash
npm install xstate-ts-to-mermaid
```

## Usage

```typescript
import { setup } from "xstate";
import { toMermaid } from "xstate-ts-to-mermaid";

// Example showcasing ALL supported XState v5 fields:
// description, tags, entry, exit, invoke, on, after
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

console.log(toMermaid(orderMachine, { title: "Order Processing" }));
```

Output (actual generated output, not manually written):

```mermaid
stateDiagram-v2
    [*] --> idle
    idle: <b>idle</b><br/>Waiting for order submission
    idle --> validating: SUBMIT IF stockAvailable<br/>⚡ reserveStock
    validating: <b>validating</b><br/>[loading] [🔒 stock_reserved] [🔒 payment_not_charged]<br/>───────────<br/><b><i>Entry actions</i></b><br/>⚡ notifyUser
    validating --> cancelled: CANCEL<br/>⚡ releaseStock
    validating --> processing: after 5000ms
    processing: <b>processing</b><br/>Processing payment<br/>[loading] [🔒 stock_reserved]<br/>───────────<br/><b><i>Invoke</i></b><br/>◉ paymentProcessor<br/>Actor ID - payment
    processing --> completed: PAYMENT_SUCCESS
    processing --> failed: PAYMENT_FAILED
    completed: <b>completed</b><br/>Order fulfilled<br/>[success] [🔒 payment_charged] [🔒 stock_shipped]<br/>───────────<br/><b><i>Entry actions</i></b><br/>⚡ chargeCard
    failed: <b>failed</b><br/>Payment failed. Manual retry available.<br/>[error] [🔒 stock_released]<br/>───────────<br/><b><i>Entry actions</i></b><br/>⚡ releaseStock
    failed --> processing: RETRY IF hasValidPayment
    cancelled: <b>cancelled</b><br/>Order cancelled by user<br/>───────────<br/><b><i>Entry actions</i></b><br/>⚡ logCancellation<br/>───────────<br/><b><i>Exit actions</i></b><br/>⚡ cleanupResources
```

**Legend for this example:**
| Symbol | Meaning |
|--------|---------|
| `[tag]` | Tags in brackets (pill-like styling) |
| 🔒 | [State invariant](https://en.wikipedia.org/wiki/Invariant_(mathematics)#Invariants_in_computer_science) (convention used in this example's tag names) |
| ⚡ | Action |
| ◉ | Invoked actor |

## Stately.ai Visual Parity

<table>
<tr>
<th>Stately.ai Editor (Reference)</th>
<th>This Library (Mermaid Output)</th>
</tr>
<tr>
<td><img src="docs/stately-ai-reference.png" alt="Stately.ai editor" width="400"/></td>
<td><img src="docs/library-output.png" alt="Library mermaid output" width="400"/></td>
</tr>
</table>

**Key visual elements preserved:**
- Each tag as a separate item (like Stately's pill/chip styling)
- Bold state names
- Separated action sections
- Guard conditions on transitions
- Entry/exit actions with icons

This library renders all official XState v5 state node fields:

- **`description`** - State description text
- **`tags`** - Array of tags in brackets (tags can contain any string including emojis)
- **`meta`** - Generic key-value metadata (rendered with *italicized* keys)
- **`entry`** - Entry actions with ⚡ prefix
- **`exit`** - Exit actions with ⚡ prefix
- **`invoke`** - Invoked actors with ◉ prefix
- **`on`** / **`after`** - Transitions with guards (IF format) and actions

Visual formatting:
- **`<b>` Bold state headers**: State name rendered prominently
- **`<br/>` Line breaks**: Proper separation between elements
- **`───────────` Horizontal separators**: Visual distinction between content and action sections
- **`<b><i>` Bold+italic section headers**: "Entry actions", "Exit actions", "Invoke" labels

## Important: `meta` vs `tags`

**Warning:** The `meta` field is valid XState v5, but **Stately.ai's visual editor has no UI for it**. When you import a machine with `meta` into Stately.ai and export it, the `meta` field gets cleansed/dropped.

**Recommendation:** Use `tags` instead of `meta` - tags survive Stately.ai round-trips.

```typescript
// RECOMMENDED - survives Stately.ai import/export
validating: {
  tags: ["loading", "stock_reserved"],
}

// WORKS but gets cleansed by Stately.ai visual editor
validating: {
  meta: { category: "processing" },
}
```

## Supported XState Fields

| Field | Description | Rendering |
|-------|-------------|-----------|
| `description` | State description | Plain text below state name |
| `tags` | Array of string tags | `[tag1] [tag2]` |
| `meta` | Generic metadata object | `*key* - value` (italicized keys) |
| `entry` | Entry actions array | Section with `⚡ actionName` |
| `exit` | Exit actions array | Section with `⚡ actionName` |
| `invoke` | Invoked actors | Section with `◉ actorSrc` and `Actor ID - id` |
| `on` | Event transitions | `EVENT IF guard` on edges |
| `after` | Delayed transitions | `after Xms` on edges |

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
  includeExitActions?: boolean; // Show exit actions on states (default: true)
  includeInvokes?: boolean; // Show invoke actors on states (default: true)
  includeTags?: boolean; // Show tags on states (default: true)
  includeMeta?: boolean; // Show meta on states (default: true)
}
```

### Exported Helpers

```typescript
import {
  getStateName,
  formatEventName,
  getDescription,
  getEntryActions,
  getExitActions,
  getInvokes,
  getTags,
  getMeta,
  formatTransitionLabel,
} from "xstate-ts-to-mermaid";

getStateName("machine.parent.child"); // "child"
formatEventName("xstate.after.60000.machine..."); // "after 60000ms"
```

## Testing

Run the field coverage test to verify all XState fields are captured:

```bash
npx tsx field-coverage.test.ts
```

This deterministically checks that every renderable XState v5 field is present in the output.

## Features

- XState v5 TypeScript compatible
- **Stately.ai visual parity** - renders all official XState state node fields
- `<b>` bold state name headers
- `<b><i>` bold+italic section headers (Entry actions, Exit actions, Invoke)
- `───────────` horizontal separators for visual distinction
- `<br/>` proper line breaks
- `[tag]` bracket notation for tags (pill-like styling, supports any string including emojis)
- `meta` rendered with italicized keys (warning: cleansed by Stately.ai)
- ⚡ entry, exit, and transition actions
- ◉ invoke actors with source and ID
- IF format for guards
- Handles nested/compound states
- Formats timeout events with raw milliseconds
- Zero information loss - all metadata from XState is preserved

## License

MIT
