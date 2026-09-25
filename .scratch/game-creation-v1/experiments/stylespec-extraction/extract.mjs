// 参考图 → StyleSpec（票 15）。**这不是管线代码** —— R11 把这一步定成
// 「人在 Claude Code 会话里的一次交互」，管线只消费产出的文件。
// 所以本脚本是**可复跑的操作记录**，不是 packages/ 里的一个功能。
//
// 它刻意 import 真契约（packages/contracts/dist），不另写一份 schema。
import fs from "node:fs";
import path from "node:path";
import { StyleSpecSchema } from "../../../../packages/contracts/dist/index.js";

const B = process.env.ANTHROPIC_BASE_URL, K = process.env.ANTHROPIC_AUTH_TOKEN;
const [imgPath, runsArg, modeArg] = process.argv.slice(2);
const runs = Number(runsArg ?? 5);
const thinking = modeArg === "thinking";   // 默认关；`thinking` 打开

const b64 = fs.readFileSync(imgPath).toString("base64");

// docs/文档.md 第 12 节列了 12 个维度，但我们的契约只有 11 个字段（UI / Rendering /
// Perspective 都归并了）。prompt 按**契约的字段**要，不按文档的维度要 —— 否则会拿到
// schema 里没有的键（会被 Zod 静默剥掉，人却以为提取到了）。
import { PROMPT } from "./prompt.mjs";

const stripFences = (s) => s.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
const lowerHex = (s) => s.replace(/#[0-9A-Fa-f]{6}\b/g, (h) => h.toLowerCase());

async function call() {
  const body = { model: "deepseek-v4-pro", max_tokens: 6000, messages: [{ role: "user", content: [
    { type: "image", source: { type: "base64", media_type: "image/png", data: b64 } },
    { type: "text", text: PROMPT }] }] };
  if (!thinking) body.thinking = { type: "disabled" };
  const t0 = Date.now();
  const r = await fetch(`${B}/v1/messages`, { method: "POST",
    headers: { "content-type": "application/json", "x-api-key": K }, body: JSON.stringify(body) });
  const j = await r.json();
  const raw = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("").trim();
  return { ms: Date.now() - t0, http: r.status, raw, model: j.model, usage: j.usage, stop: j.stop_reason };
}

const results = [];
for (let i = 1; i <= runs; i++) {
  const r = await call();
  let obj = null, parseErr = null;
  try { obj = JSON.parse(stripFences(r.raw)); } catch (e) { parseErr = e.message; }

  // ⚠️ 两次校验：**原样**过一遍，**规范化后**再过一遍。
  //    两者的差就是「票 24 那条小写规范化」到底在挡什么 —— 这是本票要暴露的。
  const rawRes = obj ? StyleSpecSchema.safeParse(obj) : null;
  const normRes = obj ? StyleSpecSchema.safeParse(JSON.parse(lowerHex(JSON.stringify(obj)))) : null;

  const rec = { run: i, ms: r.ms, http: r.http, model: r.model, usage: r.usage, stop: r.stop,
    parse: parseErr ? "FAIL: " + parseErr : "ok", obj,
    rawValid: rawRes ? rawRes.success : null,
    normValid: normRes ? normRes.success : null,
    rawErr: rawRes && !rawRes.success ? rawRes.error.issues.slice(0, 3).map((x) => `${x.path.join(".")}: ${x.message}`) : null };
  results.push(rec);

  const pal = obj?.palette ?? [];
  const upper = pal.filter((h) => /#[0-9A-F]/.test(h)).length;
  console.log(`[${i}/${runs}] ${(r.ms/1000).toFixed(1)}s HTTP${r.http} model=${r.model} stop=${r.stop} ` +
    `parse=${rec.parse === "ok" ? "ok" : "FAIL"} 原样过schema=${rec.rawValid} 规范化后=${rec.normValid}`);
  console.log(`     palette ${pal.length} 色，其中 ${upper} 个含大写   confidence=${obj?.confidence}`);
  if (rec.rawErr) console.log(`     ✗ 原样不过的原因：${rec.rawErr.join(" | ")}`);
}

const outDir = path.join(import.meta.dirname, "out");
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString();
const tag = `${thinking ? "thinking" : "nothink"}-${runs}x`;
fs.writeFileSync(path.join(outDir, `runs.${tag}.json`),
  JSON.stringify({ image: imgPath, model: "deepseek-v4-pro", thinking, prompt: PROMPT, at: stamp, results }, null, 2) + "\n");

const okRaw = results.filter((r) => r.rawValid).length;
const okNorm = results.filter((r) => r.normValid).length;
const okParse = results.filter((r) => r.parse === "ok").length;
console.log(`\n── 小结（${tag}）──`);
console.log(`解析成功 ${okParse}/${runs} · 原样过 schema ${okRaw}/${runs} · 规范化后过 schema ${okNorm}/${runs}`);
console.log(`中位延迟 ${(results.map((r) => r.ms).sort((a, b) => a - b)[Math.floor(runs / 2)] / 1000).toFixed(1)}s`);
console.log(`→ ${path.relative(process.cwd(), path.join(outDir, `runs.${tag}.json`))}`);
