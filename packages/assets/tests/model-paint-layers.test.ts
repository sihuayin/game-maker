// **真图回归 · 背景层**（票 38 的 Q5）：把「最远层不抠 / 非最远层按实测众数色抠」
// 钉在**真字节**上，而不是钉在桩上。
//
// ⚠️ 这一份与隔壁 `model-paint.test.ts` 是**同一条纪律、不同的形状**：
//   那边是**单帧 / 多帧**（物体 + 底），这边是**背景层**（一条带 + 留白，或一张本来就该铺满的底）。
//   ⚠️ **背景层是两种相反的东西**（票 38 §2）：`layers[0]`（最远层）本来就该铺满，**抠它是错的**；
//   其余层必须留白，**不抠它是错的**。⇒ 同一组断言不可能同时对这两半，判据**按层分**。
//
// ⚠️ **上游依赖**写在 `fixtures/model-paint-layers/README.md`：这些颜色量自
//   `gemini-2.5-flash-image`（2026-09-30 与 2026-10-09 两跑，声明色一律是 `#ff00ff`）。
//   **换了上游（换模型 / 换供应商）⇒ 偏移会变 ⇒ 这 5 张要重量、要换掉**，
//   而不是把断言放宽到「怎么画都算过」。
//
// ⚠️ **三块的分工**（别把哪一块当成了另一块的证据 —— 2026-10-10 用变异验证量过）：
//   ① 量法那一块：钉**读数**（众数色是什么、抠掉多少）。
//   ② 三层配方那一块：钉**「按层分」这个决定**（最远层不抠 / 其余层抠）。
//   ③ 众数 vs 四角那一块：钉**「用的是哪个颜色」** —— 只有它能把「四角取样」这条老路杀红。
//   ⚠️ ②③ 分开不是啰嗦：② 那两张**真·非最远层**恰恰**分不开**众数色与四角取样（下详），
//   把「用哪个颜色」寄在 ② 上是一颗**假牙**。
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import type { AssetRecipe, DrawList, StyleSpec } from "@game-maker/contracts";
import { decodePNG } from "../src/png.js";
import {
  buildAssetPack, dominantOpaqueColor, keyBackground, keyColorFor, l1Distance,
  type DrawListGenerator, type ImageGenerator, type RasterImage,
} from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const DIR = path.join(ROOT, "fixtures/model-paint-layers");
const RECIPE: AssetRecipe = JSON.parse(readFileSync(path.join(ROOT, "fixtures/recipes/shift-change.json"), "utf8"));
const STYLE: StyleSpec = JSON.parse(
  readFileSync(path.join(ROOT, ".scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json"), "utf8"));
const EPOCH = 1790208000;
/** 提示词里逐字写着的那个（`keyColorFor(palette)` 在本轮色板下的返回值）。 */
const DECLARED = "#ff00ff";
const declaredRgb = [255, 0, 255] as const;
/** 站点那条门禁的界（`@game-maker/contracts` 的 `FILLED`，票 50）。 */
const FILLED = 0.999;
/** 生图那条路的默认容差（`pack.ts` 的 `src.background?.tolerance ?? 30`）。 */
const TOL = 30;

