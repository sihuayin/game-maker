import { describe, expect, it } from "vitest";
import { hazardAnchor } from "../src/hazard.js";

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
