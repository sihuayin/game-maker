// 票 23：**第十七次真跑 · 补跑第五步**（2026-10-17 · ✅ 人已裁 **(甲) 只重跑 `plan`**）。
//
// ⚠️ 第十七跑的段 A 死在 `plan-assets`：`empty-input` ×3（数据丢了，不是 schema 错）。
//   前四步的产物在失败现场（票 55 的机制写的），本驱动**只重跑第五步**：
//     game-maker plan --design <失败现场>/game-design.json
//                     --visual-world <失败现场>/visual-world.json
//                     --out raw/plan-2026-10-17a
//   ⇒ **≤3 发文本 · 0 张图**。调的是 `planAssets` —— 与 `create` 第五步同一个函数、同一份提示词、
//     同一个 `playerAnimationGate`，不是手工拼现场。
//
// ⚠️ **正题**：模型这次写出来的背景层，是不是票 88 教的那副形状？
//   （`sky p0` · `wall p0.6 铺x` · `ground p1 铺x`；不平铺的层 parallax 必须是 0）
//
// ⚠️ 不重试、不修、不改代码 / fixture / 配置 / 端口 · 不动失败现场与旧检查点 · 不提交。
// 跑法：node .scratch/game-maker-v2/experiments/e2e-wasteland/plan-2026-10-17a.mjs
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const url = (p) => pathToFileURL(p).href;

const { run } = await import(url(path.join(ROOT, "packages/cli/dist/cli.js")));
const { auditLayerCoverage, layerDrawnSize, imageCallsOf } =
  await import(url(path.join(ROOT, "packages/contracts/dist/index.js")));

const FAIL = path.join(HERE, "raw", "run-out-2026-10-17a", ".failed-2026-10-17T02-49-08-832Z");
const DESIGN = path.join(FAIL, "game-design.json");
const VW = path.join(FAIL, "visual-world.json");
const OUT = path.join(HERE, "raw", "plan-2026-10-17a");
const JSON_OUT = path.join(HERE, "raw", "plan-2026-10-17a.json");
const LOG = path.join(HERE, "raw", "plan-2026-10-17a.log");
const OLD_RUN = path.join(HERE, "raw", "run-out-2026-10-13g", "ruined-city-scavenger", "run", "v1");

const FAIL_FILES = ["visual-world.json", "game-intent.json", "game-design.json", "character-dna.json", "style.png"];
const OLD_FILES = [
  "intent.md", "visual-world.json", "game-intent.json", "game-design.json",
  "character-dna.json", "asset-recipe.json", "stylespec.json", "ledger.json",
  "style.png", "reference.png",
];
const FIXTURE = path.join(ROOT, "fixtures/e2e/wasteland-platformer");
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

const failBefore = hashMap(FAIL, FAIL_FILES);
const oldBefore = hashMap(OLD_RUN, OLD_FILES);
const fixBefore = hashMap(FIXTURE, FIXTURE_FILES);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const lines = [];
const errors = [];
fs.writeFileSync(LOG, "");
const log = (s) => { process.stdout.write(s); fs.appendFileSync(LOG, s); };
const io = { out: (s) => void lines.push(s), err: (s) => { errors.push(s); log(s); } };
const t0 = Date.now();

const WALL_LIMIT_MS = 15 * 60 * 1000;
const guard = setTimeout(() => {
  const ms = Date.now() - t0;
  console.error(`\n\n⛔ 墙上时间到 ${(ms / 60000).toFixed(1)} 分钟 —— 退出。`);
  fs.writeFileSync(JSON_OUT, JSON.stringify({ code: "wall-clock-stop", ms, text: lines.join("") + errors.join("") }, null, 1));
  process.exit(3);
}, WALL_LIMIT_MS);
guard.unref?.();

console.log("票 23 —— 第十七次真跑 · **补跑第五步 `plan`**（≤3 发文本 · 0 张图）");
console.log(`  批准  : ✅ 人裁 2026-10-17「甲：只重跑 plan」`);
console.log(`  design: ${path.relative(ROOT, DESIGN)}（第十七跑的失败现场）`);
console.log(`  world : ${path.relative(ROOT, VW)}`);
console.log(`  out   : ${path.relative(ROOT, OUT)}`);
console.log(`  文本走: ${process.env["ANTHROPIC_BASE_URL"] ?? "（未设）"}（直连）`);
console.log(`  叫停  : ${WALL_LIMIT_MS / 60000} 分钟`);
console.log(`  正题  : ⭐ **背景层是不是票 88 教的那副形状**\n`);

const code = await run(
  ["plan", "--design", DESIGN, "--visual-world", VW, "--out", OUT, "--json"],
  io,
  { env: process.env, cwd: ROOT },
);
const ms = Date.now() - t0;
clearTimeout(guard);

const text = lines.join("") + errors.join("");
fs.writeFileSync(JSON_OUT, JSON.stringify({ code, ms, text }, null, 1));
console.log(`\n退出码 ${code} · 墙钟 ${(ms / 1000).toFixed(1)}s`);

const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };

