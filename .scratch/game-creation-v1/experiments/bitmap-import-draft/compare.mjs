// 票 23 的原型：一张**人工导入的真实位图** → 目标像素网格，三种降采样策略并排对比。
//
// 素材是 experiments/bitmap-asset-via-wan/player_with_reference.png：
// 1024×1024、**没有整数像素网格**（边缘位置均匀分布）、61152 种颜色、背景不透明且有渐变噪点。
// 所以这里做的不是「重采样回原网格」，是**重建**一个网格 —— 像素化，而不是缩放。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const A = "../../../../packages/assets/dist/index.js";
const { decodePNG, encodePNG, quantizeToPalette, emptyImage, inkBBox, paletteExactness } = await import(A);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "../../../../fixtures/import/wan-player-1024.png");
const SS = JSON.parse(fs.readFileSync(path.resolve(HERE, "../style-transfer-from-test-png/stylespec.json"), "utf8"));
const PALETTE = SS.palette.map((h) => h.toLowerCase());
const OUT = path.resolve(HERE, "out");

const at = (img, x, y) => { const s = (y * img.width + x) * 4; return [img.data[s], img.data[s + 1], img.data[s + 2], img.data[s + 3]]; };
const set = (img, x, y, c) => { const s = (y * img.width + x) * 4; img.data[s] = c[0]; img.data[s + 1] = c[1]; img.data[s + 2] = c[2]; img.data[s + 3] = c[3]; };

// ── 1. 背景 → alpha。背景是**有噪点的近纯色**，所以只能按容差抠，不能判等 ──────────
function keyBackground(img, tolerance = 30) {
  const corners = [[2, 2], [img.width - 3, 2], [2, img.height - 3], [img.width - 3, img.height - 3]].map(([x, y]) => at(img, x, y));
  const out = { width: img.width, height: img.height, data: Buffer.from(img.data) };
  let keyed = 0;
  for (let i = 0; i < img.width * img.height; i++) {
    const s = i * 4;
    const d = Math.min(...corners.map((c) => Math.abs(img.data[s] - c[0]) + Math.abs(img.data[s + 1] - c[1]) + Math.abs(img.data[s + 2] - c[2])));
    if (d <= tolerance) { out.data[s + 3] = 0; keyed++; }
  }
  return { image: out, background: corners[0].slice(0, 3), keyed };
}

const crop = (img, box) => {
  const out = emptyImage(box.w, box.h);
  for (let y = 0; y < box.h; y++) img.data.copy(out.data, y * box.w * 4, ((box.y + y) * img.width + box.x) * 4, ((box.y + y) * img.width + box.x + box.w) * 4);
  return out;
};

// ── 2. 三种降采样策略 ────────────────────────────────────────────────────────
/** A 最近邻抽样：每格取左上角那个源像素。快，但源图有抗锯齿时会采到边缘的过渡色。 */
function downscaleNearest(img, W, H) {
  const out = emptyImage(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    set(out, x, y, at(img, Math.min(img.width - 1, Math.floor((x * img.width) / W)), Math.min(img.height - 1, Math.floor((y * img.height) / H))));
  return out;
}
/** B 面积平均：格内 RGB 加权平均。对照片自然，对像素画会把前景与背景混在一起。 */
function downscaleArea(img, W, H) {
  const out = emptyImage(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sx0 = Math.floor((x * img.width) / W), sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * img.width) / W));
    const sy0 = Math.floor((y * img.height) / H), sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * img.height) / H));
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let sy = sy0; sy < sy1; sy++) for (let sx = sx0; sx < sx1; sx++) {
      const c = at(img, sx, sy);
      const w = c[3] / 255;                       // **按 alpha 加权**，否则透明区会把颜色拉黑
      r += c[0] * w; g += c[1] * w; b += c[2] * w; a += c[3]; n++; if (w > 0) a += 0;
    }
    const sumW = (() => { let s = 0; for (let sy = sy0; sy < sy1; sy++) for (let sx = sx0; sx < sx1; sx++) s += at(img, sx, sy)[3] / 255; return s; })();
    const meanA = a / n;
    set(out, x, y, sumW > 0 ? [Math.round(r / sumW), Math.round(g / sumW), Math.round(b / sumW), Math.round(meanA)] : [0, 0, 0, 0]);
  }
  return out;
}
/** C 色板投票：格内每个像素先映到最近色板色，取众数。**不平均** —— 像素画的边界是硬的。 */
function downscalePaletteVote(img, W, H, palette) {
  const pal = palette.map((h) => { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; });
  const out = emptyImage(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sx0 = Math.floor((x * img.width) / W), sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * img.width) / W));
    const sy0 = Math.floor((y * img.height) / H), sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * img.height) / H));
    const votes = new Array(pal.length).fill(0);
    let opaque = 0, total = 0;
    for (let sy = sy0; sy < sy1; sy++) for (let sx = sx0; sx < sx1; sx++) {
      const c = at(img, sx, sy); total++;
      if (c[3] < 128) continue;
      opaque++;
      let best = 0, bestD = Infinity;
      for (let k = 0; k < pal.length; k++) { const d = (c[0] - pal[k][0]) ** 2 + (c[1] - pal[k][1]) ** 2 + (c[2] - pal[k][2]) ** 2; if (d < bestD) { bestD = d; best = k; } }
      votes[best]++;
    }
    if (opaque * 2 < total) { set(out, x, y, [0, 0, 0, 0]); continue; }
    const k = votes.indexOf(Math.max(...votes));
    set(out, x, y, [pal[k][0], pal[k][1], pal[k][2], 255]);
  }
  return out;
}

