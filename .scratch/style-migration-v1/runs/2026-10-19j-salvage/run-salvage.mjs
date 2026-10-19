// 票 18：零付费复用失败现场的 66 张原图 + 3 个 drawlist，重建包。
//   ⚠️ 两个上游桩都会抛：任何「复用缺文件」都必须当场失败，不许偷偷重发。
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const A = await import(pathToFileURL(path.join(ROOT, "packages/assets/dist/index.js")).href);
const C = await import(pathToFileURL(path.join(ROOT, "packages/contracts/dist/index.js")).href);
const { buildAssetPack, verifyPack } = A;
const { parseRecipe } = C;

const FRAME_RUN = path.resolve(HERE, "../2026-10-19i-real-frames/ruin-scavenger-extraction-assets");
const FAILED = fs.readdirSync(FRAME_RUN).find((d) => d.startsWith("failed-"));
if (!FAILED) throw new Error("找不到失败现场");
const REUSE = path.join(FRAME_RUN, FAILED);
const OUT = HERE;
const FINAL = path.join(OUT, "ruin-scavenger-extraction-assets", "pack", "v1");
if (fs.existsSync(FINAL)) { console.error("包已存在，拒绝覆盖：" + FINAL); process.exit(2); }

const parsed = parseRecipe(JSON.parse(fs.readFileSync(path.join(HERE, "asset-recipe.json"), "utf8")));
if (!parsed.ok) throw new Error("配方不过 parseRecipe：" + parsed.errors.join(" / "));
const style = JSON.parse(fs.readFileSync(path.join(HERE, "stylespec.json"), "utf8"));
const dna = JSON.parse(fs.readFileSync(path.join(HERE, "character-dna.json"), "utf8"));
const world = JSON.parse(fs.readFileSync(path.join(HERE, "visual-world.json"), "utf8"));

const ledger = [];
const result = await buildAssetPack({
  recipe: parsed.value, style, outDir: OUT, recipeDir: HERE,
  reuseFrom: REUSE,
  generate: () => { throw new Error("salvage：drawlist 复用缺文件，拒绝调用文本上游"); },
  generateImage: async () => { throw new Error("salvage：生图复用缺文件，拒绝调用生图上游"); },
  characterDna: dna, visualWorld: world, ledger,
  sourceDateEpoch: 1792454400, concurrency: { image: 1, text: 1 },
});
const verified = verifyPack({ packDir: result.packDir });
const out = {
  ok: verified.data.ok === true,
  packDir: result.packDir,
  verify: verified.data,
  imageCalls: result.imageCalls.length,
  ledgerCalls: ledger.length,
  assets: result.manifest.assets.map((a) => ({ id: a.id, kind: a.kind, frames: a.frames.length })),
};
fs.writeFileSync(path.join(HERE, "salvage-result.json"), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 2));
if (out.ok !== true) process.exit(1);
