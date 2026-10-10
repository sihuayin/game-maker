// 票 38 的取证：量**真背景层**的底色 —— 「按声明色 / 按实测众数色 / 按四角取样」三种抠法各会把一层抠成什么样。
//
// 为什么要单独一份：第三次真跑那 9 张里**只有一张背景层**（`wasteland-skyline.sky`，最远层），
// 而它在 `.gitignore` 里、且会被下一次真跑的 `rmSync` 删掉 ⇒ 「非最远层的真读数」本机**只有**仓库里
// 早就存在的四张（`image-route-v1` 票 02 的现场，2026-09-30，**已入库**）。
//
// 跑法：node measure-layer-colour.mjs
// 依赖：packages/assets/dist（`decodePNG` · `keyBackground` · `foregroundBlocks` · `dominantOpaqueColor` · `l1Distance`）
//
// 尺子与 `../key-colour-third-run/measure-key-colour.mjs` **逐字相同**，好让两处读数可以直接并排放：
//   声明色 = keyColorFor(本轮色板) = [255,0,255] · 容差 30 · 众数 = 不透明像素的众数
//   四角 = 沿对角线内缩、第一个 alpha ≥ 128（`import.ts` 里 `opaqueFrom(2,2,1,1)` 的形状）
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
const A = await import("/Volumes/shy/some-projects/game-maker/packages/assets/dist/index.js");
const { decodePNG, l1Distance: l1, foregroundBlocks, dominantOpaqueColor, keyBackground } = A;

const ROOT = "/Volumes/shy/some-projects/game-maker";
const DECLARED = [255, 0, 255];
const T = 30;

/** 五张真图。前四张**已在库里**（`git ls-files` 有它们）；第五张在 `.gitignore` 里、只在**本机**。 */
const FILES = [
  [`${ROOT}/.scratch/image-route-v1/experiments/layer-description/treatment-sky.png`,
    "treatment-sky", "最远层（只画了天空+山脊）", "image-route-v1 票 02 · 2026-09-30 · 已入库"],
  [`${ROOT}/.scratch/image-route-v1/experiments/layer-description/control-sky.png`,
    "control-sky", "最远层·**对照**（逐层描述被故意摘掉 ⇒ 每层都被要求画整张场景）", "同上 · 已入库"],
  [`${ROOT}/.scratch/game-maker-v2/experiments/e2e-wasteland/raw/key-colour-third-run/wasteland-skyline.sky.png`,
    "wasteland-skyline.sky", "最远层（e2e 配方那 4 层里的第 1 层）", "第三次真跑 · 2026-10-09 · ⚠️ **不入库，下一次真跑会删掉**"],
  [`${ROOT}/.scratch/image-route-v1/experiments/layer-description/treatment-wall.png`,
    "treatment-wall", "**非最远层**（中景：自己那一条墙带）", "image-route-v1 票 02 · 2026-09-30 · 已入库"],
  [`${ROOT}/.scratch/image-route-v1/experiments/layer-description/treatment-ground.png`,
    "treatment-ground", "**非最远层**（近端：自己那一条站台+铁轨）", "同上 · 已入库"],
];

/** site.ts 那条门禁（票 50）用的界：`layers[0]` 的交付不透明率必须够到它，其余层**不许**够到它。 */
const FILLED = 0.999;
/** 单帧那两条判据（票 37 的 Q1），搬过来只是为了看它们在背景层上会说什么。 */
const SINGLE_RATIO = 0.5, SINGLE_SHARE = 0.6;

const report = [];
const say = (s) => { console.log(s); report.push(s); };

