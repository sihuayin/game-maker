// 票 23：**第十次真跑 · 段 A**（2026-10-13 · ✅ **人已批准**，边界见下）。
//
// ⚠️ **人裁（2026-10-13 · 原话）**：「Q1 选『有条件批准重跑段 A』…
//   **文本调用上限 15 发、0 张图、150 分钟硬叫停。不得因为失败自动扩大预算或启动段 B。**」
//   ⇒ **这一跑就是第九跑的重跑，一字不改**：不改提示词 / 不改契约 / 不改 `STRUCTURED_CALL_ATTEMPTS`（仍是 3）/
//     不在驱动里加任何探针或 tee —— 免得把「两次跑的是不是同一件事」这个问题搞脏。
//   ⚠️ **失败就如实失败，不自动做第二次、不自动往下走**（R13 不动）。
//
// 段 A = `create` **不带 `--yes`** ⇒ 理解层跑完、到清单为止**停下**（退出码 0 · `data.status = "awaiting"`）。
//   ⚠️ **0 张图** —— `pack` 段根本不在这一段的代码路径里。花的只有文本（正常 5 发、最坏 15 发）。
//
// ⚠️ **本跑与第九跑（`run-2026-10-13b.mjs`）的差别只有一处：输出路径**。
//   ① 换输出路径（`run-out-2026-10-13c` / `run-2026-10-13c.json`）；
//   ② 读点数**照抄第九跑**（§四.5 意图层「先分家」· §四.2 `player.id` 被改成了什么 ·
//      §四.6 `design-attempts.json`）—— **本跑的正题是「`plan-assets` 那三发空输入会不会再发生」**，
//      所以第九跑的读点一个都不能少（要能跟前一跑逐项对照）。
//   ③ **前九跑的字节一个不碰**（它们各自的脚本负责各自的目录）。
//
// ⚠️ **这一跑想量到的**（票 59 的探针把「重采样 3 次够不够」变成一个有胜算的问题）：
//   · `plan-assets` 这一次会不会又三发全空？若过了 ⇒ **链第一次走到检查点**，
//     那之后 `pack` / `config` / `qa` / 站点四段**才有第一次被执行的记录**。
//   · ⚠️ 若又死在同一处，那就是**第二次、独立的一次**复现 ⇒ 归因价值比第一次高
//     （票 59 已经量到「连续 6 发空、第 7 发不空」，这一次会告诉我们是「这次恰好不空」还是「还是空」）。
//   · ⚠️ **本跑不改 `7890` 状态、不启动段 B、不生成任何图片。**
//
// 跑法：node .scratch/game-maker-v2/experiments/e2e-wasteland/run-2026-10-13c.mjs
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const url = (p) => pathToFileURL(p).href;

const { run } = await import(url(path.join(ROOT, "packages/cli/dist/cli.js")));
const { createProxyFetch } = await import(url(path.join(ROOT, "packages/assets/dist/index.js")));

const PROXY = process.env["E2E_PROXY"] ?? "http://127.0.0.1:7890";
const direct = fetch;
const proxied = createProxyFetch({ proxy: PROXY });
const doFetch = (u, init) => (/^https:/i.test(String(u)) ? proxied : direct)(u, init);

const FIXTURE = path.join(ROOT, "fixtures/e2e/wasteland-platformer");
const STYLE = path.join(FIXTURE, "style.png");
const INTENT = path.join(FIXTURE, "intent.md");
const OUT = path.join(HERE, "raw", "run-out-2026-10-13c");
const JSON_OUT = path.join(HERE, "raw", "run-2026-10-13c.json");
const LOG = path.join(HERE, "raw", "run-2026-10-13c.log");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const lines = [];
const errors = [];
fs.writeFileSync(LOG, "");
const log = (s) => { process.stdout.write(s); fs.appendFileSync(LOG, s); };
const io = { out: (s) => void lines.push(s), err: (s) => { errors.push(s); log(s); } };
const t0 = Date.now();

// ── 150 分钟硬叫停（报告 §三.4）────────────────────────────────────────────
const WALL_LIMIT_MS = 150 * 60 * 1000;
const guard = setTimeout(() => {
  const ms = Date.now() - t0;
  console.error(`\n\n⛔ 墙上时间到 ${(ms / 60000).toFixed(1)} 分钟 —— 退出。`);
  fs.writeFileSync(JSON_OUT, JSON.stringify(
    { code: "wall-clock-stop", ms, text: lines.join("") + errors.join(""),
      steps: errors.filter((l) => l.startsWith("  · ")) }, null, 1));
  process.exit(3);
}, WALL_LIMIT_MS);
guard.unref?.();

