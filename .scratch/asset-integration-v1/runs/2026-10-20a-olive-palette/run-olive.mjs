// 票 06：在 v1 的 32 色末尾追加 2 个橄榄槽，复用现有 raw 零付费重建 pack/v2。
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

const REUSE = path.resolve(ROOT, ".scratch/style-migration-v1/runs/2026-10-19k-patch");
if (!fs.existsSync(REUSE)) throw new Error("找不到 raw 复用目录：" + REUSE);
const OUT = HERE;
const VERSION = Number(process.env.PACK_VERSION ?? 2); // 显式给：v1 旧色板；v2 = 2 槽实验；v3 = 1 槽定稿
const FINAL = path.join(OUT, "ruin-scavenger-extraction-assets", "pack", `v${VERSION}`);
if (fs.existsSync(FINAL)) { console.error("包已存在，拒绝覆盖：" + FINAL); process.exit(2); }

const parsed = parseRecipe(JSON.parse(fs.readFileSync(path.join(HERE, "asset-recipe.json"), "utf8")));
if (!parsed.ok) throw new Error("配方不过 parseRecipe：" + parsed.errors.join(" / "));
const STYLE_FILE = process.env.STYLE_FILE ?? "stylespec.json";
const style = JSON.parse(fs.readFileSync(path.join(HERE, STYLE_FILE), "utf8"));
const dna = JSON.parse(fs.readFileSync(path.join(HERE, "character-dna.json"), "utf8"));
const world = JSON.parse(fs.readFileSync(path.join(HERE, "visual-world.json"), "utf8"));

const ledger = [];
const result = await buildAssetPack({
  recipe: parsed.value, style, outDir: OUT, recipeDir: HERE,
  reuseFrom: REUSE, version: VERSION,
  generate: () => { throw new Error("olive 重建：drawlist 复用缺文件，拒绝调用文本上游"); },
  generateImage: async () => { throw new Error("olive 重建：生图复用缺文件，拒绝调用生图上游"); },
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
  palette: { size: result.manifest.palette.size, values: result.manifest.palette.values },
  assets: result.manifest.assets.map((a) => ({ id: a.id, kind: a.kind, frames: a.frames.length })),
};
fs.writeFileSync(path.join(HERE, `olive-result-v${VERSION}.json`), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 2));
if (out.ok !== true) process.exit(1);
