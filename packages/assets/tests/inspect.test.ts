import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import type { AssetRecipe, AssetSpec, DrawList, StyleSpec } from "@game-maker/contracts";
import { buildAssetPack, inspectPack, type DrawListGenerator } from "../src/index.js";

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

// ─────────────────────────────────────────────────────────────────────────────
// 票 47 · 色板外像素 —— 那以前被**静默丢掉**的一半
//
// ⚠️ **它是一条诊断观察，不是失败条件、不是阈值、不是验收判据**（人裁 2026-10-13，Q3）。
//   本文件里**没有任何一条**断言说「色板外的像素多」是错的 —— 恰恰相反：
//   实测那堆色板外的颜色来自 drawlist 里**手写的** `opacity < 1`（半透明混合）⇒ **它可以是设计**。
//   这一节盯的是两件别的：① 这个数**报得出来**（不再静默丢掉）② 它与契约里那个
//   `paletteBinding` 字段**对得上**（`exact` ⇒ 一个色板外像素都不该有）。
// ─────────────────────────────────────────────────────────────────────────────

type Usage = {
  perAsset: { id: string; usedColors: number; opacityPixels: number; offPalettePixels: number }[];
  perColor: { color: string; assets: number; share: number }[];
  totalPixels: number;
  opaquePixels: number;
  offPalette: { pixels: number; share: number; colors: { color: string; pixels: number }[] };
};

const usageOf = (packDir: string): Usage => inspectPack({ packDir }).data.paletteUsage as Usage;

