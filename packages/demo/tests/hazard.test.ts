import { describe, expect, it } from "vitest";
import { dangerState, hazardAnchor } from "../src/hazard.js";

/**
 * 票 106：危险物的三角波返回的是**锚点位置**，不是盒子中心。
 *
 * ⚠️ 现场：锚点 `{0.5,1}`（底边中心）时，把 `body.center` 写回精灵会把「半个身位」
 *   每帧再减一次 —— 敌人 7 秒后 `y=-21838`。这个纯函数是「锚点该在哪」的唯一答案。
 */
describe("危险物三角波：锚点位置（票 106）", () => {
  it("0 → ¼ → ½ → ¾ → 一整程：620 / 650 / 680 / 650 / 620", () => {
    expect(hazardAnchor(620, 60, 3000, 0)).toBe(620);
    expect(hazardAnchor(620, 60, 3000, 750)).toBe(650);
    expect(hazardAnchor(620, 60, 3000, 1500)).toBe(680);
    expect(hazardAnchor(620, 60, 3000, 2250)).toBe(650);
    expect(hazardAnchor(620, 60, 3000, 3000)).toBe(620);
    expect(hazardAnchor(620, 60, 3000, 6000)).toBe(620);
  });

  it("扫过多个周期也从不走出 [start, start + distance] —— 不累积偏移", () => {
    for (let t = 0; t <= 12_000; t += 16) {
      const p = hazardAnchor(620, 60, 3000, t);
      expect(p, `t=${t}`).toBeGreaterThanOrEqual(620);
      expect(p, `t=${t}`).toBeLessThanOrEqual(680);
    }
  });

  it("distance / periodMs 为 0 或负数 ⇒ 原地不动", () => {
    for (const [distance, periodMs] of [[0, 3000], [-1, 3000], [60, 0], [60, -1]] as const)
      expect(hazardAnchor(620, distance, periodMs, 1234)).toBe(620);
  });
});

/**
 * 票 05 / 14：danger 的定时打击状态 —— `periodMs` 是安全窗口、`activeMs` 是喷发窗口，
 * 完整周期 = periodMs + activeMs，喷发落在周期的**最后** activeMs，t=0 从 idle 开始。
 */
describe("danger 定时打击状态：idle ↔ active（票 05 / 14）", () => {
  it("t=0 是 idle（给玩家一个安全窗口）；periodMs 内 idle，其后 activeMs 内 active", () => {
    expect(dangerState(2000, 500, 0)).toBe("idle");
    expect(dangerState(2000, 500, 1999)).toBe("idle");
    expect(dangerState(2000, 500, 2000)).toBe("active");
    expect(dangerState(2000, 500, 2499)).toBe("active");
    expect(dangerState(2000, 500, 2500)).toBe("idle");   // 新周期回到安全窗口
  });

  it("扫过多个周期也不累积偏移（任意 t 都在「idle 长 periodMs + active 长 activeMs」的相位里）", () => {
    const P = 2000, A = 500;
    for (let t = 0; t <= 12_000; t += 16) {
      const phase = t % (P + A);
      expect(dangerState(P, A, t)).toBe(phase < P ? "idle" : "active");
    }
  });

  it("periodMs / activeMs 非法 ⇒ 恒 idle（不喷发，靠 schema 在别处拦）", () => {
    for (const [periodMs, activeMs] of [[0, 500], [-1, 500], [2000, 0], [2000, -1]] as const)
      expect(dangerState(periodMs, activeMs, 1234)).toBe("idle");
  });
});
