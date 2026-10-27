import { describe, expect, it } from "vitest";
import { createObserver } from "../observe.mjs";
import { createPolicy, noteObservation, shouldJump } from "../policy.mjs";

const state = (over = {}) => ({
  x: 40, y: 240, bottom: 240, left: 28, right: 52, vx: 0, vy: 0,
  onFloor: true, blockedRight: false, touchingRight: false,
  collected: 0, won: false,
  pickups: [{ x: 220, y: 232, active: true }],
  hazards: [], chests: [], dangers: [], gate: { x: 1380, y: 208 }, solids: [], scrollX: 0,
  ...over,
});

const scenario = (assertions) => ({
  id: "success-basic", version: 1, required: true, expectedOutcome: "SUCCESS", baselineEligible: true,
  target: { siteVersion: 1 }, harnessCondition: "none", setup: { kind: "none" },
  actions: [{ kind: "move_to", target: { kind: "gate" } }],
  assertions,
  termination: { kind: "won" }, timeoutMs: 1000, pollIntervalMs: 50, stepDelayMs: 35,
  comparableEvents: ["pickup", "win"],
});

describe("事件推导（票 03 闭集）", () => {
  it("scene-ready / spawn / pickup / chest-open / win / land / jump / reset / runtime-error", () => {
    const obs = createObserver({ scenario: scenario([]), spawn: { x: 40, y: 240 } });
    obs.record(state({ chests: [{ x: 300, y: 240, opened: false }] }), 0, { console: [], exceptions: [] });
    expect(obs.events.map((e) => e.type)).toEqual(["scene-ready", "spawn"]);

    obs.record(state({ collected: 1, pickups: [{ x: 220, y: 232, active: false }], chests: [{ x: 300, y: 240, opened: false }] }), 50);
    expect(obs.events.find((e) => e.type === "pickup")?.params.count).toBe(1);
    expect(obs.events.find((e) => e.type === "pickup")?.source).toBe("poll");

    obs.record(state({ collected: 2, won: true, chests: [{ x: 300, y: 240, opened: true }] }), 100);
    expect(obs.events.some((e) => e.type === "chest-open")).toBe(true);
    expect(obs.events.some((e) => e.type === "win")).toBe(true);

    obs.record(state({ x: 40, y: 240, onFloor: false, collected: 2, won: true }), 150);
    expect(obs.events.some((e) => e.type === "jump")).toBe(true);
    obs.record(state({ x: 40, y: 240, onFloor: true, collected: 2, won: true }), 200);
    expect(obs.events.some((e) => e.type === "land")).toBe(true);

    obs.record(state({ x: 400, onFloor: true, collected: 2, won: true }), 250);
    obs.record(state({ x: 40, onFloor: true, collected: 2, won: true }), 300);
    expect(obs.events.some((e) => e.type === "reset")).toBe(true);

    const err = { console: [{ type: "error", text: "boom" }], exceptions: [] };
    obs.record(state({ x: 40, onFloor: true, collected: 2, won: true }), 350, err);
    const runtime = obs.events.find((e) => e.type === "runtime-error");
    expect(runtime?.source).toBe("cdp");
    expect(runtime?.params.text).toBe("boom");
  });

  it("同一窗口多次拾取：计数保留、标记 ambiguous", () => {
    const obs = createObserver({ scenario: scenario([]), spawn: { x: 40, y: 240 } });
    obs.record(state({ pickups: [{ x: 1, y: 1, active: true }, { x: 2, y: 2, active: true }] }), 0);
    obs.record(state({ collected: 2, pickups: [{ x: 1, y: 1, active: false }, { x: 2, y: 2, active: false }] }), 50);
    const p = obs.events.find((e) => e.type === "pickup");
    expect(p.params.count).toBe(2);
    expect(p.params.ambiguous).toBe(true);
  });
});

describe("断言三值（证据门控 + 否定可判）", () => {
  const wonAssertion = {
    id: "won", kind: "state", requires: ["won"],
    expect: { kind: "state", path: "won", op: "eq", value: true }, withinMs: 1000, onInsufficient: "unknown",
  };

  it("观察到了 ⇒ pass", () => {
    const obs = createObserver({ scenario: scenario([wonAssertion]), spawn: { x: 40, y: 240 } });
    obs.record(state({ won: true, gate: { x: 1380, y: 208 }, x: 1380 }), 0);
    expect(obs.assertionResults()[0].result).toBe("pass");
  });

  it("没到 gate 的 won=false ⇒ unknown，不是 fail", () => {
    const obs = createObserver({ scenario: scenario([wonAssertion]), spawn: { x: 40, y: 240 } });
    obs.record(state({ x: 79 }), 0);
    const r = obs.assertionResults()[0];
    expect(r.result).toBe("unknown");
    expect(r.insufficientEvidence.ruleId).toBe("negative-not-judgeable");
  });

  it("到了 gate 仍 won=false ⇒ fail（否定条件可判）", () => {
    const obs = createObserver({ scenario: scenario([wonAssertion]), spawn: { x: 40, y: 240 } });
    obs.record(state({ x: 1380 }), 0);
    obs.record(state({ x: 1380 }), 50);
    expect(obs.assertionResults()[0].result).toBe("fail");
  });

  it("轮询有洞 ⇒ unknown（不能把没看到当失败/通过）", () => {
    const obs = createObserver({ scenario: scenario([wonAssertion]), spawn: { x: 40, y: 240 } });
    obs.record(state({ x: 1380 }), 0);
    obs.markGap(50, "state-unreadable");
    const r = obs.assertionResults()[0];
    expect(r.result).toBe("unknown");
    expect(r.insufficientEvidence.ruleId).toBe("poll-gap");
  });

  it("初始态 pickup 缺失可判：initialActivePickups 断言", () => {
    const a = {
      id: "missing", kind: "state", requires: ["initialActivePickups"],
      expect: { kind: "state", path: "initialActivePickups", op: "eq", value: 0 }, withinMs: 1000, onInsufficient: "unknown",
    };
    const obs = createObserver({ scenario: scenario([a]), spawn: { x: 40, y: 240 } });
    obs.record(state({ pickups: [] }), 0);
    expect(obs.assertionResults()[0].result).toBe("pass");
  });
});

describe("策略按观测步决策（不依赖墙钟）", () => {
  it("同一起跳冷却步数，不同真实时间给出同样的决定", () => {
    const a = createPolicy({ floorY: 240, spawn: { x: 40, y: 240 } });
    const b = createPolicy({ floorY: 240, spawn: { x: 40, y: 240 } });
    const st = state({ x: 300, onFloor: true, blockedRight: true, touchingRight: true });
    for (let i = 0; i < 8; i++) { noteObservation(st, a); noteObservation(st, b); }
    expect(shouldJump(st, a)).toBe(shouldJump(st, b));
  });
});
