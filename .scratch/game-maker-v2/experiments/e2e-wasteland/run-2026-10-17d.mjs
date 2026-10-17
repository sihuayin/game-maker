// 票 23：**第二十次真跑 · 段 B 重跑**（2026-10-17 · ✅ **人已批准** —— 原话「批准」）。
//
// ⚠️ **这一跑要问的是一句话**：**第十九跑死在 `pack` 的那一条（`enemy-wasteland.patrol` 的
//   底部地面线 → 1 块），在票 99 / 100 / 101 / 102 的救援路径落地之后，能不能过去；
//   过去之后，`config` / `qa` / 站点 这三段能不能第一次在一份真跑出来的合规清单上走完？**
//   ⭐ 免费回放已证：同一张失败图，当前生产代码切出**正好 4 块**（报告 §2）。
//
// ⚠️ **输入是第十八次真跑（段 A）的检查点**，**跑在副本上、不在原件上**：
//   驱动先把 `raw/run-out-2026-10-17b/wasteland-scavenger-assets/run/v1`（10 份）逐字节拷进
//   `raw/run-out-2026-10-17d/wasteland-scavenger-assets/run/v1`，`build` 只碰那个副本
//   ⇒ **原件一个字节不动**（跑前拍 sha256、跑后复验）。
//
// ⚠️ **代理**：生图走 https ⇒ 注入 `doFetch`（`https:` → `http://127.0.0.1:7890`）。
//   配置里那个 `image.proxy` 是 `http://127.0.0.1:9098`（今天关着），不注入会 fetch failed。
//   **本驱动不修改任何端口状态、不改配置。**
//
// ⚠️ **预算**（报告 §二，**是上界、不是保证**）：
//   图片 **11 张（上界）** · 文本 **12 发（上界 = drawlist 6 × 2）** · **150 分钟硬叫停**。
//   ⚠️ 全仓没有任何「调用预算」机制 —— 唯一真实现的闸是下面那个 `setTimeout`。
//
// ⚠️ **失败就如实失败**：不重试、不修、不自动往下走（R13）。
//
// 跑法：node .scratch/game-maker-v2/experiments/e2e-wasteland/run-2026-10-17d.mjs
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const url = (p) => pathToFileURL(p).href;

const { run } = await import(url(path.join(ROOT, "packages/cli/dist/cli.js")));
const { createProxyFetch } = await import(url(path.join(ROOT, "packages/assets/dist/index.js")));
const { parseAssetPack, imageCallsOf, auditLayerCoverage, layerDrawnSize } =
  await import(url(path.join(ROOT, "packages/contracts/dist/index.js")));

const PROXY = process.env["E2E_PROXY"] ?? "http://127.0.0.1:7890";
const direct = fetch;
const proxied = createProxyFetch({ proxy: PROXY });
const doFetch = (u, init) => (/^https:/i.test(String(u)) ? proxied : direct)(u, init);

const GAME_ID = "wasteland-scavenger-assets";
const SRC_RUN = path.join(HERE, "raw", "run-out-2026-10-17b", GAME_ID, "run", "v1");
const OUT = path.join(HERE, "raw", "run-out-2026-10-17d");
const JSON_OUT = path.join(HERE, "raw", "run-2026-10-17d.json");
const LOG = path.join(HERE, "raw", "run-2026-10-17d.log");

const UNDERSTANDING_FILES = [
  "intent.md", "visual-world.json", "game-intent.json", "game-design.json",
  "character-dna.json", "asset-recipe.json", "stylespec.json", "ledger.json",
  "style.png", "reference.png",
];

const sha = (p) => createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const before = new Map(UNDERSTANDING_FILES.map((f) => [f, sha(path.join(SRC_RUN, f))]));

// ⚠️ 只清**本跑自己的**目录；18 跑检查点与旧现场一个字节不碰。
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, GAME_ID, "run"), { recursive: true });
const RUN_DIR = path.join(OUT, GAME_ID, "run", "v1");
fs.cpSync(SRC_RUN, RUN_DIR, { recursive: true });
const copied = fs.readdirSync(RUN_DIR).sort();

const recipe = JSON.parse(fs.readFileSync(path.join(RUN_DIR, "asset-recipe.json"), "utf8"));
const calls = imageCallsOf(recipe);
const drawlist = recipe.assets.filter((e) => e.source.kind === "drawlist").length;

