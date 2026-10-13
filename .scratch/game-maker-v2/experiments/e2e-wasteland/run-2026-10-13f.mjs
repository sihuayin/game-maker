// 票 23：**第十三次真跑 · 段 A**（2026-10-13 · ✅ **人已批准**，原话「**批段 A**」）。
//
// ⚠️ **这一跑要问的是一句话**：**票 61 那条闸门，在一份真跑出来的清单上，成不成立？**
//   —— 闸门已经在夹具上验过（9 条判据），但**真跑上一次都没执行过**。
//
// 段 A = `create` **不带 `--yes`** ⇒ 理解层跑完、到清单为止**停下**（退出码 0 · `data.status = "awaiting"`）。
//   ⚠️ **0 张图** —— `pack` 段根本不在这一段的代码路径里。花的只有文本（上界 15 发）。
//
// ⚠️ **为什么不是「只跑段 B」**（报告 §七）：票 61 的闸门挂在 `planAssets` = **段 A 的第五步**，
//   而 `build`（段 B）**不跑那一步**（它读盘上那份 `asset-recipe.json`）。盘上那份旧清单
//   **正是那条缝的形状**（`characterId: "player"` 名下三件 `kind:"animation"`、三路里没有 `run`）
//   ⇒ 只跑段 B 会让 `config` 再死一次，而第十二跑已经量过那次失败（退 4 · 200.8s · 14 张图照买）。
//
// ⚠️ **预算**（报告 §二）：图片 **0** · 文本 **≤15 发**（5 步 × `STRUCTURED_CALL_ATTEMPTS`=3）·
//   **150 分钟硬叫停**。⚠️ **全仓没有任何「调用预算」机制** —— 唯一真实现的闸是下面那个 `setTimeout`。
//   ⚠️ 票 61 那条闸门把 `plan-assets` 变成了一步**可能重采样**的地方（今天它一直首发过）——
//      这是段 A 文本量从「五步各一发」变成「最坏五步各三发」的直接后果。
//
// ⚠️ **失败就如实失败**：不重试、不修、不自动往下走（R13）。任何一步抛 ⇒ 让它抛，现场照既有机制落盘。
// ⚠️ **不改任何代码 / 不改任何端口状态 / 不启动段 B / 不生成任何图片 / 不动前十跑与旧检查点的字节。**
//
// 跑法：node .scratch/game-maker-v2/experiments/e2e-wasteland/run-2026-10-13f.mjs
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
const OUT = path.join(HERE, "raw", "run-out-2026-10-13f");
const JSON_OUT = path.join(HERE, "raw", "run-2026-10-13f.json");
const LOG = path.join(HERE, "raw", "run-2026-10-13f.log");
const OLD_RUN = path.join(HERE, "raw", "run-out-2026-10-13d", "ruined-city-scavenger", "run", "v1");

// ⚠️ 只清**本跑自己的**目录；旧检查点与前十跑那些字节一个不碰。
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

console.log("票 23 —— 第十三次真跑 · **段 A**（create 到检查点为止 · 0 张图）");
console.log(`  style : fixtures/e2e/wasteland-platformer/style.png（借 halt-dusk.png，有意错配）`);
console.log(`  intent: fixtures/e2e/wasteland-platformer/intent.md`);
console.log(`  out   : ${path.relative(ROOT, OUT)}（⚠️ 不动旧检查点与前十跑的字节）`);
console.log(`  文本走: http://127.0.0.1:15721（直连）· https → ${PROXY}`);
console.log(`  并发  : --concurrency-image 2 ⇒ **text 4（默认）/ image 2**`);
console.log(`  叫停  : ${WALL_LIMIT_MS / 60000} 分钟（⚠️ 唯一的闸 —— 没有调用预算机制）`);
console.log(`  正题  : **票 61 那条闸门，在真跑上成不成立**\n`);

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
console.log(`\n📊 生成图：generated/ ${billed.gen} · masters/ ${billed.mas}（段 A 应当是 0 / 0）`);

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

// ⭐ 验收 §四.1（**本跑的正题**）—— 票 61 那条闸门：玩家那件长什么样
//   判据四条，与 `ops.ts:188` 的 `playerAnimationGate` 逐条对齐（**不是抄它的实现，是照它的判据看**）。
const recipeFiles = findFiles("asset-recipe.json");
const designFiles = findFiles("game-design.json");

console.log(`\n⭐ 验收 §四.1（**票 61 的闸门在真跑上成不成立**）：`);
if (designFiles.length === 0) console.log(`   —— 没落到 game-design.json（没走到设计层）`);
if (recipeFiles.length === 0) console.log(`   —— 没落到 asset-recipe.json（没走到 plan-assets）`);

