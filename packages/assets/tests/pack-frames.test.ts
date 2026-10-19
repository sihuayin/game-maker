// 票 17：`source.kind === "frames"` —— **一帧一次调用**，不再靠「一图 N 帧」。
import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import type { AssetRecipe, StyleSpec } from "@game-maker/contracts";
import { buildAssetPack, keyColorFor, verifyPack, type ImageGenerator } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const STYLE: StyleSpec = JSON.parse(readFileSync(ROOT + ".scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json", "utf8"));
const EPOCH = 1790208000;
const dirs: string[] = [];
const tmp = () => { const d = mkdtempSync(path.join(tmpdir(), "pack-frames-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const recipe = (): AssetRecipe => ({
  format: "asset-recipe/v1",
  id: "frames-test",
  styleRef: "unused.json",
  assets: [{
    spec: {
      kind: "animation", id: "hero", role: "测试角色", description: "一个测试角色",
      styleId: "test-style", anchor: { x: 0.5, y: 1 }, size: { w: 16, h: 24 }, required: true,
      animations: [{ name: "idle", frames: 2, fps: 4, loop: true }],
    },
    source: { kind: "frames" },
  }],
});

describe("§ 逐帧源：一帧一次调用（票 17）", () => {
  it("2 帧 = 2 次调用；manifest 有 2 帧且分组正确；每帧原图独立落盘", async () => {
    const prompts: string[] = [];
    const sizes: { w: number; h: number }[] = [];
    const bg = hex(keyColorFor(STYLE.palette));
    const ink = hex(STYLE.palette[0]!);
    const gen: ImageGenerator = async (req) => {
      prompts.push(req.prompt);
      sizes.push(req.size);
      const w = req.size.w * 4, h = req.size.h * 4;
      const data = Buffer.alloc(w * h * 4);
      const put = (x: number, y: number, c: readonly number[]) => {
        const o = (y * w + x) * 4;
        data[o] = c[0]!; data[o + 1] = c[1]!; data[o + 2] = c[2]!; data[o + 3] = 255;
      };
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(x, y, bg);
      for (let y = Math.floor(h * 0.15); y < Math.floor(h * 0.9); y++)
        for (let x = Math.floor(w * 0.25); x < Math.floor(w * 0.75); x++) put(x, y, ink);
      return { image: { width: w, height: h, data }, call: { protocol: "openai", requestedSize: "test", ms: 1, attempts: 1 } };
    };
    const r = await buildAssetPack({
      recipe: recipe(), style: STYLE, outDir: tmp(), recipeDir: ROOT,
      generate: () => { throw new Error("不走 drawlist"); }, generateImage: gen, sourceDateEpoch: EPOCH,
      concurrency: { image: 1, text: 1 },
    });
    expect(r.imageCalls).toHaveLength(2);
    expect(prompts).toHaveLength(2);
    expect(prompts[0]).toContain("第 1 帧 / 共 2 帧");
    expect(prompts[1]).toContain("第 2 帧 / 共 2 帧");
    // ⚠️ 逐帧的画布是**一帧**的尺寸，不是 N 倍宽
    expect(sizes).toEqual([{ w: 16, h: 24 }, { w: 16, h: 24 }]);
    const asset = r.manifest.assets.find((a) => a.id === "hero")!;
    expect(asset.frames).toHaveLength(2);
    expect(asset.animations?.[0]).toMatchObject({ name: "idle", frames: ["hero.idle1", "hero.idle2"] });
    for (const n of ["hero.idle1", "hero.idle2"]) {
      expect(existsSync(path.join(r.packDir, `authoring/generated/${n}.png`))).toBe(true);
      expect(existsSync(path.join(r.packDir, `authoring/generated/${n}.prompt.txt`))).toBe(true);
    }
    expect(verifyPack({ packDir: r.packDir }).data.ok).toBe(true);
  });
});
