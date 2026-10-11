// 票 23：**第七次真跑 · 段 B**（2026-10-11 · ⚠️ **只有人类在检查点批了那个数之后才许跑**）。
//
// 段 B = `build <段 A 落下来的 run 目录>` ⇒ 生图 → 配置 → QA → 站点。
//   ⚠️ run 目录**从段 A 的 JSON 里读回来**（`raw/run-2026-10-11a.json` 的 `data.runDir`）——
//   不手打路径，免得打错一个字符就跑到别的 run 上。
//   ⚠️ 这也正是 Q2 要的形状：清单、风格、参考图、基因**一概从磁盘读回**（票 15 的 invariant 3）。
//
// 并发：`--concurrency-image 2`（同段 A）。
// ⚠️ **本脚本自己不检查授权** —— 授权是人给的，不是脚本给的。**没拿到那个字，别跑它。**
//
// 跑法：node .scratch/game-maker-v2/experiments/e2e-wasteland/run-2026-10-11b.mjs
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

const OUT = path.join(HERE, "raw", "run-out-2026-10-11a");        // 与段 A 同一个 out 根
const A_JSON = path.join(HERE, "raw", "run-2026-10-11a.json");
const JSON_OUT = path.join(HERE, "raw", "run-2026-10-11b.json");
const LOG = path.join(HERE, "raw", "run-2026-10-11b.log");

// ── run 目录从段 A 的读数里读回来 ───────────────────────────────────────────
const a = JSON.parse(fs.readFileSync(A_JSON, "utf8"));
const RUN_DIR = JSON.parse(a.text).data.runDir;
if (typeof RUN_DIR !== "string" || !fs.existsSync(RUN_DIR)) {
  console.error(`✗ 段 A 的 run 目录读不出来或不存在：${RUN_DIR}`);
  process.exit(1);
}
const manifest = path.join(RUN_DIR, "asset-recipe.json");
const planned = fs.existsSync(manifest)
  ? JSON.parse(fs.readFileSync(manifest, "utf8")).assets?.length ?? "?"
  : "（清单不在）";

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

console.log("票 23 —— 第七次真跑 · **段 B**（build：生图 → 配置 → QA → 站点）");
console.log(`  run   : ${path.relative(ROOT, RUN_DIR)}（从段 A 的 JSON 读回）`);
console.log(`  清单  : ${planned} 件`);
console.log(`  并发  : --concurrency-image 2 ⇒ text 4（默认）/ image 2`);
console.log(`  叫停  : ${WALL_LIMIT_MS / 60000} 分钟\n`);

const code = await run(
  ["build", RUN_DIR, "--out", OUT, "--json", "--concurrency-image", "2"],
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

// ⚠️ 失败时 pack 段的账不落盘 ⇒ 图钱只能数文件，而且**会少算**（第六跑 20 vs 21）。
const walkBilled = () => {
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
const billed = walkBilled();
console.log(`\n📊 花掉几张（数文件 · ⚠️ 会少算）：generated/ ${billed.gen} + masters/ ${billed.mas} = ${billed.gen + billed.mas}`);

if (code !== 0) {
  console.log(`\n❌ 段 B 失败（现场前 3000 字）：\n${text.slice(0, 3000)}`);
  process.exit(1);
}
const d = JSON.parse(lines.join("")).data ?? {};
console.log(`\n✅ 跑到站点 —— 游戏 id：${d.gameId} · run v${d.runVersion} · 包 v${d.packVersion}`);
console.log(`run：${d.runDir}\n包：${d.packDir}\n配置：${d.config}\n站点：${d.siteDir}`);