// 找产物（plan 落在 <out>/<recipeId>/recipes/v<N>.json）
const recipes = [];
const rec = (p) => {
  let ents = [];
  try { ents = fs.readdirSync(p, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const full = path.join(p, e.name);
    if (e.isDirectory()) rec(full);
    else if (/^v\d+\.json$/.test(e.name) && full.includes("/recipes/")) recipes.push(full);
  }
};
rec(OUT);
console.log(`\n⭐ 产物：${recipes.length ? recipes.map((r) => path.relative(ROOT, r)).join(" · ") : "❌ 没有 recipe json"}`);

if (code === 0) {
  for (const rf of recipes) {
    const recipe = readJson(rf);
    const specs = (recipe?.assets ?? []).map((a) => a.spec ?? a);
    console.log(`\n⭐⭐ 正题（背景层形状）：${path.relative(ROOT, rf)} · ${specs.length} 件资源`);
    const bgs = specs.filter((s) => s.kind === "background");
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
      console.log(`   ⇒ 逐层配对：${layers.length === 0 ? "—（没有层）" : bad.length === 0 ? "✅ 全过" : `❌ ${bad.length} 层不合格`}`);
      if (typeof bg.size?.w === "number" && typeof bg.size?.h === "number" && layers.length > 0) {
        const viewport = { w: 480, h: 270 };
        const world = { w: 1440, h: 270 };
        const entries = layers.map((l, i) => ({
          where: `scene.background[${i}]`, name: `${bg.id}.${l.name}`, parallax: l.parallax,
          drawn: layerDrawnSize({ tileable: l.tileable, nominal: bg.size }, world),
        }));
        const issues = auditLayerCoverage(viewport, world, entries);
        console.log(`   ⇒ \`auditLayerCoverage\`（视口 480×270 · 世界 1440×270）：${issues.length === 0 ? "✅ 0 条 error" : `❌ ${issues.length} 条 error`}`);
        for (const e of issues) console.log(`      · ${e.message}`);
      }
    }

    // 票 61 / 票 89
    const design = readJson(DESIGN);
    const playerId = design?.player?.id;
    const mine = specs.filter((s) => s.characterId === playerId);
    const animMine = mine.filter((s) => s.kind === "animation");
    const one = animMine.length === 1 ? animMine[0] : null;
    const names = (one?.animations ?? []).map((x) => x.name);
    const WANT = ["idle", "run", "jump"];
    const short = (one?.animations ?? []).filter((x) => x.frames < 2).map((x) => x.name);
    const dups = specs.flatMap((s) => {
      const ns = (s.animations ?? []).map((x) => x.name);
      return ns.filter((n, i) => ns.indexOf(n) !== i).map((n) => `${s.id}:${n}`);
    });
    console.log(`\n⭐ 票 61 闸门 / 票 89 唯一性（player.id=${JSON.stringify(playerId)}）：`);
    console.log(`   ① 恰好一件 animation … ${animMine.length === 1 ? "✅ 1 件" : `❌ ${animMine.length} 件`}`);
    console.log(`   ② idle/run/jump ……… ${one && WANT.every((n) => names.includes(n)) ? "✅" : `❌ 缺 ${JSON.stringify(WANT.filter((n) => !names.includes(n)))}`}（实际 ${JSON.stringify(names)}）`);
    console.log(`   ③ 每路 ≥2 帧 ………… ${short.length === 0 ? (one ? "✅" : "—") : `❌ ${JSON.stringify(short)}`}`);
    console.log(`   票 89 名字唯一 ……… ${dups.length === 0 ? "✅" : `❌ ${JSON.stringify(dups)}`}`);
    const c = imageCallsOf(recipe);
    console.log(`   ⚠️ imageCalls（预测，不是闸）：${JSON.stringify(c)}`);
  }
  const doc = JSON.parse(lines.join(""));
  const d = doc.data ?? {};
  console.log(`\n账（plan 那一步）：${JSON.stringify(d.ledger ?? null)}`);
}

// 阴性
console.log(`\n⭐ 阴性（失败现场五份未变）：${(() => { const bad = checkHashes(FAIL, failBefore); return bad.length === 0 ? `✅ ${failBefore.size}/${failBefore.size}` : `❌ ${bad.join(" · ")}`; })()}`);
console.log(`⭐ 阴性（旧检查点 13g 十份未变）：${(() => { const bad = checkHashes(OLD_RUN, oldBefore); return bad.length === 0 ? `✅ ${oldBefore.size}/${oldBefore.size}` : `❌ ${bad.join(" · ")}`; })()}`);
console.log(`⭐ 阴性（fixture 三份未变）：${(() => { const bad = checkHashes(FIXTURE, fixBefore); return bad.length === 0 ? `✅ ${fixBefore.size}/${fixBefore.size}` : `❌ ${bad.join(" · ")}`; })()}`);

let gen = 0, mas = 0;
const countPng = (p) => {
  let ents = [];
  try { ents = fs.readdirSync(p, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const full = path.join(p, e.name);
    if (e.isDirectory()) countPng(full);
    else if (e.name.endsWith(".png")) {
      if (full.includes("/authoring/generated/")) gen++;
      else if (full.includes("/authoring/masters/")) mas++;
    }
  }
};
countPng(OUT);
console.log(`⭐ 生成图：generated/ ${gen} · masters/ ${mas}（应当是 0 / 0）`);

if (code !== 0) {
  console.log(`\n❌ plan 失败（现场前 2500 字）：\n${text.slice(0, 2500)}`);
  process.exit(1);
}
