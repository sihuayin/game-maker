// 等分切不动这个 sheet —— 那就**按检测到的墨迹间隙切**。
// 行内取一列一列的墨量，零墨的连续区间就是角色之间的缝。
import fs from "node:fs";
const ROOT = "/Volumes/shy/some-projects/game-maker/";
const { decodePNG, keyBackground, inkBBox, cropToBox, encodePNG, emptyImage } = await import(ROOT + "packages/assets/dist/index.js");
const OUT = ROOT + ".scratch/game-creation-v1/experiments/master-to-animation/out/";

/** 按竖直方向的墨迹间隙把一行图切成若干块。返回每块在本图上的矩形。 */
function segmentRow(img, { minGap = 8 } = {}) {
  const colInk = [];
  for (let x = 0; x < img.width; x++) {
    let n = 0;
    for (let y = 0; y < img.height; y++) if (img.data[(y * img.width + x) * 4 + 3] !== 0) { n++; break; }
    colInk.push(n);
  }
  const segs = [];
  let start = -1, gap = 0;
  for (let x = 0; x < img.width; x++) {
    if (colInk[x] === 0) { if (start >= 0 && ++gap >= minGap) { segs.push([start, x - gap]); start = -1; gap = 0; } }
    else { if (start < 0) start = x; gap = 0; }
  }
  if (start >= 0) segs.push([start, img.width - 1]);
  return segs.map(([x0, x1]) => {
    let y0 = Infinity, y1 = -Infinity;
    for (let y = 0; y < img.height; y++) for (let x = x0; x <= x1; x++)
      if (img.data[(y * img.width + x) * 4 + 3] !== 0) { if (y < y0) y0 = y; if (y > y1) y1 = y; break; }
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  });
}

const headRatio = (cell) => {
  const b = inkBBox(cell); let lo = Infinity, hi = -Infinity;
  for (let y = b.y; y < b.y + Math.max(1, Math.round(b.h * 0.3)); y++)
    for (let x = 0; x < cell.width; x++)
      if (cell.data[(y * cell.width + x) * 4 + 3] !== 0) { if (x < lo) lo = x; if (x > hi) hi = x; }
  return { hw: hi - lo + 1, bh: b.h, bw: b.w };
};

const out = {};
for (const name of ["idle", "run", "jump"]) {
  const raw = decodePNG(fs.readFileSync(`${OUT}${name}-sheet.png`));
  const k = keyBackground(raw, { tolerance: 40 }).image;
  const segs = segmentRow(k);
  const cells = segs.map((b) => cropToBox(k, b));
  const m = cells.map(headRatio);
  console.log(`${name}: 等分该有 ${name === "run" ? 6 : 4} 帧，**检测到 ${segs.length} 块**`);
  console.log(`   逐帧：身高 ${m.map((x) => x.bh).join(" ")}   头宽 ${m.map((x) => x.hw).join(" ")}`);
  console.log(`   身高极差 ${Math.max(...m.map((x) => x.bh)) - Math.min(...m.map((x) => x.bh))}   头宽极差 ${Math.max(...m.map((x) => x.hw)) - Math.min(...m.map((x) => x.hw))}`);
  out[name] = { detected: segs.length, expected: name === "run" ? 6 : 4, heights: m.map((x) => x.bh), headWidths: m.map((x) => x.hw) };
  // 拼成联系表
  const h = Math.max(...cells.map((c) => c.height));
  const sheet = emptyImage(cells.reduce((s, c) => s + c.width + 8, 0), h);
  let x = 0;
  for (const c of cells) { for (let y = 0; y < c.height; y++) c.data.copy(sheet.data, (y * sheet.width + x) * 4, y * c.width * 4, (y * c.width + c.width) * 4); x += c.width + 8; }
  fs.writeFileSync(`${OUT}${name}-detected.png`, encodePNG(sheet));
}
fs.writeFileSync(`${OUT}segment-report.json`, JSON.stringify(out, null, 2) + "\n");