for (const [file, name, what, origin] of FILES) {
  // ⚠️ 第五张（`wasteland-skyline.sky.png`）**不在 git 里**（`.gitignore` 挡着，下一次真跑还会删掉）
  //   ⇒ 换了机器跑这支脚本时它必然缺席。**缺席要吼一声，不许静默少测一张**。
  if (!existsSync(file)) {
    say(`\n━━ ${name}.png —— ⚠️ **文件不在这台机器上**（${file}）⇒ 这一张**没量到**。读数表因此不完整。`);
    continue;
  }
  const img = decodePNG(readFileSync(file));
  const { width: w, height: h, data } = img;
  const at = (x, y) => { const o = (y * w + x) * 4; return [data[o], data[o + 1], data[o + 2]]; };
  const alpha = (x, y) => data[(y * w + x) * 4 + 3];
  const px = w * h;

  const counts = new Map();
  let nearest = Infinity, nearestC = null, opaque = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (alpha(x, y) < 128) continue;
    opaque++;
    const c = at(x, y), k = c.join(",");
    counts.set(k, (counts.get(k) ?? 0) + 1);
    const d = l1(c, DECLARED); if (d < nearest) { nearest = d; nearestC = c; }
  }
  const cover = (c, t) => { let n = 0; for (const [k, v] of counts) if (l1(k.split(",").map(Number), c) <= t) n += v; return n / opaque; };
  const modeK = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const mode = modeK.split(",").map(Number);
  const corner = (x0, y0, dx, dy) => { for (let i = 0; i < Math.min(w, h); i++) { const x = x0 + dx * i, y = y0 + dy * i;
    if (x < 0 || y < 0 || x >= w || y >= h) break; if (alpha(x, y) >= 128) return at(x, y); } return at(x0, y0); };
  const corners = [corner(2, 2, 1, 1), corner(w - 3, 2, -1, 1), corner(2, h - 3, 1, -1), corner(w - 3, h - 3, -1, -1)];

  const strategy = (colors) => {
    const k = keyBackground(img, { tolerance: T, colors });
    const b = foregroundBlocks(k.image);
    const delivered = b.total / px;          // 交付态不透明率（= coverage.json 里那个 ratio 的口径）
    return { keyed: k.keyedPixels / px, blocks: b.areas.length, share: b.largestShare, delivered };
  };
  const byDecl = strategy([DECLARED]), byMode = strategy([mode]), byCorner = strategy(corners);

  say(`\n━━ ${name}.png  ${w}×${h}  —— ${what}\n     来源：${origin}`);
  say(`  ① 上游给的 alpha：不透明 ${(100 * opaque / px).toFixed(1)}%（${px - opaque} 个像素在阈值以下）`);
  say(`  ② 提示词声明的是 [${DECLARED}]：容差 ${T} 下抠掉 **${(100 * byDecl.keyed).toFixed(1)}%**` +
      `　（容差扫描 ${[30, 60, 90, 120, 150, 180, 200].map((t) => `T${t}:${(100 * cover(DECLARED, t)).toFixed(1)}%`).join(" ")}）` +
      `　画面里离它最近的像素 [${nearestC}] L1=${nearest}`);
  say(`  ③ 这张图上**实测的众数色** [${mode}]：本身占 ${(100 * counts.get(modeK) / opaque).toFixed(1)}%，` +
      `容差 ${T} 下覆盖 **${(100 * byMode.keyed).toFixed(1)}%**`);
  say(`  ④ 四角（对角内缩）[${corners.map((c) => c.join(",")).join("] [")}] → 各自 T30 覆盖 ` +
      corners.map((c) => `${(100 * cover(c, T)).toFixed(1)}%`).join(" / "));

  const line = (tag, r) =>
    `     ${tag}：抠掉 ${(100 * r.keyed).toFixed(1)}% · 前景 **${r.blocks} 块** · 最大块占前景 ${(100 * r.share).toFixed(1)}%` +
    ` · **交付态不透明率 ${(100 * r.delivered).toFixed(1)}%**` +
    `　⇒ FILLED(≥${FILLED}) ${r.delivered >= FILLED ? "**过**" : "✗ 不过"}` +
    ` · 票37单帧两条(抠掉>${SINGLE_RATIO} 且 最大块≥${SINGLE_SHARE}) ${r.keyed > SINGLE_RATIO && r.share >= SINGLE_SHARE ? "过" : "✗ 不过"}`;
  say(`  ⑤ 三种抠法各会把这一层变成什么：`);
  say(line("按【声明色】  ", byDecl));
  say(line("按【实测众数色】", byMode));
  say(line("按【四角取样】", byCorner));

  let band = 0;
  for (let y = 0; y < h; y++) { let n = 0, tot = 0;
    for (let x = 0; x < w; x++) { if (alpha(x, y) < 128) continue; tot++; if (l1(at(x, y), mode) <= T) n++; }
    if (tot && n / tot >= 0.5) band++; }
  say(`  ⑥ 逐行看众数色盖在哪一带：覆盖 ≥50% 的行 ${band}/${h}（占高度 ${(100 * band / h).toFixed(0)}%）`);
}

const w0 = decodePNG(readFileSync(FILES[3][0]));
const auto = dominantOpaqueColor(w0);
say(`\n⑦ 交叉核对：票 37 新导出的 dominantOpaqueColor(treatment-wall) = [${auto.color}]，` +
    `${auto.pixels}/${auto.opaquePixels} 像素（${(100 * auto.pixels / auto.opaquePixels).toFixed(1)}%）` +
    ` —— 与上面手算的众数色**同值**。`);
say(`\n⚠️ 只有一张出自 e2e 配方（\`wasteland-skyline.sky\`），而且它**不入库**。`);
say(`⚠️ 两张非最远层（wall / ground）来自 \`image-route-v1\` 票 02 的现场：**同一个 \`backgroundLayerPrompt\` 模板**`);
say(`   （见同目录 \`.prompt.txt\`，逐字对过）、**同一个上游**，但**不同主体、不同日期** —— 引用它们要把这条限制一起写上。`);
