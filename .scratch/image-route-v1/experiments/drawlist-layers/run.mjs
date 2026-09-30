// **票 02 漏掉的那一半**：`assetTask`（drawlist 那条路）也读了 `layers[].description` ——
// 而那条路**本来就跑得通**，我改了它的提示词**却没量过**。
//
// ⚠️ 这条路上覆盖率是**能读的**（与生图那条不同）：drawlist 由自己的光栅化器画，
//   没有「抠图底色」那一环，透明与不透明都是精确的。
//
//   node .scratch/image-route-v1/experiments/drawlist-layers/run.mjs
//
// 两个臂走同一份模板、同一个上游、同一组参数，唯一差别是那三句话在不在。
// 一次 1 笔文本调用（一个资源一次画完三层）。**要花钱**，所以它不住 CI。
import fs from "node:fs";
import { buildAssetPack, createDrawListGenerator } from "../../../../packages/assets/dist/index.js";

const ROOT = new URL("../../../../", import.meta.url).pathname;
const style = JSON.parse(fs.readFileSync(ROOT + "fixtures/style-spec.halt-dusk.json", "utf8"));
const bg = JSON.parse(fs.readFileSync(ROOT + "fixtures/recipes/last-train-image.json", "utf8"))
  .assets.find((a) => a.spec.id === "bg-dusk-halt").spec;

const baseUrl = process.env.ANTHROPIC_BASE_URL, apiKey = process.env.ANTHROPIC_AUTH_TOKEN;
if (!baseUrl || !apiKey) { console.error("缺文本上游凭据（ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN）"); process.exit(1); }

const outDir = ROOT + "out/__drawlist-layers";
fs.mkdirSync(outDir, { recursive: true });

const N = Number(process.argv[2] ?? 3);      // ⚠️ **一次采样不是一次测量**（票 05 的教训）
const rows = { control: [], treatment: [] };

// ⚠️ **`--from-disk`：不再花钱，把磁盘上已有的那几包重新汇一版表** ——
//   它的用途只有一个：**证明 README 那张表是从这些包算出来的**（量一次要留一份能再量的）。
//   我第一版把这个脚本写错过一处（`l.name`，而 `LayerCoverage` 里叫 `frame`），
//   于是它印出一行 `undefined` —— 而 README 那张表是**另写一段代码**从磁盘上汇出来的。
//   那一版教训写在这里：**表必须能从入库的脚本里再算一遍**。
if (process.argv.includes("--from-disk")) {
  // ⚠️ **逐个 `pack/v<N>` 读，而且按版本分开报** —— 提示词改过一次，v1 与 v2 是**两套提示词**下的数，
  //   混成一张表就是拿两次不同的实验当一次（`pack` 永不覆盖，所以两版都在磁盘上）。
  const byVersion = new Map();
  for (const arm of ["control", "treatment"])
    for (const d of fs.readdirSync(outDir).filter((x) => x.startsWith(`dl-${arm}`))) {
      const pdir = `${outDir}/${d}/pack`;
      if (!fs.existsSync(pdir)) continue;
      for (const v of fs.readdirSync(pdir).filter((x) => /^v\d+$/.test(x))) {
        const f = `${pdir}/${v}/coverage.json`;
        if (!fs.existsSync(f)) continue;
        const key = `${arm} ${v}`;
        if (!rows[key]) rows[key] = [];
        rows[key].push(Object.fromEntries(JSON.parse(fs.readFileSync(f, "utf8")).layers.map((l) => [l.frame, l.ratio])));
      }
    }
  report();
  process.exit(0);
}

for (const arm of ["control", "treatment"]) for (let rep = 0; rep < N; rep++) {
  const withDesc = bg.layers;
  const layers = arm === "control" ? withDesc.map(({ description, ...r }) => r) : withDesc;
  const r = await buildAssetPack({
    recipe: { format: "asset-recipe/v1", id: `dl-${arm}-${rep}`, styleRef: "x",
      assets: [{ spec: { ...bg, layers }, source: { kind: "drawlist" } }] },
    style, outDir, recipeDir: ROOT,
    generate: createDrawListGenerator({ baseUrl, apiKey }),
  });
  const cov = JSON.parse(fs.readFileSync(`${r.packDir}/coverage.json`, "utf8"));
  rows[arm].push(Object.fromEntries(cov.layers.map((l) => [l.frame, l.ratio])));   // ⚠️ `frame` 不是 `name`
}

report();

/** 汇总：每一层把**每一次**的数都列出来 —— **不取平均**（求平均是在拿噪声当结论）。 */
function report() {
  for (const key of [...Object.keys(rows)].filter((k) => rows[k].length > 0).sort()) {
    const names = [...new Set(rows[key].flatMap((r) => Object.keys(r)))].sort();
    console.log(`\n── ${key}（${rows[key].length} 个样本）`);
    for (const n of names)
      console.log(`  ${n.replace("bg-dusk-halt.", "").padEnd(9)} ` +
        rows[key].map((r) => `${(100 * r[n]).toFixed(1)}%`).join(" / "));
  }
  console.log("\n判据（票 50）：最远那层要 ≥99.9%，其余两层要 <99.9%。");
  console.log("参照：out/last-train/pack/v17（真跑出来的那一包）：sky 100% · wall 42.2% · ground 14.1%。");
}
