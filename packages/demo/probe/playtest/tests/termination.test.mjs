import { describe, expect, it } from "vitest";
import {
  LIMITS, createPolicy, decide, markJump, noteObservation, pickupReachable, shouldJump, stopReasonOf,
} from "../policy.mjs";

// 03 Q4–Q7 的确定性验证：无进展 / 重复重置 / 等待上限 / 跳跃验证 / pickupAbove 可达性。
// ⚠️ 这些测试只喂观测状态，不启动浏览器；真实取证（06）另有证据链。

const FLOOR = 240, PW = 24, PH = 32, MOVE = { speed: 90, jumpVelocity: 330, gravity: 900 };

const patroller = (over = {}) => {
  const x = over.x ?? 340, w = over.width ?? 24, hgt = over.height ?? 32;
  return {
    x, y: FLOOR, axis: "x", distance: 100, periodMs: 3000, t0: 0,
    left: x - w / 2, right: x + w / 2, top: FLOOR - hgt, bottom: FLOOR, width: w, height: hgt,
    ...over,
  };
};

const state = (over = {}) => ({
  x: 40, y: 240, bottom: FLOOR, top: FLOOR - PH, left: 28, right: 52, width: PW, height: PH,
  vx: 0, vy: 0, onFloor: true, blockedRight: false, touchingRight: false,
  collected: 0, won: false, pickups: [], hazards: [], chests: [], dangers: [],
  gate: { x: 1380, y: 208 }, solids: [{ x: 0, y: 240, w: 1440, h: 30 }], scrollX: 0,
  ...over,
});

const ctx = (st = state()) => createPolicy({ floorY: FLOOR, spawn: { x: st.x, y: st.y }, move: MOVE });

describe("无进展有限终止（03 Q4）", () => {
  it("连续 300 个观测步无进展 ⇒ no-progress；atStep 指向触发步", () => {
    const st = state();
    const c = ctx(st);
    for (let step = 1; step <= LIMITS.NO_PROGRESS_STEPS - 1; step++) {
      noteObservation(st, c, step);
      expect(stopReasonOf(st, c), `step=${step}`).toBeNull();
    }
    noteObservation(st, c, LIMITS.NO_PROGRESS_STEPS);
    expect(stopReasonOf(st, c)).toEqual({ reason: "no-progress", atStep: LIMITS.NO_PROGRESS_STEPS });
    expect(c.notes.at(-1)).toMatchObject({ step: LIMITS.NO_PROGRESS_STEPS, kind: "stop" });
  });

  it("任一进展事件（x / collected / chests / won / gate）清零计数", () => {
    const c = ctx(state());
    for (let step = 1; step <= 200; step++) noteObservation(state(), c, step);
    expect(c.noProgressSteps).toBe(200);
    noteObservation(state({ collected: 1 }), c, 201);
    expect(c.noProgressSteps).toBe(0);

    for (let step = 202; step <= 300; step++) noteObservation(state({ collected: 1 }), c, step);
    expect(c.noProgressSteps).toBe(99);
    noteObservation(state({ collected: 1, x: 60, left: 48, right: 72 }), c, 301);
    expect(c.noProgressSteps).toBe(0);

    noteObservation(state({ collected: 1, x: 60, left: 48, right: 72, won: true }), c, 302);
    expect(c.noProgressSteps).toBe(0);
  });

  it("停止一旦锁定就返回同一结果（原因不漂移）", () => {
    const st = state();
    const c = ctx(st);
    for (let step = 1; step <= LIMITS.NO_PROGRESS_STEPS; step++) noteObservation(st, c, step);
    const first = stopReasonOf(st, c);
    noteObservation(state({ collected: 1 }), c, 1000);
    expect(stopReasonOf(state({ collected: 1 }), c)).toEqual(first);
  });
});

