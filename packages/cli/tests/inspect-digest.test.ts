// v3 终端摘要：纯函数聚合与渲染（第二轮边界 1 / 测试矩阵「聚合器纯函数」）。
import { describe, expect, it } from "vitest";
import type { Observation } from "@game-maker/contracts";
import type { InspectAsset, InspectData, InspectPaletteUsage, SourceSizeEntry } from "@game-maker/assets";
import { inspectDigestLines, inspectObservationOf } from "../src/inspect-digest.js";

const PATHS = { qaReport: "wasteland/run/v1/qa-report.json", packDir: "wasteland/pack/v1" };

const asset = (id: string): InspectAsset => ({
  id, kind: "sprite", size: { w: 16, h: 16 }, origin: "imported", paletteBinding: "exact", frames: 1, animations: [],
});

const size = (id: string, unit: string, deltaAr: number): SourceSizeEntry => ({
  id, unit, deltaAr, source: { w: 100, h: 100, ar: 1 }, target: { w: 100, h: 100, ar: 1 },
});

const usage = (pixels: number, share: number): InspectPaletteUsage => ({
  perAsset: [], perColor: [], totalPixels: 0, opaquePixels: 0,
  offPalette: { pixels, share, colors: [] },
});

const data = (over: Partial<InspectData> = {}): InspectData => ({
  packId: "wasteland", version: 1, provenanceMode: "generated",
  assets: [asset("a"), asset("b")],
  paletteUsage: usage(184, 0.0105),
  layerCoverage: [
    { asset: "bg", frame: "sky", w: 10, h: 10, opaque: 100, ratio: 1 },
    { asset: "bg", frame: "ground", w: 10, h: 10, opaque: 17, ratio: 0.174 },
  ],
  sourceSizes: [size("enemy", "patrol", 107.84), size("master", "", -9.06)],
  ...over,
});

const ok: Observation = { source: "inspect", outcome: "ok", lines: ["ignored"] };

describe("§inspectDigestLines", () => {
  it("四行：资源/源图/色板外/背景，指针指向报告与 inspect", () => {
    expect(inspectDigestLines(data(), ok, PATHS)).toEqual([
      "资源观察摘要（不评分 · 不阻断）：",
      "  2 个资源 · 源图→目标 2 条 · 最大 |长宽比差| 107.8%（enemy.patrol）",
      "  色板外像素 184 个（1.05%） · 背景层 2 帧 · 最低覆盖 17.4%（ground）",
      "  全文：wasteland/run/v1/qa-report.json · game-maker inspect wasteland/pack/v1",
    ]);
  });

  it("最大 |Δ_AR| 并列取 manifest 顺序第一条；背景最低覆盖率并列取第一条", () => {
    const lines = inspectDigestLines(data({
      sourceSizes: [size("first", "", 12.3), size("second", "", -12.3)],
      layerCoverage: [
        { asset: "bg", frame: "first", w: 1, h: 1, opaque: 0, ratio: 0.5 },
        { asset: "bg", frame: "second", w: 1, h: 1, opaque: 0, ratio: 0.5 },
      ],
    }), ok, PATHS);
    expect(lines[1]).toContain("12.3%（first）");
    expect(lines[2]).toContain("50.0%（first）");
  });

  it("空数组 / 缺失字段：整段省略；真实零值照常显示", () => {
    const lines = inspectDigestLines(data({
      assets: [], sourceSizes: [], layerCoverage: [],
      paletteUsage: usage(0, 0),
    }), ok, PATHS);
    expect(lines).toEqual([
      "资源观察摘要（不评分 · 不阻断）：",
      "  0 个资源",                                  // 真实零值照显，不是缺失
      "  色板外像素 0 个（0.00%）",
      "  全文：wasteland/run/v1/qa-report.json · game-maker inspect wasteland/pack/v1",
    ]);
  });

  it("非法字段：安全省略、不抛错、不以 0 冒充缺失", () => {
    const broken = {
      assets: "nope",
      sourceSizes: [{ id: 1, unit: "x", deltaAr: "NaN" }],
      paletteUsage: { offPalette: { pixels: "x", share: 2 } },
      layerCoverage: [{ frame: 1, ratio: 9 }],
    } as unknown as InspectData;
    expect(inspectDigestLines(broken, ok, PATHS)).toEqual([
      "资源观察摘要（不评分 · 不阻断）：",
      "  全文：wasteland/run/v1/qa-report.json · game-maker inspect wasteland/pack/v1",
    ]);
  });

  it("inspect 不可用：一行同源原因，没有 header / 指针", () => {
    const unavailable: Observation = { source: "inspect", outcome: "unavailable", reason: "inspect 未能完成：boom" };
    expect(inspectDigestLines(data(), unavailable, PATHS))
      .toEqual(["inspect 观察不可用：inspect 未能完成：boom"]);
  });

  it("03：观察为 ok 但 inspectData 整体缺席 ⇒ 整块省略", () => {
    expect(inspectDigestLines(undefined, ok, PATHS)).toEqual([]);
  });

  it("报告里没有 inspect 观察但数据在 ⇒ 照常显示（防御）", () => {
    expect(inspectDigestLines(data(), undefined, PATHS)[0]).toBe("资源观察摘要（不评分 · 不阻断）：");
  });
});

describe("§inspectObservationOf", () => {
  it("只挑 inspect，不挑 review", () => {
    const review: Observation = { source: "review", outcome: "unavailable", reason: "人工付费" };
    expect(inspectObservationOf([review, ok])).toBe(ok);
    expect(inspectObservationOf([review])).toBeUndefined();
  });
});
