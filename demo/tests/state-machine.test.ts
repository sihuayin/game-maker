import { describe, expect, it } from "vitest";
import { canTransition } from "../src/runtime/state-machine.js";

describe("creation state machine", () => {
  it("allows normal creation flow", () => {
    expect(canTransition("created","compiling")).toBe(true);
    expect(canTransition("compiling","compiled")).toBe(true);
    expect(canTransition("evaluating","repairing")).toBe(true);
    expect(canTransition("finalizing","passed")).toBe(true);
  });
  it("rejects illegal jumps", () => {
    expect(canTransition("created","passed")).toBe(false);
    expect(canTransition("passed","building")).toBe(false);
  });
});