console.log("票 23 —— 第十次真跑 · **段 A**（create 到检查点为止 · 0 张图）");
console.log(`  style : fixtures/e2e/wasteland-platformer/style.png（借 halt-dusk.png，有意错配）`);
console.log(`  intent: fixtures/e2e/wasteland-platformer/intent.md`);
console.log(`  out   : ${path.relative(ROOT, OUT)}（⚠️ 不动前九跑那些字节）`);
console.log(`  文本走: http://127.0.0.1:15721（ANTHROPIC_BASE_URL，直连）· https → ${PROXY}`);
console.log(`  并发  : --concurrency-image 2 ⇒ **text 4（默认）/ image 2**（裁定 Q3 的字面）`);
console.log(`  叫停  : ${WALL_LIMIT_MS / 60000} 分钟`);
console.log(`  正题  : 票 54 的「先分家」够不够让模型**不再把实体与设定登记成机制**\n`);

const code = await run(
  ["create", "--style", STYLE, "--intent", INTENT, "--out", OUT, "--json", "--concurrency-image", "2"],
  io,
  { fetchImpl: doFetch, env: process.env, cwd: ROOT },
);
const ms = Date.now() - t0;
clearTimeout(guard);

const text = lines.join("") + errors.join("");
fs.writeFileSync(JSON_OUT,
  JSON.stringify({ code, ms, text, steps: errors.filter((l) => l.startsWith("  · ")) }, null, 1));

console.log(`\n退出码 ${code} · 墙钟 ${(ms / 1000).toFixed(1)}s（${(ms / 60000).toFixed(1)} 分钟）`);
console.log(`步：${(errors.filter((l) => l.startsWith("  · "))).map((s) => s.trim()).join(" → ") || "（没走到）"}`);

