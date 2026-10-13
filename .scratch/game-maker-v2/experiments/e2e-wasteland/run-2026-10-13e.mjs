// 票 23：**第十二次真跑 · 段 B**（2026-10-13 · ✅ **人已批准**，原话「**批段 B**」）。
//
// ⚠️ **这一跑要问的是一句话**：**`pack` / `config` / `qa` / 站点 这四段，能不能在一份真跑出来的
//   配方上跑完？** —— 它们**从 V2 起到今天一次都没被执行过**（第六跑那次死在 `pack` 里）。
//
// ⚠️ **输入是第十一次真跑（段 A）的检查点**，**跑在副本上、不在原件上**：
//   驱动先把 `raw/run-out-2026-10-13d/…/run/v1`（10 份）**逐字节拷进本跑自己的新目录**
//   `raw/run-out-2026-10-13e/…/run/v1`，`build` 只碰那个副本
//   ⇒ **段 A 那一跑的字节一个都不动**（报告 §五那条边界）。
//   ⚠️ 而 `build` 会往 run 目录里**加**一份 `game-config.json`（那是它该做的事）——
//      加在副本上，原件不加。
//
// ⚠️ **代理**：生图走 https ⇒ 注入 `doFetch`（`https:` → `http://127.0.0.1:7890`）。
//   ⚠️ **为什么必须注入**：`ops.ts:1149` 是 `fetchImpl ?? (t.proxy ? …)`，
//      而**配置里那个 `proxy` 是 `http://127.0.0.1:9098`（今天关着）**，且
//      `createProxyFetch` **不回落直连**（`http.ts:39/49/56`）⇒ 不注入就会以 fetch failed 收场。
//   ⚠️ **本驱动不修改任何端口状态、不改配置。**
//
// ⚠️ **预算**（报告 §二，**是上界、不是保证**，照人裁的更正措辞）：
//   图片 **14 张（上界）** · 文本 **32 发（上界）** · **150 分钟硬叫停**。
//   ⚠️ **全仓没有任何「调用预算」机制** —— 唯一真实现的闸是下面那个 `setTimeout`。
//
// ⚠️ **失败就如实失败**：不重试、不修、不自动往下走（R13）。`config` / `qa` / 站点
//   任何一步抛 ⇒ 让它抛，现场照既有机制落盘。
//
// 跑法：node .scratch/game-maker-v2/experiments/e2e-wasteland/run-2026-10-13e.mjs
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const url = (p) => pathToFileURL(p).href;

const { run } = await import(url(path.join(ROOT, "packages/cli/dist/cli.js")));
const { createProxyFetch } = await import(url(path.join(ROOT, "packages/assets/dist/index.js")));
const { parseAssetPack } = await import(url(path.join(ROOT, "packages/contracts/dist/index.js")));

const PROXY = process.env["E2E_PROXY"] ?? "http://127.0.0.1:7890";
const direct = fetch;
const proxied = createProxyFetch({ proxy: PROXY });
const doFetch = (u, init) => (/^https:/i.test(String(u)) ? proxied : direct)(u, init);

// ── 输入（段 A 的检查点）与输出（本跑自己的新目录）──────────────────────────
const GAME_ID = "ruined-city-scavenger";
const SRC_RUN = path.join(HERE, "raw", "run-out-2026-10-13d", GAME_ID, "run", "v1");
const REF_RUN = path.join(HERE, "raw", "checkpoint-run11", GAME_ID, "run", "v1");
const OUT = path.join(HERE, "raw", "run-out-2026-10-13e");
const JSON_OUT = path.join(HERE, "raw", "run-2026-10-13e.json");
const LOG = path.join(HERE, "raw", "run-2026-10-13e.log");

const UNDERSTANDING_FILES = [
  "intent.md", "visual-world.json", "game-intent.json", "game-design.json",
  "character-dna.json", "asset-recipe.json", "stylespec.json", "ledger.json",
  "style.png", "reference.png",
];

// ⚠️ 只清**本跑自己的**目录；段 A 那些字节一个不碰。
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, GAME_ID, "run"), { recursive: true });
const RUN_DIR = path.join(OUT, GAME_ID, "run", "v1");
fs.cpSync(SRC_RUN, RUN_DIR, { recursive: true });
const copied = fs.readdirSync(RUN_DIR).sort();

