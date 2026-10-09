// 票 23 的探针：**意图那一步到底吐了什么**。
// 票 16（2026-10-08）与本次（2026-10-09）都死在同一格：`analyze-intent` 三发全 `schema`。
// 本探针把**原始请求体与原始响应体**落下来 —— 账只记「病因」，不记「吐了什么」，
// 而没有原始输出就没法判断这是「模型不听话」还是「提示词骨架教错了」。
//
// 跑法：node .scratch/game-maker-v2/experiments/e2e-wasteland/intent-raw-probe.mjs
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const url = (p) => pathToFileURL(p).href;

const { analyzeIntent } = await import(url(path.join(ROOT, "packages/game-design/dist/index.js")));

const RAW = path.join(HERE, "raw", "intent-raw");
fs.rmSync(RAW, { recursive: true, force: true });
fs.mkdirSync(RAW, { recursive: true });

const requirementText = fs.readFileSync(path.join(ROOT, "fixtures/e2e/wasteland-platformer/intent.md"), "utf8");

let n = 0;
const doFetch = async (u, init) => {
  n += 1;
  const id = String(n).padStart(2, "0");
  fs.writeFileSync(path.join(RAW, `${id}.request.json`), String(init?.body ?? ""));
  const res = await fetch(u, init);
  const text = await res.text();
  fs.writeFileSync(path.join(RAW, `${id}.response.json`), text);
  return new Response(text, { status: res.status, headers: res.headers });
};

const t0 = Date.now();
try {
  const out = await analyzeIntent({
    requirementText,
    transport: { baseUrl: process.env["ANTHROPIC_BASE_URL"], apiKey: process.env["ANTHROPIC_AUTH_TOKEN"] },
    fetchImpl: doFetch,
  });
  console.log(`✅ 过了契约 · ${Date.now() - t0}ms · 往返 ${n} 次`);
  console.log(JSON.stringify(out.spec, null, 1).slice(0, 1500));
} catch (e) {
  console.log(`❌ ${e.name} · ${Date.now() - t0}ms · 往返 ${n} 次`);
  console.log(`failure=${e.failure}`);
  console.log(String(e.message).slice(0, 1200));
  console.log(`\n原始往返落在 ${path.relative(ROOT, RAW)}/（成对 ${n} 组）`);
}

// 把每一发的工具入参摊出来给人看
for (const f of fs.readdirSync(RAW).filter((x) => x.endsWith(".response.json")).sort()) {
  const doc = JSON.parse(fs.readFileSync(path.join(RAW, f), "utf8"));
  const tools = (doc.content ?? []).filter((c) => c.type === "tool_use");
  console.log(`\n${f}  stop=${doc.stop_reason}  model=${doc.model}  usage=${JSON.stringify(doc.usage)}`);
  for (const t of tools) console.log(`  tool=${t.name} input=${JSON.stringify(t.input).slice(0, 600)}`);
}
