// 票 23：**第十七次真跑 · 段 A**（2026-10-17 · ✅ **人已批准** —— 原话「批段 A」）。
//
// ⚠️ **这一跑要问的是一句话**：**模型这次写出来的背景层，是不是票 88 改完的那副形状？**
//   票 76 量到「段 A 教 sky p0.3 不铺 · 段 B 教世界宽 1440」，票 65 的判据说这两样配在一起必拒；
//   票 88 已把段 A 的样板换成数据并改正（`sky p0` · `wall p0.6 铺x` · `ground p1 铺x`）。
//   旧检查点 13g 是票 88 **施工之前**的产物 ⇒ 拿它跑段 B 只会重放那 2 条已知 error。
//   ⇒ **本跑是「模型读了会不会照做」的第一个真跑窗口。**
//
// ⚠️ **段 A = `create` 不带 `--yes`** ⇒ 理解层五步跑完、到清单为止停下（退出码 0 · `status: "awaiting"`）。
//   **0 张图**（`pack` 不在这一段的路径里）· **≤15 发文本**（5 步 × STRUCTURED_CALL_ATTEMPTS=3）·
//   **150 分钟硬叫停**（唯一真实现的闸）。
//
// ⚠️ **失败就如实失败**：不重试、不修、不自动往下走（R13）。任何一步抛 ⇒ 让它抛。
// ⚠️ **不改代码 / 不改 fixture / 不跑段 B / 不买图 / 不改任何端口状态 / 不动旧检查点 · 不提交。**
//
// 跑法：node .scratch/game-maker-v2/experiments/e2e-wasteland/run-2026-10-17a.mjs
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const url = (p) => pathToFileURL(p).href;

const { run } = await import(url(path.join(ROOT, "packages/cli/dist/cli.js")));
const { createProxyFetch } = await import(url(path.join(ROOT, "packages/assets/dist/index.js")));
const { auditLayerCoverage, layerDrawnSize, imageCallsOf } =
  await import(url(path.join(ROOT, "packages/contracts/dist/index.js")));

const PROXY = process.env["E2E_PROXY"] ?? "http://127.0.0.1:7890";
const direct = fetch;
const proxied = createProxyFetch({ proxy: PROXY });
const doFetch = (u, init) => (/^https:/i.test(String(u)) ? proxied : direct)(u, init);

const FIXTURE = path.join(ROOT, "fixtures/e2e/wasteland-platformer");
const STYLE = path.join(FIXTURE, "style.png");
const INTENT = path.join(FIXTURE, "intent.md");
const OUT = path.join(HERE, "raw", "run-out-2026-10-17a");
const JSON_OUT = path.join(HERE, "raw", "run-2026-10-17a.json");
const LOG = path.join(HERE, "raw", "run-2026-10-17a.log");
const OLD_RUN = path.join(HERE, "raw", "run-out-2026-10-13g", "ruined-city-scavenger", "run", "v1");

const OLD_FILES = [
  "intent.md", "visual-world.json", "game-intent.json", "game-design.json",
  "character-dna.json", "asset-recipe.json", "stylespec.json", "ledger.json",
  "style.png", "reference.png",
];
const FIXTURE_FILES = ["intent.md", "style.png", "README.md"];

const sha = (p) => createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const hashMap = (dir, files) => new Map(files.map((f) => [f, sha(path.join(dir, f))]));
const checkHashes = (dir, before) => {
  const bad = [];
  for (const [f, h] of before) {
    const now = fs.existsSync(path.join(dir, f)) ? sha(path.join(dir, f)) : "(不见了)";
    if (now !== h) bad.push(`${f} => ${now.slice(0, 12)}（原 ${h.slice(0, 12)}）`);
  }
  return bad;
};

const oldBefore = hashMap(OLD_RUN, OLD_FILES);
const fixBefore = hashMap(FIXTURE, FIXTURE_FILES);

// ⚠️ 只清**本跑自己的**目录；旧检查点与旧现场一个字节不碰。
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const lines = [];
const errors = [];
fs.writeFileSync(LOG, "");
const log = (s) => { process.stdout.write(s); fs.appendFileSync(LOG, s); };
const io = { out: (s) => void lines.push(s), err: (s) => { errors.push(s); log(s); } };
const t0 = Date.now();

// ── 150 分钟硬叫停（报告 §三②，**唯一真实现的闸**）─────────────────────────
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

