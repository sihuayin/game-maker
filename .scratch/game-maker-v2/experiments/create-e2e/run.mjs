// 票 16 的 E2E 探针：**真跑一次 `create --yes`**（n=1，人类授权的）。
//
// ⚠️ 它驱动的是**出货的 CLI 入口**（`packages/cli` 的 `run`），不是把库函数拼一遍 ——
//   参数解析、检查点、两段、站点那一步，全都是真的。
// ⚠️ **生图那一路借一条能通的代理**：`game-maker.local.json` 里那条（9098）跑这一次时没开，
//   而 CLI 的 `deps.fetchImpl` **优先于**配置里的代理（`imageGeneratorFor` 的规矩）⇒ 借它。
//   ⚠️ 「探针跑的其实是哪条路」是读数的一部分 —— 下面会打出来。
//
// 跑法：node .scratch/game-maker-v2/experiments/create-e2e/run.mjs
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const url = (p) => pathToFileURL(p).href;

const { run } = await import(url(path.join(ROOT, "packages/cli/dist/cli.js")));
const { createProxyFetch, formatSpentCalls } = await import(url(path.join(ROOT, "packages/assets/dist/index.js")));

const PROXY = process.env["E2E_PROXY"] ?? "http://127.0.0.1:7890";
// ⚠️ **按 URL 分流**：文本上游在本机（`http://127.0.0.1:15721`，直连就行），
//   而生图那条（`generativelanguage.googleapis.com`）要走代理 —— 第一次跑就是没分流，
//   把本机那条明文请求也塞进代理，于是 openssl 报 `wrong version number`（0.0s 就挂）。
const direct = fetch;
const proxied = createProxyFetch({ proxy: PROXY });
const doFetch = (url, init) => (/^https:/i.test(String(url)) ? proxied : direct)(url, init);
const OUT = path.join(HERE, "raw", "out");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const style = path.join(ROOT, "fixtures/reference/halt-dusk.png");
if (!fs.existsSync(style)) throw new Error(`参考图不在：${style}`);
const INTENT =
  "做一个废土横版寻宝游戏：玩家在天黑前翻过废弃都市的屋顶与铁轨，收集净水与废料，避开游荡的变异体，抵达安全区闸门。";

const lines = [];
const errors = [];
const io = { out: (s) => void lines.push(s), err: (s) => void errors.push(s) };
const t0 = Date.now();
console.log(`票 16 E2E —— 真跑一次 create --yes（代理 ${PROXY}）`);
console.log(`参考图：${path.relative(ROOT, style)} · 需求：${INTENT.slice(0, 30)}…\n`);

const code = await run(
  ["create", "--style", style, "--intent", INTENT, "--out", OUT, "--yes", "--json", "--concurrency", "3"],
  io,
  { fetchImpl: doFetch, env: process.env, cwd: ROOT },
);
const ms = Date.now() - t0;

const text = lines.join("") + errors.join("");
const rec = { code, ms, text, steps: errors.filter((l) => l.startsWith("  · ")) };
fs.writeFileSync(path.join(HERE, "raw", "e2e.json"), JSON.stringify(rec, null, 2));

console.log(`退出码 ${code} · 墙钟 ${(ms / 1000).toFixed(1)}s`);
console.log(`步：${rec.steps.map((s) => s.trim()).join(" → ") || "（没走到）"}`);
if (code !== 0) {
  console.log(`\n失败：\n${text.slice(0, 2000)}`);
} else {
  const doc = JSON.parse(lines.join(""));
  const d = doc.data ?? {};
  console.log(`\n游戏 id：${d.gameId} · run v${d.runVersion} · 包 v${d.packVersion}`);
  console.log(`run：${d.runDir} · 包：${d.packDir} · 配置：${d.config} · 站点：${d.siteDir}`);
  console.log(`歧义条数：${(d.ambiguity ?? []).length} · 生图资产数：${d.imageAssetCount}`);
  const tree = (p, depth = 0) => fs.readdirSync(p, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() && depth < 2 ? [`${"  ".repeat(depth)}${e.name}/`, ...tree(path.join(p, e.name), depth + 1)] : []);
  console.log(`\n产物树（前两层）：\n${fs.readdirSync(path.join(OUT, d.gameId)).sort().map((d2) => `  ${d2}`).join("\n")}`);
  const pack = path.join(OUT, d.packDir);
  console.log(`包内：${fs.readdirSync(pack).sort().join(" · ")} · 包内 authoring/：${fs.readdirSync(path.join(pack, "authoring")).sort().join(" · ")}`);
  console.log(`站点入口在不在：${fs.existsSync(path.join(OUT, d.siteDir, "index.html"))}`);
  console.log(`run 里那九项：${fs.readdirSync(path.join(OUT, d.runDir)).sort().join(" · ")}`);
  const ledger = JSON.parse(fs.readFileSync(path.join(OUT, d.runDir, "ledger.json"), "utf8"));
  console.log(`\n链级的账（run/v${d.runVersion}/ledger.json）：`);
  for (const [step, c] of Object.entries(ledger.run.byStep)) console.log(`  ${step.padEnd(18)} calls=${c.calls} attempts=${c.attempts}`);
  console.log(`  墙钟 ${(ledger.run.wallClockMs / 1000).toFixed(1)}s · 账龄 ${ledger.createdAt}`);
}
console.log(`\n⚠️ 原始输出落在 raw/e2e.json`);
