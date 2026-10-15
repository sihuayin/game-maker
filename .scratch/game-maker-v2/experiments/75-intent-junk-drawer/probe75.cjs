// 票 75 探针 —— 只读 · 零付费 · 零上游。
//
// 量四件事：
//   ① 盘上 13 份真意图，逐份过**今天**的 `GameIntentSpecSchema` —— 谁还过得了、卡在哪一格。
//   ② 逐条 `mechanics[]` 分类：**真机制** / **实体名** / **布景** / **胜利条件**，
//      并标出「今天这道 gate 拦不拦它」。
//   ③ 按 2026-10-13 12:24（票 54 的「先分家」散文落地，commit a455bf3）切一半，看前后各长什么样。
//   ④ ⭐ **有没有一条「可计算」的形状判据**：拿 `mechanics[].name` 去撞世界 / 胜利条件 / 实体
//      那几张表，看它**抓得住错格的、且不误伤真机制**吗。⇒ 这是 Q1(a) 能不能成立的前提。
//
// ⚠️ 分类是**人读出来的**（R3：判据只收「精确可算」的东西 —— 「这串字是不是一条机制」不可计算，
//    这正是本票要裁的东西）。机器只回答「今天拦不拦」与「第 ④ 条规则会不会响」。
'use strict';
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { GameIntentSpecSchema } = require(path.resolve(__dirname, "../../../../packages/contracts/dist/game-intent.js"));

// 散文落地的时刻（票 54 · commit a455bf3 · 2026-10-13 12:24 本地）。用本地时区比，逐份对得住。
const PROSE_LANDED = new Date("2026-10-13T12:24:00").getTime();
const TZ = "Asia/Shanghai";
const fmt = (ms) => new Date(ms).toLocaleString("sv-SE", { timeZone: TZ }).slice(0, 16);

// 人手分类：一眼是「怎么做」的算真机制；剩下三类是错格。
const JUNK = {
  "chest": "实体名", "resource": "实体名", "enemy": "实体名",
  "treasure-chest": "实体名", "resource-pickup": "实体名", "enemy-threat": "实体名",
  "wasteland-bg": "布景", "final-goal": "胜利条件"
};

const files = execSync('find . -name game-intent.json -not -path "*/node_modules/*"', { encoding: "utf8" })
  .trim().split("\n").sort();
const rows = [];
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  const r = GameIntentSpecSchema.safeParse(j);
  const flagged = new Set((r.success ? [] : r.error.issues).map((x) => x.path.join(".")));
  const mech = j.mechanics.map((m, i) => ({
    i, id: m.id, name: m.name, cls: JUNK[m.id] || "真机制", caught: flagged.has(`mechanics.${i}.id`)
  }));
  rows.push({
    tag: f.replace(/^\.\/\.scratch\/game-maker-v2\/experiments\/e2e-wasteland\/raw\//, ""),
    t: fs.statSync(f).mtimeMs, j, mech, flaggedOther: [...flagged].filter((p) => !p.startsWith("mechanics."))
  });
}
rows.sort((a, b) => a.t - b.t);

console.log("① 逐份（按时间）：今天这道 gate 怎么判它\n");
for (const r of rows) {
  const junk = r.mech.filter((m) => m.cls !== "真机制");
  const missed = junk.filter((m) => !m.caught);
  console.log(`${fmt(r.t)}  ${r.tag}`);
  console.log(`   mechanics[]: ${r.mech.map((m) => (m.cls === "真机制" ? "·" : "✗") + m.id).join(" ")}`);
  console.log(`   错格 ${junk.length} 条 · gate 漏 ${missed.length} 条${missed.length ? " ⇒ " + missed.map((m) => `${m.id}(${m.cls})`).join(" · ") : ""}` +
    `${r.flaggedOther.length ? ` · 另有 ${r.flaggedOther.length} 条别的规则（${r.flaggedOther.join(",")}）` : ""}`);
}

console.log("\n② 「先分家」散文（2026-10-13 12:24，票 54 · a455bf3）前后\n");
const [pre, post] = [rows.filter((r) => r.t < PROSE_LANDED), rows.filter((r) => r.t >= PROSE_LANDED)];
for (const [label, rs] of [["散文之前", pre], ["散文之后", post]]) {
  const dirty = rs.filter((r) => r.mech.some((m) => m.cls !== "真机制")).length;
  const junk = rs.reduce((a, r) => a + r.mech.filter((m) => m.cls !== "真机制").length, 0);
  const tot = rs.reduce((a, r) => a + r.mech.length, 0);
  console.log(`${label}: ${rs.length} 份 · 带错格的 ${dirty} 份 ⇒ ${dirty}/${rs.length} · 错格条目 ${junk}/${tot}`);
}

