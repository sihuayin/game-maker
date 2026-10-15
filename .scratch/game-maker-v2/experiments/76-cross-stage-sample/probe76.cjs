// 票 76 探针 —— 只读 · 零付费 · 零上游。
//
// 量四件事：
//   ① 三处实物（段 A 样板 / 两份真产物 / 那份手写夹具）拿**真的** auditLayerCoverage 逐层裁一遍
//   ② 样板要改成什么形状才在任何世界宽下都过（**最小改动是什么**）
//   ③ 反过来：样板那个形状**在多宽的世界里才刚好过**（解临界值）
//   ④ 仓库测试语料里 sky 的 parallax 取值分布（「样板是不是唯一的异类」）
'use strict';
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const { auditLayerCoverage, layerDrawnSize } = require(path.resolve(__dirname, "../../../../packages/contracts/dist/layer-coverage.js"));

const VP = { w: 480, h: 270 };                 // DEFAULT_VIEWPORT（段 B 骨架与外壳同值）
const WORLD = { w: 1440, h: 270 };             // 段 B 骨架 :618 逐字 world: { size: { w: 1440, h: 270 } }
const NOMINAL = { w: 480, h: 270 };            // 每层画出来多大 —— 由资源标称尺寸来（真产物逐份都是 480×270）

const samples = {
  "段 A 样板 recipeShapeSpec() (prompt.ts:494-496)": [
    { name: "sky", parallax: 0.3 },
    { name: "ground", parallax: 1, tileable: { x: true, y: false } }
  ],
  "真产物 13e（第十二跑）": [
    { name: "sky", parallax: 0.1 }, { name: "distant-blocks", parallax: 0.4 },
    { name: "wall", parallax: 1, tileable: { x: true, y: false } }
  ],
  "真产物 13h（第十五跑）": [
    { name: "sky", parallax: 0.1 }, { name: "silhouette", parallax: 0.4 },
    { name: "facade", parallax: 1, tileable: { x: true, y: false } }
  ],
  "手写夹具 fixtures/packs/last-train/v2": [
    { name: "sky", parallax: 0 }, { name: "wall", parallax: 0.6, tileable: { x: true, y: false } },
    { name: "ground", parallax: 1, tileable: { x: true, y: false } }
  ]
};

function audit(layers, world = WORLD, nominal = NOMINAL) {
  const entries = layers.map((l) => ({
    where: "scene.background[0]", name: l.name, parallax: l.parallax ?? 0,
    drawn: layerDrawnSize({ tileable: l.tileable, nominal }, world)
  }));
  return auditLayerCoverage(VP, world, entries);
}

console.log(`视口 ${VP.w}×${VP.h} · 世界 ${WORLD.w}×${WORLD.h} · 每层标称 ${NOMINAL.w}×${NOMINAL.h}（与真产物同）\n`);
console.log("① 三处实物逐层裁一遍（真的 auditLayerCoverage）\n");
for (const [label, ls] of Object.entries(samples)) {
  const bad = audit(ls);
  const badNames = new Set(bad.map((b) => b.message.match(/层 "([^"]+)"/)?.[1]));
  console.log(`${bad.length === 0 ? "✅" : "❌"} ${label}`);
  for (const l of ls) {
    const d = layerDrawnSize({ tileable: l.tileable, nominal: NOMINAL }, WORLD);
    const cover = d.w - (l.parallax ?? 0) * (WORLD.w - VP.w);
    console.log(`     ${badNames.has(l.name) ? "✗" : "·"} ${l.name.padEnd(15)} parallax ${String(l.parallax).padEnd(4)} ` +
      `${l.tileable ? "铺 x" : "不铺"}  画 ${d.w} ⇒ 最坏剩 ${cover}px ${cover >= VP.w ? "(≥480 ✓)" : "(<480 ✗)"}`);
  }
}

console.log("\n② 样板要改成什么才**在任何世界宽下都过**（逐支试）\n");
const alts = {
  "(a1) sky parallax 改成 0": [{ name: "sky", parallax: 0 }, { name: "ground", parallax: 1, tileable: { x: true, y: false } }],
  "(a2) sky 加 tileable.x（铺满世界）": [{ name: "sky", parallax: 0.3, tileable: { x: true, y: false } }, { name: "ground", parallax: 1, tileable: { x: true, y: false } }],
  "(a3) sky 照原样，但把这一层**画宽到 1440**": [{ name: "sky", parallax: 0.3 }, { name: "ground", parallax: 1, tileable: { x: true, y: false } }],
  "(现状) sky parallax 0.3 不铺、标称 480": [{ name: "sky", parallax: 0.3 }, { name: "ground", parallax: 1, tileable: { x: true, y: false } }]
};
for (const [label, ls] of Object.entries(alts)) {
  const nominal = label.startsWith("(a3)") ? { w: 1440, h: 270 } : NOMINAL;
  const worlds = [{ w: 480, h: 270 }, { w: 960, h: 270 }, WORLD, { w: 2880, h: 270 }];
  const rs = worlds.map((w) => `世界${w.w}:${audit(ls, w, nominal).length === 0 ? "过" : "拒"}`);
  console.log(`   ${label}`);
  console.log(`      ${rs.join("  ")}`);
}

console.log("\n③ 样板那个形状（sky p0.3 · 标称 480）**在多宽的世界里才刚好过**\n");
// 480 − 0.3 × (w − 480) ≥ 480 ⇔ 0.3 × (w − 480) ≤ 0 ⇔ w ≤ 480
for (const w of [408, 480, 481, 600, 960, 1440]) {
  const cover = NOMINAL.w - 0.3 * Math.max(0, w - VP.w);
  console.log(`   世界宽 ${String(w).padStart(4)} ⇒ 最坏剩 ${String(cover).padStart(5)}px ${cover >= VP.w ? "✓ 过" : "✗ 拒"}`);
}
console.log("   ⇒ ⚠️ 判决：它**只在世界不比视口宽时**才成立 —— 也就是「**不滚动的单屏游戏**」。");

console.log("\n④ 仓库测试语料里 sky 的 parallax（「样板是不是唯一的异类」）\n");
const tests = execSync(`grep -rn 'name: "sky"\\|"name":"sky"' packages/*/tests/ packages/*/src/ 2>/dev/null || true`, { encoding: "utf8" })
  .trim().split("\n").filter(Boolean);
const tally = new Map();
for (const line of tests) {
  const m = line.match(/parallax"?\s*:\s*([\d.]+)/);
  const k = m ? m[1] : "?";
  tally.set(k, (tally.get(k) || 0) + 1);
  console.log(`   ${line.split(":")[0].replace(/^packages\//, "").padEnd(42)} parallax ${k}`);
}
console.log(`\n   分布：${[...tally].sort((a, b) => b[1] - a[1]).map(([k, n]) => `p${k} ×${n}`).join(" · ")}`);