const lines = [];
const errors = [];
fs.writeFileSync(LOG, "");
const log = (s) => { process.stdout.write(s); fs.appendFileSync(LOG, s); };
const io = { out: (s) => void lines.push(s), err: (s) => { errors.push(s); log(s); } };
const t0 = Date.now();

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

console.log("票 23 —— 第二十次真跑 · **段 B 重跑**（build：pack → config → qa → 站点）");
console.log(`  批准  : ✅ 人裁 2026-10-17「批准」（第二十跑 · 段 B 重跑）`);
console.log(`  输入  : ${path.relative(ROOT, SRC_RUN)}（第十八跑的检查点，**只读、拷副本**）`);
console.log(`  输出  : ${path.relative(ROOT, OUT)}（⚠️ 原件一个字节不碰）`);
console.log(`  文本走: ${process.env["ANTHROPIC_BASE_URL"] ?? "（未设）"}（直连）· https（生图）→ ${PROXY}`);
console.log(`  并发  : --concurrency-image 2 ⇒ text 4（默认）/ image 2`);
console.log(`  叫停  : ${WALL_LIMIT_MS / 60000} 分钟（⚠️ 唯一的闸 —— 没有调用预算机制）`);
console.log(`  正题  : 第十九跑死在 \`pack\` 的底部地面线 → 票 100 / 102 的救援路径`);
console.log(`           ⇒ 先过 \`pack\`，再看 \`config\` / \`qa\` / 站点\n`);
console.log(`  拷进副本的：${copied.join(" · ")}\n`);
console.log(`  预算上界：图片 ${calls.total} 张 ${JSON.stringify(calls.breakdown)} · 文本 ${drawlist * 2} 发（drawlist ${drawlist} 件 × 2）\n`);

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

const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
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
console.log(`\n📊 真画出来的图（数盘上的字节）：generated/ ${billed.gen} · masters/ ${billed.mas}`);
console.log(`   ⚠️ 对照声明 imageCalls.total = ${calls.total}（**是预测、不是闸**）`);

// ⭐ 验收 §四.3 —— pack
console.log(`\n⭐ 验收 §四.3（pack：包落盘了吗、过不过自己那份契约）：`);
const manifests = findFiles("manifest.json");
if (manifests.length === 0) console.log(`   —— ❌ 没有 manifest.json（pack 没跑完）`);
for (const m of manifests) {
  console.log(`   ${path.relative(OUT, m)}`);
  const raw = readJson(m);
  const p = parseAssetPack(raw);
  console.log(`      parseAssetPack：${p.ok ? "✅ 过" : "❌ 不过 —— " + p.errors.slice(0, 4).join("；")}`);
  console.log(`      assets=${(raw?.assets ?? []).length} · files=${(raw?.files ?? []).length} · packMode=${raw?.provenance?.mode ?? "（无）"}`);
}

// ⭐ 验收 §四.1 —— config + 层覆盖（第十五跑的那条拦路石）
console.log(`\n⭐ 验收 §四.1（config 落盘？层覆盖过不过？）：`);
const cfgPath = path.join(RUN_DIR, "game-config.json");
if (!fs.existsSync(cfgPath)) console.log(`   ❌ 没有 run/v1/game-config.json`);
else {
  const cfg = readJson(cfgPath);
  console.log(`   ✅ run/v1/game-config.json（${fs.statSync(cfgPath).size} B）· format=${cfg?.format ?? "（无）"}`);
  console.log(`   world.size = ${JSON.stringify(cfg?.world?.size)} · background.asset = ${JSON.stringify(cfg?.scene?.background?.asset)}`);
  const pa = cfg?.player?.anims;
  console.log(`   player.anims = ${JSON.stringify(pa)}`);
  if (pa && typeof pa === "object") {
    const vals = Object.values(pa);
    console.log(`      三格互不相同：${new Set(vals).size === vals.length && vals.length === 3 ? "✅" : "❌"}（${vals.length} 格 / ${new Set(vals).size} 个名字）`);
  }
  // 层覆盖：用生产函数重放（视口 480×270 · config 自己写的世界）
  for (const m of manifests) {
    const manifest = readJson(m);
    const a = manifest?.assets?.find((x) => x.id === cfg?.scene?.background?.asset);
    if (!a) { console.log(`   ⚠️ 清单里解不到背景资源 ${JSON.stringify(cfg?.scene?.background?.asset)}`); continue; }
    const layers = a.layers ?? [];
    const viewport = { w: 480, h: 270 };
    const world = cfg?.world?.size ?? { w: 0, h: 0 };
    const entries = layers.map((l, i) => ({
      where: `scene.background[${i}]`, name: `${a.id}.${l.name}`, parallax: l.parallax,
      drawn: layerDrawnSize({ tileable: l.tileable, nominal: a.size }, world),
    }));
    const issues = auditLayerCoverage(viewport, world, entries);
    console.log(`   ⭐ auditLayerCoverage（视口 480×270 · 世界 ${world.w}×${world.h} · 标称 ${a.size?.w}×${a.size?.h}）：` +
      `${issues.length === 0 ? "✅ 0 条 error" : `❌ ${issues.length} 条 error`}`);
    for (const e of issues) console.log(`      · ${e.message}`);
  }
}