console.log("票 23 —— 第十七次真跑 · **段 A**（create 到检查点为止 · 0 张图）");
console.log(`  批准  : ✅ 人裁 2026-10-17「批段 A」`);
console.log(`  style : fixtures/e2e/wasteland-platformer/style.png`);
console.log(`  intent: fixtures/e2e/wasteland-platformer/intent.md`);
console.log(`  out   : ${path.relative(ROOT, OUT)}（⚠️ 不动旧检查点与旧现场）`);
console.log(`  文本走: ${process.env["ANTHROPIC_BASE_URL"] ?? "（未设）"}（直连）· https（生图）→ ${PROXY}`);
console.log(`  并发  : --concurrency-image 2 ⇒ text 4（默认）/ image 2（本段无生图）`);
console.log(`  叫停  : ${WALL_LIMIT_MS / 60000} 分钟（⚠️ 唯一的闸 —— 没有调用预算机制）`);
console.log(`  正题  : ⭐ **模型写出来的背景层，是不是票 88 教的那副形状**\n`);

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

const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
const unwrap = (raw) => raw?.design ?? raw?.spec ?? raw?.data ?? raw;
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
console.log(`\n📊 生成图：generated/ ${billed.gen} · masters/ ${billed.mas}（段 A 应当是 0 / 0）`);

// ⭐ 验收 §四.0 —— 五步走到检查点
const vw = findFiles("visual-world.json");
console.log(`\n⭐ 验收 §四.0（第一步活下来了吗）：`);
console.log(`   visual-world.json … ${vw.length ? `✅ 在（${path.relative(ROOT, vw[0])}）` : "❌ 没落"}`);
if (vw.length) {
  const w = unwrap(readJson(vw[0]));
  console.log(`     顶层 palette：${Array.isArray(w?.palette) ? "❌ array" : w?.palette === undefined ? "— 缺席" : `✅ ${typeof w.palette}（${Object.keys(w.palette ?? {}).length} 键）`}`);
  console.log(`     format / styleIdentity：${w?.format === undefined ? "❌ format 缺席" : "✅ format"} · ${w?.styleIdentity === undefined ? "❌ styleIdentity 缺席" : "✅ styleIdentity"}`);
}

// ⭐ 验收 §四.1 / §四.2 —— **本跑的正题**：背景层形状 + 生产判据重放
const recipeFiles = findFiles("asset-recipe.json");
const designFiles = findFiles("game-design.json");

console.log(`\n⭐⭐ 验收 §四.1（**本跑的正题**：背景层形状）：`);
if (recipeFiles.length === 0) console.log(`   ❌ 没落到 asset-recipe.json（没走到 plan-assets）`);
for (const rf of recipeFiles) {
  const recipe = readJson(rf);
  const specs = (recipe?.assets ?? []).map((a) => a.spec ?? a);
  const bgs = specs.filter((s) => s.kind === "background");
  console.log(`   ${path.relative(ROOT, rf)} · 背景资源 ${bgs.length} 件`);
  for (const bg of bgs) {
    console.log(`   ── ${bg.id} · size=${JSON.stringify(bg.size)}`);
    const layers = bg.layers ?? [];
    layers.forEach((l, i) => {
      const tiled = l.tileable?.x === true;
      const suspect = !tiled && l.parallax !== 0;
      console.log(`      [${i}] ${String(l.name).padEnd(14)} parallax=${String(l.parallax).padEnd(4)} ` +
        `铺x=${tiled ? "✅" : "❌"} ${suspect ? "⚠️ **不平铺且 parallax ≠ 0 ⇒ 判据会拒**" : ""}`);
    });
    const bad = layers.filter((l) => l.tileable?.x !== true && l.parallax !== 0);
    console.log(`   ⇒ 逐层配对（不平铺 ⇒ p0）：${layers.length === 0 ? "—（没有层）" : bad.length === 0 ? "✅ 全过" : `❌ ${bad.length} 层不合格`}`);

    // §四.2 —— 拿生产判据重放（世界 1440 是骨架那个数 = 压力测试口径）
    if (typeof bg.size?.w === "number" && typeof bg.size?.h === "number") {
      const viewport = { w: 480, h: 270 };
      const world = { w: 1440, h: 270 };
      const entries = layers.map((l, i) => ({
        where: `scene.background[${i}]`,
        name: `${bg.id}.${l.name}`,
        parallax: l.parallax,
        drawn: layerDrawnSize({ tileable: l.tileable, nominal: bg.size }, world),
      }));
      const issues = auditLayerCoverage(viewport, world, entries);
      console.log(`   ⇒ \`auditLayerCoverage\`（视口 480×270 · 世界 1440×270 · 标称 ${bg.size.w}×${bg.size.h}）：` +
        `${issues.length === 0 ? "✅ 0 条 error" : `❌ ${issues.length} 条 error`}`);
      for (const e of issues) console.log(`      · ${e.message}`);
    } else {
      console.log(`   ⇒ 跳过判据重放：这件背景没有可读的 size`);
    }
  }
}

