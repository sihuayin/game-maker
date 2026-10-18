// C 已付费图的零上游重放：把 3 张真图走一遍交付处理，产出真实包。
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
const SRC = fs.readdirSync(path.join(HERE, "runs/2026-10-18e/ruin-scavenger-style-probe"))
  .find((n) => n.startsWith("failed-"));
const FAILED = path.join(HERE, "runs/2026-10-18e/ruin-scavenger-style-probe", SRC);
const OUT = path.join(HERE, "runs/2026-10-18e-replay-clean");
const recipe = JSON.parse(fs.readFileSync(path.join(RUN, "probe-player-recipe.json"), "utf8"));
// run 图实测 9 块；重放按 9 帧走，jump 没有图 ⇒ 从重放配方里去掉。
for (const a of recipe.assets) {
  a.spec.animations = a.spec.animations.filter((x) => x.name !== "jump");
  for (const x of a.spec.animations) if (x.name === "run") x.frames = 9;
}
const parsed = parseRecipe(recipe);
if (!parsed.ok) throw new Error(parsed.errors.join(" / "));
const style = JSON.parse(fs.readFileSync(path.join(RUN, "stylespec.json"), "utf8"));
const dna = JSON.parse(fs.readFileSync(path.join(RUN, "character-dna.json"), "utf8"));
const CLEAN = path.join(HERE, "runs/2026-10-18e-replay-clean/src");
const MASTER = path.join(CLEAN, "master-probe-player.png");
const IDLE = path.join(CLEAN, "scavenger-actor.idle.png");
const RUNIMG = path.join(CLEAN, "scavenger-actor.run.png");
let n = 0;
const generateImage = async (req) => {
  n += 1;
  const file = req.prompt.includes("母版参考图") ? MASTER
    : req.prompt.includes("「idle") ? IDLE
    : req.prompt.includes("「run") ? RUNIMG
    : (() => { throw new Error("重放：未知请求 " + req.prompt.slice(0, 40)); })();
  const image = decodePNG(fs.readFileSync(file));
  console.log(`replay #${n} ${path.basename(file)} ${image.width}x${image.height}`);
  return { image, call: { protocol: "gemini", requestedSize: `${req.size.w}x${req.size.h}`, ms: 0, attempts: 1, requestedModel: "replay" } };
};
const ledger = [];
const r = await buildAssetPack({
  recipe: parsed.value, style, recipeDir: RUN, outDir: OUT,
  generate: () => { throw new Error("no drawlist"); },
  generateImage, characterDna: dna, ledger, concurrency: { image: 1, text: 1 },
});
console.log(JSON.stringify({ ok: true, packDir: r.packDir, images: n, frames: r.manifest.assets.map((a) => [a.id, a.frames.length]) }, null, 2));
