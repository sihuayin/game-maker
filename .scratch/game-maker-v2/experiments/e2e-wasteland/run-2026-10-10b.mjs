// 票 23：**从 fixture 真跑到站点一次**（第五次真跑 · 2026-10-10b）。
//
// 与 `run-2026-10-10.mjs`（第四跑）**逐行相同，只差输出路径** —— 这是人类裁的 (a)「直接重跑」：
// 探针 ⑤ 量到这一步首发成功率 ≈ 2/6，第四跑 3 发全灭 ≈ 30% 概率，属运气差而非回归
// ⇒ 原样再来一次，**设置一个字不改**（style/intent 不变 · `--concurrency 2` · 150 分钟叫停）。
//
// ⚠️ 为什么要另开一个文件而不是重跑第四跑那个：第四跑那个脚本开头 `fs.rmSync(OUT)` +
// 覆写 `raw/run-2026-10-10.json`，会把**第四跑的失败记录**（3 发 schema 全灭的 ledger）抹掉。
// 那一份是探针 ⑤ 的原始依据，不能毁。
//
// 跑法：node .scratch/game-maker-v2/experiments/e2e-wasteland/run-2026-10-10b.mjs
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
const OUT = path.join(HERE, "raw", "run-out-2026-10-10b");
const JSON_OUT = path.join(HERE, "raw", "run-2026-10-10b.json");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const lines = [];
const errors = [];
const LOG = path.join(HERE, "raw", "run-2026-10-10b.log");
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

console.log("票 23 —— 从 fixture 真跑到站点（第五次 · 2026-10-10b · 第四跑的原样重试）");
console.log(`  style : fixtures/e2e/wasteland-platformer/style.png（借 halt-dusk.png，有意错配）`);
console.log(`  intent: fixtures/e2e/wasteland-platformer/intent.md（§27 逐字节）`);
console.log(`  out   : ${path.relative(ROOT, OUT)}（⚠️ 不动第四跑那些字节）`);
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

if (code !== 0) {
  console.log(`\n❌ 失败现场（前 2500 字）：\n${text.slice(0, 2500)}`);
  process.exit(1);
}
const doc = JSON.parse(lines.join(""));
const d = doc.data ?? {};
console.log(`\n游戏 id：${d.gameId} · run v${d.runVersion} · 包 v${d.packVersion}`);
console.log(`run：${d.runDir}\n包：${d.packDir}\n配置：${d.config}\n站点：${d.siteDir}`);
console.log(`歧义条数：${(d.ambiguity ?? []).length} · **生图资产数：${d.imageAssetCount}**`);