// ⭐ 验收 §四.4 —— qa
console.log(`\n⭐ 验收 §四.4（qa 执行？R3 不许有分数）：`);
const qa = path.join(RUN_DIR, "qa-report.json");
if (!fs.existsSync(qa)) console.log(`   ❌ 没有 run/v1/qa-report.json`);
else {
  const j = readJson(qa);
  console.log(`   ✅ run/v1/qa-report.json（${fs.statSync(qa).size} B）· format=${j?.format ?? "（无）"} · 顶层键=${Object.keys(j ?? {}).join(" · ")}`);
  console.log(`   ⚠️ R3：逐字找 score/rating/分数：${JSON.stringify(text.match(/score|rating|分数/gi) ?? [])}`);
}

// ⭐ 验收 §四.2 —— 站点
console.log(`\n⭐ 验收 §四.2（站点第一次装配出来？）：`);
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

// ⭐ 验收 §六.3（新增）—— 底部横带救援有没有被触发
console.log(`\n⭐ 验收 §六.3（新增：底部横带救援）`);
const bandLines = text.split("\n").filter((l) => l.includes("底部横带"));
if (bandLines.length === 0) console.log(`   —— 没有印出「底部横带」一行（救援未触发，或 pack 没走到多帧资源）`);
else for (const l of bandLines) console.log(`   ${l.trim()}`);

// ⭐ 验收 §四.6 —— 账
console.log(`\n⭐ 验收 §四.6（账）：`);
for (const f of findFiles("ledger.json")) {
  const j = readJson(f);
  const cs = j?.calls ?? [];
  console.log(`   ${path.relative(OUT, f)} —— ${cs.length} 发`);
  for (const c of cs) {
    console.log(`      · ${String(c.step).padEnd(17)} attempts=${c.attempts}` +
      (c.failures?.length ? ` failures=${JSON.stringify(c.failures)}` : "") +
      (c.spent ? ` spent=${JSON.stringify(c.spent)}` : ""));
  }
}

// ⭐ 阴性 —— 原件与副本理解层
console.log(`\n⭐ 阴性 §四.7（输入检查点 10 份逐字节没动）：`);
let intact = 0; const bad = [];
for (const [f, h] of before) {
  const now = fs.existsSync(path.join(SRC_RUN, f)) ? sha(path.join(SRC_RUN, f)) : "(不见了)";
  if (now === h) intact++; else bad.push(f);
}
console.log(`   ${intact}/${before.size} 逐字节未变 ${bad.length ? "❌ " + bad.join(" · ") : "✅"}`);

console.log(`\n⭐ 阴性 §四.9（副本里那五份理解层产物逐字节不变）：`);
let same = 0; const diff = [];
for (const f of ["visual-world.json", "game-intent.json", "game-design.json", "character-dna.json", "asset-recipe.json"]) {
  const a = path.join(SRC_RUN, f), b = path.join(RUN_DIR, f);
  if (!fs.existsSync(a) || !fs.existsSync(b)) { diff.push(`${f}（缺）`); continue; }
  if (fs.readFileSync(a).equals(fs.readFileSync(b))) same++; else diff.push(f);
}
console.log(`   ${same}/5 逐字节相同 ${diff.length ? "⚠️ 变了：" + diff.join(" · ") : "✅"}`);

if (code !== 0) {
  console.log(`\n❌ 段 B 失败（现场前 3000 字）：\n${text.slice(0, 3000)}`);
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
