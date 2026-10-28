// 04 危险形态通用化：纵向巡逻 / 定时喷发的确定性 fixture。
//
// ⚠️ 这些用例证明的是「状态驱动」而不是「坐标脚本」：几何/速度/周期全部来自 fixture 状态，
//   策略用玩家自己的 `move` 与 READ_STATE 的盒足迹推演；没有本关坐标 / hazard id / 固定时间。
import { describe, expect, it } from "vitest";
import {
  createPolicy, decide, hazardModel, verticalSweepOverlap, verticalCrossingWindow,
  dangerModel, dangerPathSafe, stopReasonOf, LIMITS,
} from "../policy.mjs";
import { READ_STATE } from "../../probe-harness.mjs";

const FLOOR = 240, PW = 24, PH = 32, MOVE = { speed: 90, jumpVelocity: 330, gravity: 900 };

const state = (over = {}) => ({
  x: 300, y: 240, bottom: FLOOR, top: FLOOR - PH, left: 288, right: 312, width: PW, height: PH,
  vx: 0, vy: 0, onFloor: true, blockedRight: false, touchingRight: false,
  collected: 0, won: false, pickups: [], hazards: [], chests: [], dangers: [],
  gate: { x: 1380, y: 208 }, solids: [{ x: 0, y: 240, w: 1440, h: 30 }], scrollX: 0,
  ...over,
});

const ctx = (st = state(), move = MOVE) =>
  createPolicy({ floorY: FLOOR, spawn: { x: st.x, y: st.y }, move });

/**
 * 纵向巡逻 fixture：锚点 = 盒底（资源锚点 {0.5,1}）。
 * `bottom` 是**当前**观测位置，`start/distance/periodMs/t0` 供策略反推锚点与相位。
 */
const vertical = (over = {}) => {
  const width = over.width ?? 24;
  const height = over.height ?? 32;
  const start = over.start ?? 140;
  const distance = over.distance ?? 120;
  const periodMs = over.periodMs ?? 4000;
  const t0 = over.t0 ?? 0;
  const phase = (((t0 % periodMs) + periodMs) % periodMs) / periodMs;
  const k = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  const bottom = start + k * distance;
  const x = over.x ?? 400;
  const left = x - width / 2;
  return {
    x, y: bottom, axis: "y", distance, periodMs, t0,
    left, right: left + width, top: bottom - height, bottom, width, height,
    ...over,
  };
};

/** 定时喷发 fixture：盒足迹取 config 的打击盒（READ_STATE 暴露的 left/right/top/bottom）。 */
const danger = (over = {}) => {
  const width = over.width ?? 40;
  const height = over.height ?? 32;
  const left = over.left ?? 380;
  const top = over.top ?? (FLOOR - height);
  return {
    x: left + width / 2, y: top + height,
    left, right: left + width, top, bottom: top + height, width, height,
    state: "idle", hits: 0, periodMs: 1000, activeMs: 200, t: 0,
    ...over,
  };
};

/** 玩家停在等待点（右边界 = 危险物左边界 - 2px）。 */
const atWaitPoint = (hazards, dangers = []) => state({
  x: 374.5, left: 362.5, right: 386.5, hazards, dangers,
});

describe("04 纵向巡逻：模型 / 扫掠相关性", () => {
  it("hazardModel 接受 axis:\"y\"，由观测反推锚点与行程；缺字段仍为 null", () => {
    // t0=1000 / period 4000 ⇒ phase .25 ⇒ k=.5 ⇒ 当前盒底 = 140 + 60 = 200
    const m = hazardModel(vertical({ start: 140, distance: 120, periodMs: 4000, t0: 1000 }));
    expect(m.axis).toBe("y");
    expect(m.start).toBeCloseTo(140);
    expect(m.sweepTop).toBeCloseTo(108);      // 起点盒底 140 - 高 32
    expect(m.sweepBottom).toBeCloseTo(260);   // 终点盒底 140 + 行程 120
    expect(m.velY).toBeGreaterThan(0);        // 前半周期向下
    expect(m.velX).toBe(0);
    expect(hazardModel(vertical({ distance: 0 }))).toBeNull();
    expect(hazardModel(vertical({ periodMs: 0 }))).toBeNull();
    expect(hazardModel({ axis: "y", x: 400, periodMs: 1000, distance: 100 })).toBeNull(); // 缺几何
  });

  it("相关性按完整扫掠范围：当前在头顶之上、但会扫到玩家高度 ⇒ 相关", () => {
    // 当前盒底 120（玩家 top=208，当前帧不重叠）；扫掠到 260 ⇒ 会降到玩家高度。
    const h = vertical({ start: 120, distance: 140, periodMs: 2000, t0: 0 });
    const st = atWaitPoint([h]);
    expect(h.bottom).toBeLessThan(st.top);
    expect(verticalSweepOverlap(st, hazardModel(h))).toBe(true);
    // 窗口不够（621ms < 555ms + 150ms 余量）⇒ 等待；若只看当前帧就会误判为无关而前进。
    expect(decide(st, ctx(st))).toEqual({ advance: false, jump: false });
  });
});