// ⭐ 验收 §四.4 / §四.5 —— 票 61 的闸门 + 票 89 的唯一性
console.log(`\n⭐ 验收 §四.4 / §四.5（票 61 闸门 · 票 89 动画名唯一性）：`);
for (const rf of recipeFiles) {
  const recipe = readJson(rf);
  const d = designFiles.length ? unwrap(readJson(designFiles[0])) : null;
  const playerId = d?.player?.id;
  const specs = (recipe?.assets ?? []).map((a) => a.spec ?? a);
  const mine = specs.filter((s) => s.characterId === playerId);
  const animMine = mine.filter((s) => s.kind === "animation");
  const one = animMine.length === 1 ? animMine[0] : null;
  const names = (one?.animations ?? []).map((x) => x.name);
  const WANT = ["idle", "run", "jump"];
  const short = (one?.animations ?? []).filter((x) => x.frames < 2).map((x) => x.name);
  const dup = (s) => {
    const ns = (s.animations ?? []).map((x) => x.name);
    return ns.filter((n, i) => ns.indexOf(n) !== i);
  };
  console.log(`   design.player.id = ${JSON.stringify(playerId)} · characterId 命中的资产 ${mine.length} 件 · animation ${animMine.length} 件`);
  console.log(`      ① 恰好一件 animation      … ${animMine.length === 1 ? "✅ 1 件" : `❌ ${animMine.length} 件`}`);
  console.log(`      ② idle/run/jump 三路齐备   … ${one && WANT.every((n) => names.includes(n)) ? "✅" : `❌ 缺 ${JSON.stringify(WANT.filter((n) => !names.includes(n)))}`}（实际 ${JSON.stringify(names)}）`);
  console.log(`      ③ 每路 ≥2 帧               … ${short.length === 0 ? (one ? "✅" : "—") : `❌ ${JSON.stringify(short)}`}`);
  const dups = specs.flatMap((s) => dup(s).map((n) => `${s.id}:${n}`));
  console.log(`      票 89 动画名唯一            … ${dups.length === 0 ? "✅" : `❌ ${JSON.stringify(dups)}`}`);
}

// ⭐ 验收 §四.6 —— 账
const ledgers = findFiles("ledger.json");
console.log(`\n⭐ 验收 §四.6（账 —— 段 A 的五步各几发）：`);
for (const f of ledgers) {
  const j = readJson(f);
  const calls = j?.calls ?? [];
  let round = 0;
  console.log(`   ${path.relative(ROOT, f)} —— ${calls.length} 发`);
  for (const c of calls) {
    round += c.attempts ?? 1;
    console.log(`      · ${String(c.step).padEnd(17)} attempts=${c.attempts}` +
      (c.failures?.length ? ` failures=${JSON.stringify(c.failures)}` : ""));
  }
  console.log(`   ⇒ 真往返合计 **${round} 发**（上界 15）`);
}
for (const rf of recipeFiles) {
  const recipe = readJson(rf);
  const c = imageCallsOf(recipe);
  console.log(`   ⚠️ imageCalls（**预测，不是闸**）：${JSON.stringify(c)}`);
}

// ⭐ 阴性 —— 旧检查点 / fixture / 段 A 只产理解层
console.log(`\n⭐ 阴性 ⑦（旧检查点 13g 逐字节没动）：`);
{
  const bad = checkHashes(OLD_RUN, oldBefore);
  console.log(`   ${bad.length === 0 ? `✅ ${oldBefore.size}/${oldBefore.size} 逐字节未变` : `❌ ${bad.join(" · ")}`}`);
}
console.log(`\n⭐ 阴性 ⑧（fixture 三份没动）：`);
{
  const bad = checkHashes(FIXTURE, fixBefore);
  console.log(`   ${bad.length === 0 ? `✅ ${fixBefore.size}/${fixBefore.size} 逐字节未变` : `❌ ${bad.join(" · ")}`}`);
}
console.log(`\n⭐ 阴性 ⑨（段 A 只许产理解层）：`);
for (const [what, p] of [
  ["pack/", path.join(OUT, "ruined-city-scavenger", "pack")],
  ["game-config.json", path.join(OUT, "ruined-city-scavenger", "run", "v1", "game-config.json")],
  ["qa-report.json", path.join(OUT, "ruined-city-scavenger", "run", "v1", "qa-report.json")],
  ["site/", path.join(OUT, "ruined-city-scavenger", "site")],
]) console.log(`   ${what} … ${fs.existsSync(p) ? "❌ 出现了（段 A 不该有）" : "✅ 不在"}`);

if (code !== 0) {
  console.log(`\n❌ 段 A 失败（现场前 2500 字）：\n${text.slice(0, 2500)}`);
  process.exit(1);
}

const doc = JSON.parse(lines.join(""));
const d = doc.data ?? {};
console.log(`\n✅ 检查点 —— 状态：${d.status}`);
console.log(`游戏 id：${d.gameId} · run v${d.runVersion}`);
console.log(`run 目录：${d.runDir}`);
console.log(`歧义条数：${(d.ambiguity ?? []).length}`);
