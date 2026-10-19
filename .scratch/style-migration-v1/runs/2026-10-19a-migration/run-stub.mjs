// 票 09：迁移配方的零上游桩跑。
//   1) 全量迁移配方过 parseRecipe（19 条）
//   2) 只跑 7 条 import + 3 条 drawlist（10 条）—— 桩 drawlist 生成器，无生图端口
//   3) 包过 verifyPack
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const A = await import(pathToFileURL(path.join(ROOT, "packages/assets/dist/index.js")).href);
const C = await import(pathToFileURL(path.join(ROOT, "packages/contracts/dist/index.js")).href);
const { buildAssetPack, verifyPack } = A;
const { parseRecipe } = C;

const fullRaw = JSON.parse(fs.readFileSync(path.join(HERE, "asset-recipe.json"), "utf8"));
const stubRaw = JSON.parse(fs.readFileSync(path.join(HERE, "asset-recipe.stub.json"), "utf8"));
const full = parseRecipe(fullRaw);
if (!full.ok) throw new Error("全量迁移配方不过 parseRecipe: " + full.errors.join(" / "));
const stub = parseRecipe(stubRaw);
if (!stub.ok) throw new Error("桩跑配方不过 parseRecipe: " + stub.errors.join(" / "));
const style = JSON.parse(fs.readFileSync(path.join(HERE, "stylespec.json"), "utf8"));

/** 与 packages/assets/tests/pack.test.ts 同款桩：确定性色块，零上游。 */
const stubDrawLists = (spec) => {
  const n = spec.kind === "animation"
    ? spec.animations.reduce((s, a) => s + a.frames, 0)
    : 1;
  return Array.from({ length: n }, (_, i) => ({
    format: "drawlist+curve/v1", id: spec.id, frame: `f${i}`,
    viewBox: [0, 0, spec.size.w, spec.size.h], expectedSize: [spec.size.w, spec.size.h],
    ops: [
      { op: "rect", x: 0, y: 0, w: spec.size.w, h: spec.size.h, fill: `palette:${i % 5}` },
      { op: "rect", x: 1, y: 1, w: Math.max(1, spec.size.w - 2), h: 2, fill: "palette:1" },
    ],
  }));
};

const result = await buildAssetPack({
  recipe: stub.value,
  style,
  recipeDir: HERE,
  outDir: path.join(HERE, "stub-out"),
  generate: stubDrawLists,
  sourceDateEpoch: 1792454400,   // 2026-10-19 固定 epoch
  concurrency: { image: 1, text: 1 },
});

const verified = verifyPack({ packDir: result.packDir });
const manifest = JSON.parse(fs.readFileSync(path.join(result.packDir, "manifest.json"), "utf8"));
const summary = manifest.assets.map((a) => ({
  id: a.id, kind: a.kind, origin: a.origin, paletteBinding: a.paletteBinding,
  size: a.size, frames: a.frames.length,
}));

console.log(JSON.stringify({
  ok: true,
  fullRecipeAssets: full.value.assets.length,
  stubRecipeAssets: stub.value.assets.length,
  packDir: result.packDir,
  verify: verified.data,
  audit: result.audit,
  imageCalls: result.imageCalls.length,
  assets: summary,
}, null, 2));
