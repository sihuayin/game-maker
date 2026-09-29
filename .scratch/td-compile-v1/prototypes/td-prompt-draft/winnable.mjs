import fs from "node:fs";
const { buildTdWorld, pathPointAt } = await import("../../packages/demo/dist/td/world.js");
const { createSim, advance, FIXED_DT_MS, simSnapshot } = await import("../../packages/demo/dist/td/sim.js");
const M = JSON.parse(fs.readFileSync("fixtures/packs/counter-siege/v4/manifest.json", "utf8"));
for (const [tag, f] of [["我手写的那一关", "fixtures/td-configs/counter-siege.json"], ["模型编译出来的那一关", "fixtures/td-configs/__probe-compiled.json"]]) {
  const C = JSON.parse(fs.readFileSync(f, "utf8"));
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
  console.log(`${tag.padEnd(24)} ${String(r.phase).padEnd(5)} 波 ${r.wave}/5 · 声望 ${r.lives}/20 · 建 ${r.built} 升 ${r.upgraded} · 杀 ${r.killed} 漏 ${r.leaked} · 路径 ${w.path.total}px · 插槽 ${w.slots.length}`);
}