const lines = [];
const errors = [];
fs.writeFileSync(LOG, "");
const log = (s) => { process.stdout.write(s); fs.appendFileSync(LOG, s); };
const io = { out: (s) => void lines.push(s), err: (s) => { errors.push(s); log(s); } };
const t0 = Date.now();

// ── 150 分钟硬叫停（报告 §二，**唯一真实现的闸**）─────────────────────────
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

console.log("票 23 —— 第十二次真跑 · **段 B**（build：pack → config → qa → 站点）");
console.log(`  输入  : ${path.relative(ROOT, SRC_RUN)}（段 A 的检查点，**只读、拷副本**）`);
console.log(`  输出  : ${path.relative(ROOT, OUT)}（⚠️ 段 A 那些字节一个不碰）`);
console.log(`  文本走: http://127.0.0.1:15721（直连）· https（生图）→ ${PROXY}`);
console.log(`  并发  : --concurrency-image 2 ⇒ **text 4（默认）/ image 2**`);
console.log(`  叫停  : ${WALL_LIMIT_MS / 60000} 分钟（⚠️ 唯一的闸 —— 没有调用预算机制）`);
console.log(`  正题  : \`pack\` / \`config\` / \`qa\` / 站点 —— **这四段今天第一次被执行**\n`);
console.log(`  拷进副本的：${copied.join(" · ")}\n`);

