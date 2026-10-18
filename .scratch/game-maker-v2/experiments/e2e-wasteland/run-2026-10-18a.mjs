// 票 107：玩家重设计 · **付费跑**（1 母版 + idle/run/jump；每张最多 3 次、全局 ≤12 发、30 分钟硬停）。
// 人裁逐字：「批准 107 付费跑：4 张 / ≤12 发 / 30 分钟」。
// ⚠️ 失败不隐藏重试、不自动往下走；失败就如实失败并留下账。本脚本不碰 v1、不改配置。
// 跑法：node .scratch/game-maker-v2/experiments/e2e-wasteland/run-2026-10-18a.mjs
import fs from "node:fs";
import path from "node:path";
// ⚠️ 先 `pnpm build`（脚本读 dist）。
import { pathToFileURL } from "node:url";
import path from "node:path";
const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const A = await import(pathToFileURL(path.join(ROOT, "packages/assets/dist/index.js")).href);
const C = await import(pathToFileURL(path.join(ROOT, "packages/contracts/dist/index.js")).href);
const { buildAssetPack, createGeminiGenerator, createProxyFetch, resolveImageTransport } = A;
const { parseRecipe } = C;
const RUN = path.join(HERE, "raw/run-out-2026-10-18a/wasteland-scavenger-assets/run/v1");
const OUT = path.join(HERE, "raw/run-out-2026-10-18a");
const PROXY = "http://127.0.0.1:7890";
const MAX_TRIPS = 12;
const WALL_MS = 30 * 60 * 1000;

const recipeRaw = JSON.parse(fs.readFileSync(path.join(RUN, "asset-recipe.json"), "utf8"));
const parsed = parseRecipe(recipeRaw);
if (!parsed.ok) throw new Error("recipe invalid: " + parsed.errors.join(" / "));
const style = JSON.parse(fs.readFileSync(path.join(RUN, "stylespec.json"), "utf8"));
const dna = JSON.parse(fs.readFileSync(path.join(RUN, "character-dna.json"), "utf8"));

const cfg = resolveImageTransport({ env: process.env, cwd: ROOT });
if (!cfg.transport) throw new Error("没有生图凭据：" + cfg.warnings.join("；"));
if (cfg.transport.protocol !== "gemini") throw new Error("本次只走 gemini，配置是 " + cfg.transport.protocol);
console.log(`上游：${cfg.transport.protocol} · ${cfg.transport.baseUrl} · ${cfg.transport.model ?? "(默认)"}；代理 ${PROXY}；预算 ≤${MAX_TRIPS} 发 / 30 分钟`);

const proxyFetch = createProxyFetch({ proxy: PROXY });
let trips = 0;
const fetchImpl = async (url, init) => {
  if (trips >= MAX_TRIPS) {
    console.error(`⛔ 预算上限 ${MAX_TRIPS} 发 —— 停止，不再重试`);
    return new Response(JSON.stringify({ error: { message: "BUDGET_CAP_REACHED" } }), { status: 400, headers: { "content-type": "application/json" } });
  }
  trips += 1;
  console.log(`  · 第 ${trips} 发`);
  return proxyFetch(url, init);
};
const gen = createGeminiGenerator({
  baseUrl: cfg.transport.baseUrl, apiKey: cfg.transport.apiKey,
  ...(cfg.transport.model ? { model: cfg.transport.model } : {}),
  attempts: 3, fetchImpl,
});

const starter = Date.now();
const timer = setTimeout(() => { console.error("⛔ 30 分钟硬停"); process.exit(3); }, WALL_MS);
const ledger = [];
let result;
try {
  result = await buildAssetPack({
    recipe: parsed.value, style, recipeDir: RUN, outDir: OUT,
    generate: () => { throw new Error("这分配方里没有 drawlist 资源"); },
    generateImage: (req, report) => gen(req, report),
    characterDna: dna,
    ledger,
  });
} catch (e) {
  clearTimeout(timer);
  console.error("✗ 付费跑失败：", e instanceof Error ? e.message : String(e));
  console.error("已发出的调用：", JSON.stringify(ledger, null, 1));
  process.exit(1);
}
clearTimeout(timer);
console.log(`✓ 完成 · 墙钟 ${((Date.now() - starter) / 1000).toFixed(1)}s · 实际发出 ${trips} 发`);
console.log("账：", ledger.map((c) => `${c.step}:${c.target}:attempts=${c.attempts}`).join(" · "));
console.log("包：", result.packDir);
console.log("图像调用：", JSON.stringify(result.imageCalls.map((c) => ({ asset: c.assetId, master: c.master, attempts: c.attempts, size: c.requestedSize })), null, 1));