const countPng = () => {
  let gen = 0, mas = 0;
  const rec = (p) => {
    let ents = [];
    try { ents = fs.readdirSync(p, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const full = path.join(p, e.name);
      if (e.isDirectory()) rec(full);
      else if (e.name.endsWith(".png")) {
        if (full.includes("/authoring/generated/")) gen++;
        else if (full.includes("/authoring/masters/")) mas++;
      }
    }
  };
  rec(OUT);
  return { gen, mas };
};
const billed = countPng();
console.log(`\n📊 生成图：generated/ ${billed.gen} · masters/ ${billed.mas}（段 A 应当是 0 / 0）`);

// ── 捡文件：先找失败现场，再找正式产物 ──────────────────────────────────────
const findFiles = (name) => {
  const hits = [];
  const rec = (p) => {
    let ents = [];
    try { ents = fs.readdirSync(p, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const full = path.join(p, e.name);
      if (e.isDirectory()) rec(full);
      else if (e.name === name) hits.push(full);
    }
  };
  rec(OUT);
  return hits;
};
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
const unwrap = (raw) => raw?.design ?? raw?.spec ?? raw?.data ?? raw;

// ⭐ 验收 §四.5 —— 意图层：票 54 的「先分家」到底生效了没有
const intentFiles = findFiles("game-intent.json");
console.log(`\n⭐ 验收 §四.5（票 54 的「先分家」够不够 —— 意图层当场读数）：`);
if (intentFiles.length === 0) console.log(`   —— 没落到 game-intent.json（连意图层都没走过去）`);
for (const f of intentFiles) {
  const spec = unwrap(readJson(f));
  if (!spec) { console.log(`   ${path.relative(ROOT, f)} —— 读不动`); continue; }
  const ents = (spec.entities ?? []).map((e) => `${e.id}:${e.type}`);
  const mechs = (spec.mechanics ?? []).map((m) => m.id);
  const entIds = new Set((spec.entities ?? []).map((e) => e.id));
  const cross = mechs.filter((m) => entIds.has(m));
  const bags = mechs.filter((m) => /bg|background|sky|scene|世界|背景|setting|theme/i.test(m));
  console.log(`   ${path.relative(ROOT, f)}`);
  console.log(`   entities  = ${JSON.stringify(ents)}`);
  console.log(`   mechanics = ${JSON.stringify(mechs)}`);
  console.log(`   跨数组重 id（gate ⑤b）= ${JSON.stringify(cross)}   ← ${cross.length === 0 ? "✅ 空（先分家生效）" : "❌ 非空 ⇒ 意图层当场退 4"}`);
  console.log(`   看着像「世界设定」的机制 = ${JSON.stringify(bags)}   ← ${bags.length === 0 ? "✅ 空（先分家生效）" : "⚠️ 非空 ⇒ 设计层覆盖判据会点名它（R12）"}`);
  console.log(`   world = ${JSON.stringify({ theme: spec.world?.theme, setting: spec.world?.setting })} · winConditions = ${JSON.stringify(spec.winConditions)}`);
}

// ⭐ 验收 §四.2 —— 第八跑那两样：那个 id 被改成了什么
const designFiles = findFiles("game-design.json");
console.log(`\n⭐ 验收 §四.2（票 42/53 那两句话够不够）：`);
if (designFiles.length === 0) console.log(`   —— 没落到 game-design.json（这一跑没走到设计层）`);
for (const f of designFiles) {
  const d = unwrap(readJson(f));
  if (!d) { console.log(`   ${path.relative(ROOT, f)} —— 读不动`); continue; }
  const playerId = d.player?.id;
  const npcs = (d.npcs ?? []).map((x) => x.id);
  const mechs = (d.mechanics ?? []).map((m) => `${m.id}→${m.mechanic}`);
  console.log(`   ${path.relative(ROOT, f)}`);
  console.log(`   player.id = ${JSON.stringify(playerId)}   ← ${playerId !== "scavenger" ? "✅ 与意图层登记的 npc id 不同" : "❌ 仍然等于意图层登记的 npc id"}`);
  console.log(`   npcs      = ${JSON.stringify(npcs)}   ← ${npcs.includes("scavenger") ? "✅ 仍含 \"scavenger\"（意图覆盖成立）" : "⚠️ 不含 \"scavenger\" ⇒ auditIntentCoverage 会报缺项"}`);
  console.log(`   mechanics = ${JSON.stringify(mechs)}   ← id 照抄意图层、mechanic 从 8 值闭集里挑`);
}

// ⭐ 验收 §四.6 —— 票 55 的容器：这一圈每一发模型入参
const attemptFiles = findFiles("design-attempts.json");
console.log(`\n⭐ 验收 §四.6（票 55 的 「design-attempts.json」 —— 第八跑那处诊断缺口）：`);
if (attemptFiles.length === 0) {
  console.log(`   —— 没有这个文件。⚠️ 它只在**设计层抛出**时才写（成功路径结构性不写）⇒`);
  console.log(`      走到检查点 = 没抛 = 没有它，这是**预期**、不是异常。`);
}
for (const f of attemptFiles) {
  const c = unwrap(readJson(f));
  console.log(`   ${path.relative(ROOT, f)}`);
  if (!c) { console.log(`      —— 读不动`); continue; }
  const ads = c.attempts ?? [];
  console.log(`   发了 ${ads.length} 次：`);
  for (const a of ads) {
    const rid = a.raw?.player?.id;
    console.log(`     · #${a.attempt} outcome=${a.outcome}` +
      (rid !== undefined ? ` · raw.player.id = ${JSON.stringify(rid)}` : ` · raw 缺席`) +
      (a.rejections?.length ? ` · rejections = ${JSON.stringify(a.rejections.map((r) => r.reason))}` : "") +
      (a.detail ? `\n         detail: ${String(a.detail).slice(0, 400)}` : ""));
  }
}

if (code !== 0) {
  console.log(`\n❌ 段 A 失败（现场前 2500 字）：\n${text.slice(0, 2500)}`);
  process.exit(1);
}

const doc = JSON.parse(lines.join(""));
const d = doc.data ?? {};
console.log(`\n✅ 检查点 —— 状态：${d.status}`);
console.log(`游戏 id：${d.gameId} · run v${d.runVersion}`);
console.log(`run 目录：${d.runDir}`);
console.log(`\n⭐ 生图调用数（imageCalls，票 40 之后与 pack 同一把尺子）：${d.imageCalls}`);
console.log(`   明细：${JSON.stringify(d.imageCallBreakdown)}`);
console.log(`   清单件数（按 source.kind）：${JSON.stringify(d.kinds)}`);
console.log(`\n歧义条数：${(d.ambiguity ?? []).length}`);
for (const a of d.ambiguity ?? []) console.log(`   ⚠️ ${a}`);
console.log(`\n👉 段 B 的入口（⚠️ 要另出报告 + 另行同意）：`);
console.log(`   node -e '…run(["build","${d.runDir}","--concurrency-image","2","--json"], …)'`);
