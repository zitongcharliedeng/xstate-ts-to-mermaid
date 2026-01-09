#!/usr/bin/env npx tsx
/**
 * This file tests the README example and outputs the ACTUAL generated mermaid.
 * The output of this script should match what's in the README.
 *
 * Showcases ALL supported XState v5 fields:
 * - description, tags, meta, entry, exit, invoke, on, after
 */
import { setup } from "xstate";
import { toMermaid } from "../index.js";

export const orderMachine = setup({
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

console.log(toMermaid(orderMachine, { title: "Order Processing" }));
