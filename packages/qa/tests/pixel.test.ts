// 票 04（P0-05b）的判据落点：票 03 裁定 A+ 的**纯函数**那一半。
//
// ⚠️ 阈值只在这里出现一次（`PIXEL_INTEGRITY_THRESHOLDS`）—— 测试断言的是**裁定原文**：
//   长宽比 24.9/25.0、色板外 24.9/25.0 与 9.9/10.0、不透明像素 15/16。
import { describe, expect, it } from "vitest";
import {
  QA_JUDGEMENTS, QAReportSchema, buildQAReport,
  type JudgementResult, type QAJudgementResults, type QAReport,
} from "@game-maker/contracts";
import { PIXEL_INTEGRITY_THRESHOLDS, pixelIntegrity, withPixelFindings } from "../src/index.js";

const ar = (deltaAr: number, id = "hero", unit = "run") => ({ id, unit, deltaAr });
const px = (id: string, offPalettePixels: number, opacityPixels: number) => ({ id, offPalettePixels, opacityPixels });
const sev = (r: ReturnType<typeof pixelIntegrity>) =>
  r.findings.map((f) => [f.judgement, f.finding.severity] as const);

describe("票 03 裁定 A+ · 长宽比", () => {
  it("24.9% 不触发；25.0% 触发 error；负方向按绝对值", () => {
    expect(pixelIntegrity({ sourceSizes: [ar(24.9)] }).findings).toEqual([]);
    const at = pixelIntegrity({ sourceSizes: [ar(25)] });
    expect(sev(at)).toEqual([["constructive-constraint", "error"]]);
    expect(at.findings[0]!.finding.target).toBe("hero.run");
    expect(sev(pixelIntegrity({ sourceSizes: [ar(-25)] }))).toEqual([["constructive-constraint", "error"]]);
  });

  it("背景层不豁免：`unit` 照样进 target（例如 sky）", () => {
    const r = pixelIntegrity({ sourceSizes: [ar(103.2, "level", "sky")] });
    expect(sev(r)).toEqual([["constructive-constraint", "error"]]);
    expect(r.findings[0]!.finding.target).toBe("level.sky");
  });

  it("没有 sourceSizes ⇒ 观察行写明「没跑（unavailable）」，不产 findings、不记绿", () => {
    const r = pixelIntegrity({ sourceSizes: [] });
    expect(r.findings).toEqual([]);
    expect(r.observationLines.join("\n")).toMatch(/源图 \/ 目标尺寸：没跑（unavailable）/);
    expect(r.observationLines.join("\n")).toMatch(/不计入通过/);
  });

  it("阈值来源写在常量里（票 03 裁定）", () => {
    expect(PIXEL_INTEGRITY_THRESHOLDS.aspectRatio.errorDeltaArPct).toBe(25);
  });
});

