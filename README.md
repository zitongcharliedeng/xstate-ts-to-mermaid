# xstate-ts-to-mermaid

Convert XState v5 TypeScript state machines to Mermaid stateDiagram-v2 format with Stately.ai visual parity.

## Visual Parity with Stately.ai

| Stately.ai Editor (Reference) | This Library (Mermaid Output) |
|:-----------------------------:|:-----------------------------:|
| <img src=".github/assets/stately-ai-reference.png" alt="Stately.ai editor" width="400"/> | <img src=".github/assets/library-output.png" alt="Library mermaid output" width="400"/> |

**Legend:**

| Symbol | Meaning |
|:------:|---------|
| **bold** | State name (lowercase), Event names, Actions |
| `━━━━━━` | Header separator line |
| `<sup>(tag)</sup>` | Tags (superscript, styled as pills in Stately.ai) |
| `<sup><b>desc</b></sup>` | Description (superscript bold, raised closer to title) |
| `<sup><b>∟ ID∶ x</b></sup>` | Actor ID (superscript bold, hugs parent) |
| *italic* | Only *after* keyword in delayed transitions |
| `<b>[ϟ action]</b>` | Bold action with lightning inside brackets |
| `<b>[◉ actor]</b>` | Bold invoked actor in brackets |
| `Entry actions` | Section labels (normal text) |
| `∟` | Corner symbol for nested info |
| `IF` | Guard condition on transition |
| `────────` | Section separator |

## Why?

XState v5 has no built-in Mermaid export. The official recommendation from David Piano is to use `@xstate/graph`'s `toDirectedGraph()` and write your own converter. This library provides visual parity with Stately.ai's editor, unlike the simplified Mermaid export Stately.ai currently provides.

## Installation

```bash
npm install xstate-ts-to-mermaid
```

## Usage

### Machine Definition (Source of Truth)

See [`examples/order-machine.ts`](examples/order-machine.ts) for a complete example demonstrating ALL supported XState v5 fields. This file is the single source of truth - tests verify both the machine and documentation against it.

## Supported XState Fields

| Field | Description | Rendering |
|-------|-------------|-----------|
| `description` | State description | `<sup><b>desc</b></sup>` (superscript bold) |
| `tags` | Array of string tags | `<sup>(tag1) (tag2)</sup>` all on one line, `INV:` → `Invariant∶` |
| `meta` | Generic metadata object | `*key* - value` (italicized keys) |
| `entry` | Entry actions array | `Entry actions` + `<b>[ϟ actionName]</b>` |
| `exit` | Exit actions array | `Exit actions` + `<b>[ϟ actionName]</b>` |
| `invoke` | Invoked actors | `Invoke` + `<b>[◉ actorSrc]</b>` + `<sup><b>∟ ID∶ id</b></sup>` |
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
  includeGuards?: boolean;       // default: true
  includeActions?: boolean;      // default: true
  includeEntryActions?: boolean; // default: true
  includeExitActions?: boolean;  // default: true
  includeInvokes?: boolean;      // default: true
  includeTags?: boolean;         // default: true
  includeMeta?: boolean;         // default: true
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

## Important: `meta` vs `tags`

**Warning:** The `meta` field is valid XState v5, but **Stately.ai's visual editor has no UI for it**. When you import a machine with `meta` into Stately.ai and export it, the `meta` field gets cleansed/dropped.

**Recommendation:** Use `tags` instead of `meta` - tags survive Stately.ai round-trips.

## Development

```bash
npm test           # Run all tests
npm run build      # Build library
```

### Project Structure

```
├── index.ts                    # Library source
├── examples/
│   └── order-machine.ts        # Example machine (source of truth)
├── tests/
│   └── field-coverage.test.ts  # Verifies all XState fields render
└── .github/
    ├── assets/                 # Generated comparison images
    └── workflows/ci.yml        # CI pipeline
```

## License

MIT