console.log("\n③ ⭐ 今天 gate 拦得住谁、拦不住谁（全盘合计）\n");
const tally = (want) => {
  const m = new Map();
  for (const r of rows) for (const x of r.mech) if (x.cls !== "真机制" && x.caught === want) m.set(x.id, (m.get(x.id) || 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
};
console.log("   逮住的（⑤b 跨数组撞名）：");
for (const [id, n] of tally(true)) console.log(`     ${id.padEnd(18)} ${JUNK[id].padEnd(6)} ×${n}`);
console.log("   漏掉的：");
for (const [id, n] of tally(false)) console.log(`     ${id.padEnd(18)} ${JUNK[id].padEnd(6)} ×${n}`);
console.log("\n   ⚠️ 同一个词两种命运 —— `resource` 两个表里都有：");
for (const r of rows) {
  const x = r.mech.find((m) => m.id === "resource");
  if (x) console.log(`     ${x.caught ? "逮住" : "漏掉"}  ${fmt(r.t)}  ${r.tag}  （entities: ${r.j.entities.map((e) => e.id).join(",")}）`);
}

console.log("\n④ ⭐ 「名字撞表」这条可计算的形状判据，抓得住错格吗、误伤真机制吗\n");
// 候选规则：mechanics[].name（trim）若与 world 三格 / winConditions / loseConditions / entities[].role
// 中的任一条 **互为子串**（且长度 ≥ 2），就报。
const overlap = (a, b) => a.length >= 2 && b.length >= 2 && (a.includes(b) || b.includes(a));
let tp = 0, fn = 0, fp = 0, tn = 0;
const fps = [];
for (const r of rows) {
  const pools = [
    ["world.theme", r.j.world.theme], ["world.setting", r.j.world.setting], ["world.atmosphere", r.j.world.atmosphere],
    ...r.j.winConditions.map((x, i) => [`win[${i}]`, x]),
    ...r.j.loseConditions.map((x, i) => [`lose[${i}]`, x]),
    ...r.j.entities.map((e, i) => [`entities[${i}].role`, e.role])
  ];
  for (const m of r.mech) {
    const hit = pools.find(([, v]) => overlap(m.name.trim(), String(v).trim()));
    if (m.cls !== "真机制") { if (hit) tp++; else { fn++; } }
    else if (hit) { fp++; fps.push(`${fmt(r.t)} ${r.tag} :: ${m.id}«${m.name}» 撞 ${hit[0]}«${hit[1]}»`); }
    else tn++;
  }
}
console.log(`   错格 17 条：逮住 ${tp} · 漏 ${fn}`);
console.log(`   真机制 47 条：误伤 ${fp} · 放过 ${tn}`);
if (fps.length) { console.log("   ⚠️ 误伤清单："); for (const l of fps) console.log("     " + l); }

console.log("\n⑤ ⚠️ 诚实检查：④ 那个 0/47 是**语料**的性质，还是**规则**的性质？\n");
// 拿同一份需求（fixtures/e2e/wasteland-platformer/intent.md）能自然写出来的**真机制**名字来试。
const cand = ["探索废弃城市", "废土生存", "在废土中前进", "收集宝箱里的资源", "躲避危险", "跳跃越过废墟"];
const ref = rows[rows.length - 1].j;
const pools5 = [
  ["world.theme", ref.world.theme], ["world.setting", ref.world.setting], ["world.atmosphere", ref.world.atmosphere],
  ...ref.winConditions.map((x, i) => [`win[${i}]`, x]),
  ...ref.entities.map((e, i) => [`entities[${i}].role`, e.role])
];
for (const c of cand) {
  const hit = pools5.find(([, v]) => overlap(c.trim(), String(v).trim()));
  console.log(`   ${hit ? "⚠️ 误报" : "✅ 放过"}  «${c}»${hit ? ` —— 撞上 ${hit[0]}«${hit[1]}»` : ""}`);
}
console.log("\n   ⇒ 读法：④ 的「0 误伤」量的是**这 13 份语料**（同一个需求、同一种写法），");
console.log("     不是这条规则的普遍性质 —— 上表里凡是**名字里带世界词**的真机制都会被误报。");
