import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CommandError } from "@game-maker/contracts";
import { selectScenarios } from "../src/playtest.js";

const scenario = (over: Record<string, unknown> = {}) => ({
  formatVersion: "playtest-scenario/v1",
  id: "acceptance-win",
  version: 1,
  required: true,
  expectedOutcome: "SUCCESS",
  baselineEligible: false,
  target: { siteVersion: 1 },
  harnessCondition: "none",
  setup: { kind: "none" },
  actions: [{ kind: "move_to", target: { kind: "gate" } }],
  assertions: [{
    id: "won", kind: "state", requires: ["won"],
    expect: { kind: "state", path: "won", op: "eq", value: true },
    withinMs: 1000, onInsufficient: "unknown",
  }],
  termination: { kind: "won" },
  timeoutMs: 1000,
  pollIntervalMs: 50,
  stepDelayMs: 35,
  comparableEvents: ["pickup", "win"],
  ...over,
});

let dir: string;
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), "gm-scenario-dir-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

function writeScenario(name: string, over: Record<string, unknown> = {}): string {
  const file = path.join(dir, name);
  writeFileSync(file, JSON.stringify(scenario(over), null, 2));
  return file;
}

function expectInvalid(fn: () => unknown, re: RegExp): void {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(CommandError);
    expect((e as CommandError).kind).toBe("invalid");
    expect((e as Error).message).toMatch(re);
    return;
  }
  throw new Error("expected selectScenarios to throw");
}

describe("playtest --scenario-dir 场景选择（FA-01D）", () => {
  it("有效的 required 场景被选中", () => {
    writeScenario("acceptance.json");
    const selected = selectScenarios(dir, 1);
    expect(selected.map((s) => s.scenario.id)).toEqual(["acceptance-win"]);
  });

  it("required:true 与 required:false 混合时只选必需场景", () => {
    writeScenario("acceptance.json");
    writeScenario("diagnostic.json", { id: "diagnostic", required: false });
    const selected = selectScenarios(dir, 1);
    expect(selected.map((s) => s.scenario.id)).toEqual(["acceptance-win"]);
  });

  it("只有诊断场景 ⇒ invalid（不把诊断场景提升为交付必需项）", () => {
    writeScenario("diagnostic.json", { id: "diagnostic", required: false });
    expectInvalid(() => selectScenarios(dir, 1), /没有可执行的必需场景/);
  });

  it("空目录 ⇒ invalid", () => {
    expectInvalid(() => selectScenarios(dir, 1), /没有可执行的必需场景/);
  });

  it("schema 不过 ⇒ invalid，且错误带文件路径", () => {
    writeScenario("bad.json", { formatVersion: "playtest-scenario/v0" });
    expectInvalid(() => selectScenarios(dir, 1), /不过 schema/);
  });

  it("siteVersion 不匹配 ⇒ invalid", () => {
    writeScenario("v2.json", { target: { siteVersion: 2 } });
    expectInvalid(() => selectScenarios(dir, 1), /目标 site v2 与实际 v1 不匹配/);
  });

  it("目录不存在 ⇒ invalid", () => {
    expectInvalid(() => selectScenarios(path.join(dir, "nope"), 1), /场景目录不可用/);
  });

  it("路径不是目录 ⇒ invalid", () => {
    const file = path.join(dir, "not-a-dir");
    writeFileSync(file, "x");
    expectInvalid(() => selectScenarios(file, 1), /不是目录/);
  });

  it("默认五态目录仍只选出 success-basic（默认行为不变）", () => {
    const fiveState = path.resolve(process.cwd(), "packages/demo/probe/playtest/scenarios/five-state");
    expect(existsSync(fiveState)).toBe(true);
    const selected = selectScenarios(fiveState, 1);
    expect(selected.map((s) => s.scenario.id)).toEqual(["success-basic"]);
  });
});
