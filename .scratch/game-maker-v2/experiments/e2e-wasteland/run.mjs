// 票 23：**从 fixture 真跑到站点一次**（n=1）。
//
// ⚠️ 它驱动的是**出货的 CLI 入口**（`packages/cli/dist/cli.js` 的 `run`）—— 参数解析、R9 那个检查点、
//   两段、站点那一步，全是真的。不是把库函数拼一遍。
//
// ⚠️ **为什么注入 fetch 而不是改 `game-maker.local.json`**（人类 2026-10-09 裁定「暂不修改」）：
//   配置里 `image.proxy` 写的是 `127.0.0.1:9098`，**那个口今天没人听**；本机 ClashX 在 `7890`。
//   而 `IMAGE_ENV` 只有 protocol/baseUrl/apiKey/model —— **根本没有 proxy 这一项**，
//   env 覆盖**换不掉代理**。于是只剩一条路：注入 `deps.fetchImpl`（它**优先于**配置里的代理，
//   见 `packages/assets/src/ops.ts:1041`）—— 这正是**票 16** 用过的那条。
//   ⇒ 「这一次跑的到底是哪条路」是读数的一部分，下面会逐字打出来。
// ⚠️ **按 URL 分流**：文本上游在本机（`http://127.0.0.1:15721`，直连），生图那条是 https 走代理。
//   不分流会把本机的明文请求也塞进代理，openssl 当场报 `wrong version number`（票 16 第一次就这么挂的）。
//
// 跑法：node .scratch/game-maker-v2/experiments/e2e-wasteland/run.mjs
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
const OUT = path.join(HERE, "raw", "run-out");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const lines = [];
const errors = [];
const io = { out: (s) => void lines.push(s), err: (s) => void errors.push(s) };
const t0 = Date.now();
console.log("票 23 —— 从 fixture 真跑到站点");
console.log(`  style : fixtures/e2e/wasteland-platformer/style.png（借 halt-dusk.png，有意错配）`);
console.log(`  intent: fixtures/e2e/wasteland-platformer/intent.md（§27 逐字节）`);
console.log(`  out   : ${path.relative(ROOT, OUT)}`);
console.log(`  生图走: https → ${PROXY}（注入 fetchImpl）· http → 直连`);
console.log(`  账上自报的协议，跑完在下面对账\n`);

const code = await run(
  ["create", "--style", STYLE, "--intent", INTENT, "--out", OUT, "--yes", "--json", "--concurrency", "3"],
  io,
  { fetchImpl: doFetch, env: process.env, cwd: ROOT },
);
const ms = Date.now() - t0;

const text = lines.join("") + errors.join("");
fs.writeFileSync(path.join(HERE, "raw", "run.json"),
  JSON.stringify({ code, ms, text, steps: errors.filter((l) => l.startsWith("  · ")) }, null, 1));

console.log(`\n退出码 ${code} · 墙钟 ${(ms / 1000).toFixed(1)}s`);
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
