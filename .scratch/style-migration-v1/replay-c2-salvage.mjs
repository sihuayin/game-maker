// C2 已付费图的免费抢救重放：idle 4 + run 12，零上游。
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../..");
const A = await import(pathToFileURL(path.join(ROOT, "packages/assets/dist/index.js")).href);
const C = await import(pathToFileURL(path.join(ROOT, "packages/contracts/dist/index.js")).href);
const { buildAssetPack, decodePNG } = A;
const { parseRecipe } = C;
const RUN = path.join(HERE, "runs/2026-10-18d/ruin-scavenger-extraction-assets/run/v1");
const SRC = path.join(HERE, "runs/2026-10-18f-salvage/src");
const OUT = path.join(HERE, "runs/2026-10-18f-salvage");
const recipe = JSON.parse(fs.readFileSync(path.join(RUN, "probe-player-recipe.json"), "utf8"));
for (const a of recipe.assets) {
  a.spec.animations = a.spec.animations.filter((x) => x.name !== "jump");
  for (const x of a.spec.animations) if (x.name === "run") x.frames = 12;
}
const parsed = parseRecipe(recipe);
if (!parsed.ok) throw new Error(parsed.errors.join(" / "));
const style = JSON.parse(fs.readFileSync(path.join(RUN, "stylespec.json"), "utf8"));
const dna = JSON.parse(fs.readFileSync(path.join(RUN, "character-dna.json"), "utf8"));
const files = { master: path.join(SRC, "master.png"), idle: path.join(SRC, "idle-strip.png"), run: path.join(SRC, "run-strip.png") };
let n = 0;
const generateImage = async (req) => {
  n += 1;
  const f = req.prompt.includes("母版参考图") ? files.master : req.prompt.includes("「idle") ? files.idle : req.prompt.includes("「run") ? files.run : (() => { throw new Error("unknown"); })();
  const image = decodePNG(fs.readFileSync(f));
  console.log(`replay #${n} ${path.basename(f)} ${image.width}x${image.height}`);
  return { image, call: { protocol: "gemini", requestedSize: `${req.size.w}x${req.size.h}`, ms: 0, attempts: 1, requestedModel: "replay" } };
};
const r = await buildAssetPack({
  recipe: parsed.value, style, recipeDir: RUN, outDir: OUT,
  generate: () => { throw new Error("no drawlist"); },
  generateImage, characterDna: dna, ledger: [], concurrency: { image: 1, text: 1 },
});
console.log(JSON.stringify({ ok: true, packDir: r.packDir, frames: r.manifest.assets.map((a) => [a.id, a.frames.length]) }, null, 2));
