// 票 01 的**端到端免费见证**：假生图器（零上游）造两张固定网格图，
// `buildAssetPack` 必须按格切出 **4 + 9** 帧，且每格内容校验真的会拦下污染。
//
// ⚠️ 这一组不碰网络、不读 `game-maker.local.json`、不写 `out/`（临时目录）。
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import type { AssetRecipe, AssetSpec, StyleSpec } from "@game-maker/contracts";
import {
  buildAssetPack, keyColorFor, verifyPack,
  type ImageGenerator, type RasterImage,
} from "../src/index.js";
import { deliveredColour } from "./_model-paint.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const STYLE: StyleSpec = JSON.parse(readFileSync(
  ROOT + ".scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json", "utf8"));
const EPOCH = 1790208000;

const dirs: string[] = [];
const tmp = () => { const d = mkdtempSync(path.join(tmpdir(), "pack-grid-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

const SIZE = { w: 16, h: 24 };
const IDLE = { columns: 2, rows: 2 };
const RUN = { columns: 3, rows: 3 };

const recipe = (): AssetRecipe => ({
  format: "asset-recipe/v1",
  id: "grid-sheet",
  styleRef: "authoring/stylespec.json",
  assets: [{
    spec: {
      kind: "animation", id: "hero", role: "player", description: "废墟里的拾荒者",
      styleId: "style-ref", anchor: { x: 0.5, y: 1 }, size: SIZE, required: true,
      animations: [
        { name: "idle", frames: 4, sheet: IDLE, fps: 4, loop: true },
        { name: "run", frames: 9, sheet: RUN, fps: 8, loop: true },
      ],
    },
    source: { kind: "image" },
  }],
});

type Pollution = { empty?: number; twoSubjects?: number; frame?: number };

/** 与「模型画的那张固定网格图」同构：纯色底、每格中央一个角色，可选污染。 */
const sheetImage = (columns: number, rows: number, pollute: Pollution = {}): RasterImage => {
  const w = SIZE.w * columns, h = SIZE.h * rows;
  const bg = deliveredColour(keyColorFor(STYLE.palette));
  const data = Buffer.alloc(w * h * 4);
  const put = (x: number, y: number, c: readonly [number, number, number]): void => {
    const o = (y * w + x) * 4;
    data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(x, y, bg);

  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    const i = r * columns + c;
    const x0 = c * SIZE.w, y0 = r * SIZE.h;
    if (pollute.empty === i) continue;
    const colour = [STYLE.palette[(i + 1) % STYLE.palette.length]!];
    const rgb = [parseInt(colour[0]!.slice(1, 3), 16), parseInt(colour[0]!.slice(3, 5), 16), parseInt(colour[0]!.slice(5, 7), 16)] as const;
    if (pollute.twoSubjects === i) {
      for (let y = 3; y < SIZE.h - 3; y++) {
        for (let x = 2; x < 6; x++) put(x0 + x, y0 + y, rgb);
        for (let x = 10; x < 14; x++) put(x0 + x, y0 + y, rgb);
      }
    } else {
      for (let y = 3; y < SIZE.h - 3; y++) for (let x = 3; x < SIZE.w - 3; x++) put(x0 + x, y0 + y, rgb);
    }
    if (pollute.frame === i) {
      const ink = [34, 34, 34] as const;
      for (let x = 0; x < SIZE.w; x++) { put(x0 + x, y0, ink); put(x0 + x, y0 + SIZE.h - 1, ink); }
      for (let y = 0; y < SIZE.h; y++) { put(x0, y0 + y, ink); put(x0 + SIZE.w - 1, y0 + y, ink); }
    }
  }
  return { width: w, height: h, data };
};

const generator = (pollute: (requestIndex: number) => Pollution = () => ({})) => {
  const calls: { w: number; h: number; prompt: string }[] = [];
  const gen: ImageGenerator = async (req) => {
    calls.push({ w: req.size.w, h: req.size.h, prompt: req.prompt });
    // 请求尺寸由 pack 按 cols×rows 算：idle 32×48 / run 48×72
    const grid = req.size.w === SIZE.w * RUN.columns ? RUN : IDLE;
    return {
      image: sheetImage(grid.columns, grid.rows, pollute(calls.length - 1)),
      call: { protocol: "openai", requestedSize: `${req.size.w}x${req.size.h}`, ms: 1, attempts: 1 },
    };
  };
  return { gen, calls };
};

const build = (gen: ImageGenerator) => buildAssetPack({
  recipe: recipe(), style: STYLE, outDir: tmp(), recipeDir: ROOT,
  generate: () => { throw new Error("这个资源不走 drawlist"); },
  generateImage: gen, sourceDateEpoch: EPOCH,
});

describe("§ 假生成器 dry run：4 + 9 帧按格切进包（零上游）", () => {
  it("两次调用 · 画布按 cols×rows 申请 · 帧数与顺序正确", async () => {
    const { gen, calls } = generator();
    const { manifest, packDir, audit } = await build(gen);

    expect(audit).toEqual([]);
    expect(calls).toHaveLength(2);
    // 画布是「每格 spec.size × 网格」，不是 N 倍宽的一条横带
    expect(calls.map((c) => [c.w, c.h])).toEqual([[SIZE.w * 2, SIZE.h * 2], [SIZE.w * 3, SIZE.h * 3]]);
    expect(calls[0]!.prompt).toContain("2 列 × 2 行");
    expect(calls[1]!.prompt).toContain("3 列 × 3 行");

    const asset = manifest.assets[0]!;
    expect(asset.frames.map((f) => f.name)).toEqual([
      "hero.idle1", "hero.idle2", "hero.idle3", "hero.idle4",
      "hero.run1", "hero.run2", "hero.run3", "hero.run4", "hero.run5",
      "hero.run6", "hero.run7", "hero.run8", "hero.run9",
    ]);
    expect(asset.animations!.map((a) => ({ name: a.name, frames: a.frames.length })))
      .toEqual([{ name: "idle", frames: 4 }, { name: "run", frames: 9 }]);
    expect(verifyPack({ packDir }).data.ok).toBe(true);
  });

  it("⚠️ 空格 ⇒ 明确失败（不静默取剩下的）", async () => {
    const { gen } = generator((i) => (i === 0 ? { empty: 2 } : {}));
    await expect(build(gen)).rejects.toThrow(/第 3 格.*空/);
  });

  it("⚠️ 一格里两个主体 ⇒ 明确失败", async () => {
    const { gen } = generator((i) => (i === 0 ? { twoSubjects: 0 } : {}));
    await expect(build(gen)).rejects.toThrow(/多主体|最大连通块/);
  });

  it("⚠️ 格子带黑框 ⇒ 明确失败（C2 idle 的那种污染）", async () => {
    const { gen } = generator((i) => (i === 0 ? { frame: 0 } : {}));
    await expect(build(gen)).rejects.toThrow(/边框|四条边/);
  });

  it("⚠️ 1 帧 + 1×1 网格也走按格校验 —— 不许因为「只有一帧」绕过", async () => {
    // ⚠️ 1×1 的格子就是整张图，所以要让**单帧那两条判据先过**（底色 > 50% · 最大块 ≥ 60%），
    //   只剩「四边框」这一条能红 —— 否则测到的是单帧那条旧判据，不是网格分支。
    const r = recipe();
    const spec = r.assets[0]!.spec as Extract<AssetSpec, { kind: "animation" }>;
    spec.size = { w: 100, h: 100 };
    spec.animations = [{ name: "idle", frames: 1, sheet: { columns: 1, rows: 1 }, fps: 1, loop: true }];
    const bg = deliveredColour(keyColorFor(STYLE.palette));
    const ink = [34, 34, 34] as const;
    const gen: ImageGenerator = async (req) => {
      const { w, h } = req.size;
      const data = Buffer.alloc(w * h * 4);
      const put = (x: number, y: number, c: readonly number[]): void => {
        const o = (y * w + x) * 4;
        data[o] = c[0]!; data[o + 1] = c[1]!; data[o + 2] = c[2]!; data[o + 3] = 255;
      };
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(x, y, bg);
      for (let x = 0; x < w; x++) { put(x, 0, ink); put(x, h - 1, ink); }
      for (let y = 0; y < h; y++) { put(0, y, ink); put(w - 1, y, ink); }
      for (let y = 30; y < 70; y++) for (let x = 30; x < 70; x++) put(x, y, ink);
      return { image: { width: w, height: h, data }, call: { protocol: "openai", requestedSize: `${w}x${h}`, ms: 1, attempts: 1 } };
    };
    await expect(buildAssetPack({
      recipe: r, style: STYLE, outDir: tmp(), recipeDir: ROOT,
      generate: () => { throw new Error("不走 drawlist"); }, generateImage: gen, sourceDateEpoch: EPOCH,
    })).rejects.toThrow(/第 1 格.*边框/);
  });
});
