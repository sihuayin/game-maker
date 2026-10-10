// 票 23：**从 fixture 真跑到站点一次**（第四次真跑 · 2026-10-10）。
//
// 这个文件是 `run.mjs` 的**兄弟**，不是它的替代 —— 只差三处，逐条写在下面（其余逐行照抄 `run.mjs`）：
//
//   ① **输出落新目录**：`raw/run-out-2026-10-10/` + `raw/run-2026-10-10.json`。
//      ⚠️ `run.mjs` 开头那句 `fs.rmSync(OUT)` 会把 `raw/run-out/` 连同里面**前两次真跑的现场**
//      （`wasteland-scavenger-run/` 与 `wasteland-scavenger-assets/`，含第三跑的 16 份 drawlist JSON
//      与配方）一起删掉，并覆写 `raw/run.json`（第三跑的 stdout —— 解 §六 用的就是它）。
//      ⇒ 这一跑**不碰**那些字节。
//   ② **并发 `--concurrency 2`**（2026-10-10 人类裁定 Q3）。
//      ⚠️ 出货 CLI 那条 flag 是**两个上游一起设**的（`cli.ts:179` / `:446`：
//      `{ text: n, image: n }`，注释也自认「要分开调就用 API」）⇒ 这一跑是 **text 2 / image 2**，
//      裁定原话是「image 2」。**这是读数的一部分，别漏报。**
//   ③ **150 分钟硬叫停**（裁定 Q2）。到点**自己退出**、留档、不继续花钱。
//      ⚠️ 到点那一刻在途的那几笔拦不住（与 `pack.ts` 那道闸同一个道理），但**不会再发新的**。
//
// 跑法：node .scratch/game-maker-v2/experiments/e2e-wasteland/run-2026-10-10.mjs
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
const OUT = path.join(HERE, "raw", "run-out-2026-10-10");
const JSON_OUT = path.join(HERE, "raw", "run-2026-10-10.json");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const lines = [];
const errors = [];
// ⚠️ 与 `run.mjs` 差的第 ④ 处（很小，但为了**边跑边看**）：进度行**同时**打到终端**与一份日志**。
const LOG = path.join(HERE, "raw", "run-2026-10-10.log");
fs.writeFileSync(LOG, "");
const log = (s) => { process.stdout.write(s); fs.appendFileSync(LOG, s); };
const io = { out: (s) => void lines.push(s), err: (s) => { errors.push(s); log(s); } };
const t0 = Date.now();

// ── ③ 150 分钟硬叫停 ────────────────────────────────────────────────────────
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

console.log("票 23 —— 从 fixture 真跑到站点（第四次 · 2026-10-10）");
console.log(`  style : fixtures/e2e/wasteland-platformer/style.png（借 halt-dusk.png，有意错配）`);
console.log(`  intent: fixtures/e2e/wasteland-platformer/intent.md（§27 逐字节）`);
console.log(`  out   : ${path.relative(ROOT, OUT)}（⚠️ 不动 raw/run-out/）`);
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
