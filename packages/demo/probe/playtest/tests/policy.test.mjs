import { describe, expect, it } from "vitest";
import {
  createPolicy, decide, hazardModel, noteObservation, crossingWindow, jumpPredictionSafe,
} from "../policy.mjs";

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

// 三角波位置（测试侧的独立实现，避免拿被测函数证明自己）。
const anchor = (start, dist, period, t0) => {
  const p = (((t0 % period) + period) % period) / period;
  const k = p < 0.5 ? p * 2 : 2 - p * 2;
  return start + k * dist;
};

describe("FA-02 巡逻危险物：模型与跨带窗口", () => {
  it("从观测反推巡逻带与速度方向（不写死 start/id）", () => {
    // t0=750/3000 ⇒ phase 0.25 ⇒ k=0.5 ⇒ anchor = start + 50
    const h = patroller({ x: 390, t0: 750 });
    const m = hazardModel(h);
    expect(m.bandLeft).toBeCloseTo(328);
    expect(m.bandRight).toBeCloseTo(452);
    expect(m.vel).toBeGreaterThan(0);      // phase < 0.5 ⇒ 向右
    const h2 = patroller({ x: 390, t0: 2250 }); // phase 0.75 ⇒ 向左
    expect(hazardModel(h2).vel).toBeLessThan(0);
  });

  it("非横向巡逻 ⇒ null（不把静止危险物当巡逻物处理）", () => {
    expect(hazardModel(patroller({ axis: "y" }))).toBeNull();
    expect(hazardModel(patroller({ distance: 0 }))).toBeNull();
  });

  it("跨带窗口随物理量/几何变化，而不是写死的像素值", () => {
    const st = state({ x: 311, right: 323.5 });
    const c = ctx(st);
    const w1 = crossingWindow(st, c, patroller({ t0: 2000 }));           // 向左，接近玩家
    expect(w1).not.toBeNull();
    expect(w1.gMax).toBeGreaterThan(w1.gMin);
    const faster = crossingWindow(st, { ...c, move: { ...MOVE, speed: 120 } }, patroller({ t0: 2000 }));
    expect(faster.gMax).toBeGreaterThan(w1.gMax);                       // 跑得越快，可起跳的距离越远
    const higher = crossingWindow(st, c, patroller({ top: 170, bottom: 202 }));
    expect(higher).toBeNull();                                           // 32px 之上的危险物跳不过去
  });
});

describe("FA-02 decide：等待 / 起跳 / 抑制", () => {
  it("危险物在远处 ⇒ 继续前进", () => {
    const st = state({ x: 150, left: 138, right: 162, hazards: [patroller({ x: 390 })] });
    const d = decide(st, ctx(st));
    expect(d).toEqual({ advance: true, jump: false });
  });

  it("到等待点且危险物正在远离 ⇒ 松开右键等待（advance:false）", () => {
    // t0=750 ⇒ 向右（远离），anchor=390，bandLeft=328
    const h = patroller({ x: 390, t0: 750 });
    const st = state({ x: 315.5, left: 303.5, right: 327.5, hazards: [h] });
    const d = decide(st, ctx(st));
    expect(d.advance).toBe(false);
    expect(d.jump).toBe(false);
  });

  it("到等待点、危险物朝自己走来且进入窗口 ⇒ 前进 + 起跳", () => {
    // 锚点 380.5 / phase .7975（向左）⇒ 反推 start=340；hazard.left=368.5，玩家 right=326.5 ⇒ gap=42
    const h = patroller({ x: 380.5, t0: 2392.5 });
    const m = hazardModel(h);
    expect(m.bandLeft).toBeCloseTo(328);
    expect(h.left - 326.5).toBeCloseTo(42);
    const st = state({ x: 314.5, left: 302.5, right: 326.5, hazards: [h] });
    const d = decide(st, ctx(st));
    expect(d.advance).toBe(true);
    expect(d.jump).toBe(true);
    expect(m.vel).toBeLessThan(0);
  });

  it("危险物在前时，上方拾取物不会触发无关起跳（pickupAbove 抑制）", () => {
    const h = patroller({ x: 400, t0: 2250 }); // 向左接近，bandLeft=328
    const st = state({
      x: 300, left: 288, right: 312, hazards: [h],
      // 拾取物在 350：起跳会落在巡逻带内（328..452），推演判不安全 ⇒ 不跳
      pickups: [{ x: 350, y: 150, active: true }],
    });
    const d = decide(st, ctx(st));
    expect(d).toEqual({ advance: true, jump: false });
  });

  it("越过危险物后（已在身后）回到通用策略；起跳前做安全推演", () => {
    const h = patroller({ x: 360, t0: 2250 }); // 在玩家身后
    const st = state({
      x: 500, left: 488, right: 512, hazards: [h],
      solids: [{ x: 0, y: 240, w: 1440, h: 30 }, { x: 520, y: 240, w: 40, h: 40 }],
      blockedRight: true,
    });
    const c = ctx(state());
    const d = decide(st, c);
    expect(d.advance).toBe(true);
    expect(jumpPredictionSafe(st, c, [h])).toBe(true);
  });

  it("危险物就在眼前时，起跳推演判不安全（不会主动跳进去）", () => {
    const h = patroller({ x: 350, t0: 2250 });
    const st = state({ x: 320, left: 308, right: 332, hazards: [h] });
    expect(jumpPredictionSafe(st, ctx(st), [h])).toBe(false);
  });
});