// ── 3. 跑一遍，出并排对比图 ─────────────────────────────────────────────────
const src = decodePNG(fs.readFileSync(SRC));
const keyed = keyBackground(src, 30);
const box = inkBBox(keyed.image);
const sprite = crop(keyed.image, box);
console.log(`源图 ${src.width}×${src.height} · 抠背后前景包围盒 ${box.w}×${box.h} · 关键色 ${keyed.background.join(",")} · 抠掉 ${keyed.keyed} 像素`);

const TARGET_H = 48;
const TARGET_W = Math.round((box.w / box.h) * TARGET_H);
console.log(`目标网格 ${TARGET_W}×${TARGET_H}（按包围盒长宽比）· 降采样倍率 ≈ ${(box.h / TARGET_H).toFixed(1)}×\n`);

const strategies = [
  ["A 最近邻", (i, w, h) => downscaleNearest(i, w, h)],
  ["B 面积平均", (i, w, h) => downscaleArea(i, w, h)],
  ["C 色板投票", (i, w, h) => downscalePaletteVote(i, w, h, PALETTE)],
];

// 两行：上 = 量化到世界色板（paletteBinding: quantized），下 = 保留自己的颜色（unbound）
const grid = strategies.map(([name, fn]) => {
  const small = fn(sprite, TARGET_W, TARGET_H);
  const quantized = name.startsWith("C") ? small : quantizeToPalette(small, PALETTE);
  return { name, quantized, unbound: small };
});

const SCALE = 8, PAD = 16, LABEL = 22, ROWGAP = 30;
const cellW = TARGET_W * SCALE, cellH = TARGET_H * SCALE;
const W = PAD + grid.length * (cellW + PAD);
const H = PAD + (LABEL + cellH + ROWGAP) * 2 + PAD;
const sheet = emptyImage(W, H);
for (let i = 0; i < W * H; i++) set(sheet, i % W, Math.floor(i / W), [24, 28, 31, 255]);

const drawCell = (img, ox, oy) => {
  for (let y = 0; y < TARGET_H; y++) for (let x = 0; x < TARGET_W; x++) {
    const c = at(img, x, y);
    if (c[3] === 0) continue;
    // ⚠️ 必须按 alpha-over 合成到联系表的底色上。
    // 直接写 alpha<255 的像素，看图器会合成到**白底**上 —— 半透明边缘看起来像一圈白边，
    // 那是渲染假象，不是策略的效果（第一版就踩了这个坑）。
    const a = c[3] / 255, bgc = [24, 28, 31];
    const comp = [0, 1, 2].map((k) => Math.round(c[k] * a + bgc[k] * (1 - a)));
    for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++) set(sheet, ox + x * SCALE + dx, oy + y * SCALE + dy, [...comp, 255]);
  }
};

const rowY = [PAD + LABEL, PAD + LABEL + cellH + ROWGAP + LABEL];
grid.forEach((g, i) => {
  const ox = PAD + i * (cellW + PAD);
  drawCell(g.quantized, ox, rowY[0]);
  drawCell(g.unbound, ox, rowY[1]);
  const ex = paletteExactness(g.quantized, PALETTE);
  const own = new Set();
  for (let k = 0; k < TARGET_W * TARGET_H; k++) { const s2 = k * 4; if (g.unbound.data[s2 + 3]) own.add(`${g.unbound.data[s2]},${g.unbound.data[s2 + 1]},${g.unbound.data[s2 + 2]}`); }
  console.log(`  ${g.name.padEnd(10)} 量化后色板外 ${ex.offPalette.length} 种 · 不量化时自带 ${own.size} 种颜色`);
});

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "compare.png"), encodePNG(sheet));
grid.forEach((g, i) => {
  fs.writeFileSync(path.join(OUT, `strategy-${"ABC"[i]}-quantized.png`), encodePNG(g.quantized));
  fs.writeFileSync(path.join(OUT, `strategy-${"ABC"[i]}-unbound.png`), encodePNG(g.unbound));
});
console.log(`\n→ out/compare.png  · 上排 = 量化到世界色板，下排 = 保留自带颜色（unbound）`);
console.log(`→ out/strategy-{A,B,C}-{quantized,unbound}.png（1× ${TARGET_W}×${TARGET_H}）`);
