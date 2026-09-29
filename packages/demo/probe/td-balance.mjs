// **平衡调参的回路**：把参考玩家跑一遍，报每一波的结果。
//
//   node packages/demo/probe/td-balance.mjs [包版本] [覆盖JSON]
//
// ⚠️ 它是**设计文档里那条调参回路**的工具（`docs/counter-siege.md`）——
//   数值不是拍的，是「改关卡 → 让它跑一遍 → 看曲线」跑出来的。
//   覆盖参数那一路是为了**一次试好几种**而不改文件：
//     node packages/demo/probe/td-balance.mjs v4 '{"economy.startScrap":140}'
//   键是关卡 JSON 里的路径（`towers.0.levels.0.damage`），值是新的数。
import fs from "node:fs";
import path from "node:path";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
process.chdir(ROOT);
const PACK = process.argv[2] ?? "fixtures/packs/counter-siege/v4";
const OVER = process.argv[3] ? JSON.parse(process.argv[3]) : {};
const { buildTdWorld } = await import("../dist/td/world.js");
const { createSim, advance, autoPlay, simSnapshot, FIXED_DT_MS } = await import("../dist/td/sim.js");
const M = JSON.parse(fs.readFileSync(PACK.startsWith("fixtures/") ? `${PACK}/manifest.json` : `out/counter-siege/pack/${PACK}/manifest.json`, "utf8"));
const C = JSON.parse(fs.readFileSync("fixtures/td-configs/counter-siege.json", "utf8"));
for (const [k, v] of Object.entries(OVER)) {
  const [path, val] = [k, v];
  const seg = path.split(".");
  let o = C;
  for (const s of seg.slice(0, -1)) o = /^\d+$/.test(s) ? o[+s] : o[s];
  const last = seg.at(-1);
  if (last.endsWith("+=")) { const key = last.slice(0, -2); o[key] = (o[key] ?? 0) + val; }
  else if (/^\d+$/.test(last)) o[+last] = val;
  else o[last] = val;
}
const w = buildTdWorld(M, C, { packBase: `../../pack/${PACK}/` });
if (w.issues.some((i) => i.severity === "error")) { console.log("配置有硬错", w.issues.filter(i=>i.severity==="error").slice(0,2)); process.exit(1); }
let s = createSim(w);
const perWave = [];
let leakMark = 0, killMark = 0, waveMark = 0;
for (let i = 0; i < 60 * 900 && s.phase !== "won" && s.phase !== "lost"; i++) {
  s = advance(s, FIXED_DT_MS, autoPlay(s, w), w);
  if (s.wave !== waveMark) {
    if (s.killed !== killMark || s.leaked !== leakMark) perWave.push(`第 ${waveMark + 1} 波：杀 ${s.killed - killMark} · 漏 ${s.leaked - leakMark} · 声望 ${s.lives} · 废料 ${s.scrap}`);
    waveMark = s.wave; killMark = s.killed; leakMark = s.leaked;
  }
}
if (s.killed !== killMark || s.leaked !== leakMark) perWave.push(`第 ${waveMark + 1} 波：杀 ${s.killed - killMark} · 漏 ${s.leaked - leakMark} · 声望 ${s.lives} · 废料 ${s.scrap}`);
const snap = simSnapshot(s);
console.log(`结果: ${snap.phase}  波 ${snap.wave}/${w.waves.length}  声望 ${snap.lives}/${w.economy.lives}  废料 ${snap.scrap}  建 ${snap.built} 升 ${snap.upgraded}  杀 ${snap.killed} 漏 ${snap.leaked}  用时 ${(s.ms/1000).toFixed(0)}s`);
const hp = w.enemies.reduce((n,e)=>n+e.hp,0);
const totalHp = C.waves.reduce((n,wv)=>n+wv.groups.reduce((m,g)=>m+g.count*(C.enemies.find(e=>e.id===g.enemy)?.hp??0),0),0);
console.log(perWave.map((l)=>`   ${l}`).join("\n"));
console.log(`   全场敌人总血 ${totalHp}`);