describe("重复重置有限终止（03 Q4）", () => {
  it("累计 5 次 x 回弹 ⇒ reset-exhaustion（判据与 observe.mjs 一致）", () => {
    const c = ctx(state());
    let step = 0;
    for (let n = 1; n <= LIMITS.RESET_BUDGET - 1; n++) {
      noteObservation(state({ x: 400, left: 388, right: 412 }), c, ++step);
      noteObservation(state(), c, ++step);
      expect(c.resets, `reset #${n}`).toBe(n);
      expect(stopReasonOf(state(), c)).toBeNull();
    }
    noteObservation(state({ x: 400, left: 388, right: 412 }), c, ++step);
    noteObservation(state(), c, ++step);
    expect(c.resets).toBe(LIMITS.RESET_BUDGET);
    expect(stopReasonOf(state(), c)).toEqual({ reason: "reset-exhaustion", atStep: step });
  });

  it("没有回弹（只是走动）不计数；重置计数不因进展清零", () => {
    const c = ctx(state());
    noteObservation(state({ x: 400, left: 388, right: 412 }), c, 1);
    noteObservation(state({ x: 500, left: 488, right: 512 }), c, 2);
    expect(c.resets).toBe(0);
    noteObservation(state({ x: 400, left: 388, right: 412 }), c, 3);
    noteObservation(state(), c, 4);
    expect(c.resets).toBe(1);
    noteObservation(state({ collected: 1 }), c, 5);
    expect(c.resets).toBe(1);
  });
});

describe("等待上限（03 Q5）", () => {
  const waitingState = () => {
    // t0=750 ⇒ 危险物向右远离；玩家已到等待点 ⇒ advance:false（见 policy.test）。
    const h = patroller({ x: 390, t0: 750 });
    return state({ x: 315.5, left: 303.5, right: 327.5, hazards: [h] });
  };

  it("连续 120 步 advance:false ⇒ wait-limit", () => {
    const st = waitingState();
    const c = ctx(st);
    let step = 0;
    for (let i = 1; i < LIMITS.WAIT_STEPS; i++) {
      noteObservation(st, c, ++step);
      expect(decide(st, c).advance, `step=${step}`).toBe(false);
      expect(stopReasonOf(st, c)).toBeNull();
    }
    noteObservation(st, c, ++step);
    expect(decide(st, c).advance).toBe(false);
    expect(stopReasonOf(st, c)).toEqual({ reason: "wait-limit", atStep: step });
  });

  it("新进展或恢复推进清零等待计数", () => {
    const st = waitingState();
    const c = ctx(st);
    for (let i = 0; i < 60; i++) { noteObservation(st, c, i + 1); decide(st, c); }
    expect(c.waits).toBe(60);
    noteObservation(state({ collected: 1 }), c, 61);
    expect(c.waits).toBe(0);

    for (let i = 0; i < 10; i++) { noteObservation(st, c, 62 + i); decide(st, c); }
    expect(c.waits).toBe(10);
    // 危险物走进窗口后…这里用“前进”状态直接验证恢复推进清零。
    const open = state({ x: 40 });
    noteObservation(open, c, 100);
    expect(decide(open, c).advance).toBe(true);
    expect(c.waits).toBe(0);
  });
});

