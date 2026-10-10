// 票 23 第六跑：把 pack 的判据**原样重放**在本跑落盘的原图上（零上游调用、零成本）。
//
// 为什么需要它：`settled.find(第一个 rejected)` 是按**清单顺序**取的 ⇒ 报出来的是 assets[2]
//   （rubble-hound），这只能证明 **assets[0]/[1]（scavenger/enemy）没 reject**，
//   证不了 assets[3]（wanderer）与后面的。而 pack 段的账（ledger.json）失败时不落盘
//   ⇒ 想知道「帧数核对到底响没响、票 37/38 的判据在真图上是什么读数」，只能拿盘上那些原图重算。
//
// ⚠️ 口径与 `pack.ts:676-791` 逐行对齐：众数色 → 按它抠 → 单帧判「抠掉多数 + 剩余成块」/
//   多帧判「块数 === 声明帧数」；最远背景层**不抠也不判**。
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const RUN = path.join(HERE, "raw/run-out-2026-10-10c/wasteland-scavenger-assets/run/v1");
const BASE = path.resolve(RUN, "../.."); // run-out-.../wasteland-scavenger-assets
// ⚠️ `path.join(RUN, "..")` 会把 ".." **归一化掉**、停在 `run/` 那一层 —— 用 resolve 才上得去。
const FAILED = fs.readdirSync(BASE).find((d) => d.startsWith("failed-"));
const PACK = path.join(BASE, FAILED);

const url = (p) => pathToFileURL(p).href;
const A = path.resolve(HERE, "../../../../packages/assets/dist");
const { decodePNG } = await import(url(path.join(A, "png.js")));
const { dominantOpaqueColor, keyBackground, foregroundBlocks } = await import(url(path.join(A, "import.js")));
const { segmentRowCells } = await import(url(path.join(A, "sheet.js")));

const recipe = JSON.parse(fs.readFileSync(path.join(RUN, "asset-recipe.json"), "utf8"));
const style = JSON.parse(fs.readFileSync(path.join(RUN, "stylespec.json"), "utf8"));
const palette = style.palette;

// —— `keyColorFor(palette)` 的同款复算（pack.ts 用它当**声明色**，只用于报错里那句对照）——
const hexToRgb = (h) => { const s = h.replace("#", ""); return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)); };
const keyColorFor = (p) => {
  // 与契约同款：取色板里最暗（亮度最小）的那个当底。
  let best = p[0], bestL = Infinity;
  for (const c of p) { const [r, g, b] = hexToRgb(c); const l = 0.2126 * r + 0.7152 * g + 0.0722 * b; if (l < bestL) { bestL = l; best = c; } }
  return best;
};
const DECLARED = hexToRgb(keyColorFor(palette));
const TOL = 30;

const load = (rel) => { const p = path.join(PACK, rel); return fs.existsSync(p) ? decodePNG(fs.readFileSync(p)) : null; };
const pct = (x) => `${(x * 100).toFixed(1)}%`;

const rows = [];
const note = (s) => rows.push(s);

// ── 多帧：帧数核对（§四.5 点名要的那条读数）────────────────────────────────
note("=== 多帧 unit：帧数核对（`segmentRowCells`）===");
for (const a of recipe.assets) {
  if (a.source.kind !== "image" || a.spec.kind !== "animation") continue;
  for (const an of a.spec.animations) {
    if (an.frames === 1) continue;
    const img = load(`authoring/generated/${a.spec.id}.${an.name}.png`);
    if (!img) { note(`  ${a.spec.id}.${an.name}  声明 ${an.frames} 帧  · 盘上无图（未派发 / 母版失败）`); continue; }
    const measured = dominantOpaqueColor(img);
    const keyed = keyBackground(img, { tolerance: TOL, colors: [measured.color] });
    const seg = segmentRowCells(img, keyed.image);
    const ok = seg.cells.length === an.frames;
    note(`  ${a.spec.id}.${an.name}  声明 ${an.frames} 帧 · 检出 ${seg.cells.length} 块 · 按众数色抠掉 ${pct(keyed.keyedPixels / (img.width * img.height))}  ${ok ? "✅ 过" : "❌ 会抛「检测到 N 块」"}`);
  }
}

// ── 单帧（非背景）：两条结构判据 ──────────────────────────────────────────
note("");
note("=== 单帧 unit（非背景）：票 37 的两条判据 ===");
for (const a of recipe.assets) {
  if (a.source.kind !== "image") continue;
  const s = a.spec;
  if (s.kind === "background") continue;
  // ⚠️ 判的是 **unit**（`u.frames === 1`），不是**资产** —— 一个资产可以既有单帧动画
  //   （`scavenger.idle`）又有多帧的（`scavenger.walk`）。按资产过滤会把前者整批漏掉。
  const names = s.kind === "animation"
    ? s.animations.filter((x) => x.frames === 1).map((x) => `${s.id}.${x.name}`)
    : [s.id];
  for (const n of names) {
    const img = load(`authoring/generated/${n}.png`);
    if (!img) { note(`  ${n}  盘上无图`); continue; }
    const measured = dominantOpaqueColor(img);
    const keyed = keyBackground(img, { tolerance: TOL, colors: [measured.color] });
    const ratio = keyed.keyedPixels / (img.width * img.height);
    const blocks = foregroundBlocks(keyed.image);
    const declKeyed = keyBackground(img, { tolerance: TOL, colors: [DECLARED] }).keyedPixels;
    note(`  ${n.padEnd(22)} ${String(s.size.w + "x" + s.size.h).padEnd(8)} 抠掉 ${pct(ratio).padStart(6)} ${ratio > 0.5 ? "✅" : "❌"} · 最大块 ${pct(blocks.largestShare).padStart(6)} ${blocks.largestShare >= 0.6 ? "✅" : "❌"} · 块数 ${blocks.areas.length} ［声明色只抠到 ${declKeyed} px］`);
  }
}

// ── 背景层（票 38）───────────────────────────────────────────────────────
note("");
note("=== 背景层（票 38）：最远层不抠、非最远层按众数色抠 ===");
for (const a of recipe.assets) {
  if (a.source.kind !== "image" || a.spec.kind !== "background") continue;
  const ls = a.spec.layers ?? [];
  for (let i = 0; i < ls.length; i++) {
    const n = `bg-wasteland.${ls[i].name ?? ls[i]}`;
    const img = load(`authoring/generated/${n}.png`);
    if (!img) { note(`  [${i}] ${n}  盘上无图`); continue; }
    const measured = dominantOpaqueColor(img);
    const px = img.width * img.height;
    if (i === 0) {
      const wouldKey = keyBackground(img, { tolerance: TOL, colors: [measured.color] });
      note(`  [${i}] ${n.padEnd(22)} 最远层 ⇒ **不抠**  · ［若按众数色抠会抠掉 ${pct(wouldKey.keyedPixels / px)} ⇒ 印证票 38 那条「按它抠 = 把这一层自己抠掉」］`);
    } else {
      const keyed = keyBackground(img, { tolerance: TOL, colors: [measured.color] });
      note(`  [${i}] ${n.padEnd(22)} 非最远层 ⇒ 按众数色抠掉 ${pct(keyed.keyedPixels / px)}（pack 侧**无判据**；只在 site.ts 那条 FILLED 门禁上守）`);
    }
  }
}

const out = rows.join("\n");
fs.writeFileSync(path.join(HERE, "raw/palette-shape/probe-run6.txt"), out);
console.log(out);