for (const rf of recipeFiles) {
  const recipe = readJson(rf);
  const d = designFiles.length ? unwrap(readJson(designFiles[0])) : null;
  const playerId = d?.player?.id;
  console.log(`   ${path.relative(ROOT, rf)}`);
  console.log(`   design.player.id = ${JSON.stringify(playerId)}`);

  const all = (recipe?.assets ?? []).map((a) => a.spec ?? a);
  const mine = all.filter((s) => s.characterId === playerId);
  console.log(`   \`characterId === design.player.id\` 的资产一共 **${mine.length}** 件：`);
  for (const s of mine) {
    const anims = (s.animations ?? []).map((x) => `${x.name}:${x.frames}`);
    console.log(`     · ${String(s.id).padEnd(20)} kind=${String(s.kind).padEnd(11)} anims=${JSON.stringify(anims)}`);
  }

  const animMine = mine.filter((s) => s.kind === "animation");
  const one = animMine.length === 1 ? animMine[0] : null;
  const names = new Set((one?.animations ?? []).map((x) => x.name));
  const WANT = ["idle", "run", "jump"];
  const short = one ? (one.animations ?? []).filter((x) => x.frames < 2).map((x) => x.name) : [];

  console.log(`   ── 闸门四条（\`playerAnimationGate\`：ops.ts:188 · 调用点 :314）：`);
  console.log(`      ① 恰好一件 \`kind:"animation"\`   … ${animMine.length === 1 ? "✅ 1 件" : `❌ ${animMine.length} 件`}`);
  console.log(`      ② \`animations[]\` 三路齐备        … ${one && WANT.every((n) => names.has(n)) ? "✅ idle/run/jump 都在" : `❌ 缺 ${JSON.stringify(WANT.filter((n) => !names.has(n)))}`}（实际：${JSON.stringify([...names])}）`);
  console.log(`      ③ 每路 ≥2 帧                      … ${short.length === 0 ? (one ? "✅" : "—（没有那一件，②已红）") : `❌ ${JSON.stringify(short)}`}`);
  console.log(`      ④ characterId 严格等于玩家 id      … ${mine.length > 0 ? "✅ 认得出（上面那几件就是）" : "❌ 一件都没写着这个 id"}`);
  const pass = animMine.length === 1 && WANT.every((n) => names.has(n)) && short.length === 0;
  console.log(`   ⇒ ${pass ? "✅ **闸门放行**（这一跑的正题：成立）" : "❌ **闸门会拦**（这一跑的正题：不成立 —— 上面红的那几条就是它的病）"}`);
}

// ⭐ 验收 §四.3 —— 票 60 / 票 55 的两只容器（照 13d 读法，原样保留）
for (const [file, what] of [
  ["design-attempts.json", "票 55 的容器（设计层**抛出**时才写）"],
  ["visual-world-attempts.json", "票 60 的容器（第一步**抛出**时才写）"],
]) {
  const hits = findFiles(file);
  console.log(`\n⭐ ${what}：`);
  if (hits.length === 0) {
    console.log(`   —— 没有这个文件。⚠️ 走到检查点 = 没抛 = 本来是**预期**；`);
    console.log(`      但若本跑**死在**那一步却没有它 ⇒ 那是异常，照记不藏。`);
  }
  for (const f of hits) {
    const c = unwrap(readJson(f));
    console.log(`   ${path.relative(ROOT, f)} —— ${(c?.attempts ?? []).length} 发`);
    for (const a of c?.attempts ?? []) {
      console.log(`     · #${a.attempt} outcome=${a.outcome} · response=${JSON.stringify(a.response ?? null)}`);
      if (a.detail) console.log(`        detail: ${String(a.detail).slice(0, 300)}`);
    }
  }
}

// ⭐ 验收 §四.7 —— 账（段 A 那五步各几发、有没有重采样）
const ledgers = findFiles("ledger.json");
console.log(`\n⭐ 验收 §四.7（账 —— 段 A 的五步各几发）：`);
for (const f of ledgers) {
  const j = readJson(f);
  const calls = j?.calls ?? [];
  console.log(`   ${path.relative(ROOT, f)} —— ${calls.length} 发`);
  let round = 0;
  for (const c of calls) {
    round += c.attempts ?? 1;
    console.log(`     · ${String(c.step).padEnd(17)} ${String(c.target ?? "").padEnd(12)} attempts=${c.attempts}` +
      (c.failures?.length ? ` failures=${JSON.stringify(c.failures)}` : "") +
      (c.usage ? ` usage=${JSON.stringify(c.usage)}` : ""));
  }
  console.log(`   ⇒ 真往返合计 **${round} 发**（上界 15：5 步 × STRUCTURED_CALL_ATTEMPTS=3）`);
}

// ⭐ 阴性 —— 旧检查点一个字节没动
console.log(`\n⭐ 阴性（报告 §四.8）—— 旧检查点（13d）还在吗：`);
console.log(`   ${fs.existsSync(OLD_RUN) ? "✅ 在（本跑只在 run-out-2026-10-13f/ 里跑）" : "❌ 不见了"}`);
if (fs.existsSync(OLD_RUN)) {
  const r = readJson(path.join(OLD_RUN, "asset-recipe.json"));
  const all = (r?.assets ?? []).map((a) => a.spec ?? a);
  const mine = all.filter((s) => s.characterId === "player" && s.kind === "animation");
  console.log(`   旧清单里玩家的 animation 资产仍是 **${mine.length}** 件（${JSON.stringify(mine.map((s) => s.id))}）⇒ 与票 61 立案时一致，没被本跑改写`);
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
console.log(`\n⭐ 生图调用数（imageCalls，票 40 之后与 pack 同一把尺子）—— **段 B 的预算要读它**：${JSON.stringify(d.imageCalls)}`);
console.log(`   明细：${JSON.stringify(d.imageCallBreakdown)}`);
console.log(`   清单件数（按 source.kind）：${JSON.stringify(d.kinds)}`);
console.log(`\n歧义条数：${(d.ambiguity ?? []).length}`);
for (const a of d.ambiguity ?? []) console.log(`   ⚠️ ${a}`);
console.log(`\n👉 段 B 的入口（⚠️ 要**另出报告 + 另行同意** —— 报告 §八(甲)）：`);
console.log(`   build ${path.relative(ROOT, d.runDir)} --concurrency-image 2 --json`);