const dirs: string[] = [];
const tmp = () => { const d = mkdtempSync(path.join(tmpdir(), "mplayers-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

const load = (file: string): RasterImage => decodePNG(readFileSync(path.join(DIR, file)));
/** 按某个颜色抠，抠掉了**全图**像素的多少（覆盖率的分母就是它）。 */
const keyedShare = (img: RasterImage, color: readonly number[]) =>
  keyBackground(img, { tolerance: TOL, colors: [[color[0]!, color[1]!, color[2]!]] }).keyedPixels / img.width / img.height;

/**
 * **最远层**那 3 张 —— 它们本来就该铺满，所以「按众数色抠」在它们身上是**错的**。
 *
 * `mode` 与 `keyed` 是 2026-10-10 用交付版实现量出来的（原始读数见 fixture README）；
 * ⚠️ 两列都**钉死**：实现改一次量法，这里就该红一次，而不是悄悄换个数继续绿。
 */
const FARTHEST = [
  { file: "third-run-wasteland-skyline-sky.png", mode: [48, 57, 70],  keyed: 0.314 },
  { file: "layer-exp-treatment-sky.png",         mode: [41, 41, 64],  keyed: 0.263 },
  { file: "layer-exp-control-sky.png",           mode: [56, 66, 88],  keyed: 0.387 },
] as const;
/**
 * **非最远层**那 2 张 —— 它们必须留白，所以「按众数色抠」在它们身上是**对的**。
 *
 * ⚠️ 也正是这两张否掉了「照搬单帧那两条判据」：`0.481` / `0.478` **都 ≤ 0.5**
 *   （一层背景就是一条带，内容与留白本来就各占一半）⇒ 那条 `> 0.5` 会把两张真图**都拒掉**。
 */
const NEAR = [
  { file: "layer-exp-treatment-wall.png",   mode: [209, 77, 164], keyed: 0.481 },
  { file: "layer-exp-treatment-ground.png", mode: [224, 65, 153], keyed: 0.478 },
] as const;

describe("真图回归 · 背景层：**5 张已付费的真图**（票 38 的 Q5）", () => {
  it("前提：这 5 张的提示词里写的就是 `#ff00ff`，而色板派生的也正是它", () => {
    expect(keyColorFor(STYLE.palette)).toBe(DECLARED);
  });

  it("⚠️ **声明色覆盖率 = 0** —— 5 张一张都没交付 `#ff00ff`（背景层与单帧/多帧同一个病）", () => {
    // ⚠️ 这一条是**整张票的来由**：票 37 改了单帧 / 多帧，背景层按 Q3 原样留着 ——
    //   而背景层同样不交付声明色 ⇒ 那条哨兵**必然**响（下一次真跑会付完 13 张图再停）。
    for (const img of [...FARTHEST, ...NEAR]) {
      expect(keyedShare(load(img.file), declaredRgb), `${img.file} 竟然抠到了声明色`).toBe(0);
    }
  });

  it("⚠️ 众数色与声明色**差得很远**（L1 ≥ 100）—— 「差不多」不成立，是**另一个色**", () => {
    for (const img of [...FARTHEST, ...NEAR]) {
      const l1 = l1Distance(dominantOpaqueColor(load(img.file)).color, declaredRgb);
      expect(l1, `${img.file} 的众数色离声明色只差 L1 ${l1}`).toBeGreaterThanOrEqual(100);
    }
  });

  it("⚠️ **最远层 3 张：按众数色抠会把它们打到门禁之下** —— 这就是「最远层不该抠」的实操证据", () => {
    for (const img of FARTHEST) {
      const loaded = load(img.file);
      const m = dominantOpaqueColor(loaded);
      expect(m.color, `${img.file} 的实测众数色`).toEqual([...img.mode]);
      const keyed = keyedShare(loaded, m.color);
      expect(keyed, `${img.file}：按众数色抠掉多少`).toBeCloseTo(img.keyed, 2);
      // ⚠️ **众数色在最远层上就是它的内容本身** ⇒ 抠完的交付不透明率 = 1 − keyed。
      //   三张全在 `FILLED` 之下 ⇒ 真抠的话，站点那条「最远层必须画满」**当场红**。
      //   而票 38 的答案是**不抠**（不是「换一个颜色抠」）⇒ 这条差值正是那个决定的代价说明书。
      expect(1 - keyed, `${img.file}：抠完的交付不透明率`).toBeLessThan(FILLED);
      expect(1 - keyed, `${img.file}：抠得够狠才说明众数色是内容`).toBeLessThan(0.8);
    }
  });

  it("⚠️ **非最远层 2 张：众数色就是那块平涂的空白板** —— 抠得掉，而且它就是该被抠的那个", () => {
    for (const img of NEAR) {
      const loaded = load(img.file);
      const m = dominantOpaqueColor(loaded);
      expect(m.color, `${img.file} 的实测众数色`).toEqual([...img.mode]);
      // ⚠️ 「众数色 ≠ 声明色」是这条改动的**病根**，与票 37 的判据同款 —— 必须单独钉一条。
      expect(l1Distance(m.color, declaredRgb), `${img.file}：众数色与声明色`).toBeGreaterThanOrEqual(100);
      // 「确实被抠除了」：抠掉的比例 > 0（不是空转），且与读数一致。
      const keyed = keyedShare(loaded, m.color);
      expect(keyed, `${img.file}：众数色一个像素都没抠掉`).toBeGreaterThan(0);
      expect(keyed, `${img.file}：按众数色抠掉多少`).toBeCloseTo(img.keyed, 2);
      // ⚠️ 顺带把那个**没被采纳**的判据钉在原地：单帧那条「抠掉多数（> 0.5）」
      //   会把这两张真图**都拒掉**（0.481 / 0.478 ≤ 0.5）—— 那不是「放宽」，是「不能照搬」。
      expect(keyed, `${img.file}：单帧那条 > 0.5 会把它拒掉`).toBeLessThanOrEqual(0.5);
    }
  });
});

// ── 真跑 `buildAssetPack` 的两块共用的脚手架 ───────────────────────────────────

/** 一份分层背景配方：`spec.layers` 按传进来的层表，尺寸故意取小（64×48），跑得快。 */
const bgRecipe = (layers: { name: string; parallax: number; description: string }[]): AssetRecipe => ({
  ...RECIPE, id: "real-layers", referenceImage: undefined,
  assets: [{
    spec: {
      kind: "background", id: "bg", role: "backdrop", description: "真图回归用的分层背景",
      styleId: "style-ref", anchor: { x: 0, y: 0 }, size: { w: 64, h: 48 },
      required: true, layers,
    },
    source: { kind: "image" },
  }],
});

/** 一张图喂所有层（`file` 给了就用它），或者按提示词把每一层分到不同的真图。 */
const paints = (pick: string | ((prompt: string) => string)): ImageGenerator => {
  const cache = new Map<string, RasterImage>();
  const imageOf = (file: string) => {
    const hit = cache.get(file) ?? load(file);
    cache.set(file, hit);
    return hit;
  };
  return async (req) => {
    const file = typeof pick === "string" ? pick : pick(req.prompt);
    if (file === "") throw new Error(`桩认不出这是哪一层：\n${req.prompt}`);
    const w = req.size.w, h = req.size.h, image = imageOf(file);
    // ⚠️ 上游**不按我们点的大小交图**（真图是 1344×768 / 480×270）—— 桩照做，
    //   于是交付态要经过真实的降采样那一段（这正是要测的东西）。
    void w; void h;
    return { image, call: { protocol: "openai", requestedSize: `${w}x${h}`, ms: 1, attempts: 1 } };
  };
};

const runPack = async (recipe: AssetRecipe, gen: ImageGenerator) =>
  buildAssetPack({
    recipe, style: STYLE, outDir: tmp(), recipeDir: ROOT,
    generate: stub, generateImage: gen, sourceDateEpoch: EPOCH,
  });

/** 交付的图集里，某一帧**真正透明**的像素占这一帧的多少（站点那条门禁读的就是它的补集）。 */
const transparentShareOf = (packDir: string, name: string) => {
  const atlas = JSON.parse(readFileSync(path.join(packDir, "delivery/atlas.backgrounds.json"), "utf8"));
  const img = decodePNG(readFileSync(path.join(packDir, "delivery/atlas.backgrounds.png")));
  const f = atlas.frames[name].frame as { x: number; y: number; w: number; h: number };
  let clear = 0;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++)
    if (img.data[((f.y + y) * img.width + f.x + x) * 4 + 3]! === 0) clear++;
  return clear / (f.w * f.h);
};

describe("真图回归 · 背景层：**真的走一遍 `buildAssetPack`**（票 38 的 Q1 落地没落地）", () => {
  const LAYERS = [
    { name: "sky", parallax: 0, description: "远天 · 铺满整块画布" },
    { name: "wall", parallax: 0.5, description: "中景墙带 · 一条横带" },
    { name: "ground", parallax: 1, description: "近端站台与铁轨" },
  ];
  /** 按提示词里**这一层自己的描述**认出是哪一层 —— 三层各有各的那一句。 */
  const BY_LAYER = (p: string) =>
    p.includes("铺满整块画布") ? "third-run-wasteland-skyline-sky.png"
    : p.includes("一条横带") ? "layer-exp-treatment-wall.png"
    : p.includes("近端站台与铁轨") ? "layer-exp-treatment-ground.png" : "";

  it("⚠️ 最远层交付态**整帧不透明**、非最远层**确实被抠出了透明**（票 38 的 Q1/Q5）", async () => {
    const { packDir, audit } = await runPack(bgRecipe(LAYERS), paints(BY_LAYER));
    expect(audit, "真图这一跑该是干净的").toEqual([]);

    // ⚠️ **最远层不抠**（票 38 的 Q1）：它走的必须是 `importFrames` 的「不传 `background` ⇒
    //   原样返回」那条路 —— 交付态**一个透明像素都不该有**。
    //   ⚠️ 这一条与「按众数色抠」是**互斥**的：那会抠掉约三成（上面 FARTHEST 那 3 个读数）。
    expect(transparentShareOf(packDir, "bg.sky"), "最远层有意不抠 ⇒ 交付态整帧不透明").toBe(0);
    // **非最远层**：按实测众数色抠 ⇒ 一定抠出了透明。
    // ⚠️ 这里**只**能说「确实抠掉了」——「用的是众数色而不是四角」这一层意思，
    //   这两张真图**给不出**：它们的四角**恰好落在底色板里**（见下一块的实测）。
    //   ⇒ 别把这两条断言当成「用哪个颜色」的证据。
    for (const name of ["bg.wall", "bg.ground"]) {
      expect(transparentShareOf(packDir, name), `${name}：众数色该被抠掉`).toBeGreaterThan(0.3);
    }
  });

  /** ⚠️ **两种规则的交付态读数**（2026-10-10 实测，同一套 64×48 管道）—— 见下块。 */
  const DISCRIMINATING = [
    { file: "third-run-wasteland-skyline-sky.png", mode: 0.3060, corners: 0.6195 },
    { file: "layer-exp-treatment-sky.png",         mode: 0.2546, corners: 0.4248 },
    { file: "layer-exp-control-sky.png",           mode: 0.3750, corners: 0.5667 },
  ] as const;

  /**
   * ⚠️ **为什么偏偏拿三张「天空」当中景层** —— 一种**有意的错用**。
   *
   * 上面那两张**真·非最远层**（`wall` / `ground`）**分不开**「按众数色」与「按四角取样」：
   * 实测它们的四角**恰好落在底色板里**（众数 `[209,77,164]`，四角 `[149,124,113] [209,77,162]`
   * `[209,76,163] [209,75,163]`）⇒ 两条规则只差 **21 个像素（0.02%）**。
   * 拿它们证明「用的是众数色」是一颗**假牙**：把 `pack` 改回四角取样，它们照样绿。
   *
   * 而这三张天空的**四角是内容**（例 `[78,85,94] [47,57,71] [72,48,30] [73,50,34]`）⇒
   * 两条规则在**交付态**上就分得开（上表两列相差 17~31 个百分点）。
   * 「谁该当最远层」那件事由上面那份三层配方钉着；**这一块只管「用哪个颜色」**。
   */
  for (const { file, mode, corners } of DISCRIMINATING)
    it(`⚠️ **用的是众数色，不是四角取样**：${file}`, async () => {
      const layers = [
        { name: "sky", parallax: 0, description: "远天" },
        { name: "mid", parallax: 0.5, description: "中景" },
      ];
      // 同一张图喂两层：最远层**不抠**（所以它的读数恒 0），中景层**按众数色抠**
      // ⇒ 交付态那一个数只可能来自抠底，别处没有第二个来源。
      const { packDir, audit } = await runPack(bgRecipe(layers), paints(file));
      expect(audit, `${file}：这一跑该是干净的`).toEqual([]);
      const share = transparentShareOf(packDir, "bg.mid");
      // 一个数钉两件事：**是**众数色那一档，**不是**四角那一档（两者相差 ≥ 0.17）。
      expect(share, `交付态透明 ${(100 * share).toFixed(2)}% —— 众数色那一档是 ${(100 * mode).toFixed(2)}%，` +
        `四角取样那一档是 ${(100 * corners).toFixed(2)}%（票 38 实测）`).toBeCloseTo(mode, 2);
    });
});

/** 与 `recipes-sweep.test.ts` 同款的桩 drawlist 生成器（这一份走的是生图那条路，桩只为凑形状）。 */
const stub: DrawListGenerator = (spec) => {
  const n = spec.kind === "animation" ? spec.animations.reduce((s, a) => s + a.frames, 0)
    : spec.kind === "background" && spec.layers ? spec.layers.length : 1;
  return Array.from({ length: n }, (_, i) => ({
    format: "drawlist+curve/v1", id: spec.id, frame: `f${i}`,
    viewBox: [0, 0, spec.size.w, spec.size.h], expectedSize: [spec.size.w, spec.size.h],
    ops: [
      { op: "rect", x: 0, y: 0, w: spec.size.w, h: spec.size.h, fill: `palette:${i % 5}` },
      { op: "rect", x: 1, y: 1, w: Math.max(1, spec.size.w - 2), h: 2, fill: "palette:1" },
    ] as DrawList["ops"],
  }));
};
