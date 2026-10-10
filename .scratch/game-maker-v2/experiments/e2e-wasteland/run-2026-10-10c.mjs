// 票 23：**从 fixture 真跑到站点一次**（第六次真跑 · 2026-10-10c）。
//
// 与 `run-2026-10-10b.mjs`（第五跑）**逐行相同，只差输出路径** —— 人类 2026-10-10 批的第 6 跑。
// 设置一个字不改：同一个 style/intent · `--concurrency 2` · 150 分钟叫停 · 注入 fetchImpl 绕开 9098。
//
// ⚠️ **开跑前的已知风险（不藏）**：
//   探针 ⑥ 量到 `character-dna` 在**第五跑那份 design 输入**上是 **9/9 确定性失败**
//   （`characters[2].id` 与 `player` 同名 `scavenger` —— 上游 `GameDesignSpec` 的
//   `player`/`enemies`/`npcs` 三个数组**各查各的**，跨数组重名没人验）。
//   ⚠️ 但它量的是**给定那份输入**下的确定性，不是「每一跑都会撞」——
//   `compile-design` 每跑**重新生成** design，而第三跑这一步是 `attempts: 1` 一次过。
//   ⇒ 这一跑**有真实机会**过第 4 步；不过的话**在花钱之前**就死（pack 段才花钱）。
//
// ⚠️ 为什么要另开一个文件而不是重跑第五跑那个：那个脚本开头 `fs.rmSync(OUT)` +
//   覆写 `raw/run-2026-10-10b.json`，会把**第五跑的失败记录**抹掉。那一份是探针 ⑥ 的原始依据，不能毁。
//
// 跑法：node .scratch/game-maker-v2/experiments/e2e-wasteland/run-2026-10-10c.mjs
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
const OUT = path.join(HERE, "raw", "run-out-2026-10-10c");
const JSON_OUT = path.join(HERE, "raw", "run-2026-10-10c.json");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const lines = [];
const errors = [];
const LOG = path.join(HERE, "raw", "run-2026-10-10c.log");
fs.writeFileSync(LOG, "");
const log = (s) => { process.stdout.write(s); fs.appendFileSync(LOG, s); };
const io = { out: (s) => void lines.push(s), err: (s) => { errors.push(s); log(s); } };
const t0 = Date.now();

// ── 150 分钟硬叫停（裁定 Q2）────────────────────────────────────────────────
const WALL_LIMIT_MS = 150 * 60 * 1000;
const guard = setTimeout(() => {
  const ms = Date.now() - t0;
  console.error(`\n\n⛔ 墙上时间到 ${(ms / 60000).toFixed(1)} 分钟（裁定 Q2 的 150 分钟叫停线）—— 退出。`);
  fs.writeFileSync(JSON_OUT, JSON.stringify(
    { code: "wall-clock-stop", ms, text: lines.join("") + errors.join(""),
      steps: errors.filter((l) => l.startsWith("  · ")) }, null, 1));
  process.exit(3);
}, WALL_LIMIT_MS);
guard.unref?.();

console.log("票 23 —— 从 fixture 真跑到站点（第六次 · 2026-10-10c）");
console.log(`  style : fixtures/e2e/wasteland-platformer/style.png（借 halt-dusk.png，有意错配）`);
console.log(`  intent: fixtures/e2e/wasteland-platformer/intent.md（§27 逐字节）`);
console.log(`  out   : ${path.relative(ROOT, OUT)}（⚠️ 不动第四/第五跑那些字节）`);
console.log(`  生图走: https → ${PROXY}（注入 fetchImpl）· http → 直连`);
console.log(`  并发  : --concurrency 2 ⇒ **text 2 / image 2**（裁定原话是 image 2；CLI 只能一起设）`);
console.log(`  叫停  : ${WALL_LIMIT_MS / 60000} 分钟\n`);

const code = await run(
  ["create", "--style", STYLE, "--intent", INTENT, "--out", OUT, "--yes", "--json", "--concurrency", "2"],
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

// ⚠️ 失败时 ledger 不落盘（§四.2 那条注）⇒ 「花掉几张」只能数文件。
const countFiles = (dir, ext) => {
  try { return fs.readdirSync(dir).filter((f) => f.endsWith(ext)).length; } catch { return 0; }
};
const genRoot = path.join(OUT);
const walk = (d) => {
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
  rec(d);
  return { gen, mas };
};
const billed = walk(genRoot);
const ledgerCount = (() => {
  let n = 0;
  const rec = (p) => {
    let ents = [];
    try { ents = fs.readdirSync(p, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (e.isDirectory()) rec(path.join(p, e.name));
      else if (e.name === "ledger.json") n++;
    }
  };
  rec(genRoot);
  return n;
})();
console.log(`\n📊 花掉几张：generated/ ${billed.gen} 张 + masters/ ${billed.mas} 张 = ${billed.gen + billed.mas} 张（数文件）`);
console.log(`   ledger.json 落盘数：${ledgerCount}（=0 说明是失败跑 ⇒ 账上没有，只能数文件）`);

if (code !== 0) {
  console.log(`\n❌ 失败现场（前 2500 字）：\n${text.slice(0, 2500)}`);
  process.exit(1);
}
const doc = JSON.parse(lines.join(""));
const d = doc.data ?? {};
console.log(`\n游戏 id：${d.gameId} · run v${d.runVersion} · 包 v${d.packVersion}`);
console.log(`run：${d.runDir}\n包：${d.packDir}\n配置：${d.config}\n站点：${d.siteDir}`);
console.log(`歧义条数：${(d.ambiguity ?? []).length} · **生图资产数：${d.imageAssetCount}**`);
