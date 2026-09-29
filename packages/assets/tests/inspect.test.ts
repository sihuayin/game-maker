import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { inspectPack } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const PACK = ROOT + "fixtures/packs/last-train/v2";

describe("inspect 的色板用色观察（票 39）", () => {
  const r = inspectPack({ packDir: PACK });
  const usage = r.data.paletteUsage as {
    perAsset: { id: string; usedColors: number }[];
    perColor: { color: string; assets: number; share: number }[];
  };

  it("每个资源都报出「用了几色」，每个色都报出「几个资源用到、占多少像素」", () => {
    expect(usage.perAsset).toHaveLength(9);
    expect(usage.perColor).toHaveLength(8);
    expect(usage.perAsset.find((a) => a.id === "player-traveler")?.usedColors).toBe(6);
    expect(usage.perColor.every((c) => c.share >= 0 && c.share <= 1)).toBe(true);
  });

  it("⚠️ 它是**观察**，不是**判据** —— 报数、不打分、不阻断（票 39 立的规矩）", () => {
    // 这条断言盯的是**措辞**：把这块升级成门之前，得先说出「错了一定不是设计」的理由。
    // 见 CONTEXT.md 的「观察 / 判据」词条。
    expect(r.summary.join("\n")).toMatch(/观察，不是判据/);
    // 而且它必须**照常返回**：一个色没人用、重音色占比低 —— 都不是失败
    expect(r.command).toBe("inspect");
  });

  it("真包上的事实：8 色**每个都至少被一个资源用到**；最暗色 9/9", () => {
    expect(usage.perColor.every((c) => c.assets >= 1)).toBe(true);
    expect(usage.perColor.find((c) => c.color === "#1c1c28")?.assets).toBe(9);
  });

  it("⚠️ **整包**与**逐个资源**是两种读法，会给出相反的印象", () => {
    // 逐个看：多数道具的最暗色占 34~62%，像「太暗了」。
    // 整包看：最高的色只占 37%，而重音 `#d4a64a` **9 个资源里 9 个都用到**。
    // ⇒ 「重音色几乎没用上」是**逐个看**的产物，不是这个包的性质。
    const accent = usage.perColor.find((c) => c.color === "#d4a64a");
    expect(accent?.assets, "整包看，重音色每个资源都用到").toBe(9);
    expect(accent?.share).toBeLessThan(0.1);
  });
});
