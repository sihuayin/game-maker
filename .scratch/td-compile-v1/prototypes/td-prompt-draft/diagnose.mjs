// 定位：编译出来那一关为什么打不赢 —— 是插槽不够，还是波次堆得太狠？
import fs from "node:fs";
const { buildTdWorld, pathPointAt } = await import("../../packages/demo/dist/td/world.js");
const { createSim, advance, FIXED_DT_MS, simSnapshot } = await import("../../packages/demo/dist/td/sim.js");
const M = JSON.parse(fs.readFileSync("fixtures/packs/counter-siege/v4/manifest.json", "utf8"));
const COMPILED = JSON.parse(fs.readFileSync("fixtures/td-configs/__probe-compiled.json", "utf8"));
const HAND = JSON.parse(fs.readFileSync("fixtures/td-configs/counter-siege.json", "utf8"));

function play(C, tag) {
  const w = buildTdWorld(M, C, { packBase: "" });
  const nearestArc = (s) => { let b = Infinity, a = 0; for (let d = 0; d <= w.path.total; d++) { const p = pathPointAt(w.path, d); const dd = Math.hypot(p.x - s.at.x, p.y - s.at.y); if (dd < b) { b = dd; a = d; } } return a; };
  const order = [...w.slots].sort((a, b) => nearestArc(a) - nearestArc(b)).map((s) => s.id);
  let s = createSim(w); const built = new Set();
  for (let i = 0; i < 900 * 62; i++) {
    const acts = [];
    if (s.phase === "build" || s.phase === "wave") {
      const plain = s.towers.find((t) => t.level === 0); const us = plain && w.towers.find((t) => t.id === plain.towerId);
      if (plain && us && s.scrap >= us.upgradeCost) acts.push({ kind: "upgrade", slotId: plain.slotId });
      else { const next = order.find((id) => !built.has(id)); const spec = next && w.towers[s.towers.length % w.towers.length];
        if (next && spec && s.scrap >= spec.cost) { acts.push({ kind: "build", slotId: next, towerId: spec.id }); built.add(next); } }
      if (!acts.length && s.phase === "build") acts.push({ kind: "start-wave" });
    }
    s = advance(s, FIXED_DT_MS, acts, w);
    if (s.phase === "won" || s.phase === "lost") break;
  }
  const r = simSnapshot(s);
  console.log(`${tag.padEnd(34)} ${String(r.phase).padEnd(5)} 波 ${r.wave}/5 · 声望 ${r.lives}/20 · 建 ${r.built} 升 ${r.upgraded} · 杀 ${r.killed} 漏 ${r.leaked}`);
  return r;
}
// 每波敌人总血 —— 看波次堆得狠不狠
const hpOf = (C) => C.waves.map((w, i) => `第${i + 1}波 ${w.groups.reduce((n, g) => n + g.count * (C.enemies.find((e) => e.id === g.enemy)?.hp ?? 0), 0)}`).join(" · ");
console.log("手写的  :", hpOf(HAND));
console.log("编译的  :", hpOf(COMPILED));
console.log();
play(HAND, "① 我手写的（9 插槽）");
play(COMPILED, "② 编译的（6 插槽）");
play({ ...COMPILED, slots: HAND.slots }, "③ 编译的波次 + 手写的 9 个插槽");
play({ ...COMPILED, waves: HAND.waves }, "④ 编译的插槽 + 手写的波次");
