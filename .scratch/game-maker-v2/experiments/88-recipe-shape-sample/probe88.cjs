// 票 88 探针 —— 只读 · 零付费 · 零上游。**核的是那份施工方案能不能成立**，一动不动源码。
//
// 段 B 的世界与视口**不写死**，直接从 `packages/assets/dist` 的构建产物里取
// （`gameConfigExample.world.size` 与 `DEFAULT_VIEWPORT`）—— 与那条待写的测试将用的同一份。
'use strict';
const path = require("path");
const assets = require(path.resolve(__dirname, "../../../../packages/assets/dist/index.js"));
const { auditLayerCoverage, layerDrawnSize } = require(path.resolve(__dirname, "../../../../packages/contracts/dist/layer-coverage.js"));

const VP = assets.DEFAULT_VIEWPORT;
const WORLD = assets.gameConfigExample.world.size;
const NOMINAL = { w: 480, h: 270 };

// 方案 §二 提案的那份数据（(甲) 三层 —— 与通过整条链的手写夹具逐格同形）
const PROPOSED = [
  { name: "sky", parallax: 0 },
  { name: "wall", parallax: 0.6, tileable: { x: true, y: false } },
  { name: "ground", parallax: 1, tileable: { x: true, y: false } }
];
// 今天那段样板（真产物照抄的那份形状）
const TODAY = [
  { name: "sky", parallax: 0.3 },
  { name: "ground", parallax: 1, tileable: { x: true, y: false } }
];

const auditOf = (layers, world) => auditLayerCoverage(VP, world, layers.map((l) => ({
  where: "scene.background[0]", name: l.name, parallax: l.parallax,
  drawn: layerDrawnSize({ tileable: l.tileable, nominal: NOMINAL }, world)
})));

console.log(`段 B 的骨架世界（从构建产物读的）：${WORLD.w}×${WORLD.h} · 视口 ${VP.w}×${VP.h}\n`);

console.log("① 验收条件 1：提案那份数据 × 骨架世界 ⇒ 期望**零 error**\n");
const ok = auditOf(PROPOSED, WORLD);
console.log(`   ${ok.length === 0 ? "✅ 零 error —— 验收条件 1 成立" : "❌ " + ok.length + " 条"}`);
for (const i of ok) console.log("     " + i.message);

console.log("\n② 验收条件 2（阴性对照）：把规矩抽掉（`sky` 退回 `parallax: 0.3`）⇒ 期望**当场红**\n");
const neg = auditOf([{ ...PROPOSED[0], parallax: 0.3 }, ...PROPOSED.slice(1)], WORLD);
console.log(`   ${neg.length > 0 ? "✅ 红 " + neg.length + " 条 —— 上一条**不是恒真**的" : "❌ 居然全绿（那条判据是恒真的）"}`);
for (const i of neg) console.log("     " + i.message.slice(0, 150) + "…");

console.log("\n③ 提案 (甲) 三层 vs 今天那段样板 —— 逐层对照\n");
for (const [label, ls] of [["提案 (甲)", PROPOSED], ["今天那段样板", TODAY]]) {
  const bad = new Set(auditOf(ls, WORLD).map((b) => b.message.match(/层 "([^"]+)"/)?.[1]));
  console.log(`   ${label}：`);
  for (const l of ls) {
    const d = layerDrawnSize({ tileable: l.tileable, nominal: NOMINAL }, WORLD);
    const cover = d.w - (l.parallax ?? 0) * (WORLD.w - VP.w);
    console.log(`     ${bad.has(l.name) ? "✗" : "·"} ${l.name.padEnd(7)} p${String(l.parallax).padEnd(4)} ${l.tileable ? "铺x" : "不铺"}  画 ${d.w} ⇒ 剩 ${cover}px`);
  }
}

console.log("\n④ 规矩第二条「把资源画得足够宽」的临界宽度（不平铺的层，需要 nominal.w ≥ 480 + p×960）\n");
for (const p of [0.1, 0.3, 0.4, 0.6, 1]) console.log(`   parallax ${p} ⇒ 资源至少 ${480 + p * (WORLD.w - VP.w)}px 宽`);
console.log("   ⚠️ 而 `nominal` 是**资源级**的（ops.ts:785 / draw.ts:223 都取 asset.size）⇒");
console.log("      层与层各自定宽**做不到**，这条规矩说的是**整件资源**。");

console.log("\n⑤ (乙) 两层的最小改动也核一遍（只把 sky 改成 0）\n");
const minimal = [{ name: "sky", parallax: 0 }, TODAY[1]];
console.log(`   ${auditOf(minimal, WORLD).length === 0 ? "✅ 也过" : "❌ 不过"} —— 但中间层没有任何示范（票 76 Q1 点名要避免的那个）`);
