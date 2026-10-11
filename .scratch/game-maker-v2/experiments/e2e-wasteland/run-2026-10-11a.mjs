// 票 23：**第七次真跑 · 段 A**（2026-10-11 · 人类批准「只批段 A」）。
//
// 段 A = `create` **不带 `--yes`** ⇒ 理解层跑完、到清单为止**停下**（退出码 0 · `data.status = "awaiting"`）。
//   ⚠️ **0 张图** —— `pack` 段根本不在这一段的代码路径里。花的只有文本（正常 5 发）。
//   ⚠️ 这是第六跑那一轮 Q2 裁定的落点：「恢复两段流程（不带 --yes 停在检查点 · 批准后 build）」。
//
// 并发：`--concurrency-image 2`（裁定 Q3 的字面）· 文本**不给** ⇒ 走引擎默认 4。
//   ⚠️ 票 41 之前 CLI **只能把 text 与 image 一起设** ⇒ 留了驱动的那几跑（第四/五/六）是
//     `--concurrency 2` ⇒ text 2 / image 2，**文本被一起拉低了**（更早的第三跑是 `--concurrency 3`）。
//
// ⚠️ 与 `run-2026-10-10c.mjs` 的差别只有三处：**去掉 `--yes`** · 换 `--concurrency-image 2` · 换输出路径。
//   前六跑的字节一个不碰（它们各自的脚本负责各自的目录）。
//
// 跑法：node .scratch/game-maker-v2/experiments/e2e-wasteland/run-2026-10-11a.mjs
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
const OUT = path.join(HERE, "raw", "run-out-2026-10-11a");
const JSON_OUT = path.join(HERE, "raw", "run-2026-10-11a.json");
const LOG = path.join(HERE, "raw", "run-2026-10-11a.log");
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

console.log("票 23 —— 第七次真跑 · **段 A**（create 到检查点为止 · 0 张图）");
console.log(`  style : fixtures/e2e/wasteland-platformer/style.png（借 halt-dusk.png，有意错配）`);
console.log(`  intent: fixtures/e2e/wasteland-platformer/intent.md（§27 逐字节）`);
console.log(`  out   : ${path.relative(ROOT, OUT)}（⚠️ 不动前六跑那些字节）`);
console.log(`  文本走: http://127.0.0.1:15721（ANTHROPIC_BASE_URL，直连）· https → ${PROXY}`);
console.log(`  并发  : --concurrency-image 2 ⇒ **text 4（默认）/ image 2**（裁定 Q3 的字面）`);
console.log(`  叫停  : ${WALL_LIMIT_MS / 60000} 分钟\n`);

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
console.log(`\n👉 段 B 的入口（等批准）：`);
console.log(`   node -e '…run(["build","${d.runDir}","--concurrency-image","2","--json"], …)'`);
