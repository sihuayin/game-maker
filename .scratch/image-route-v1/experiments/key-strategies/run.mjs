// **票 03 的那一问**：声明色抠不掉，那换成别的策略行不行？
//
// ⚠️ **它不花钱、不调上游** —— 数据全在磁盘上（过往真跑留下的生图原图）。
//   三个候选各自套上去，量同一个数：**抠掉了多少**。
//
//   node .scratch/image-route-v1/experiments/key-strategies/run.mjs
//
// 判据的眼睛是两只：
//   · **最远那层**：抠掉得越少越好（它后面没有东西，抠掉的就是**内容**）；
//   · **其余层**：抠掉的应当正好是「这一层没画东西的地方」—— 一个像素都抠不掉就是失败。
import fs from "node:fs";
import path from "node:path";
import { decodePNG, keyBackground } from "../../../../packages/assets/dist/index.js";

const ROOT = new URL("../../../../", import.meta.url).pathname;
const KEY = [255, 0, 255];                      // #ff00ff —— 提示词里逐字要求的那一个
const TOL = 40;                                 // 曼哈顿距离，与 pack 对背景层用的同一个

const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

/** 图里出现最多的那个颜色（粗量化到 4 一档，免得抗锯齿把计数打散）。 */
function dominant(img) {
  const counts = new Map();
  for (let i = 0; i < img.width * img.height; i++) {
    const s = i * 4;
    const k = `${img.data[s] >> 2},${img.data[s + 1] >> 2},${img.data[s + 2] >> 2}`;
    const e = counts.get(k) ?? { n: 0, c: [img.data[s], img.data[s + 1], img.data[s + 2]] };
    e.n += 1; counts.set(k, e);
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0].c;
}

const rows = [];
for (const packRoot of fs.readdirSync(path.join(ROOT, "out"))) {
  const packsDir = path.join(ROOT, "out", packRoot, "pack");
  if (!fs.existsSync(packsDir)) continue;
  for (const v of fs.readdirSync(packsDir)) {
    const dir = path.join(packsDir, v);
    const manPath = path.join(dir, "manifest.json");
    const genDir = path.join(dir, "authoring", "generated");
    if (!fs.existsSync(manPath) || !fs.existsSync(genDir)) continue;
    const man = JSON.parse(fs.readFileSync(manPath, "utf8"));
    for (const a of man.assets) {
      if (a.kind !== "background" || !a.layers) continue;
      for (const [i, layer] of a.layers.entries()) {
        const f = `${a.id}.${layer.name}.png`;
        const p = path.join(genDir, f);
        if (!fs.existsSync(p)) continue;
        const img = decodePNG(fs.readFileSync(p));
        const total = img.width * img.height;
        const declared = keyBackground(img, { tolerance: TOL, colors: [KEY] });
        const corners = keyBackground(img, { tolerance: TOL });
        const dom = dominant(img);
        const byDom = keyBackground(img, { tolerance: TOL, colors: [dom] });
        rows.push({
          src: `${packRoot}/pack/${v}`, frame: f, farthest: i === 0,
          declared: declared.keyedPixels / total, corners: corners.keyedPixels / total,
          dom: byDom.keyedPixels / total, domColor: hex(dom), domDist: dist(dom, KEY),
        });
      }
    }
  }
}

const pc = (x) => (100 * x).toFixed(1).padStart(5) + "%";
console.log(`${rows.length} 张背景层原图（全部来自真跑，磁盘上现成的）\n`);
console.log("框里的是**最远那层**（它抠掉得越少越好）：\n");
console.log("  层                                  声明色  四角取样  出现最多的色（到 #ff00ff 的距离）");
for (const r of rows.sort((a, b) => Number(b.farthest) - Number(a.farthest))) {
  const mark = r.farthest ? "▣" : " ";
  console.log(`  ${mark} ${r.frame.padEnd(34)} ${pc(r.declared)}  ${pc(r.corners)}   ${r.domColor}  (${String(r.domDist).padStart(4)}) → ${pc(r.dom)}`);
}
const far = rows.filter((r) => r.farthest), near = rows.filter((r) => !r.farthest);
console.log(`\n汇总：`);
console.log(`  最远层 ${far.length} 张 · 声明色中位 ${pc(far.map(r=>r.declared).sort()[far.length>>1] ?? 0)} · ` +
  `四角取样中位 ${pc(far.map(r=>r.corners).sort()[far.length>>1] ?? 0)}`);
console.log(`  其余层 ${near.length} 张 · 声明色抠掉 0 的 ${near.filter(r=>r.declared===0).length} 张 · ` +
  `出现最多的色离 #ff00ff 中位 ${near.map(r=>r.domDist).sort()[near.length>>1] ?? "-"}`);
