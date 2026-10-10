// 第三次真跑（2026-10-09）那 9 张**已付费**的图：量「我们声明的底色」与「模型真画的底色」差多远。
//
// ⚠️ 它读的是本目录里那 9 张 PNG 的**副本** —— 原现场 `../run-out/.../failed-2026-10-09T18-30-06-008Z/`
//   会被下一次真跑（`run.mjs` 开头的 `rmSync(OUT)`）整个删掉，而 `*.png` 在 `.gitignore` 里
//   ⇒ **下一次跑之前不复制出来，这批读数就没了**（第二次真跑那 10 张就是这么没的）。
//
// 跑法：node measure-key-colour.mjs   （只依赖 packages/assets/dist 的 decodePNG）
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const { decodePNG } = await import("/Volumes/shy/some-projects/game-maker/packages/assets/dist/index.js");
const DIR = path.dirname(fileURLToPath(import.meta.url));
/** 提示词里逐字要求的那一个（`keyColorFor(palette)` 在本轮色板下返回它）。 */
const DECLARED = [255, 0, 255];
const l1 = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
/** 每张图提示词里写的格数（`整张图共 N 个角色，不多不少`）；非动画是 1。 */
const CELLS = {
  "enemy-patrol.patrol": 4, "scavenger-fail.fail": 4, "scavenger-idle.idle": 2,
  "scavenger-jump.jump": 3, "scavenger-run.run": 4,
  "treasure-chest": 1, "wasteland-skyline.sky": 1, "master-enemy": 1, "master-scavenger": 1,
};
for (const [name, cells] of Object.entries(CELLS)) {
  const { width: w, height: h, data } = decodePNG(readFileSync(path.join(DIR, `${name}.png`)));
  const at = (x, y) => { const o = (y * w + x) * 4; return [data[o], data[o + 1], data[o + 2]]; };
  const counts = new Map();
  let nearest = Infinity, nearestC = null, opaque = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] < 128) continue;
    opaque++;
    const c = at(x, y); const k = c.join(",");
    counts.set(k, (counts.get(k) ?? 0) + 1);
    const d = l1(c, DECLARED); if (d < nearest) { nearest = d; nearestC = c; }
  }
  const modeK = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const mode = modeK.split(",").map(Number);
  const frac = (c, T) => { let n = 0; for (const [k, v] of counts) if (l1(k.split(",").map(Number), c) <= T) n += v; return +(100 * n / opaque).toFixed(1); };
  // 四角：沿对角线往里走，第一个不透明像素（`import.ts` 的 `opaqueFrom(2,2,1,1)` 形状）
  const corner = (x0, y0, dx, dy) => { for (let i = 0; i < Math.min(w, h); i++) { const x = x0 + dx * i, y = y0 + dy * i;
    if (x < 0 || y < 0 || x >= w || y >= h) break; const p = at(x, y); if (data[(y * w + x) * 4 + 3] >= 128) return p; } return at(x0, y0); };
  const corners = [corner(2, 2, 1, 1), corner(w - 3, 2, -1, 1), corner(2, h - 3, 1, -1), corner(w - 3, h - 3, -1, -1)];
  const sweep = [30, 60, 90, 120, 150, 180, 200].map((T) => `T${T}:${frac(DECLARED, T)}%`).join(" ");
  console.log(`\n${name}.png  ${w}×${h}  ${cells} 格`);
  console.log(`  声明的是 [${DECLARED}]  画面里离它最近的像素 [${nearestC}] L1=${nearest}`);
  console.log(`  众数色 [${mode}]  占全图 ${(100 * counts.get(modeK) / opaque).toFixed(1)}%（本体素的 ${frac(mode, 0)}% 是它自己）· 众数色 T30 覆盖率 ${frac(mode, 30)}%`);
  console.log(`  四角（对角内缩）[${corners.map((c) => c.join(",")).join("] [")}]  →  各自 T30 覆盖率 ${corners.map((c) => frac(c, 30) + "%").join(" / ")}`);
  console.log(`  按声明色抠（容差扫描，占不透明像素的%）: ${sweep}`);
  if (cells > 1) {
    const cw = w / cells;
    const per = [];
    for (let i = 0; i < cells; i++) {
      const x0 = Math.round(i * cw), x1 = Math.round((i + 1) * cw);
      const c = new Map();
      for (let y = 0; y < h; y++) for (let x = x0; x < x1; x++) { const k = at(x, y).join(","); c.set(k, (c.get(k) ?? 0) + 1); }
      const mk = [...c.entries()].sort((a, b) => b[1] - a[1])[0][0];
      per.push(`格${i} [${mk}] ΔL1(整图众数)=${l1(mk.split(",").map(Number), mode)}`);
    }
    console.log(`  逐格众数: ${per.join("  ·  ")}`);
  }
}
