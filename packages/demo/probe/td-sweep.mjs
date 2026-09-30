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
//   ✅ **2026-09-30：那个换已经落地，复制品也已删掉** —— 现在 import 的是真的 `autoPlay`。
import fs from "node:fs";
const { buildTdWorld, pathPointAt } = await import("../dist/td/world.js");
const { createSim, advance, autoPlay, FIXED_DT_MS, simSnapshot } = await import("../dist/td/sim.js");

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

/**
 * ⚠️ 这里原本有一份**参考玩家的复制品**（票 04 留的，因为那时真玩家还没有几何策略）。
 *   现在真的那个已经在 `sim.ts` 里了 —— 复制品**已经删掉**，改成 import 真的 `autoPlay`。
 *   留着两份的唯一后果是：它们会漂，而「扫描量出来的刻度」会与「真跑用的玩家」不是同一个人。
 */
function play(w) {
  let s = createSim(w);
  for (let i = 0; i < 900 * 62; i++) {
    s = advance(s, FIXED_DT_MS, autoPlay(s, w), w);
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
