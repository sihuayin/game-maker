// 探测：视觉路径（/v1/messages）认不认 `thinking:{"type":"disabled"}`。
// 票 15 说「跑 5 次稳定性测试前应该先知道答案，否则 5 次 × 61s = 5 分钟纯等待」。
import fs from "node:fs";

const B = process.env.ANTHROPIC_BASE_URL, K = process.env.ANTHROPIC_AUTH_TOKEN;
const img = process.argv[2] ?? "fixtures/reference/test.png";
const b64 = fs.readFileSync(img).toString("base64");

const ASK = `这张图里最显眼的三个颜色分别是什么？只回答 hex，形如 #rrggbb，用逗号分隔，不要其他任何字。`;

async function once(label, thinking) {
  const body = { model: "deepseek-v4-pro", max_tokens: 3000, messages: [{ role: "user", content: [
    { type: "image", source: { type: "base64", media_type: "image/png", data: b64 } },
    { type: "text", text: ASK }] }] };
  if (thinking) body.thinking = thinking;
  const t0 = Date.now();
  const r = await fetch(`${B}/v1/messages`, { method: "POST",
    headers: { "content-type": "application/json", "x-api-key": K }, body: JSON.stringify(body) });
  const j = await r.json();
  const txt = (j.content || []).filter(c => c.type === "text").map(c => c.text).join("").trim();
  console.log(`[${label}] HTTP ${r.status} ${((Date.now() - t0) / 1000).toFixed(1)}s  model=${j.model}  out_tok=${j.usage?.output_tokens}`);
  console.log(`    → ${txt.slice(0, 200).replace(/\n/g, " ")}`);
  return { ms: Date.now() - t0, txt, j };
}

await once("thinking 默认（开）", null);
await once("thinking disabled", { type: "disabled" });