describe("04 纵向巡逻：穿越窗口 / 等待 / 有限终止", () => {
  it("安全窗 ≥ 穿越时间 + 余量 ⇒ 前进；通过纵向危险不要求起跳", () => {
    // 起点 140、行程 120、周期 4000 ⇒ 安全窗 ≈ 1117ms ≥ 556ms + 150ms
    const h = vertical({ start: 140, distance: 120, periodMs: 4000, t0: 0 });
    const st = atWaitPoint([h]);
    const win = verticalCrossingWindow(st, ctx(st), h);
    expect(win.cross).toBe(true);
    expect(win.needMs).toBeGreaterThan(win.crossingMs);
    expect(decide(st, ctx(st))).toEqual({ advance: true, jump: false });
  });

  it("窗口随玩家速度变化，不是写死的像素/时间", () => {
    const h = vertical({ start: 120, distance: 140, periodMs: 2000, t0: 0 });
    const st = atWaitPoint([h]);
    expect(verticalCrossingWindow(st, ctx(st), h).cross).toBe(false);
    expect(verticalCrossingWindow(st, ctx(st, { ...MOVE, speed: 200 }), h).cross).toBe(true);
  });

  it("整周期没有安全窗（最高点也在头顶以下）⇒ 等待", () => {
    const h = vertical({ start: 230, distance: 40, periodMs: 4000, t0: 0 });
    const st = atWaitPoint([h]);
    const win = verticalCrossingWindow(st, ctx(st), h);
    expect(win.mode).toBe("no-window");
    expect(decide(st, ctx(st))).toEqual({ advance: false, jump: false });
  });

  it("连续等待 120 步 ⇒ wait-limit（主动停止，不是游戏失败）", () => {
    const h = vertical({ start: 230, distance: 40, periodMs: 4000, t0: 0 });
    const st = atWaitPoint([h]);
    const c = ctx(st);
    for (let i = 0; i < LIMITS.WAIT_STEPS; i++) decide(st, c);
    expect(stopReasonOf(st, c)).toEqual({ reason: "wait-limit", atStep: 0 });
  });

  it("缺运动字段 ⇒ 保守带外等待 + vertical-window-unknown（一次性，不刷屏）", () => {
    const h = vertical({ distance: 0 }); // hazardModel ⇒ null，但盒边界已知
    const st = atWaitPoint([h]);
    const c = ctx(st);
    expect(decide(st, c)).toEqual({ advance: false, jump: false });
    expect(decide(st, c)).toEqual({ advance: false, jump: false });
    const notes = c.notes.filter((n) => n.kind === "vertical-window-unknown");
    expect(notes).toHaveLength(1);
    expect(notes[0].detail.missing).toContain("distance");
  });
});