const code = await run(
  ["build", RUN_DIR, "--out", OUT, "--concurrency-image", "2", "--json"],
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

// ── 真花掉的图（数盘上的字节，不数声明）────────────────────────────────────
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

// ⭐ 验收 §四.1 / §四.5 —— pack：包落盘了吗、过不过自己那份契约、真画了几张
console.log(`\n⭐ 验收 §四.1 / §四.5（\`pack\` 第一次在一份真配方上跑完？）：`);
const manifests = findFiles("manifest.json");
if (manifests.length === 0) console.log(`   —— ❌ 没有 manifest.json（\`pack\` 没跑完）`);
for (const m of manifests) {
  console.log(`   ${path.relative(OUT, m)}`);
  const raw = readJson(m);
  if (!raw) { console.log(`      —— ⚠️ 读不动`); continue; }
  const p = parseAssetPack(raw);
  // ⚠️ 它的返回形状是 `{ok:true,value}` / `{ok:false,errors}`（`assetpack.ts:304`）——
  //    **不是** `{success,error}`。第一版这里读错了，导致**真跑跑完之后驱动自己崩了**
  //    （付费运行本身没受影响）。留着这行注释，免得下次再猜。
  console.log(`      parseAssetPack：${p.ok ? "✅ 过" : "❌ 不过 —— " + p.errors.slice(0, 4).join("；")}`);
  console.log(`      assets=${(raw.assets ?? []).length} · files=${(raw.files ?? []).length} · packMode=${raw.provenance?.mode ?? "（无）"}`);
  const byKind = {};
  for (const a of raw.assets ?? []) byKind[a.source?.kind ?? "?"] = (byKind[a.source?.kind ?? "?"] ?? 0) + 1;
  console.log(`      按 source.kind：${JSON.stringify(byKind)}`);
}
console.log(`\n📊 真画出来的图（数盘上的字节）：generated/ ${billed.gen} · masters/ ${billed.mas}`);
console.log(`   ⚠️ 对照段 A 检查点声明的 imageCalls.total = 14（**是预测、不是闸**）`);

const ratios = findFiles("master-ratios.json");
console.log(`\n⭐ 验收 §四.5（母版比例的**观察** —— 票 39 降级后那条，观察不是错误）：`);
if (ratios.length === 0) console.log(`   —— 没有 master-ratios.json`);
for (const r of ratios) {
  console.log(`   ${path.relative(OUT, r)}`);
  const j = readJson(r);
  for (const e of j?.ratios ?? j?.data?.ratios ?? (Array.isArray(j) ? j : [])) {
    console.log(`      · ${JSON.stringify(e).slice(0, 220)}`);
  }
}

// ⭐ 验收 §四.2 —— config
console.log(`\n⭐ 验收 §四.2（\`config\` 第一次被执行？）：`);
const cfg = path.join(RUN_DIR, "game-config.json");
if (fs.existsSync(cfg)) {
  const j = readJson(cfg);
  console.log(`   ✅ run/v1/game-config.json（${fs.statSync(cfg).size} B）· format=${j?.format ?? "（无）"} · 顶层键=${Object.keys(j ?? {}).slice(0, 12).join(" · ")}`);
} else console.log(`   ❌ 没有 run/v1/game-config.json`);

// ⭐ 验收 §四.3 —— qa（R3：不算分）
console.log(`\n⭐ 验收 §四.3（\`qa\` 第一次被执行？）：`);
const qa = path.join(RUN_DIR, "qa-report.json");
if (fs.existsSync(qa)) {
  const j = readJson(qa);
  console.log(`   ✅ run/v1/qa-report.json（${fs.statSync(qa).size} B）· format=${j?.format ?? "（无）"} · 顶层键=${Object.keys(j ?? {}).join(" · ")}`);
  console.log(`   ⚠️ R3：**不许有分数** —— 逐字找 score/rating/分数：${JSON.stringify(text.match(/score|rating|分数/gi) ?? [])}`);
} else console.log(`   ❌ 没有 run/v1/qa-report.json`);

// ⭐ 验收 §四.4 —— 站点
console.log(`\n⭐ 验收 §四.4（站点第一次被装配出来？）：`);
const siteDirs = [];
const recSite = (p, depth = 0) => {
  if (depth > 4) return;
  let ents = []; try { ents = fs.readdirSync(p, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const full = path.join(p, e.name);
    if (e.isDirectory()) { if (/^site$/.test(e.name)) siteDirs.push(full); else recSite(full, depth + 1); }
  }
};
recSite(OUT);
if (siteDirs.length === 0) console.log(`   ❌ 没有 site/ 目录`);
for (const s of siteDirs) {
  for (const v of fs.readdirSync(s)) {
    const d = path.join(s, v);
    console.log(`   ${path.relative(OUT, d)}：${fs.readdirSync(d).join(" · ")}`);
    const idx = path.join(d, "index.html");
    if (fs.existsSync(idx)) console.log(`      index.html ${fs.statSync(idx).size} B`);
  }
}

// ⭐ 验收 §四.6 / §四.7 —— 理解层那五份没被回写、段 A 的账只追加
console.log(`\n⭐ 验收 §四.6 / §四.7（段 B 只许**加**东西，不许回写理解层）：`);
let same = 0, diff = [];
for (const f of UNDERSTANDING_FILES) {
  const a = path.join(SRC_RUN, f), b = path.join(RUN_DIR, f);
  if (!fs.existsSync(a) || !fs.existsSync(b)) { diff.push(`${f}（缺）`); continue; }
  if (fs.readFileSync(a).equals(fs.readFileSync(b))) same++;
  else diff.push(f);
}
console.log(`   与段 A 逐字节相同：${same}/${UNDERSTANDING_FILES.length}` +
  (diff.length ? `  ⚠️ 变了：${diff.join(" · ")}` : "  ✅"));
const srcLed = readJson(path.join(SRC_RUN, "ledger.json"));
const dstLed = readJson(path.join(RUN_DIR, "ledger.json"));
console.log(`   账：段 A ${(srcLed?.calls ?? []).length} 发（→ 段 B 副本 ${(dstLed?.calls ?? []).length} 发）` +
  ` ⇒ 只追加的话前 ${(srcLed?.calls ?? []).length} 发应当逐字相同`);
console.log(`   段 A 的原件还在吗：${fs.existsSync(SRC_RUN) ? "✅ 在（本跑只在副本上跑）" : "❌ 不见了"}`);
console.log(`   与备份 checkpoint-run11 逐字节一致：` +
  UNDERSTANDING_FILES.every((f) => fs.existsSync(path.join(REF_RUN, f)) &&
    fs.readFileSync(path.join(SRC_RUN, f)).equals(fs.readFileSync(path.join(REF_RUN, f)))) ? "✅" : "⚠️ 不一致");

if (code !== 0) {
  console.log(`\n❌ 段 B 失败（现场前 2500 字）：\n${text.slice(0, 2500)}`);
  process.exit(1);
}

const doc = JSON.parse(lines.join(""));
const d = doc.data ?? {};
console.log(`\n✅ 段 B 跑完 —— 状态：${d.status}`);
console.log(`游戏 id：${d.gameId} · run v${d.runVersion} · 包 v${d.packVersion}`);
console.log(`run   ：${d.runDir}`);
console.log(`包    ：${d.packDir}`);
console.log(`配置  ：${d.config}`);
console.log(`站点  ：${d.siteDir}`);
console.log(`入口  ：${d.entry}`);
console.log(`打开  ：${d.serveRoot}/site/v${d.packVersion}/index.html`);
