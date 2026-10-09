// 票 34 的判据：改名**之后**，真的 `analyzeIntent` 在真上游上还吐不吐字符串。
//
// 票 23 那次真跑死在这里（三发全 `schema`，`coreLoop: expected array, received string`）。
// 本探针走**出厂的那份** `analyzeIntent`（`packages/game-design/dist/`，与 CLI 消费的是同一份），
// 输入就是 fixture 的 `intent.md` 逐字节，运输层是**真上游** —— 不是复刻请求，是真调用。
//
// 跑法：node .scratch/game-maker-v2/experiments/e2e-wasteland/intent-after-rename-probe.mjs
import fs from "node:fs";
import path from "node:path";
import { analyzeIntent, AnalyzeIntentError } from "../../../../packages/game-design/dist/analyze-intent.js";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const RAW = path.join(HERE, "raw", "after-rename");
fs.rmSync(RAW, { recursive: true, force: true });
fs.mkdirSync(RAW, { recursive: true });

const requirementText = fs.readFileSync(path.join(ROOT, "fixtures/e2e/wasteland-platformer/intent.md"), "utf8");
const transport = { baseUrl: process.env["ANTHROPIC_BASE_URL"] ?? "", apiKey: process.env["ANTHROPIC_AUTH_TOKEN"] ?? "" };
if (!transport.baseUrl || !transport.apiKey) {
  console.error("⚠️ 缺上游凭据：ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN");
  process.exit(2);
}

const t0 = Date.now();
// ⚠️ 包一层 fetch 把**上游原文**留下来：只看 `spec` 是「过了契约之后」的样子，
/// 看不到模型究竟吐的是数组还是字符串 —— 而这一票问的正是后者。
let n = 0;
const tee = async (url, init) => {
  const res = await fetch(url, init);
  const txt = await res.text();
  n += 1;
  fs.writeFileSync(path.join(RAW, `${String(n).padStart(2, "0")}.request.json`), String(init?.body ?? ""));
  fs.writeFileSync(path.join(RAW, `${String(n).padStart(2, "0")}.response.json`), txt);
  return new Response(txt, { status: res.status, statusText: res.statusText, headers: res.headers });
};

try {
  const r = await analyzeIntent({ requirementText, transport, fetchImpl: tee });
  const ms = Date.now() - t0;
  fs.writeFileSync(path.join(RAW, "result.json"), JSON.stringify(r, null, 1));
  console.log(`✅ 过契约（${ms}ms）`);
  console.log(`   coreLoopSteps：${JSON.stringify(r.spec.coreLoopSteps)}`);
  console.log(`   形状：${Array.isArray(r.spec.coreLoopSteps) ? "array" : typeof r.spec.coreLoopSteps}` +
    ` · ${r.spec.coreLoopSteps.length} 条`);
  console.log(`   账：${JSON.stringify(r.ledger ?? null)}`);
} catch (e) {
  const ms = Date.now() - t0;
  fs.writeFileSync(path.join(RAW, "error.json"), JSON.stringify(
    { name: e?.name, message: e?.message, failure: e?.failure, ledger: e?.ledger }, null, 1));
  console.log(`❌ 没成（${ms}ms）：${e?.message}`);
  if (e instanceof AnalyzeIntentError) console.log(`   failures：${JSON.stringify(e.ledger?.map((c) => c.failures))}`);
  process.exit(1);
}