describe("跳跃动作验证（03 Q6）", () => {
  it("发键后 3 步内未离地 ⇒ 单次失败；连续 3 次 ⇒ 降级为不跳", () => {
    const st = state();
    const c = ctx(st);
    let step = 0;
    for (let attempt = 1; attempt <= LIMITS.JUMP_UNVERIFIED_BUDGET; attempt++) {
      noteObservation(st, c, ++step);
      markJump(c, st);
      noteObservation(st, c, ++step);
      noteObservation(st, c, ++step);
      expect(c.jump.failures, `attempt ${attempt} 未到窗口`).toBe(attempt - 1);
      noteObservation(st, c, ++step); // 第 3 步，窗口关闭
      expect(c.jump.failures).toBe(attempt);
      expect(c.jump.unverified).toBe(attempt);
    }
    expect(c.jump.degraded).toBe(true);
    expect(c.notes.filter((n) => n.kind === "jump-unverified")).toHaveLength(LIMITS.JUMP_UNVERIFIED_BUDGET);
  });

  it("观察到离地（onFloor / vy / bottom 下降）⇒ 验证成功并清零失败计数", () => {
    const c = ctx(state());
    noteObservation(state(), c, 1);
    markJump(c, state());
    expect(c.jump.pending).not.toBeNull();
    noteObservation(state({ onFloor: false, vy: -300, bottom: 210 }), c, 2);
    expect(c.jump.pending).toBeNull();
    expect(c.jump.failures).toBe(0);
    expect(c.jump.degraded).toBe(false);
    expect(c.notes.at(-1)).toMatchObject({ kind: "jump-verified" });
  });

  it("降级后放弃可选跳跃（拾取物），但被挡住的必需跳跃仍会重试", () => {
    const c = ctx(state());
    c.jump.degraded = true;
    const withPickup = state({
      x: 100, left: 88, right: 112,
      pickups: [{ x: 160, y: 200, active: true }],
    });
    expect(shouldJump(withPickup, c)).toBe(false);
    const blocked = state({ x: 100, left: 88, right: 112, blockedRight: true });
    expect(shouldJump(blocked, c)).toBe(true);
  });

  it("跳跃是唯一推进手段且累计 5 次失败 ⇒ jump-exhaustion", () => {
    const blocked = state({ x: 100, left: 88, right: 112, blockedRight: true, touchingRight: true });
    const c = ctx(blocked);
    let step = 0;
    for (let i = 0; i < 200 && c.stop === null; i++) {
      noteObservation(blocked, c, ++step);
      const d = decide(blocked, c);
      if (d.jump) markJump(c, blocked);
      stopReasonOf(blocked, c);
    }
    expect(c.stop).toMatchObject({ reason: "jump-exhaustion" });
    expect(c.stop.atStep).toBeGreaterThan(0);
    expect(c.jump.failures).toBeGreaterThanOrEqual(LIMITS.JUMP_FAILURE_BUDGET);
    expect(c.jump.degraded).toBe(true);
  });

  it("有替代推进手段时，5 次失败也不主动停止（交给 no-progress）", () => {
    const st = state({ x: 100, left: 88, right: 112 }); // 未被挡：可继续走
    const c = ctx(st);
    c.jump.failures = LIMITS.JUMP_FAILURE_BUDGET;
    c.jump.degraded = true;
    expect(stopReasonOf(st, c)).toBeNull();
  });
});

describe("pickupAbove 可达性（03 Q7）", () => {
  it("单跳高度内 ⇒ 追", () => {
    const st = state({ x: 100, left: 88, right: 112, pickups: [{ x: 170, y: 200, active: true }] });
    const c = ctx(st);
    expect(pickupReachable(st, c, st.pickups[0]).reachable).toBe(true);
    expect(shouldJump(st, c)).toBe(true);
  });

  it("平台覆盖拾取物、且二次起跳够得到 ⇒ 追", () => {
    const st = state({
      x: 140, left: 128, right: 152,
      solids: [{ x: 0, y: 240, w: 1440, h: 30 }, { x: 230, y: 190, w: 80, h: 10 }],
      pickups: [{ x: 250, y: 140, active: true }],
    });
    const c = ctx(st);
    const r = pickupReachable(st, c, st.pickups[0]);
    expect(r).toMatchObject({ reachable: true, via: "platform" });
    expect(shouldJump(st, c)).toBe(true);
  });

  it("没有平台 ⇒ 不跳，且记录 pickup-unreachable（不静默、不刷屏）", () => {
    const st = state({ x: 100, left: 88, right: 112, pickups: [{ x: 180, y: 100, active: true }] });
    const c = ctx(st);
    expect(pickupReachable(st, c, st.pickups[0]).reachable).toBe(false);
    expect(shouldJump(st, c)).toBe(false);
    const notes = c.notes.filter((n) => n.kind === "pickup-unreachable");
    expect(notes).toHaveLength(1);
    expect(notes[0].detail).toMatchObject({
      index: 0, maxJumpHeight: expect.any(Number), missing: expect.any(String),
    });
    shouldJump(st, c);
    expect(c.notes.filter((n) => n.kind === "pickup-unreachable")).toHaveLength(1);
  });

  it("拾取物起跳同样先做 jumpPredictionSafe（非危险分支）", () => {
    const h = patroller({ x: 350, t0: 2250 }); // 锚点 350、向左；盒 338..362
    const st = state({
      x: 310, left: 298, right: 322, hazards: [h],
      pickups: [{ x: 390, y: 200, active: true }],
    });
    expect(shouldJump(st, ctx(st))).toBe(true);           // 拾取物本身够得到
    expect(decide(st, ctx(st)).jump).toBe(false);         // 但起跳会落进危险物 → 推演否决
  });
});
