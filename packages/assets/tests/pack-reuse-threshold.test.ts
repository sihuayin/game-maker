// 票 18：失败现场的**零付费复用** + 多部件道具的 `minLargestShare`。
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import type { AssetRecipe, StyleSpec } from "@game-maker/contracts";
import { buildAssetPack, encodePNG, keyColorFor, packAssets, verifyPack, type ImageGenerator } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const STYLE: StyleSpec = JSON.parse(readFileSync(ROOT + ".scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json", "utf8"));
const EPOCH = 1790208000;
const dirs: string[] = [];
const tmp = () => { const d = mkdtempSync(path.join(tmpdir(), "pack-reuse-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });
const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** 一张纯色底 + 若干矩形块的测试图。 */
function imageOf(w: number, h: number, blocks: { x0: number; y0: number; x1: number; y1: number }[]) {
  const bg = hex(keyColorFor(STYLE.palette));
  const ink = hex(STYLE.palette[0]!);
  const data = Buffer.alloc(w * h * 4);
  const put = (x: number, y: number, c: readonly number[]) => {
    const o = (y * w + x) * 4;
    data[o] = c[0]!; data[o + 1] = c[1]!; data[o + 2] = c[2]!; data[o + 3] = 255;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(x, y, bg);
  for (const b of blocks) for (let y = b.y0; y < b.y1; y++) for (let x = b.x0; x < b.x1; x++) put(x, y, ink);
  return { width: w, height: h, data };
}
const genOf = (img: ReturnType<typeof imageOf>): ImageGenerator => async () => ({
  image: img, call: { protocol: "openai", requestedSize: "test", ms: 1, attempts: 1 },
});

const frameRecipe = (): AssetRecipe => ({
  format: "asset-recipe/v1", id: "reuse-test", styleRef: "unused.json",
  assets: [{
    spec: {
      kind: "animation", id: "hero", role: "测试角色", description: "一个测试角色",
      styleId: "test-style", anchor: { x: 0.5, y: 1 }, size: { w: 16, h: 24 }, required: true,
      animations: [{ name: "idle", frames: 2, fps: 4, loop: true }],
    },
    source: { kind: "frames" },
  }],
});

const spriteRecipe = (minLargestShare?: number): AssetRecipe => ({
  format: "asset-recipe/v1", id: "threshold-test", styleRef: "unused.json",
  assets: [{
    spec: {
      kind: "sprite", id: "prop", role: "多部件道具", description: "桌子 + 椅子",
      styleId: "test-style", anchor: { x: 0.5, y: 1 }, size: { w: 32, h: 32 }, required: true,
    },
    source: { kind: "image", ...(minLargestShare === undefined ? {} : { minLargestShare }) },
  }],
});

describe("§ 票 18：零付费复用现场", () => {
  it("现场已有两帧原图 ⇒ 0 次生图调用，pack 仍然成立", async () => {
    const reuse = tmp();
    const gen = path.join(reuse, "authoring/generated");
    mkdirSync(gen, { recursive: true });
    const img = imageOf(64, 96, [{ x0: 16, y0: 14, x1: 48, y1: 86 }]);
    for (const name of ["hero.idle1.png", "hero.idle2.png"]) writeFileSync(path.join(gen, name), encodePNG(img));

    const r = await buildAssetPack({
      recipe: frameRecipe(), style: STYLE, outDir: tmp(), recipeDir: ROOT,
      reuseFrom: reuse,
      generate: () => { throw new Error("reuse 模式不应调用文本上游"); },
      generateImage: () => { throw new Error("reuse 模式不应调用生图上游"); },
      sourceDateEpoch: EPOCH, concurrency: { image: 1, text: 1 },
    });
    expect(r.imageCalls).toHaveLength(0);
    expect(r.manifest.assets[0]!.frames).toHaveLength(2);
    expect(verifyPack({ packDir: r.packDir }).data.ok).toBe(true);
  });

  it("现场缺一帧 ⇒ 明确失败，不偷偷重发", async () => {
    const reuse = tmp();
    const gen = path.join(reuse, "authoring/generated");
    mkdirSync(gen, { recursive: true });
    const img = imageOf(64, 96, [{ x0: 16, y0: 14, x1: 48, y1: 86 }]);
    writeFileSync(path.join(gen, "hero.idle1.png"), encodePNG(img));
    await expect(buildAssetPack({
      recipe: frameRecipe(), style: STYLE, outDir: tmp(), recipeDir: ROOT,
      reuseFrom: reuse,
      generate: () => { throw new Error("no"); },
      generateImage: () => { throw new Error("no"); },
      sourceDateEpoch: EPOCH,
    })).rejects.toThrow(/缺少生图文件/);
  });
});

describe("§ 票 18：minLargestShare（多部件道具）", () => {
  // 两个等大的块：墨各占 20%，最大块占全部墨的 50% —— 默认 0.6 不过，0.5 过。
  const twoParts = imageOf(128, 128, [
    { x0: 10, y0: 20, x1: 60, y1: 90 },
    { x0: 70, y0: 20, x1: 120, y1: 90 },
  ]);
  const build = (min?: number) => buildAssetPack({
    recipe: spriteRecipe(min), style: STYLE, outDir: tmp(), recipeDir: ROOT,
    generate: () => { throw new Error("no"); }, generateImage: genOf(twoParts), sourceDateEpoch: EPOCH,
  });

  it("默认 0.6 ⇒ 多部件道具被拒（这正是 office-debris 的误杀）", async () => {
    await expect(build()).rejects.toThrow(/最大的一块/);
  });

  it("显式 0.5 ⇒ 通过，包成立", async () => {
    const r = await build(0.5);
    expect(r.manifest.assets[0]!.frames).toHaveLength(1);
    expect(verifyPack({ packDir: r.packDir }).data.ok).toBe(true);
  });
});

describe("§ 票 19：packAssets 的 reuseFrom 接线与身份护栏", () => {
  const writeReuse = (dir: string, id = "reuse-test", withFrames = true) => {
    writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ id, version: 1, assets: [], files: [] }) + "\n");
    if (withFrames) {
      const gen = path.join(dir, "authoring/generated");
      mkdirSync(gen, { recursive: true });
      const img = imageOf(64, 96, [{ x0: 16, y0: 14, x1: 48, y1: 86 }]);
      for (const name of ["hero.idle1.png", "hero.idle2.png"]) writeFileSync(path.join(gen, name), encodePNG(img));
    }
  };

  it("reuseFrom ⇒ 零文本/生图调用，pack 成立", async () => {
    const base = tmp();
    const recipeDir = path.join(base, "recipe");
    mkdirSync(recipeDir, { recursive: true });
    writeFileSync(path.join(recipeDir, "style.json"), JSON.stringify(STYLE) + "\n");
    const recipe = { ...frameRecipe(), styleRef: "style.json" };
    const recipePath = path.join(recipeDir, "recipe.json");
    writeFileSync(recipePath, JSON.stringify(recipe) + "\n");
    const reuse = path.join(base, "reuse");
    mkdirSync(reuse, { recursive: true });
    writeReuse(reuse);
    const outRoot = path.join(base, "out");
    const r = await packAssets({
      recipePath, outRoot, transport: { baseUrl: "http://stub.invalid", apiKey: "stub" },
      imageTransport: { protocol: "openai", baseUrl: "http://stub.invalid", apiKey: "stub" },
      fetchImpl: (() => { throw new Error("reuse 模式不应调用上游"); }) as unknown as typeof fetch,
      reuseFrom: reuse, concurrency: { text: 1, image: 1 },
    });
    expect(r.data).toBeDefined();
    const packDir = path.join(outRoot, "reuse-test", "pack", "v1");
    expect(verifyPack({ packDir }).data.ok).toBe(true);
  });

  it("reuseFrom 的 manifest id 与 recipe.id 不符 ⇒ exit 4 / invalid", async () => {
    const base = tmp();
    const recipeDir = path.join(base, "recipe");
    mkdirSync(recipeDir, { recursive: true });
    writeFileSync(path.join(recipeDir, "style.json"), JSON.stringify(STYLE) + "\n");
    const recipe = { ...frameRecipe(), styleRef: "style.json" };
    const recipePath = path.join(recipeDir, "recipe.json");
    writeFileSync(recipePath, JSON.stringify(recipe) + "\n");
    const reuse = path.join(base, "reuse");
    mkdirSync(reuse, { recursive: true });
    writeReuse(reuse, "other");
    await expect(packAssets({
      recipePath, outRoot: path.join(base, "out"), transport: { baseUrl: "http://stub.invalid", apiKey: "stub" },
      imageTransport: { protocol: "openai", baseUrl: "http://stub.invalid", apiKey: "stub" },
      reuseFrom: reuse,
    })).rejects.toThrow(/不一致/);
  });

  it("reuseFrom 缺 manifest ⇒ 拒绝", async () => {
    const base = tmp();
    const recipeDir = path.join(base, "recipe");
    mkdirSync(recipeDir, { recursive: true });
    writeFileSync(path.join(recipeDir, "style.json"), JSON.stringify(STYLE) + "\n");
    const recipe = { ...frameRecipe(), styleRef: "style.json" };
    const recipePath = path.join(recipeDir, "recipe.json");
    writeFileSync(recipePath, JSON.stringify(recipe) + "\n");
    await expect(packAssets({
      recipePath, outRoot: path.join(base, "out"), transport: { baseUrl: "http://stub.invalid", apiKey: "stub" },
      imageTransport: { protocol: "openai", baseUrl: "http://stub.invalid", apiKey: "stub" },
      reuseFrom: path.join(base, "nope"),
    })).rejects.toThrow(/manifest/);
  });
});
