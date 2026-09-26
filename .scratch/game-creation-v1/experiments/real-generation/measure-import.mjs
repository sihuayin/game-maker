// 人工导入位图的**入口体检** —— 在把一张图塞进配方之前先量它值不值得进包。
//
// 为什么需要它：票 23 实测过「一张 1218×685 的场景图量化到 9 色，100% 的非透明像素被改色」。
// 但**改色率在 8 色板上必然饱和到 100%**，它区分不出好坏（本工具 2026-09-25 实测确认）。
// 能区分的是这两个量：
//   · 平均色误差 —— 量化把每个像素平均推远了多远（0~441 的欧氏距离）
//   · 色板覆盖   —— 8 色里用上了几色；只用到 3 色的资源在那个世界里会显得突兀
// 两者都在 32×48 与 64×96 上稳定（实测 8.5% vs 8.8%），所以可以横向比不同图。
//
// 用法：node measure-import.mjs <p.png> [宽x高] [stylespec.json]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const A = "../../../../packages/assets/dist/index.js";
const { decodePNG, importBitmap, inkBBox } = await import(A);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [, , srcArg, sizeArg = "32x48", styleArg] = process.argv;
if (!srcArg) {
  console.error("用法：node measure-import.mjs <p.png> [宽x高=32x48] [stylespec.json]");
  process.exit(2);
}
const src = path.resolve(srcArg);
const [w, h] = sizeArg.split("x").map(Number);
const stylePath = path.resolve(styleArg ?? path.join(HERE, "../../../../fixtures/style-spec.halt-dusk.json"));
const PALETTE = JSON.parse(fs.readFileSync(stylePath, "utf8")).palette.map((c) => c.toLowerCase());

const img = decodePNG(fs.readFileSync(src));
const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
const at = (i, x, y) => { const s = (y * i.width + x) * 4; return [i.data[s], i.data[s + 1], i.data[s + 2], i.data[s + 3]]; };

// ── 源图体检 ──────────────────────────────────────────────────────────────
let opaque = 0, semi = 0, clear = 0;
const srcColors = new Set();
for (let i = 0; i < img.width * img.height; i++) {
  const a = img.data[i * 4 + 3];
  if (a === 0) clear++; else if (a === 255) opaque++; else semi++;
  if (a !== 0) srcColors.add(img.data.slice(i * 4, i * 4 + 3).join(","));
}
const speckle = (() => {                       // 极淡 alpha 的像素数（会撑大包围盒）
  let n = 0;
  for (let i = 0; i < img.width * img.height; i++) { const a = img.data[i * 4 + 3]; if (a > 0 && a < 16) n++; }
  return n;
})();

console.log(`源图 ${path.relative(process.cwd(), src)}  ${img.width}×${img.height}`);
console.log(`  完全透明 ${clear} · 不透明 ${opaque} · 半透明 ${semi} · 前景色数 ${srcColors.size}`);
console.log(`  ⚠️ 极淡 alpha 像素（0<a<16）${speckle} 个` +
  (speckle > 0 ? " —— 这些会把包围盒撑到整张画布，见下方「孤点」一栏" : "（无）"));

// ── 包围盒判据：新判据（floor = 二值化阈值）比旧判据（alpha != 0）裁得对不对 ──
// ⚠️ 不能拿「导入后」的包围盒量：那是角色与孤点的**合并**框，它近乎撑满目标格，
// 看起来「没事」，而角色其实已经被缩到角落里去了。要比的是**源图**上两种判据的差别。
const loose = inkBBox(img);                      // 旧判据：任何非零 alpha 都算墨
const tight = inkBBox(img, { floor: 128 });      // 新判据：只认过得了二值化的像素
if (loose && tight) {
  const sx = tight.w / loose.w, sy = tight.h / loose.h;
  const hurt = sx < 0.97 || sy < 0.97;
  console.log(`  源图包围盒 旧判据 ${loose.w}×${loose.h} → 新判据 ${tight.w}×${tight.h}` +
    (hurt
      ? `  ⚠️ **旧判据会把角色缩到 ${(100 * sx).toFixed(0)}%×${(100 * sy).toFixed(0)}% 大**` +
        `（${w}×${h} 的格子里只剩 ${Math.round(w * sx)}×${Math.round(h * sy)} 给角色）`
      : "  ✅ 两种判据一致"));
  const srcAR = tight.w / tight.h, dstAR = w / h, skew = dstAR / srcAR;
  console.log(`  角色外接矩形长宽比 源 ${srcAR.toFixed(3)} → 目标 ${dstAR.toFixed(3)} · ` +
    (Math.abs(skew - 1) < 0.03 ? "✅ 不变形"
      : `⚠️ 会被${skew < 1 ? "**纵向**拉伸" : "**横向**拉伸"} ${((Math.max(skew, 1 / skew) - 1) * 100).toFixed(0)}%　（提示词里的长宽比要求就该按这个数写）`));
} else {
  console.log("  源图（接近）全透明或全不透明 —— 包围盒没有信息量");
}

// ── 进包后的量化代价 ──────────────────────────────────────────────────────
const r = importBitmap(img, { targetWidth: w, targetHeight: h, palette: PALETTE });
let n = 0, sum = 0, max = 0, changed = 0;
const used = new Map();
for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) {
  const a = at(r.grid, x, y), b = at(r, x, y);
  if (a[3] === 0) continue;
  const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  sum += d; n++; if (d > max) max = d;
  if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2]) changed++;
  used.set(hex([b[0], b[1], b[2]]), (used.get(hex([b[0], b[1], b[2]])) ?? 0) + 1);
}
const cov = [...used.entries()].sort((p, q) => q[1] - p[1]);
console.log(`${w}×${h} 进包后：非透明格 ${n} · 改色率 ${((100 * changed) / n).toFixed(1)}%（⚠️ 该值在 8 色板上恒定 ≈100%，不区分好坏）`);
console.log(`  **平均色误差 ${(sum / n).toFixed(1)} / 441（${((100 * sum) / n / 441).toFixed(1)}%）** · 最大 ${max.toFixed(1)}`);
console.log(`  **色板覆盖 ${cov.length}/${PALETTE.length}** · ${cov.map(([k, v]) => `${k}×${((100 * v) / n).toFixed(0)}%`).join(" ")}`);
const unused = PALETTE.filter((p) => !used.has(p));
if (unused.length) console.log(`  未用到的色板色：${unused.join(" ")}`);
