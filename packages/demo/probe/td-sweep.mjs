// **数值刻度扫描**：把每一维按倍率缩放，看「还在不在能玩的量级上」。
//
//   node packages/demo/probe/td-sweep.mjs '[0.5,1,2]' '["塔伤害","敌人血量"]'
//
// ⚠️ **它为什么存在**：`TD_REFERENCE_SCALE` 那几条区间是从这里量出来的，
//   而有一条测试把它钉在 `fixtures/td-configs/counter-siege.json` 上
//   （见票 04 的 Answer）。谁把关卡重调出区间，测试就红 —— **那时就得重跑这个脚本**。
//
// ⚠️⚠️ **它里面那份玩家是「票 02 那个决定的复现版」，不是出货的那一个。**
//   票 02 定了把参考玩家换成几何 + 升级优先，而**那个换还没实现**（wayfinder 是 plan, don't do）。
//   ⇒ **换落地的那一天，把下面 `play()` 里那份复制品删掉、改成 import 真的 `autoPlay`。**
//   留着一份复制品的唯一理由是：这个脚本要能解释它自己量出来的数。
import fs from "node:fs";
const { buildTdWorld, pathPointAt } = await import("../dist/td/world.js");
const { createSim, advance, FIXED_DT_MS, simSnapshot } = await import("../dist/td/sim.js");

import path from "node:path";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
process.chdir(ROOT);
const M = JSON.parse(fs.readFileSync("fixtures/packs/counter-siege/v4/manifest.json", "utf8"));
const BASE = JSON.parse(fs.readFileSync("fixtures/td-configs/counter-siege.json", "utf8"));

const clamp = (v) => Math.max(1, Math.round(v));
function mutate(cfg, dim, k) {
  const c = structuredClone(cfg);
  switch (dim) {
    case "塔伤害": for (const t of c.towers) for (const l of t.levels) l.damage = clamp(l.damage * k); break;
    case "敌人血量": for (const e of c.enemies) e.hp = clamp(e.hp * k); break;
    case "射速(越小越快)": for (const t of c.towers) for (const l of t.levels) l.fireMs = clamp(l.fireMs * k); break;
    case "敌人速度": for (const e of c.enemies) e.speed = Math.max(1, +(e.speed * k).toFixed(2)); break;
    case "开局废料": c.economy.startScrap = clamp(c.economy.startScrap * k); c.economy.waveBonus = clamp(c.economy.waveBonus * k); break;
    case "波次数量": for (const w of c.waves) for (const g of w.groups) g.count = clamp(g.count * k); break;
    case "护甲": for (const e of c.enemies) e.armor = Math.round(e.armor * k); break;
    case "塔造价": for (const t of c.towers) { t.cost = clamp(t.cost * k); t.upgradeCost = clamp(t.upgradeCost * k); } break;
  }
  return c;
}

function play(w) {
  const nearestArc = (slot) => {
    let best = Infinity, at = 0;
    for (let d = 0; d <= w.path.total; d += 1) {
      const p = pathPointAt(w.path, d);
      const dd = Math.hypot(p.x - slot.at.x, p.y - slot.at.y);
      if (dd < best) { best = dd; at = d; }
    }
    return at;
  };
  const order = [...w.slots].sort((a, b) => nearestArc(a) - nearestArc(b)).map((s) => s.id);
  let s = createSim(w);
  const built = new Set();
  for (let i = 0; i < 900 * 62; i++) {
    const acts = [];
    if (s.phase === "build" || s.phase === "wave") {
      const plain = s.towers.find((t) => t.level === 0);
      const us = plain && w.towers.find((t) => t.id === plain.towerId);
      if (plain && us && s.scrap >= us.upgradeCost) acts.push({ kind: "upgrade", slotId: plain.slotId });
      else {
        const next = order.find((id) => !built.has(id));
        const spec = next && w.towers[s.towers.length % w.towers.length];
        if (next && spec && s.scrap >= spec.cost) { acts.push({ kind: "build", slotId: next, towerId: spec.id }); built.add(next); }
      }
      if (!acts.length && s.phase === "build") acts.push({ kind: "start-wave" });
    }
    s = advance(s, FIXED_DT_MS, acts, w);
    if (s.phase === "won" || s.phase === "lost") break;
  }
  return simSnapshot(s);
}

const KS = JSON.parse(process.argv[2]);
const DIMS = JSON.parse(process.argv[3]);
const header = "维度".padEnd(18) + KS.map((k) => String(k + "×").padStart(11)).join("");
console.log(header);
console.log("-".repeat(header.length));
for (const dim of DIMS) {
  let row = dim.padEnd(16);
  for (const k of KS) {
    const cfg = mutate(BASE, dim, k);
    const w = buildTdWorld(M, cfg, { packBase: "" });
    const r = play(w);
    const tag = r.phase === "won" ? `赢 ${String(r.lives).padStart(2)}/${r.lives + r.leaked * 1}` : "输";
    row += (r.phase === "won" ? `✅${r.lives}` : "❌").padStart(9) + " ";
    void tag;
  }
  console.log(row);
}