describe("04 定时喷发：安全窗口 / active 禁入 / 回落", () => {
  it("idle 剩余 ≥ 穿越时间 + 150ms ⇒ 前进", () => {
    const d = danger({ left: 380, t: 0, periodMs: 1000, activeMs: 200 });
    const st = atWaitPoint([], [d]);
    expect(dangerPathSafe(st, ctx(st), [d]).safe).toBe(true);
    expect(decide(st, ctx(st))).toEqual({ advance: true, jump: false });
  });

  it("安全余量不足（离推进发窗口太近）⇒ 等待", () => {
    const d = danger({ left: 380, t: 300, periodMs: 1000, activeMs: 200 });
    const st = atWaitPoint([], [d]);
    expect(decide(st, ctx(st))).toEqual({ advance: false, jump: false });
  });

  it("推演落入 active 窗口 ⇒ 绝不进入", () => {
    const d = danger({ left: 380, t: 1050, periodMs: 1000, activeMs: 200 });
    const st = atWaitPoint([], [d]);
    expect(decide(st, ctx(st))).toEqual({ advance: false, jump: false });
  });

  it("观测 state=active 优先于推演（即使相位看起来还在 idle）⇒ 等待", () => {
    const d = danger({ left: 380, t: 0, state: "active", periodMs: 1000, activeMs: 200 });
    const st = atWaitPoint([], [d]);
    const verdict = dangerPathSafe(st, ctx(st), [d]);
    expect(verdict.safe).toBe(false);
    expect(verdict.mode).toBe("observed-active");
    expect(decide(st, ctx(st))).toEqual({ advance: false, jump: false });
  });

  it("缺周期/相位 ⇒ state-only（idle 才进）+ danger-window-unknown", () => {
    const idle = danger({ left: 380, periodMs: 0, t: 0, state: "idle" });
    const stIdle = atWaitPoint([], [idle]);
    const cIdle = ctx(stIdle);
    expect(decide(stIdle, cIdle)).toEqual({ advance: true, jump: false });
    expect(cIdle.notes.map((n) => n.kind)).toContain("danger-window-unknown");

    const active = danger({ left: 380, periodMs: 0, t: 0, state: "active" });
    const stActive = atWaitPoint([], [active]);
    expect(decide(stActive, ctx(stActive))).toEqual({ advance: false, jump: false });
  });

  it("连 state 都没有 ⇒ 不穿越，注解记录缺失字段", () => {
    const d = danger({ left: 380, periodMs: 0, t: 0, state: undefined });
    const st = atWaitPoint([], [d]);
    const c = ctx(st);
    expect(decide(st, c)).toEqual({ advance: false, jump: false });
    const note = c.notes.find((n) => n.kind === "danger-window-unknown");
    expect(note.detail.missing).toContain("state");
  });

  it("多个 danger 逐一路径推演：任意一只到达时在喷发 ⇒ 等待", () => {
    const a = danger({ left: 380, t: 0, periodMs: 1000, activeMs: 200 });
    // 到第二只时 atMs ≈ 1611；周期 1200（idle 1000）⇒ 穿越区间必然撞上喷发。
    const b = danger({ left: 500, t: 0, periodMs: 1000, activeMs: 200 });
    const st = atWaitPoint([], [a, b]);
    expect(dangerPathSafe(st, ctx(st), [a, b]).safe).toBe(false);
    expect(decide(st, ctx(st))).toEqual({ advance: false, jump: false });
  });

  it("多个 danger 都能按时穿过 ⇒ 前进（不是一律见 danger 就停）", () => {
    const a = danger({ left: 380, t: 0, periodMs: 1000, activeMs: 200 });
    const b = danger({ left: 500, t: 1250, periodMs: 2000, activeMs: 200 });
    const st = atWaitPoint([], [a, b]);
    expect(dangerPathSafe(st, ctx(st), [a, b]).safe).toBe(true);
    expect(decide(st, ctx(st))).toEqual({ advance: true, jump: false });
  });

  it("dangerModel 用打击盒足迹；缺几何 ⇒ null（回落 state-only）", () => {
    expect(dangerModel(danger({ left: 380, width: 40 }))).toMatchObject({ left: 380, right: 420 });
    expect(dangerModel({ x: 400, periodMs: 1000, activeMs: 200, t: 0, state: "idle" })).toBeNull();
  });
});

describe("04 READ_STATE：dangers 的只读盒足迹 + 周期相位（Q7(b)）", () => {
  const readState = (scene) => new Function("window", `return ${READ_STATE}`)({
    __gmGame: { scene: { getScene: () => scene } },
  });

  const scene = () => ({
    player: {
      x: 300, y: 240,
      body: {
        x: 288, y: 208, bottom: 240, top: 208, left: 288, right: 312, width: PW, height: PH,
        velocity: { x: 0, y: 0 }, blocked: { down: true, right: false }, touching: { right: false },
      },
    },
    solids: { getChildren: () => [] },
    pickups: [], hazards: [], chests: [], gate: null, collected: 0, won: false,
    cameras: { main: { scrollX: 0 } },
    dangers: [{
      sprite: { x: 400, y: 240, displayWidth: 40, displayHeight: 32 },
      box: { x: 380, y: 208, w: 40, h: 32 },
      state: "idle", hits: 0, periodMs: 1000, activeMs: 200, t: 1234,
    }],
  });

  it("暴露打击盒足迹 + periodMs/activeMs/t（不是精灵 body 猜测）", () => {
    const out = readState(scene());
    expect(out.dangers[0]).toMatchObject({
      left: 380, right: 420, top: 208, bottom: 240, width: 40, height: 32,
      state: "idle", hits: 0, periodMs: 1000, activeMs: 200, t: 1234,
    });
    // 策略模型能直接从这份观测反推出锚点/相位（端到端：观测 → 模型）。
    const m = dangerModel(out.dangers[0]);
    expect(m).toMatchObject({ left: 380, width: 40, height: 32 });
  });

  it("hazards 仍复用 FA-02 的 body 几何，不产生第二套", () => {
    const s = scene();
    s.hazards = [{
      sprite: {
        x: 340, y: 240, displayWidth: 24, displayHeight: 32,
        body: { x: 328, y: 208, width: 24, height: 32 },
      },
      axis: "x", distance: 100, periodMs: 3000, t0: 500,
    }];
    const out = readState(s);
    expect(out.hazards[0]).toMatchObject({ left: 328, right: 352, top: 208, bottom: 240, width: 24, height: 32 });
  });
});