describe("票 03 裁定 A+ · 色板外像素", () => {
  it("不透明像素 15 ⇒ 既不 error 也不 observation；16 ⇒ 参与判定", () => {
    const tiny = pixelIntegrity({ paletteUsage: { perAsset: [px("tiny", 15, 15)] } });
    expect(tiny.findings).toEqual([]);
    expect(tiny.observationLines.join("\n")).not.toMatch(/tiny · 色板外/);
    const edge = pixelIntegrity({ paletteUsage: { perAsset: [px("edge", 4, 16)] } });
    expect(sev(edge)).toEqual([["palette-binding", "error"]]);            // 4/16 = 25%
  });

  it("24.9% 只有 observation，25.0% 是 error", () => {
    const low = pixelIntegrity({ paletteUsage: { perAsset: [px("almost", 249, 1000)] } });
    expect(low.findings).toEqual([]);
    expect(low.observationLines.join("\n")).toMatch(/almost · 色板外 249\/1000（24\.90%）/);
    const at = pixelIntegrity({ paletteUsage: { perAsset: [px("at", 250, 1000)] } });
    expect(sev(at)).toEqual([["palette-binding", "error"]]);
    expect(at.findings[0]!.finding.target).toBe("at");
  });

  it("9.9% 不产生任何结论；10.0% 产生 observation", () => {
    expect(pixelIntegrity({ paletteUsage: { perAsset: [px("below", 99, 1000)] } }).observationLines.join("\n"))
      .not.toMatch(/below · 色板外/);
    const at = pixelIntegrity({ paletteUsage: { perAsset: [px("obs", 100, 1000)] } });
    expect(at.findings).toEqual([]);
    expect(at.observationLines.join("\n")).toMatch(/obs · 色板外 100\/1000（10\.00%）/);
    expect(at.observationLines.join("\n")).toMatch(/观察（≥10%/);
  });

  it("已接受包的已知读数不触发 error（v7 长宽比最大 2.70%；两个坏例只观察）", () => {
    const r = pixelIntegrity({
      sourceSizes: [{ id: "hazard-terrain", unit: "", deltaAr: -2.7 }],
      paletteUsage: { perAsset: [px("health-icon", 41, 256), px("tile-wall", 29, 225)] },
    });
    expect(r.findings).toEqual([]);
    expect(r.observationLines.join("\n")).toMatch(/health-icon/);
    expect(r.observationLines.join("\n")).toMatch(/tile-wall/);
  });

  it("已接受包的已知坏例落在 observation 档，不阻断", () => {
    const r = pixelIntegrity({ paletteUsage: { perAsset: [px("health-icon", 41, 256), px("tile-wall", 29, 225)] } });
    expect(r.findings).toEqual([]);
    const text = r.observationLines.join("\n");
    expect(text).toMatch(/health-icon · 色板外 41\/256（16\.02%）/);
    expect(text).toMatch(/tile-wall · 色板外 29\/225（12\.89%）/);
  });

  it("观察行写明来源（票 03 裁定 + 语料规模）", () => {
    const text = pixelIntegrity({ paletteUsage: { perAsset: [px("x", 41, 256)] } }).observationLines.join("\n");
    expect(text).toMatch(/票 03 裁定 A\+/);
    expect(text).toMatch(/7 包 \/ 89 资产/);
  });
});

describe("withPixelFindings：把阈值结论挂回**六条判据**里的那两条", () => {
  const reportWith = (): QAReport => {
    const results = Object.fromEntries(QA_JUDGEMENTS.map((j): [string, JudgementResult] =>
      j === "constructive-constraint" || j === "palette-binding"
        ? [j, { ran: true, findings: [] }]
        : [j, { ran: false, reason: "测试：这一条本次没跑" }])) as QAJudgementResults;
    return buildQAReport(results, [
      { source: "inspect", outcome: "ok", lines: ["原样观察"] },
      { source: "review", outcome: "unavailable", reason: "测试" },
    ]);
  };

  it("挂到已跑过的判据上：checked / observations 不变，报告仍过契约", () => {
    const before = reportWith();
    const after = withPixelFindings(before, [{
      judgement: "constructive-constraint",
      finding: { target: "hero.run", severity: "error", detail: "长宽比差 +52.4%" },
    }]);
    expect(after.checked).toEqual(before.checked);
    expect(after.observations).toEqual(before.observations);
    expect(after.failures).toEqual([{
      judgement: "constructive-constraint", target: "hero.run", severity: "error", detail: "长宽比差 +52.4%",
    }]);
    expect(QAReportSchema.safeParse(after).success).toBe(true);
  });

  it("挂到没跑的判据上 ⇒ 抛（没跑过的判据产不出失败）", () => {
    expect(() => withPixelFindings(reportWith(), [{
      judgement: "layer-coverage",
      finding: { target: "bg", severity: "error", detail: "x" },
    }])).toThrow(/没有跑/);
  });

  it("同一 (judgement, target) 已有失败 ⇒ 细节并进 detail（契约 §四②），仍过契约", () => {
    const once = withPixelFindings(reportWith(), [{
      judgement: "palette-binding",
      finding: { target: "hero", severity: "error", detail: "x" },
    }]);
    const twice = withPixelFindings(once, [{
      judgement: "palette-binding",
      finding: { target: "hero", severity: "error", detail: "y" },
    }]);
    expect(twice.failures).toEqual([{
      judgement: "palette-binding", target: "hero", severity: "error", detail: "x\ny",
    }]);
    expect(QAReportSchema.safeParse(twice).success).toBe(true);
  });
});