describe("FA-02 闭环（离线物理推演）：等待 + 定点起跳能越过巡逻带", () => {
  const DT = 1000 / 60;

  function simulate({ start, distance, periodMs, t0init, width = 24, px = 250 }) {
    let t = 0, x = px, bottom = FLOOR, vy = 0, onFloor = true, t0 = t0init, jumped = false;
    const hz = (tt) => anchor(start, distance, periodMs, tt);
    const c = ctx(state({ x: px, left: px - PW / 2, right: px + PW / 2 }));
    let held = true;
    const st = (tt0) => {
      const ax = hz(tt0);
      return state({
        x, bottom, top: bottom - PH, left: x - PW / 2, right: x + PW / 2, onFloor,
        hazards: [patroller({ x: ax, t0: tt0, distance, periodMs, width,
          left: ax - width / 2, right: ax + width / 2 })],
      });
    };
    for (let f = 0; f < 60 * 40; f++) {
      if (f % 2 === 0) { // ≈33ms 轮询
        const s = st(t0);
        const d = decide(s, c);
        held = d.advance;
        if (d.jump) { vy = -MOVE.jumpVelocity; onFloor = false; jumped = true; }
      }
      if (held) x += MOVE.speed * DT / 1000;
      vy += MOVE.gravity * DT / 1000;
      bottom += vy * DT / 1000;
      if (bottom >= FLOOR) { bottom = FLOOR; vy = 0; onFloor = true; }
      t0 += DT; t += DT;
      const ax = hz(t0);
      const hit = (x + PW / 2) > ax - width / 2 && (x - PW / 2) < ax + width / 2 && bottom > FLOOR - PH;
      if (hit) return { ok: false, t, x };
      if (jumped && x - PW / 2 > start + distance + width / 2 && onFloor) return { ok: true, t };
    }
    return { ok: false, t, timeout: true };
  }

  it("不同相位下都能在 40s 内越过（不靠运气撞相位）", () => {
    for (let t0 = 0; t0 < 3000; t0 += 300) {
      const r = simulate({ start: 340, distance: 100, periodMs: 3000, t0init: t0 });
      expect(r.ok, `t0=${t0}`).toBe(true);
    }
  });

  it("换成另一组几何/速度也能越过（规则不绑本关数值）", () => {
    for (let t0 = 0; t0 < 2200; t0 += 400) {
      const r = simulate({ start: 500, distance: 60, periodMs: 2200, t0init: t0, width: 20, px: 420 });
      expect(r.ok, `t0=${t0}`).toBe(true);
    }
  });
});