describe("票 47 · 色板外像素是一条**观察**（以前静默丢掉）", () => {
  it("真包上的事实：两份入库包都报得出数，且 `share` 的分母是**全部不透明像素**", () => {
    const cs = usageOf(ROOT + "fixtures/packs/counter-siege/v4");
    const lt = usageOf(PACK);

    // counter-siege v4：57 个色板外像素，散在 6 个 composited 资源里的 5 个
    expect(cs.offPalette.pixels).toBe(57);
    expect(cs.opaquePixels).toBe(8683);
    expect(cs.offPalette.share).toBeCloseTo(57 / 8683, 10);

    // last-train v2：2524（背景那一层）+ 24（信号灯）
    expect(lt.offPalette.pixels).toBe(2548);
    expect(lt.offPalette.share).toBeCloseTo(2548 / lt.opaquePixels, 10);

    // 自洽：不透明像素 = 色板内 + 色板外（这两份数**不许**各算各的）
    for (const u of [cs, lt]) expect(u.totalPixels + u.offPalette.pixels).toBe(u.opaquePixels);

    // 报出来的那些颜色**确实不在色板里** —— 否则这行数就是假的
    const pal = new Set(JSON.parse(readFileSync(path.join(PACK, "manifest.json"), "utf8")).palette.values);
    for (const c of lt.offPalette.colors) expect(pal.has(c.color)).toBe(false);
  });

  it("⚠️ 它不是判据：报出来照样**照常返回**，措辞里也这么写着", () => {
    const r = inspectPack({ packDir: ROOT + "fixtures/packs/counter-siege/v4" });
    // ⚠️ 断言必须钉在**那一行自己**上：整包 `summary` 里另有一行（色板分布那块）本来就带这四个字
    //   ⇒ 拿整个 summary 去 match 是**空守卫**（变异 M2 实测：把这一行的措辞降级，那一版照样全绿）。
    const offLine = r.summary.filter((l) => l.includes("色板外像素"));
    expect(offLine).toHaveLength(1);
    expect(offLine[0]).toMatch(/色板外像素 57 个/);
    expect(offLine[0]).toMatch(/观察，不是判据/);
    expect(r.command).toBe("inspect");
  });

  it("⚠️ 与契约字段对得上：`paletteBinding === \"exact\"` 的资源，色板外必须是 0", () => {
    // 这是**两份事实对账**，不是给「色板外像素」本身立的门（人裁 Q3 明说它只是观察）。
    // 契约 `drawlist.ts:113-123` 自己写着：`exact` = 每个不透明像素的颜色 ∈ 色板。
    for (const rel of ["fixtures/packs/counter-siege/v4", "fixtures/packs/last-train/v2"]) {
      const dir = ROOT + rel;
      const m = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8"));
      const byId = new Map(m.assets.map((a: { id: string; paletteBinding: string }) => [a.id, a.paletteBinding]));
      const u = usageOf(dir);
      for (const a of u.perAsset)
        if (byId.get(a.id) === "exact")
          expect(a.offPalettePixels, `${rel} · ${a.id} 说自己是 exact`).toBe(0);
      // 而且这条断言不是空话：这两份包里**真有**资源带色板外像素（否则上面那圈恒真）
      expect(u.perAsset.some((a) => a.offPalettePixels > 0)).toBe(true);
    }
  });

  // ── 构造出来的两发（零付费：`generate` 是注入的桩）─────────────────────────
  const RECIPE: AssetRecipe = JSON.parse(readFileSync(ROOT + "fixtures/recipes/shift-change.json", "utf8"));
  const STYLE: StyleSpec = JSON.parse(
    readFileSync(ROOT + ".scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json", "utf8"));
  const EPOCH = 1790208000;
  const dirs: string[] = [];
  const tmp = () => { const d = mkdtempSync(path.join(tmpdir(), "offpalette-")); dirs.push(d); return d; };
  afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

  /** 只有色板色的桩：底色铺满 + 一块内层。`opacity` 给了就叠一层半透明 —— 那正是色板外的来源。 */
  const gen = (opacity?: number): DrawListGenerator => (spec: AssetSpec) => {
    const n = spec.kind === "animation" ? spec.animations.reduce((s, a) => s + a.frames, 0)
      : spec.kind === "background" && spec.layers ? spec.layers.length : 1;
    return Array.from({ length: n }, (_, i): DrawList => ({
      format: "drawlist+curve/v1", id: spec.id, frame: `f${i}`,
      viewBox: [0, 0, spec.size.w, spec.size.h], expectedSize: [spec.size.w, spec.size.h],
      ops: [
        { op: "rect", x: 0, y: 0, w: spec.size.w, h: spec.size.h, fill: "palette:0" },
        {
          op: "rect", x: 1, y: 1, w: Math.max(1, spec.size.w - 2), h: Math.max(1, spec.size.h - 2),
          fill: "palette:1", ...(opacity === undefined ? {} : { opacity }),
        },
      ] as DrawList["ops"],
    }));
  };
  const smallRecipe = (): AssetRecipe => ({ ...RECIPE, assets: RECIPE.assets.slice(0, 3) });

  it("阴性 · 构造：全程只用色板色 ⇒ 色板外**一个像素都没有**，且那一行照样打得出来", async () => {
    const built = await buildAssetPack({ recipe: smallRecipe(), style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: gen(), sourceDateEpoch: EPOCH });
    const r = inspectPack({ packDir: built.packDir });
    const u = r.data.paletteUsage as Usage;

    // ⚠️ 先确认这一发**不是空跑**：真扫到了不透明像素（否则「0 个色板外」是 0 === 0 的废话）
    expect(u.opaquePixels).toBeGreaterThan(0);
    expect(u.offPalette.pixels).toBe(0);
    expect(u.offPalette.colors).toEqual([]);
    expect(u.totalPixels).toBe(u.opaquePixels);
    // ⚠️ 为 0 时**也要有那一行** —— 「交付图与色板对得上」也是信息，不能靠「没有这一行」表示
    expect(r.summary.join("\n")).toMatch(/色板外像素 0 个/);
    // 而逐个资源那行**不挂**那一截（没有就不拖噪声）⇒ 提到「色板外」的**只有**整包那一行
    expect(r.summary.filter((l) => l.includes("色板外"))).toHaveLength(1);
  }, 120_000);

  it("阳性 · 构造：一个手写的 `opacity: 0.5` 就够 ⇒ 混出色板外的颜色", async () => {
    const built = await buildAssetPack({ recipe: smallRecipe(), style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: gen(0.5), sourceDateEpoch: EPOCH });
    const r = inspectPack({ packDir: built.packDir });
    const u = r.data.paletteUsage as Usage;
    const pal = new Set(JSON.parse(readFileSync(path.join(built.packDir, "manifest.json"), "utf8")).palette.values);

    expect(u.offPalette.pixels, "半透明混出来的像素必须落在色板外").toBeGreaterThan(0);
    expect(u.offPalette.colors.length).toBeGreaterThan(0);
    for (const c of u.offPalette.colors) expect(pal.has(c.color)).toBe(false);
    // 这条**不是**在说它错 —— 它是在证明「色板外像素来自手写的 opacity」这条归因，可构造、可复现
    expect(u.perAsset.every((a) => a.offPalettePixels > 0)).toBe(true);
    // 而契约那一栏也会**自己说**它混合过（`paletteBindingOf`，`drawlist.ts:113-123`）—— 两份事实对得上
    expect(JSON.parse(readFileSync(path.join(built.packDir, "manifest.json"), "utf8"))
      .assets.every((a: { paletteBinding: string }) => a.paletteBinding === "composited")).toBe(true);
  }, 120_000);
});
